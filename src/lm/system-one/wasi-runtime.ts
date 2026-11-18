import {
  SenarsError,
  SHA256_PINNED,
  sha256Hex,
  sha256Prefixed,
  shortSha256Hex,
} from '@senars/util';

import { createWasiSandbox } from '../../capability/wasi-sandbox.js';
import type {
  ConsensusResult,
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ReasoningBudget,
} from './types.js';

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
  constructor(expected: string, actual: string) {
    super(
      `ModelDigest mismatch: pinned '${expected}' but loaded '${actual}'. Failing closed.`,
      'DIGEST_MISMATCH',
      { expected, actual }
    );
    this.name = 'DigestMismatchError';
  }
}

export function verifyModelDigest(loaded: string, pinned: string): void {
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
export function composeModelDigest(encoderId: string, headWeightsDigest: string): string {
  return sha256Prefixed(`${encoderId}++${headWeightsDigest}`);
}

/** Derive the encoder component digest from the configured encoder identity. */
export function encoderDigest(modelId: string, dimension: number): string {
  return sha256Prefixed(`${modelId}@${dimension}`);
}

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
export class SandboxedHeadRuntime implements JudgmentManifold {
  readonly #inner: JudgmentManifold;
  readonly #config: HeadRuntimeConfig;
  #sandbox?: (fn: () => Promise<unknown>) => Promise<unknown>;

  constructor(inner: JudgmentManifold, config: HeadRuntimeConfig) {
    verifyModelDigest(config.modelDigest, config.modelDigest); // pin format check at construction
    this.#inner = inner;
    this.#config = config;
  }

  async #withSandbox<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#config.provider !== 'wasi') return fn();
    this.#sandbox ??= await createWasiSandbox({
      allowedPaths: this.#config.allowedPaths ?? [],
      timeoutMs: this.#config.timeoutMs,
    });
    return this.#sandbox(fn) as Promise<T>;
  }

  async judgeBatch(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    return this.#withSandbox(() => this.#inner.judgeBatch(sharedContext, queries, budget));
  }

  async consensus(
    sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    k: number,
    budget: ReasoningBudget
  ): Promise<ConsensusResult> {
    return this.#withSandbox(() => this.#inner.consensus(sharedContext, query, k, budget));
  }

  health(): ManifoldHealth {
    return this.#inner.health();
  }
}

/** Load a head bundle: verify digest against the pin, then wrap with the sandbox. */
export function loadHeadRuntime(
  inner: JudgmentManifold,
  config: HeadRuntimeConfig,
  loadedDigest: string
): SandboxedHeadRuntime {
  verifyModelDigest(loadedDigest, config.modelDigest);
  return new SandboxedHeadRuntime(inner, config);
}
