import { createWasiSandbox } from '../../capability/wasi-sandbox.js';
import type {
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ReasoningBudget,
  ConsensusResult,
} from './types.js';

const HASH_PINNED = /^sha256:[0-9a-f]{64}$/;

/** Hash-pin mismatch fails closed — no fallback, no demotion ladder (§10). */
export class DigestMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(`ModelDigest mismatch: pinned '${expected}' but loaded '${actual}'. Failing closed.`);
    this.name = 'DigestMismatchError';
  }
}

export function verifyModelDigest(loaded: string, pinned: string): void {
  if (!HASH_PINNED.test(pinned)) {
    throw new DigestMismatchError(pinned, loaded);
  }
  if (loaded !== pinned) {
    throw new DigestMismatchError(pinned, loaded);
  }
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
