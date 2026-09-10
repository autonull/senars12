import { describe, expect, it, vi } from 'vitest';
import {
  assertWasmPathContained,
  containsPath,
  createNodeVMSandbox,
  sanitizePreopens,
  SandboxTimeoutError,
  withTimeout,
} from '@senars/nar/capability';

describe('sandbox hardening', () => {
  it('preopens drop traversal escapes', () => {
    expect(sanitizePreopens(['/workspace', '../etc', '/a/../b', '/x//y/'])).toEqual({
      '/workspace': '/workspace',
      '/x/y': '/x/y',
    });
    expect(sanitizePreopens()).toEqual({});
  });

  it('wasm path containment', () => {
    expect(containsPath('/workspace', '/workspace/mod.wasm')).toBe(true);
    expect(containsPath('/workspace', '/workspace')).toBe(true);
    expect(containsPath('/workspace', '/other/mod.wasm')).toBe(false);
    expect(containsPath('/workspace', '/workspace-evil/mod.wasm')).toBe(false);
    expect(() => assertWasmPathContained('/etc/mod.wasm', ['/workspace'])).toThrow(/escapes/);
    expect(() => assertWasmPathContained('/workspace/mod.wasm', ['/workspace'])).not.toThrow();
    expect(() => assertWasmPathContained('/anywhere/mod.wasm')).not.toThrow();
  });

  it('withTimeout rejects slow executions', async () => {
    await expect(withTimeout(Promise.resolve('fast'), 1000)).resolves.toBe('fast');
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toBeInstanceOf(SandboxTimeoutError);
  });

  it('node:vm sandbox warns deprecation but still runs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sandbox = createNodeVMSandbox();
    await expect(sandbox(async () => 'ok')).resolves.toBe('ok');
    expect(warn).toHaveBeenCalledTimes(1);
    createNodeVMSandbox();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
