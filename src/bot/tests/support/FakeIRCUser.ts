import net from 'net';

export class FakeIRCUser {
    private client: net.Socket;
    private buffer: string[] = [];
    private connected = false;

    constructor(private host: string, private port: number) {
        this.client = net.createConnection(port, host);
        this.client.on('error', () => {
        });
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);

            this.client.once('connect', () => {
                clearTimeout(timeout);
                this.connected = true;
                this.client.write('NICK TestUser\r\n');
                this.client.write('JOIN #test\r\n');
                setTimeout(resolve, 100);
            });

            this.client.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });

            this.client.on('data', (data) => {
                this.buffer.push(data.toString());
            });
        });
    }

    say(message: string): void {
        if (!this.connected) return;
        this.client.write(`PRIVMSG #test :${message}\r\n`);
    }

    async waitForReply(pattern: string, timeout = 5000): Promise<string | null> {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            for (const line of this.buffer) {
                if (line.includes(pattern)) {
                    return line;
                }
            }
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    }

    disconnect(): void {
        this.client.end();
        this.client.destroy();
    }
}
