import type { WASI, WasiConfig } from '@wasmer/wasi';
import type WasmFs from '@wasmer/wasmfs';

export class SandboxTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Sandbox execution exceeded timeout of ${timeoutMs}ms`);
    this.name = 'SandboxTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export interface WasiSandboxOptions {
  allowedPaths?: string[];
  env?: Record<string, string>;
  args?: string[];
  timeoutMs?: number;
}

export const DEFAULT_SANDBOX_TIMEOUT_MS = 30_000;

export function sanitizePreopens(paths: string[] = []): Record<string, string> {
  const preopens: Record<string, string> = {};
  for (const raw of paths) {
    const normalized = raw.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) continue;
    preopens[normalized] = normalized;
  }
  return preopens;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SandboxTimeoutError(timeoutMs)), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function containsPath(root: string, candidate: string): boolean {
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
  const r = norm(root);
  const c = norm(candidate);
  return c === r || c.startsWith(r === '/' ? '/' : `${r}/`);
}

export function assertWasmPathContained(wasmPath: string, allowedPaths: string[] = []): void {
  if (allowedPaths.length > 0 && !allowedPaths.some((root) => containsPath(root, wasmPath))) {
    throw new Error(`wasmPath '${wasmPath}' escapes allowedPaths`);
  }
}

let _wasiInitialized = false;
async function ensureWasiInit(): Promise<void> {
  if (!_wasiInitialized) {
    const { init } = await import('@wasmer/wasi');
    await init();
    _wasiInitialized = true;
  }
}

export async function createWasiSandbox(options: WasiSandboxOptions = {}): Promise<(fn: () => Promise<unknown>) => Promise<unknown>> {
  await ensureWasiInit();
  const { allowedPaths = [], env = {}, args = [], timeoutMs = DEFAULT_SANDBOX_TIMEOUT_MS } = options;

  const WasmFs = (await import('@wasmer/wasmfs')).default;
  const { WASI, MemFS } = await import('@wasmer/wasi');

  const wasmFs = new WasmFs();
  const memfs = MemFS.from_js(wasmFs.fs as any);
  const wasiConfig: WasiConfig = {
    args: ['wasi-sandbox', ...args],
    env,
    preopens: sanitizePreopens(allowedPaths),
    fs: memfs,
  };

  const wasi = new WASI(wasiConfig);

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return withTimeout(fn(), timeoutMs);
  };
}

export interface WasmModuleOptions {
  wasmPath: string;
  allowedPaths?: string[];
  env?: Record<string, string>;
  args?: string[];
  timeoutMs?: number;
  imports?: Record<string, unknown>;
}

export async function createWasmModuleSandbox(options: WasmModuleOptions): Promise<(fn: () => Promise<unknown>) => Promise<unknown>> {
  await ensureWasiInit();
  const { allowedPaths = [], env = {}, args = ['wasm-sandbox'], timeoutMs = DEFAULT_SANDBOX_TIMEOUT_MS } = options;
  assertWasmPathContained(options.wasmPath, allowedPaths);

  const WasmFs = (await import('@wasmer/wasmfs')).default;
  const { WASI, MemFS } = await import('@wasmer/wasi');

  const wasmFs = new WasmFs();
  const memfs = MemFS.from_js(wasmFs.fs as any);
  const wasiConfig: WasiConfig = {
    args,
    env,
    preopens: sanitizePreopens(allowedPaths),
    fs: memfs,
  };

  const wasi = new WASI(wasiConfig);

  const wasmBytes = (await wasmFs.fs.promises.readFile(options.wasmPath)) as unknown as BufferSource;
  const module = await globalThis.WebAssembly.compile(wasmBytes);
  const instance = await globalThis.WebAssembly.instantiate(module, {
    ...wasi.getImports(module),
    ...options.imports,
  } as WebAssembly.Imports);

  wasi.start(instance);

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return withTimeout(fn(), timeoutMs);
  };
}

let vmDeprecationWarned = false;

/**
 * @deprecated Trusted-but-faulty code isolation only — NOT a security boundary.
 * `node:vm` does not isolate untrusted code (shared primordials, known escapes).
 * Use `createWasiSandbox` for untrusted execution.
 */
export function createNodeVMSandbox(): <T>(fn: () => Promise<T>) => Promise<T> {
  if (!vmDeprecationWarned) {
    vmDeprecationWarned = true;
    console.warn('[senars] createNodeVMSandbox is deprecated: not a security boundary, use createWasiSandbox for untrusted code.');
  }
  const vm = require('vm');
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Math,
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    TypeError,
    ReferenceError,
    RangeError,
    SyntaxError,
    EvalError,
    URIError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    Proxy,
    Reflect,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,
    DataView,
    ArrayBuffer,
    SharedArrayBuffer,
    Atomics,
    FinalizationRegistry,
    WeakRef,
  });

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const script = new vm.Script(`(${fn.toString()})()`);
    return script.runInContext(context) as Promise<T>;
  };
}