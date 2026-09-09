import type { WASI, WasiConfig } from '@wasmer/wasi';
import type WasmFs from '@wasmer/wasmfs';

export interface WasiSandboxOptions {
  allowedPaths?: string[];
  env?: Record<string, string>;
  args?: string[];
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
  const { allowedPaths = [], env = {}, args = [] } = options;

  const WasmFs = (await import('@wasmer/wasmfs')).default;
  const { WASI, MemFS } = await import('@wasmer/wasi');

  const wasmFs = new WasmFs();
  const preopens: Record<string, string> = {};
  for (const path of allowedPaths) {
    preopens[path] = path;
  }

  const memfs = MemFS.from_js(wasmFs.fs as any);
  const wasiConfig: WasiConfig = {
    args: ['wasi-sandbox', ...args],
    env: { ...(process.env as Record<string, string>), ...env },
    preopens,
    fs: memfs,
  };

  const wasi = new WASI(wasiConfig);

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return fn();
  };
}

export interface WasmModuleOptions {
  wasmPath: string;
  imports?: Record<string, unknown>;
}

export async function createWasmModuleSandbox(options: WasmModuleOptions): Promise<(fn: () => Promise<unknown>) => Promise<unknown>> {
  await ensureWasiInit();
  const WasmFs = (await import('@wasmer/wasmfs')).default;
  const { WASI, MemFS } = await import('@wasmer/wasi');

  const wasmFs = new WasmFs();
  const memfs = MemFS.from_js(wasmFs.fs as any);
  const wasiConfig: WasiConfig = {
    args: ['wasm-sandbox'],
    env: process.env as Record<string, string>,
    fs: memfs,
  };

  const wasi = new WASI(wasiConfig);

  const wasmBytes = await wasmFs.fs.promises.readFile(options.wasmPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WebAssembly: any = (0, eval)('WebAssembly');
  const module = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(module, {
    ...wasi.getImports(module),
    ...options.imports,
  });

  wasi.start(instance);

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return fn();
  };
}

export function createNodeVMSandbox(): <T>(fn: () => Promise<T>) => Promise<T> {
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