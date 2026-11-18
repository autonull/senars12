import { spawn } from 'node:child_process';

export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
  /** True when either stream hit `maxOutputBytes` and the tail was dropped. */
  truncated: boolean;
}

/**
 * Spawn a command, collect both streams, and always resolve — spawn failures
 * surface as `code: 1` with the error text on stderr rather than a rejected
 * promise. Callers that need failure semantics branch on `code`.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: { cwd?: string; timeoutMs?: number; maxOutputBytes?: number } = {}
): Promise<ProcessResult> {
  const { maxOutputBytes = Number.POSITIVE_INFINITY } = options;
  return new Promise((resolve) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = '';
    const stderr = '';
    let truncated = false;
    const collector = (): { push(data: Buffer): void; text: () => string } => {
      let buf = '';
      let seen = 0;
      return {
        push(data: Buffer) {
          const remaining = maxOutputBytes - seen;
          if (remaining <= 0) {
            truncated = true;
            return;
          }
          if (data.length > remaining) truncated = true;
          seen += Math.min(remaining, data.length);
          buf += data.subarray(0, remaining).toString();
        },
        text: () => buf,
      };
    };
    const out = collector();
    const err = collector();
    child.stdout?.on('data', (data: Buffer) => out.push(data));
    child.stderr?.on('data', (data: Buffer) => err.push(data));
    const snapshot = () => ({ stdout: out.text(), stderr: err.text() });
    let settled = false;
    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill('SIGKILL');
            finish({
              code: 1,
              ...snapshot(),
              stderr: `${err.text()}\ntimed out after ${options.timeoutMs}ms`,
              truncated,
            });
          }, options.timeoutMs);
    timer?.unref?.();
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      finish({ code: code ?? 1, ...snapshot(), truncated });
    });
    child.on('error', (spawnError) => {
      if (timer) clearTimeout(timer);
      finish({ code: 1, ...snapshot(), stderr: err.text() || spawnError.message, truncated });
    });
  });
}
