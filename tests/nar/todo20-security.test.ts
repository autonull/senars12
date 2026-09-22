/** Bench 68 — Security Hardening (TODO20 Phase 7: S1 validate, S2 shell, S3 wasi, S4 sanitize). */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Registry } from '../../nar/src/tools/registry.js';
import type { Schema } from '../../nar/src/tools/types.js';
import {
  createCodeExecTools,
  shellAllowlistFromEnv,
} from '../../nar/src/tools/adapters/code-exec.js';
import {
  containsPath,
  assertWasmPathContained,
} from '../../nar/src/capability/wasi-sandbox.js';
import {
  enforceLMOutputSize,
  LMOutputTooLargeError,
  maxLMOutputChars,
} from '../../nar/src/lm/service/sanitize.js';

const NAR_SRC = join(import.meta.dirname, '../../nar/src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

type ExecTool = { execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>> };

const execTool = (
  deps: Parameters<typeof createCodeExecTools>[0],
  name: 'code_exec' | 'code_exec_wasi'
): ExecTool =>
  (createCodeExecTools(deps) as Record<string, ExecTool>)[name] as unknown as ExecTool;

describe('Bench 68 — S1: tool input validation', () => {
  it('every tool inputSchema is a strict zod object (no unknown-key pass-through)', () => {
    const offenders = walk(NAR_SRC)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => readFileSync(f, 'utf-8').includes('inputSchema: z.object('));
    expect(offenders).toEqual([]);
  });

  it('Registry rejects unknown parameters at the boundary', async () => {
    const registry = new Registry();
    const schema: Schema = {
      type: 'object',
      properties: { known: { type: 'string' } },
      required: ['known'],
    };
    registry.register({
      name: 't',
      description: 't',
      parameters: schema,
      execute: async () => ({ success: true, content: 'ok' }),
    });
    const bad = await registry.execute('t', { known: 'x', rogue: 1 });
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('Unknown parameter: rogue');
    const good = await registry.execute('t', { known: 'x' });
    expect(good.success).toBe(true);
  });
});

describe('Bench 68 — S2: shell tool hardening', () => {
  it('allow-list parser splits SHELL_ALLOWLIST and drops empties', () => {
    expect(shellAllowlistFromEnv('node, pnpm ,,ls')).toEqual(['node', 'pnpm', 'ls']);
    expect(shellAllowlistFromEnv(undefined)).toEqual([]);
  });

  it('shell/code-exec tools are disabled by default (opt-in via config)', () => {
    expect(createCodeExecTools()).toEqual({});
    expect(createCodeExecTools({ enabled: false })).toEqual({});
  });

  it('deny-lists commands outside SHELL_ALLOWLIST (empty allow-list denies all)', async () => {
    const denied = await execTool({ enabled: true }, 'code_exec').execute({
      command: 'curl',
      args: ['http://evil.example'],
    });
    expect(denied.error).toContain('not allow-listed');
    const noAllowlist = await execTool({ enabled: true }, 'code_exec').execute({ command: 'ls' });
    expect(noAllowlist.error).toContain('not allow-listed');
  });

  it('executes allow-listed commands without a shell', async () => {
    const result = await execTool({ enabled: true, allowlist: ['node'] }, 'code_exec').execute({
      command: 'node',
      args: ['-e', 'console.log("senars-bench68")'],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('senars-bench68');
  }, 15_000);

  it('enforces timeout via AbortSignal (killed child resolves, not hangs)', async () => {
    const start = Date.now();
    const result = await execTool({ enabled: true, allowlist: ['node'] }, 'code_exec').execute({
      command: 'node',
      args: ['-e', 'setTimeout(() => {}, 60_000)'],
      timeout: 1000,
    });
    expect(Date.now() - start).toBeLessThan(10_000);
    expect(result.exitCode).not.toBe(0);
  }, 15_000);
});

describe('Bench 68 — S3: WASI sandbox', () => {
  it('path containment rejects traversal outside granted roots', () => {
    expect(containsPath('/ws', '/ws/sub/file.txt')).toBe(true);
    expect(containsPath('/ws', '/ws-secret/file.txt')).toBe(false);
    expect(() => assertWasmPathContained('/ws-secret/mod.wasm', ['/ws'])).toThrow();
    expect(() => assertWasmPathContained('/ws/mod.wasm', ['/ws'])).not.toThrow();
  });

  it('wasi tool is capability-gated: no grants, no preopens; unknown module fails closed', async () => {
    const result = await execTool({ enabled: true }, 'code_exec_wasi').execute({
      wasmPath: 'does-not-exist.wasm',
    });
    expect(result.error).toBeDefined();
  });
});

describe('Bench 68 — S4: LM response sanitization', () => {
  it('strips toolChoice from local-model params (middleware present)', () => {
    const source = readFileSync(
      join(NAR_SRC, 'lm/providers/model-factory.ts'),
      'utf-8'
    );
    expect(source).toContain('toolChoice: undefined');
  });

  it('size limits: outputs over the cap throw LMOutputTooLargeError', () => {
    expect(enforceLMOutputSize('x'.repeat(10))).toBe('x'.repeat(10));
    expect(() => enforceLMOutputSize('x'.repeat(11), 10)).toThrow(LMOutputTooLargeError);
    try {
      enforceLMOutputSize('x'.repeat(11), 10);
      expect.unreachable();
    } catch (e) {
      expect((e as LMOutputTooLargeError).code).toBe('LM_OUTPUT_TOO_LARGE');
      expect((e as LMOutputTooLargeError).limit).toBe(10);
    }
  });

  it('LM_MAX_OUTPUT_CHARS env overrides the default cap', () => {
    process.env.LM_MAX_OUTPUT_CHARS = '1234';
    expect(maxLMOutputChars()).toBe(1234);
    delete process.env.LM_MAX_OUTPUT_CHARS;
    expect(maxLMOutputChars()).toBe(65_536);
  });

  it('generateText/stream paths wire the cap (LMService grep-guard)', () => {
    const source = readFileSync(join(NAR_SRC, 'lm/service/LMService.ts'), 'utf-8');
    expect(source).toContain('enforceLMOutputSize');
    expect(source).toContain('LMOutputTooLargeError');
  });

  it('Narsese from LM output is grammar-validated before admission', async () => {
    const { LMResponseParser } = await import('../../nar/src/lm/rule/response-parser.js');
    const invalid = LMResponseParser.parse('this is not narsese <<<');
    expect(invalid.valid).toBe(false);
    const valid = LMResponseParser.parse('<a --> b>. %1.0;0.9%');
    expect(valid.valid).toBe(true);
  });
});
