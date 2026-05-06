import net from 'net';

export class FakeIRCUser {
  private client: net.Socket;
  private buffer: string[] = [];
  private connected = false;

  constructor(private host: string, private port: number) {
    this.client = net.createConnection(port, host);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on('connect', () => {
        this.connected = true;
        this.client.write('NICK TestUser\r\n');
        this.client.write('JOIN #test\r\n');
        setTimeout(resolve, 100);
      });
      this.client.on('error', reject);
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
  }
}
