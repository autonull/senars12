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
    private readyAt = 0;

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.id = config.id;
        const cfg = config.config as unknown as IRCConnectionConfig;
        const nick = cfg.nick ?? 'senars';
        this.name = nick;
        this.ircConfig = {
            server: cfg.server ?? 'localhost',
            port: cfg.port ?? 6667,
            nick,
            username: cfg.username ?? nick,
            realname: cfg.realname ?? nick,
            password: cfg.password ?? '',
            channels: cfg.channels ?? ['#senars'],
            tls: cfg.tls ?? false,
            sasl: cfg.sasl ?? false,
            autoReconnect: cfg.autoReconnect ?? true,
            autoReconnectMaxRetries: cfg.autoReconnectMaxRetries ?? 10,
            floodProtectionDelay: cfg.floodProtectionDelay ?? 2000,
            floodProtectionMaxPending: cfg.floodProtectionMaxPending ?? 2,
            pingTimeout: cfg.pingTimeout ?? 60,
        };
    }

    override async connect(): Promise<void> {
        if (this.state === 'connected') return;
        this.setState('connecting');

        return new Promise((resolve, reject) => {
            const {port, username, realname, password, channels, tls, sasl, autoReconnectMaxRetries, server, nick} = this.ircConfig;

            this.client = new irc.Client(server, nick, {
                port, userName: username, realName: realname, password: password || undefined,
                channels, secure: tls, selfSigned: false, certExpired: false, sasl,
                floodProtection: false, stripColors: true, autoConnect: false, autoRejoin: false,
                retryCount: autoReconnectMaxRetries, retryDelay: 2000,
            });

            const failTimeout = setTimeout(() => { reject(new Error('Connection timeout')); this.dispose(); }, 10000);

            this.client.on('registered', () => {
                clearTimeout(failTimeout);
                this.connected = true;
                this.scheduleJoin();
                this.startQueueDrain();
                this.logger.info(`IRC connected to ${server}`);
                resolve();
            });

            this.client.on('error', (err) => this.handleError(this.createError(err.message, 'IRC_ERROR', true, err)));
            this.client.on('message', (from, to, text) => this.handleMessage(this.createMessage(from, text, {channel: to.startsWith('#') ? to : undefined})));
            this.client.on('close', () => {
                this.connected = false;
                if (this.state === 'connected') {
                    this.setState('disconnected');
                    if (this.ircConfig.autoReconnect) this.scheduleReconnect();
                }
            });
            this.client.on('reconnecting', (d) => this.logger.info(`Reconnecting... attempt ${d.attempt}`));
            this.client.connect();
        });
    }

    override async disconnect(reason: string = 'Goodbye'): Promise<void> {
        if (this.isDisconnected()) return;
        this.setState('disconnecting');
        this.stopQueueDrain();

        return new Promise((resolve) => {
            if (!this.client) return resolve();
            this.client.disconnect(reason, () => {
                this.dispose();
                resolve();
            });
        });
    }

    async send(target: string, text: string): Promise<void> {
        if (!this.connected || !this.client) return;
        if (Date.now() < this.readyAt) {
            this.messageQueue.push({target, message: text});
            return;
        }

        const pending = this.pendingMessages.get(target) ?? [];
        if (pending.length >= (this.ircConfig.floodProtectionMaxPending ?? 2)) {
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
        this.drainQueue();
    }

    private drainQueue(): void {
        while (this.messageQueue.length > 0) {
            const next = this.messageQueue[0];
            if (!next) break;
            const pending = this.pendingMessages.get(next.target) ?? [];
            if (pending.length >= (this.ircConfig.floodProtectionMaxPending ?? 3)) break;
            this.messageQueue.shift();
            this.dispatchMessage(next.target, next.message, pending);
        }
    }

    private startQueueDrain(): void {
        this.queueTimer = setInterval(() => this.drainQueue(), this.ircConfig.floodProtectionDelay);
    }

    private stopQueueDrain(): void {
        if (this.queueTimer) clearInterval(this.queueTimer);
        this.queueTimer = null;
    }

    private scheduleJoin(): void {
        if (!this.client) return;
        const channelDelay = (this.ircConfig.floodProtectionDelay ?? 2000) * (this.ircConfig.channels.length + 1);
        const joinWarmup = 5000;
        this.readyAt = Date.now() + channelDelay + joinWarmup;
        setTimeout(() => {
            this.setState('connected');
            this.ircConfig.channels.forEach(c => this.client?.join(c));
        }, channelDelay);
    }

    private scheduleReconnect(): void {
        this.withRetry(() => this.connect()).catch((err) =>
            this.handleError(this.createError('Max reconnect retries exceeded', 'RECONNECT_FAILED', false, err as Error))
        );
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