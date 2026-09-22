import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { assertWasmPathContained, withTimeout } from '../../capability/wasi-sandbox.js';
import { DigestMismatchError } from './wasi-runtime.js';

/**
 * D5/X27: WASI encoder-head bundle artifact. Compiles a trained linear head
 * (D1 `TrainedLinearHead` weights) to a self-contained WebAssembly module —
 * no external toolchain: the binary is emitted byte-by-byte in TS. The module
 * exports `memory` and `evalHead(inputPtr: i32) -> f32`
 * (clamp01(w·z + b) with z-scored inputs, unrolled). Loaded through the WASI
 * sandbox (`createWasmModuleSandbox`), SHA256 digest-pinned and fail-closed.
 */

export interface HeadBundle {
  weights: Float32Array;
  bias: number;
  /** Z-score stats baked into the module (defaults: no standardization). */
  mean?: Float32Array;
  std?: Float32Array;
}

/** Sandbox evaluation timeout when the caller supplies none. */
const DEFAULT_EVAL_TIMEOUT_MS = 30_000;

/** Input scratch starts at 0 (4*dim bytes, then 64-byte padding); blocks follow contiguously. */
const blockPtr = (dim: number, block: number): number => {
  const inputEnd = Math.ceil((4 * dim) / 64) * 64 + 64;
  return inputEnd + block * 4 * dim;
};
const weightsPtr = (dim: number): number => blockPtr(dim, 0);
const meanPtr = (dim: number): number => blockPtr(dim, 1);
const stdPtr = (dim: number): number => blockPtr(dim, 2);

const leb = (value: number): number[] => {
  const out: number[] = [];
  let v = value;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
};

/** Signed LEB128 — required for i32.const (unsigned encoding flips 64..127 negative). */
const sleb = (value: number): number[] => {
  const out: number[] = [];
  let v = value;
  for (;;) {
    const byte = v & 0x7f;
    v >>>= 7;
    if (v === 0 && byte < 0x40) {
      out.push(byte);
      break;
    }
    out.push(byte | 0x80);
  }
  return out;
};

const f32bytes = (value: number): number[] => {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  return [...new Uint8Array(buf)];
};

const section = (id: number, payload: number[]): number[] => [
  id,
  ...leb(payload.length),
  ...payload,
];

/**
 * Emit a WASM module evaluating `clamp01(w·z + b)` where `z = (x−mean)/std`
 * over an f32 input vector written at offset 0 of exported memory. Unrolled
 * per-weight chain (no loops, no locals) — one module per head shape.
 */
export function emitHeadBundleWasm(bundle: HeadBundle): Uint8Array {
  const { weights, bias, mean, std } = bundle;
  const dim = weights.length;
  const wPtr = weightsPtr(dim);
  const _mPtr = meanPtr(dim);
  const sPtr = stdPtr(dim);
  const bytes: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  // Type: (i32) -> f32
  bytes.push(...section(1, [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7d]));
  // Function 0 uses type 0
  bytes.push(...section(3, [0x01, 0x00]));
  // Memory: min pages covering input + data blocks
  const endOffset = sPtr + 4 * dim;
  const pages = Math.max(1, Math.ceil(endOffset / 65_536));
  bytes.push(...section(5, [0x01, 0x00, ...leb(pages)]));
  // Exports: memory + evalHead
  const memExport = [0x06, ...'memory'.split('').map((c) => c.charCodeAt(0)), 0x02, 0x00];
  const fnExport = [0x08, ...'evalHead'.split('').map((c) => c.charCodeAt(0)), 0x00, 0x00];
  bytes.push(...section(7, [0x02, ...memExport, ...fnExport]));

  // Code: stack-folded chain: acc=bias; per i: acc += w_i * (x_i−m_i)/s_i; clamp01
  const body: number[] = [0x00, 0x43, ...f32bytes(bias)]; // no locals; acc on stack
  for (let i = 0; i < dim; i++) {
    const invStd = 1 / (std?.[i] || 1);
    body.push(
      0x41,
      ...sleb(4 * i),
      0x2a,
      0x02,
      0x00, // f32.load input x_i
      0x43,
      ...f32bytes(mean?.[i] ?? 0),
      0x93, // f32.sub
      0x43,
      ...f32bytes(invStd),
      0x94, // f32.mul
      0x43,
      ...f32bytes(weights[i] ?? 0),
      0x94, // f32.mul
      0x92 // f32.add
    );
  }
  body.push(0x43, ...f32bytes(0), 0x97); // f32.max 0
  body.push(0x43, ...f32bytes(1), 0x96); // f32.min 1
  body.push(0x0b);
  const bodyWithSize = [...leb(body.length), ...body];
  bytes.push(...section(10, [0x01, ...bodyWithSize]));

  // Data: weights ++ mean ++ std
  const dataEnd = sPtr + 4 * dim;
  const data: number[] = [0x01, 0x00, 0x41, ...sleb(wPtr), 0x0b, ...leb(dataEnd - wPtr)];
  const emit = (arr: Float32Array | undefined, count: number): void => {
    for (let i = 0; i < count; i++) data.push(...f32bytes(arr?.[i] ?? 0));
  };
  emit(weights, dim);
  emit(mean, dim);
  emit(std, dim);
  bytes.push(...section(11, data));

  return new Uint8Array(bytes);
}

export interface HeadBundleArtifacts {
  wasmPath: string;
  /** sha256:<hex> over the emitted module bytes — the pin for loadHeadBundle. */
  modelDigest: string;
}

export async function writeHeadBundle(
  dir: string,
  bundle: HeadBundle
): Promise<HeadBundleArtifacts> {
  const wasm = emitHeadBundleWasm(bundle);
  const modelDigest = `sha256:${createHash('sha256').update(wasm).digest('hex')}`;
  await fs.mkdir(dir, { recursive: true });
  const wasmPath = join(dir, 'head.wasm');
  await fs.writeFile(wasmPath, wasm);
  await fs.writeFile(
    join(dir, 'config.json'),
    JSON.stringify({ modelDigest, dimension: bundle.weights.length }, null, 2)
  );
  await fs.writeFile(join(dir, 'MODEL_DIGEST'), `${modelDigest}\n`);
  return { wasmPath, modelDigest };
}

export interface LoadedHeadBundle {
  /** w·x + b for the supplied embedding (input written into wasm memory). */
  evaluate(embedding: Float32Array): Promise<number>;
}

/**
 * Load a head bundle through the sandbox posture: SHA256-verify the module
 * bytes against the pin (DigestMismatchError, fail-closed), require the wasm
 * path inside allowedPaths, and instantiate a **zero-import** module — no
 * WASI syscalls are granted at all, so the head can only compute. Calls are
 * timeout-guarded.
 */
export async function loadHeadBundle(options: {
  wasmPath: string;
  modelDigest: string;
  dimension: number;
  allowedPaths?: string[];
  timeoutMs?: number;
}): Promise<LoadedHeadBundle> {
  const { wasmPath, modelDigest, dimension } = options;
  assertWasmPathContained(wasmPath, options.allowedPaths ?? []);
  const wasm = new Uint8Array(await fs.readFile(wasmPath));
  const loaded = `sha256:${createHash('sha256').update(wasm).digest('hex')}`;
  if (loaded !== modelDigest) throw new DigestMismatchError(modelDigest, loaded);

  const module = await globalThis.WebAssembly.compile(wasm as unknown as BufferSource);
  if (WebAssembly.Module.imports(module).length > 0) {
    throw new Error('Head bundle must be a zero-import module (deny-by-default sandbox)');
  }
  const instance = (await globalThis.WebAssembly.instantiate(module, {})) as {
    exports: { memory: WebAssembly.Memory; evalHead: (ptr: number) => number };
  };
  const { memory, evalHead } = instance.exports;

  return {
    async evaluate(embedding: Float32Array): Promise<number> {
      if (embedding.length !== dimension) {
        throw new Error(`Head bundle expects ${dimension} inputs, got ${embedding.length}`);
      }
      new Float32Array(memory.buffer, 0, dimension).set(embedding);
      return await withTimeout(
        Promise.resolve(evalHead(0)),
        options.timeoutMs ?? DEFAULT_EVAL_TIMEOUT_MS
      );
    },
  };
}
