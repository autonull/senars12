import { spawn } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { containsPath } from '../../capability/wasi-sandbox.js';
import { tool } from 'ai';
import { z } from 'zod';

export function shellAllowlistFromEnv(env: string | undefined): string[] {
  return (env ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export interface CodeExecDeps {
  /** Opt-in: when false (default) no tools are returned. */
  enabled?: boolean;
  /** Command allow-list; defaults to the SHELL_ALLOWLIST env var (comma-separated). Empty denies all. */
  allowlist?: string[];
  workspaceRoot?: string;
  maxTimeout?: number;
  maxOutputBytes?: number;
  /** WASI sandbox grants: wasm modules/paths the sandboxed tool may read. */
  wasiAllowedPaths?: string[];
  wasiTimeoutMs?: number;
}

const deny = (reason: string) => ({ error: reason, exitCode: -1, stdout: '', stderr: '', duration: 0, truncated: false });

function createShellTool(deps: Required<Pick<CodeExecDeps, 'allowlist' | 'workspaceRoot' | 'maxTimeout' | 'maxOutputBytes'>>) {
  return tool({
    description:
      'Execute an allow-listed command in a subprocess. Scoped to the workspace directory. No shell access.',
    inputSchema: z.strictObject({
      command: z.string().describe('Command to execute (e.g., "node", "python3", "ls")'),
      args: z.array(z.string()).optional().default([]).describe('Command arguments'),
      cwd: z.string().optional().describe('Working directory relative to workspace root'),
      timeout: z
        .number()
        .min(1000)
        .max(deps.maxTimeout)
        .optional()
        .default(30_000)
        .describe('Timeout in ms'),
    }),
    execute: async ({ command, args = [], cwd, timeout = 30_000 }) => {
      const commandName = basename(command);
      if (!deps.allowlist.includes(command) && !deps.allowlist.includes(commandName)) {
        return deny(
          `Command '${command}' is not allow-listed. Set SHELL_ALLOWLIST (comma-separated) to grant access.`
        );
      }
      const execCwd = resolve(deps.workspaceRoot, cwd ?? '.');
      if (!containsPath(deps.workspaceRoot, execCwd)) {
        return deny(`Working directory must be within workspace: ${deps.workspaceRoot}`);
      }

      return new Promise((resolve) => {
        const child = spawn(command, args, {
          cwd: execCwd,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          signal: AbortSignal.timeout(timeout),
        });

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let truncated = false;

        const collect = (buffer: Buffer[], byteCount: { value: number }, maxBytes: number) => {
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

        child.stdout?.on('data', collect(stdout, { value: 0 }, deps.maxOutputBytes));
        child.stderr?.on('data', collect(stderr, { value: 0 }, deps.maxOutputBytes));

        const startTime = Date.now();
        child.on('close', (exitCode) => {
          resolve({
            exitCode: exitCode ?? -1,
            stdout: Buffer.concat(stdout).toString('utf-8'),
            stderr: Buffer.concat(stderr).toString('utf-8'),
            duration: Date.now() - startTime,
            truncated,
          });
        });

        child.on('error', (err) => {
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
  });
}

function createWasiTool(deps: Required<Pick<CodeExecDeps, 'wasiAllowedPaths' | 'wasiTimeoutMs' | 'maxOutputBytes'>>) {
  return tool({
    description:
      'Execute a WASM module in a WASI sandbox. No host FS or network access unless explicitly granted via capability tokens (allowedPaths).',
    inputSchema: z.strictObject({
      wasmPath: z.string().describe('Path to the .wasm module, relative to the workspace root'),
      args: z.array(z.string()).optional().default([]).describe('Module arguments'),
      timeout: z
        .number()
        .min(1000)
        .max(deps.wasiTimeoutMs)
        .optional()
        .default(30_000)
        .describe('Timeout in ms'),
    }),
    execute: async ({ wasmPath, args = [], timeout = 30_000 }) => {
      const { createWasmModuleSandbox } = await import('../../capability/wasi-sandbox.js');
      const startTime = Date.now();
      try {
        const result = await createWasmModuleSandbox({
          wasmPath,
          allowedPaths: deps.wasiAllowedPaths,
          args,
          timeoutMs: timeout,
        });
        const truncate = (s: string): { text: string; truncated: boolean } => {
          const clipped = Buffer.from(s, 'utf8').subarray(0, deps.maxOutputBytes);
          return {
            text: clipped.toString('utf8'),
            truncated: Buffer.byteLength(s, 'utf8') > deps.maxOutputBytes,
          };
        };
        const out = truncate(result.stdout);
        const errOut = truncate(result.stderr);
        return {
          exitCode: result.exitCode,
          stdout: out.text,
          stderr: errOut.text,
          truncated: out.truncated || errOut.truncated,
          duration: Date.now() - startTime,
        };
      } catch (err) {
        const error = String(err);
        return { ...deny(error), duration: Date.now() - startTime };
      }
    },
  });
}

export function createCodeExecTools(deps: CodeExecDeps = {}) {
  if (!deps.enabled) return {};
  const allowlist = deps.allowlist ?? shellAllowlistFromEnv(process.env.SHELL_ALLOWLIST);
  const shellDeps = {
    allowlist,
    workspaceRoot: deps.workspaceRoot || process.cwd(),
    maxTimeout: deps.maxTimeout ?? 120_000,
    maxOutputBytes: deps.maxOutputBytes ?? 65_536,
  };
  const wasiDeps = {
    wasiAllowedPaths: deps.wasiAllowedPaths ?? [],
    wasiTimeoutMs: deps.maxTimeout ?? 120_000,
    maxOutputBytes: shellDeps.maxOutputBytes,
  };
  return {
    code_exec: createShellTool(shellDeps),
    code_exec_wasi: createWasiTool(wasiDeps),
  };
}
