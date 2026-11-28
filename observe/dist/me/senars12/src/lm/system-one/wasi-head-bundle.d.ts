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
/**
 * Emit a WASM module evaluating `clamp01(w·z + b)` where `z = (x−mean)/std`
 * over an f32 input vector written at offset 0 of exported memory. Unrolled
 * per-weight chain (no loops, no locals) — one module per head shape.
 */
export declare function emitHeadBundleWasm(bundle: HeadBundle): Uint8Array;
export interface HeadBundleArtifacts {
    wasmPath: string;
    /** sha256:<hex> over the emitted module bytes — the pin for loadHeadBundle. */
    modelDigest: string;
}
export declare function writeHeadBundle(dir: string, bundle: HeadBundle): Promise<HeadBundleArtifacts>;
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
export declare function loadHeadBundle(options: {
    wasmPath: string;
    modelDigest: string;
    dimension: number;
    allowedPaths?: string[];
    timeoutMs?: number;
}): Promise<LoadedHeadBundle>;
//# sourceMappingURL=wasi-head-bundle.d.ts.map