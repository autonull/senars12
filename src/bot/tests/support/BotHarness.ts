import {ChildProcess, spawn} from 'child_process';
import net from 'net';

export class BotHarness {
  private process: ChildProcess | null = null;
  private output = '';
  private port: number | null = null;

  async spawn(args: string[] = []): Promise<void> {
    // Find available port
    this.port = await this.findAvailablePort();
    
    // Execute the runner script from the project tree so the
    // child process can be launched regardless of the test cwd.
    this.process = spawn('tsx', ['src/bot/run.ts', ...args, `--port=${this.port}`], {
      env: {...process.env, NODE_ENV: 'test'},
      stdio: ['pipe', 'pipe', 'pipe'],
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

  private async findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 6670;
        server.close(() => resolve(port));
      });
      server.on('error', () => resolve(6670 + Math.floor(Math.random() * 1000)));
    });
  }

  async kill(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGKILL');
      
      // Destroy stdio streams to close handles
      this.process.stdin?.destroy();
      this.process.stdout?.destroy();
      this.process.stderr?.destroy();
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (!this.process) {
          resolve();
          return;
        }
        let resolved = false;
        const doResolve = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        this.process?.once('exit', doResolve);
        this.process?.once('error', doResolve);
        // Timeout in case exit event doesn't fire (unref to allow Jest to exit)
        const timer = setTimeout(doResolve, 2000);
        timer.unref();
      });
      
      this.process = null;
    }
  }

  discoverPort(): number | null {
    // First try to get port from output
    const match = this.output.match(/listening on .*:(\d+)/i);
    if (match?.[1]) {
      return parseInt(match[1]);
    }
    // Fall back to assigned port
    return this.port;
  }

    getOutput(): string {
        return this.output;
    }

    private async waitForPattern(pattern: RegExp, timeout = 5000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (pattern.test(this.output)) return;
            await new Promise(r => setTimeout(r, 50));
        }
        throw new Error(`Timeout waiting for pattern: ${pattern}`);
    }
}
