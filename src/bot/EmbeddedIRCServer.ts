import net from 'net';
import {EventEmitter} from 'events';

export interface IRCMessage {
    prefix?: string;
    command: string;
    params: string[];
    raw: string;
}

export interface IRCServerConfig {
    port: number;
    hostname: string;
    channel: string;
}

export class EmbeddedIRCServer extends EventEmitter {
    private server: net.Server;
    private clients: Set<net.Socket> = new Set();
    private config: IRCServerConfig;

    constructor(config: Partial<IRCServerConfig> = {}) {
        super();
        this.config = {
            port: config.port ?? 6667,
            hostname: config.hostname ?? '127.0.0.1',
            channel: config.channel ?? '#senars',
        };
        this.server = net.createServer();
        this.setupServer();
    }

    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.config.port, this.config.hostname, () => {
                console.log(`IRC Server listening on ${this.config.hostname}:${this.config.port}`);
                resolve();
            });
        });
    }

    stop(): Promise<void> {
        return new Promise((resolve) => {
            this.server.close(() => {
                for (const client of this.clients) {
                    client.destroy();
                }
                this.clients.clear();
                resolve();
            });
        });
    }

    send(target: string, message: string): void {
        const msg = `:bot PRIVMSG ${target} :${message}\r\n`;
        for (const client of this.clients) {
            client.write(msg);
        }
    }

    private setupServer(): void {
        this.server.on('connection', (socket) => {
            this.clients.add(socket);
            this.emit('client:connect', socket);

            socket.on('data', (data) => {
                const lines = data.toString().split('\r\n').filter(Boolean);
                for (const line of lines) {
                    this.handleMessage(socket, line);
                }
            });

            socket.on('error', (err) => {
                this.emit('client:error', {socket, err});
            });

            socket.on('end', () => {
                this.clients.delete(socket);
                this.emit('client:disconnect', socket);
            });
        });
    }

    private handleMessage(socket: net.Socket, raw: string): void {
        const message = this.parseMessage(raw);
        this.emit('message', {socket, message});

        if (message.command === 'NICK') {
            socket.write(`:${socket.remoteAddress} NICK ${message.params[0]}\r\n`);
        } else if (message.command === 'JOIN') {
            socket.write(`:${socket.remoteAddress} JOIN ${message.params[0]}\r\n`);
        } else if (message.command === 'PRIVMSG') {
            const target = message.params[0];
            const text = message.params.slice(1).join(' ');
            this.broadcast(`:${socket.remoteAddress} PRIVMSG ${target} :${text}\r\n`, socket);
        }
    }

    private parseMessage(raw: string): IRCMessage {
        const parts = raw.split(' ');
        let prefix: string | undefined;
        let cursor = 0;

  if (parts[0]?.startsWith(':')) {
    prefix = parts.shift();
    cursor = 0;
  }

        const command = parts[cursor++] || '';
        const params: string[] = [];
        let remaining = parts.slice(cursor).join(' ');

        if (remaining.startsWith(':')) {
            const lastParam = remaining.slice(1);
            params.push(...parts.slice(cursor, -1), lastParam);
        } else {
            params.push(...parts.slice(cursor));
        }

        return {prefix, command, params, raw};
    }

    private broadcast(message: string, exclude?: net.Socket): void {
        for (const client of this.clients) {
            if (client !== exclude) {
                client.write(message + '\r\n');
            }
        }
    }
}
