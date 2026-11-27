import { SenarsError } from '@senars/errors';
import { SHA256_PINNED, sha256Prefixed } from '@senars/util/hash';
import { createWasiSandbox } from '../../capability/wasi-sandbox';
/**
 * Hash-pin mismatch fails closed — no fallback, no demotion ladder (§10).
 *
 * A `SenarsError` so the refusal is reported with a code: this extended plain
 * `Error`, so a digest-pin failure — the one failure in the system that must never
 * be downgraded to a retry or a demotion — reached the MCP and transport error paths
 * with `code: undefined`, indistinguishable there from a bug. `nar`'s error surface
 * declared a `DIGEST_MISMATCH` class for exactly this that nothing threw.
 */
export class DigestMismatchError extends SenarsError {
    constructor(expected, actual) {
        super(`ModelDigest mismatch: pinned '${expected}' but loaded '${actual}'. Failing closed.`, 'DIGEST_MISMATCH', { expected, actual });
        this.name = 'DigestMismatchError';
    }
}
export function verifyModelDigest(loaded, pinned) {
    if (!SHA256_PINNED.test(pinned)) {
        throw new DigestMismatchError(pinned, loaded);
    }
    if (loaded !== pinned) {
        throw new DigestMismatchError(pinned, loaded);
    }
}
/**
 * H1/X19 (Bench 26): a head ModelDigest binds the encoder to the head weights.
 * Composition = SHA256(encoderDigest ++ headWeightsDigest); swapping the encoder
 * without re-pinning heads produces a different digest and fails closed.
 */
export function composeModelDigest(encoderId, headWeightsDigest) {
    return sha256Prefixed(`${encoderId}++${headWeightsDigest}`);
}
/** Derive the encoder component digest from the configured encoder identity. */
export function encoderDigest(modelId, dimension) {
    return sha256Prefixed(`${modelId}@${dimension}`);
}
/**
 * Sandboxed head execution (§10): wraps a JudgmentManifold with the WASI
 * sandbox (deny-by-default, timeout) and hash-pinned digest verification.
 * Any digest mismatch or sandbox failure propagates — never demotes silently.
 */
export class SandboxedHeadRuntime {
    #inner;
    #config;
    #sandbox;
    constructor(inner, config) {
        verifyModelDigest(config.modelDigest, config.modelDigest); // pin format check at construction
        this.#inner = inner;
        this.#config = config;
    }
    async #withSandbox(fn) {
        if (this.#config.provider !== 'wasi')
            return fn();
        this.#sandbox ??= await createWasiSandbox({
            allowedPaths: this.#config.allowedPaths ?? [],
            timeoutMs: this.#config.timeoutMs,
        });
        return this.#sandbox(fn);
    }
    async judgeBatch(sharedContext, queries, budget) {
        return this.#withSandbox(() => this.#inner.judgeBatch(sharedContext, queries, budget));
    }
    async consensus(sharedContext, query, k, budget) {
        return this.#withSandbox(() => this.#inner.consensus(sharedContext, query, k, budget));
    }
    health() {
        return this.#inner.health();
    }
}
/** Load a head bundle: verify digest against the pin, then wrap with the sandbox. */
export function loadHeadRuntime(inner, config, loadedDigest) {
    verifyModelDigest(loadedDigest, config.modelDigest);
    return new SandboxedHeadRuntime(inner, config);
}
