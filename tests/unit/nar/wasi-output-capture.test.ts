import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Minimal WASI module (wat2wasm): writes "hello from wasm\n" to fd 1 on start.
const HELLO_WASM_HEX =
  '0061736d01000000010c0260047f7f7f7f017f60000002230116776173695f736e617073686f745f70726576696577310866645f77726974650000030201010503010001071302066d656d6f72790200065f737461727400010a11010f00410141e400410141c80110001a0b0b24020041080b1068656c6c6f2066726f6d207761736d0a0041e4000b080800000010000000';

const wasmBytes = (): Uint8Array => Uint8Array.from(HELLO_WASM_HEX.match(/../g)!.map((b) => Number.parseInt(b, 16)));

describe('createWasmModuleSandbox output capture', () => {
  it('captures stdout and exit code from a WASI module', async () => {
    const { createWasmModuleSandbox } = await import('@senars/nar/capability');
    const dir = mkdtempSync(join(tmpdir(), 'senars-wasi-'));
    const wasmPath = join(dir, 'hello.wasm');
    writeFileSync(wasmPath, wasmBytes());

    const result = await createWasmModuleSandbox({ wasmPath });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from wasm');
    expect(result.stderr).toBe('');
  });

  it('fails closed when the wasm path escapes allowedPaths', async () => {
    const { createWasmModuleSandbox } = await import('@senars/nar/capability');
    const dir = mkdtempSync(join(tmpdir(), 'senars-wasi-'));
    const wasmPath = join(dir, 'hello.wasm');
    writeFileSync(wasmPath, wasmBytes());
    await expect(createWasmModuleSandbox({ wasmPath, allowedPaths: ['/somewhere/else'] })).rejects.toThrow(
      /escapes allowedPaths/
    );
  });
});
