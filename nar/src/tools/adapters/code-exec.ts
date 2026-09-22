import { spawn } from 'node:child_process';
import { normalize, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';

// --- code_exec ---

export interface CodeExecDeps {
  workspaceRoot?: string;
  maxTimeout?: number;
  maxOutputBytes?: number;
}

export function createCodeExecTools(deps: CodeExecDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const maxTimeout = deps.maxTimeout ?? 120_000;
  const maxOutputBytes = deps.maxOutputBytes ?? 65_536;

  return {
    code_exec: tool({
      description:
        'Execute a command in a subprocess. Scoped to the workspace directory. No shell access.',
      inputSchema: z.object({
        command: z.string().describe('Command to execute (e.g., "node", "python3", "ls")'),
        args: z.array(z.string()).optional().default([]).describe('Command arguments'),
        cwd: z.string().optional().describe('Working directory relative to workspace root'),
        timeout: z
          .number()
          .min(1000)
          .max(maxTimeout)
          .optional()
          .default(30_000)
          .describe('Timeout in ms'),
      }),
      execute: async ({ command, args = [], cwd, timeout = 30_000 }) => {
        const execCwd = cwd ? resolve(workspaceRoot, cwd) : workspaceRoot;
        const normCwd = normalize(execCwd);
        if (!normCwd.startsWith(normalize(workspaceRoot))) {
          return { error: `Working directory must be within workspace: ${workspaceRoot}` };
        }

        return new Promise((resolve) => {
          const child = spawn(command, args, {
            cwd: normCwd,
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          const stdout: Buffer[] = [];
          const stderr: Buffer[] = [];
          let truncated = false;

          const collect = (
            buffer: Buffer[],
            _target: Buffer[],
            byteCount: {
              value: number;
            },
            maxBytes: number
          ) => {
            return (data: Buffer) => {
              const remaining = maxBytes - byteCount.value;
              if (remaining <= 0) {
                truncated = true;
                return;
              }
              const chunk = data.subarray(0, remaining);
              buffer.push(chunk);
              byteCount.value += chunk.length;
            };
          };

          child.stdout?.on('data', collect(stdout, stdout, { value: 0 }, maxOutputBytes));
          child.stderr?.on('data', collect(stderr, stderr, { value: 0 }, maxOutputBytes));

          const startTime = Date.now();
          const timer = setTimeout(() => {
            child.kill('SIGTERM');
          }, timeout);

          child.on('close', (exitCode) => {
            clearTimeout(timer);
            resolve({
              exitCode: exitCode ?? -1,
              stdout: Buffer.concat(stdout).toString('utf-8'),
              stderr: Buffer.concat(stderr).toString('utf-8'),
              duration: Date.now() - startTime,
              truncated,
            });
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            resolve({
              error: String(err),
              exitCode: -1,
              stdout: '',
              stderr: '',
              duration: Date.now() - startTime,
              truncated: false,
            });
          });
        });
      },
    }),
  };
}
