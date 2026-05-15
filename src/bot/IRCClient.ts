import irc, {Client as IRCClient} from 'irc';
import {EventEmitter} from 'events';

export interface IRCClientConfig {
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

interface _IRCClientEvents {
    message: (channel: string, user: string, text: string, raw: string) => void;
    error: (error: Error) => void;
    connected: () => void;
    disconnected: () => void;
    reconnecting: (attempt: number, maxRetries: number) => void;
    join: (channel: string, nick: string) => void;
    nick: (oldNick: string, newNick: string) => void;
    part: (channel: string, nick: string, reason?: string) => void;
    quit: (nick: string, reason?: string) => void;
}

export class RealIRCClient extends EventEmitter {
    private client: IRCClient | null = null;
    private config: Required<IRCClientConfig>;
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private lastPingSent = 0;
    private pendingMessages: Map<string, string[]> = new Map();
    private messageQueue: Array<{ target: string; message: string }> = [];
    private queueTimer: ReturnType<typeof setInterval> | null = null;
    private connected = false;
    private disposed = false;

    constructor(config: IRCClientConfig) {
        super();
        this.config = {
            server: config.server,
            port: config.port,
            nick: config.nick,
            username: config.username ?? config.nick,
            realname: config.realname ?? config.nick,
            password: config.password ?? '',
            channels: config.channels,
            tls: config.tls ?? false,
            sasl: config.sasl ?? false,
            autoReconnect: config.autoReconnect ?? true,
            autoReconnectMaxRetries: config.autoReconnectMaxRetries ?? 10,
            floodProtectionDelay: config.floodProtectionDelay ?? 1000,
            floodProtectionMaxPending: config.floodProtectionMaxPending ?? 3,
            pingTimeout: config.pingTimeout ?? 60,
        };
    }

    async connect(): Promise<void> {
        if (this.disposed) throw new Error('Client already disposed');
        if (this.connected) return;

        return new Promise((resolve, reject) => {
            const options: irc.IClientOpts = {
                port: this.config.port,
                userName: this.config.username,
                realName: this.config.realname,
                password: this.config.password || undefined,
                channels: this.config.channels,
                secure: this.config.tls,
                selfSigned: false,
                certExpired: false,
                sasl: this.config.sasl,
                floodProtection: false,
                stripColors: true,
                autoConnect: false,
                autoRejoin: false,
                retryCount: this.config.autoReconnectMaxRetries,
                retryDelay: 2000,
            };

            this.client = new irc.Client(this.config.server, this.config.nick, options);

            const failTimeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
                this.dispose();
            }, 10000);

            this.client.on('registered', () => {
                clearTimeout(failTimeout);
                this.reconnectAttempt = 0;
                this.connected = true;
                this.emit('connected');
                this.scheduleJoin();
                this.startPingTimer();
                this.startQueueDrain();
                resolve();
            });

            const fwd = <T extends unknown[]>(event: string, handler: (...args: T) => void) => this.client!.on(event, handler as (...args: unknown[]) => void);
            fwd('error', (err) => this.emit('error', err instanceof Error ? err : new Error(String(err))));
            fwd('message', (channel: string, nick: string, text: string) => this.emit('message', channel, nick, text, `${nick}! PRIVMSG ${channel} :${text}`));
            fwd('pong', () => { this.lastPingSent = 0; });
            fwd('join', (channel: string, nick: string) => { if (nick !== this.config.nick) this.emit('join', channel, nick); });
            fwd('nick', (_old: string, _new: string) => this.emit('nick', _old, _new));
            fwd('part', (ch: string, nk: string, reason?: string) => this.emit('part', ch, nk, reason));
            fwd('quit', (nk: string, reason?: string) => this.emit('quit', nk, reason));

            this.client.on('close', () => {
                this.connected = false;
                this.stopPingTimer();
                this.stopQueueDrain();
                this.emit('disconnected');
                this.scheduleReconnect();
            });

            this.client.on('reconnecting', (details) => {
                this.emit('reconnecting', details.attempt ?? this.reconnectAttempt, this.config.autoReconnectMaxRetries);
            });

            this.client.connect();
        });
    }

    send(target: string, message: string): void {
        if (!this.connected || !this.client || this.disposed) return;

        const pending = this.pendingMessages.get(target) ?? [];
        if (pending.length >= this.config.floodProtectionMaxPending) {
            this.messageQueue.push({target, message});
            return;
        }

        this.dispatchMessage(target, message, pending);
    }

    isConnected(): boolean {
        return this.connected;
    }

    getNick(): string {
        return this.config.nick;
    }

    async disconnect(message = 'Goodbye'): Promise<void> {
        this.stopPingTimer();
        this.stopQueueDrain();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        return new Promise((resolve) => {
            this.client?.disconnect(message, () => resolve());
            this.dispose();
        });
    }

    dispose(): void {
        this.disposed = true;
        this.stopPingTimer();
        this.stopQueueDrain();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.client) {
            this.client.removeAllListeners();
            this.client = null;
        }
        this.pendingMessages.clear();
        this.messageQueue = [];
        this.connected = false;
    }

    private dispatchMessage(target: string, message: string, pending: string[]): void {
        if (!this.client) return;
        pending.push(message);
        this.pendingMessages.set(target, pending);
        this.client.say(target, message);

        setTimeout(() => this.completeDispatch(target, message), this.config.floodProtectionDelay);
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
            if (pending.length >= this.config.floodProtectionMaxPending) break;
            this.messageQueue.shift();
            this.dispatchMessage(target, message, pending);
        }
    }

    private startQueueDrain(): void {
        this.queueTimer = setInterval(() => this.drainQueue(), this.config.floodProtectionDelay);
    }

    private stopQueueDrain(): void {
        this.queueTimer && clearInterval(this.queueTimer);
        this.queueTimer = null;
    }

    private scheduleJoin(): void {
        if (!this.client) return;
        const delay = this.config.floodProtectionDelay * (this.config.channels.length + 1);
        setTimeout(() => {
            for (const channel of this.config.channels) {
                this.client?.join(channel);
            }
        }, delay);
    }

    private startPingTimer(): void {
        this.lastPingSent = 0;
        this.pingTimer = setInterval(() => {
            if (!this.connected) return;
            const now = Date.now();
            if (this.lastPingSent === 0) {
                this.client?.send('PING', 'SeNARS12');
                this.lastPingSent = now;
            } else {
                if (now - this.lastPingSent > this.config.pingTimeout * 1000) {
                    this.emit('error', new Error('Ping timeout'));
                }
            }
        }, this.config.pingTimeout * 1000);
    }

    private stopPingTimer(): void {
        this.pingTimer && clearInterval(this.pingTimer);
        this.pingTimer = null;
        this.lastPingSent = 0;
    }

    private scheduleReconnect(): void {
        if (!this.config.autoReconnect || this.disposed || this.reconnectAttempt >= this.config.autoReconnectMaxRetries) {
            this.reconnectAttempt >= this.config.autoReconnectMaxRetries &&
            this.emit('error', new Error('Max reconnect retries exceeded'));
            return;
        }

        const delay = Math.min(16000, 1000 * 2 ** this.reconnectAttempt);
        const jitter = delay * 0.1 * Math.random();
        this.reconnectAttempt++;

        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((e) => this.emit('error', e instanceof Error ? e : new Error(String(e))));
        }, delay + jitter);
    }
}