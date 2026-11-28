import { SenarsError } from '@senars/errors';
import type { ConsensusResult, EmbeddingPointer, JudgmentManifold, JudgmentProposition, JudgmentQuery, ManifoldHealth, ReasoningBudget } from './types';
/**
 * Hash-pin mismatch fails closed — no fallback, no demotion ladder (§10).
 *
 * A `SenarsError` so the refusal is reported with a code: this extended plain
 * `Error`, so a digest-pin failure — the one failure in the system that must never
 * be downgraded to a retry or a demotion — reached the MCP and transport error paths
 * with `code: undefined`, indistinguishable there from a bug. `nar`'s error surface
 * declared a `DIGEST_MISMATCH` class for exactly this that nothing threw.
 */
export declare class DigestMismatchError extends SenarsError {
    constructor(expected: string, actual: string);
}
export declare function verifyModelDigest(loaded: string, pinned: string): void;
/**
 * H1/X19 (Bench 26): a head ModelDigest binds the encoder to the head weights.
 * Composition = SHA256(encoderDigest ++ headWeightsDigest); swapping the encoder
 * without re-pinning heads produces a different digest and fails closed.
 */
export declare function composeModelDigest(encoderId: string, headWeightsDigest: string): string;
/** Derive the encoder component digest from the configured encoder identity. */
export declare function encoderDigest(modelId: string, dimension: number): string;
export type HeadRuntimeProvider = 'wasi' | 'webgpu' | 'http' | 'peer' | 'off';
export interface HeadRuntimeConfig {
    provider: HeadRuntimeProvider;
    /** Pinned SHA256(weights) of the head bundle. Mismatch ⇒ fail closed. */
    modelDigest: string;
    timeoutMs?: number;
    allowedPaths?: string[];
}
/**
 * Sandboxed head execution (§10): wraps a JudgmentManifold with the WASI
 * sandbox (deny-by-default, timeout) and hash-pinned digest verification.
 * Any digest mismatch or sandbox failure propagates — never demotes silently.
 */
export declare class SandboxedHeadRuntime implements JudgmentManifold {
    #private;
    constructor(inner: JudgmentManifold, config: HeadRuntimeConfig);
    judgeBatch(sharedContext: EmbeddingPointer, queries: readonly JudgmentQuery[], budget: ReasoningBudget): Promise<JudgmentProposition[]>;
    consensus(sharedContext: EmbeddingPointer, query: JudgmentQuery, k: number, budget: ReasoningBudget): Promise<ConsensusResult>;
    health(): ManifoldHealth;
}
/** Load a head bundle: verify digest against the pin, then wrap with the sandbox. */
export declare function loadHeadRuntime(inner: JudgmentManifold, config: HeadRuntimeConfig, loadedDigest: string): SandboxedHeadRuntime;
//# sourceMappingURL=wasi-runtime.d.ts.map