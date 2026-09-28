import { spawn } from 'node:child_process';

export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn a command, collect both streams, and always resolve — spawn failures
 * surface as `code: 1` with the error text on stderr rather than a rejected
 * promise. Callers that need failure semantics branch on `code`.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
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
            finish({ code: 1, stdout, stderr: `${stderr}\ntimed out after ${options.timeoutMs}ms` });
          }, options.timeoutMs);
    timer?.unref?.();
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      finish({ code: code ?? 1, stdout, stderr });
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      finish({ code: 1, stdout, stderr: stderr || err.message });
    });
  });
}
