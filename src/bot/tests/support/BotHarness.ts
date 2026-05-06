import { spawn, ChildProcess } from 'child_process';

export class BotHarness {
  private process: ChildProcess | null = null;
  private output = '';

  async spawn(args: string[] = []): Promise<void> {
    this.process = spawn('node', ['run.js', ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
    });

    this.process.stdout?.on('data', (data) => {
      this.output += data.toString();
      console.log(`[Bot] ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[Bot Error] ${data.toString().trim()}`);
    });

    await this.waitForPattern(/listening|ready|started/i, 5000);
  }

  private async waitForPattern(pattern: RegExp, timeout = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (pattern.test(this.output)) return;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error(`Timeout waiting for pattern: ${pattern}`);
  }

  async kill(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 200));
      this.process = null;
    }
  }

  discoverPort(): number | null {
    const match = this.output.match(/listening on .*:(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  getOutput(): string {
    return this.output;
  }
}
