import { type OpenRequest } from './systemone-wire';
import type { BackendId, EmbeddingCache, JudgmentManifold, JudgmentQuery } from './types';
export declare const OPEN_REPLICA_BACKEND: BackendId;
/**
 * TODO17 D2: bridge to community one-pass decision models speaking the open
 * `{state, questions}` wire shape. Responses re-enter untrusted — every
 * proposition is seeded at the `LLM_PRIOR` ceiling (confidence ≤ 0.5) and
 * provenance-stamped with the replica's model id.
 */
export interface OpenSystemOneManifoldConfig {
    endpoint: string;
    embeddingCache: EmbeddingCache;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    /** Replica identity for provenance, e.g. 'kev:1.0'. */
    replicaId?: string;
}
/** Canonical perception state text: stable JSON of the context embedding. */
export declare const canonicalState: (embedding: Float32Array) => string;
export declare const toOpenQuestions: (queries: readonly JudgmentQuery[]) => OpenRequest['questions'];
export declare function createOpenSystemOneManifold(config: OpenSystemOneManifoldConfig): JudgmentManifold;
//# sourceMappingURL=open-systemone-manifold.d.ts.map