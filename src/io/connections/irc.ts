import irc, {Client as IRCClient} from 'irc';
import type {ConnectionConfig, ConnectionDeps} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger/index.js';

export interface IRCConnectionConfig {
    server: string;
    port: number;
    nick: string;
    username?: string;
    realname?: string;
    password?: string;
    channels: string[];
    tls?: boolean;
    sasl?: boolean;
    autoReconnect?: boolean;
    autoReconnectMaxRetries?: number;
    floodProtectionDelay?: number;
    floodProtectionMaxPending?: number;
    pingTimeout?: number;
}

export class IRCConnection extends BaseConnection {
    override readonly id: string;
    override readonly name: string;
    override readonly type = 'irc';
    override readonly logger = createLogger({scope: 'io:irc'});
    private client: IRCClient | null = null;
    private readonly ircConfig: IRCConnectionConfig;
    private pendingMessages: Map<string, string[]> = new Map();
    private messageQueue: Array<{ target: string; message: string }> = [];
    private queueTimer: ReturnType<typeof setInterval> | null = null;
    private connected = false;

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.id = config.id;
        const cfg = config.config as unknown as IRCConnectionConfig;
        this.name = cfg.nick ?? this.id;
        this.ircConfig = {
            server: cfg.server ?? 'localhost',
            port: cfg.port ?? 6667,
            nick: cfg.nick ?? 'senars',
            username: cfg.username ?? cfg.nick ?? 'senars',
            realname: cfg.realname ?? cfg.nick ?? 'senars',
            password: cfg.password ?? '',
            channels: cfg.channels ?? ['#senars'],
            tls: cfg.tls ?? false,
            sasl: cfg.sasl ?? false,
            autoReconnect: cfg.autoReconnect ?? true,
            autoReconnectMaxRetries: cfg.autoReconnectMaxRetries ?? 10,
            floodProtectionDelay: cfg.floodProtectionDelay ?? 1000,
            floodProtectionMaxPending: cfg.floodProtectionMaxPending ?? 3,
            pingTimeout: cfg.pingTimeout ?? 60,
        };
    }

    override async connect(): Promise<void> {
        if (this.state === 'connected') return;
        this.setState('connecting');

        return new Promise((resolve, reject) => {
            const options: irc.IClientOpts = {
                port: this.ircConfig.port,
                userName: this.ircConfig.username,
                realName: this.ircConfig.realname,
                password: this.ircConfig.password || undefined,
                channels: this.ircConfig.channels,
                secure: this.ircConfig.tls,
                selfSigned: false,
                certExpired: false,
                sasl: this.ircConfig.sasl,
                floodProtection: false,
                stripColors: true,
                autoConnect: false,
                autoRejoin: false,
                retryCount: this.ircConfig.autoReconnectMaxRetries,
                retryDelay: 2000,
            };

            this.client = new irc.Client(this.ircConfig.server, this.ircConfig.nick, options);

            const failTimeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
                this.dispose();
            }, 10000);

            this.client.on('registered', () => {
                clearTimeout(failTimeout);
                this.connected = true;
                this.setState('connected');
                this.scheduleJoin();
                this.startQueueDrain();
                this.logger.info(`IRC connected to ${this.ircConfig.server}`);
                resolve();
            });

            this.client.on('error', (err) => {
                this.handleError(this.createError(err.message, 'IRC_ERROR', true, err));
            });

            this.client.on('message', (channel: string, nick: string, text: string) => {
                this.handleMessage(this.createMessage(nick, text, {channel}));
            });

            this.client.on('close', () => {
                this.connected = false;
                if (this.state === 'connected') {
                    this.setState('disconnected');
                    this.scheduleReconnect();
                }
            });

            this.client.on('reconnecting', (details) => {
                this.logger.info(`Reconnecting... attempt ${details.attempt}`);
            });

            this.client.connect();
        });
    }

    override async disconnect(reason?: string): Promise<void> {
        if (this.state === 'disconnected' || this.state === 'idle') return;

        this.setState('disconnecting');
        this.stopQueueDrain();

        return new Promise((resolve) => {
            if (this.client) {
                this.client.disconnect(reason ?? 'Goodbye', () => resolve());
                this.dispose();
            } else {
                resolve();
            }
        });
    }

    async send(target: string, text: string): Promise<void> {
        if (!this.connected || !this.client) return;

        const pending = this.pendingMessages.get(target) ?? [];
        if (pending.length >= this.ircConfig.floodProtectionMaxPending!) {
            this.messageQueue.push({target, message: text});
            return;
        }

        this.dispatchMessage(target, text, pending);
    }

    private dispatchMessage(target: string, message: string, pending: string[]): void {
        if (!this.client) return;
        pending.push(message);
        this.pendingMessages.set(target, pending);
        this.client.say(target, message);

        setTimeout(() => this.completeDispatch(target, message), this.ircConfig.floodProtectionDelay);
    }

    private completeDispatch(target: string, message: string): void {
        const current = this.pendingMessages.get(target) ?? [];
        const idx = current.indexOf(message);
        if (idx >= 0) current.splice(idx, 1);
        this.pendingMessages.set(target, current);
        this.drainQueue();
    }

    private drainQueue(): void {
        while (this.messageQueue.length > 0) {
            const next = this.messageQueue[0];
            if (!next) break;
            const {target, message} = next;
            const pending = this.pendingMessages.get(target) ?? [];
            if (pending.length >= this.ircConfig.floodProtectionMaxPending!) break;
            this.messageQueue.shift();
            this.dispatchMessage(target, message, pending);
        }
    }

    private startQueueDrain(): void {
        this.queueTimer = setInterval(() => this.drainQueue(), this.ircConfig.floodProtectionDelay);
    }

    private stopQueueDrain(): void {
        if (this.queueTimer) {
            clearInterval(this.queueTimer);
            this.queueTimer = null;
        }
    }

    private scheduleJoin(): void {
        if (!this.client) return;
        const delay = this.ircConfig.floodProtectionDelay! * (this.ircConfig.channels.length + 1);
        setTimeout(() => {
            for (const channel of this.ircConfig.channels) {
                this.client?.join(channel);
            }
        }, delay);
    }

    private scheduleReconnect(): void {
        if (!this.ircConfig.autoReconnect) return;

        this.withRetry(() => this.connect()).catch((err) => {
            this.handleError(this.createError('Max reconnect retries exceeded', 'RECONNECT_FAILED', false, err as Error));
        });
    }

    private dispose(): void {
        this.stopQueueDrain();
        this.pendingMessages.clear();
        this.messageQueue = [];
        this.connected = false;
        if (this.client) {
            this.client.removeAllListeners();
            this.client = null;
        }
    }
}