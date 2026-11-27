import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ensureDir } from '@senars/util/fs';
import { sha256Prefixed } from '@senars/util/hash';
import { assertWasmPathContained, withSandboxTimeout } from '../../capability/wasi-sandbox';
import { DigestMismatchError } from './wasi-runtime';
import { SenarsError } from '../../errors/senars-error';
/** Sandbox evaluation timeout when the caller supplies none. */
const DEFAULT_EVAL_TIMEOUT_MS = 30_000;
/** Input scratch starts at 0 (4*dim bytes, then 64-byte padding); blocks follow contiguously. */
const blockPtr = (dim, block) => {
    const inputEnd = Math.ceil((4 * dim) / 64) * 64 + 64;
    return inputEnd + block * 4 * dim;
};
const weightsPtr = (dim) => blockPtr(dim, 0);
const meanPtr = (dim) => blockPtr(dim, 1);
const stdPtr = (dim) => blockPtr(dim, 2);
const leb = (value) => {
    const out = [];
    let v = value;
    do {
        let byte = v & 0x7f;
        v >>>= 7;
        if (v !== 0)
            byte |= 0x80;
        out.push(byte);
    } while (v !== 0);
    return out;
};
/** Signed LEB128 — required for i32.const (unsigned encoding flips 64..127 negative). */
const sleb = (value) => {
    const out = [];
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
const f32bytes = (value) => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    return [...new Uint8Array(buf)];
};
const section = (id, payload) => [
    id,
    ...leb(payload.length),
    ...payload,
];
/**
 * Emit a WASM module evaluating `clamp01(w·z + b)` where `z = (x−mean)/std`
 * over an f32 input vector written at offset 0 of exported memory. Unrolled
 * per-weight chain (no loops, no locals) — one module per head shape.
 */
export function emitHeadBundleWasm(bundle) {
    const { weights, bias, mean, std } = bundle;
    const dim = weights.length;
    const wPtr = weightsPtr(dim);
    const _mPtr = meanPtr(dim);
    const sPtr = stdPtr(dim);
    const bytes = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
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
    const body = [0x00, 0x43, ...f32bytes(bias)]; // no locals; acc on stack
    for (let i = 0; i < dim; i++) {
        const invStd = 1 / (std?.[i] || 1);
        body.push(0x41, ...sleb(4 * i), 0x2a, 0x02, 0x00, // f32.load input x_i
        0x43, ...f32bytes(mean?.[i] ?? 0), 0x93, // f32.sub
        0x43, ...f32bytes(invStd), 0x94, // f32.mul
        0x43, ...f32bytes(weights[i] ?? 0), 0x94, // f32.mul
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
    const data = [0x01, 0x00, 0x41, ...sleb(wPtr), 0x0b, ...leb(dataEnd - wPtr)];
    const emit = (arr, count) => {
        for (let i = 0; i < count; i++)
            data.push(...f32bytes(arr?.[i] ?? 0));
    };
    emit(weights, dim);
    emit(mean, dim);
    emit(std, dim);
    bytes.push(...section(11, data));
    return new Uint8Array(bytes);
}
export async function writeHeadBundle(dir, bundle) {
    const wasm = emitHeadBundleWasm(bundle);
    const modelDigest = sha256Prefixed(wasm);
    await ensureDir(dir);
    const wasmPath = join(dir, 'head.wasm');
    await fs.writeFile(wasmPath, wasm);
    await fs.writeFile(join(dir, 'config.json'), JSON.stringify({ modelDigest, dimension: bundle.weights.length }, null, 2));
    await fs.writeFile(join(dir, 'MODEL_DIGEST'), `${modelDigest}\n`);
    return { wasmPath, modelDigest };
}
/**
 * Load a head bundle through the sandbox posture: SHA256-verify the module
 * bytes against the pin (DigestMismatchError, fail-closed), require the wasm
 * path inside allowedPaths, and instantiate a **zero-import** module — no
 * WASI syscalls are granted at all, so the head can only compute. Calls are
 * timeout-guarded.
 */
export async function loadHeadBundle(options) {
    const { wasmPath, modelDigest, dimension } = options;
    assertWasmPathContained(wasmPath, options.allowedPaths ?? []);
    const wasm = new Uint8Array(await fs.readFile(wasmPath));
    const loaded = sha256Prefixed(wasm);
    if (loaded !== modelDigest)
        throw new DigestMismatchError(modelDigest, loaded);
    const module = await globalThis.WebAssembly.compile(wasm);
    if (WebAssembly.Module.imports(module).length > 0) {
        throw new SenarsError('Head bundle must be a zero-import module (deny-by-default sandbox)', 'VALIDATION_ERROR');
    }
    const instance = (await globalThis.WebAssembly.instantiate(module, {}));
    const { memory, evalHead } = instance.exports;
    return {
        async evaluate(embedding) {
            if (embedding.length !== dimension) {
                throw new SenarsError(`Head bundle expects ${dimension} inputs, got ${embedding.length}`, 'OPERATION_ERROR');
            }
            new Float32Array(memory.buffer, 0, dimension).set(embedding);
            return await withSandboxTimeout(Promise.resolve(evalHead(0)), options.timeoutMs ?? DEFAULT_EVAL_TIMEOUT_MS);
        },
    };
}
