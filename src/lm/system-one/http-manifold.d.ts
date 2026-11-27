import type { BackendId, EmbeddingCache, JudgmentManifold } from './types';
/**
 * D4/X (§0.4): remote manifold client for `provider: 'http'`. POSTs
 * `{contextEmbedding, queries}` to a `/v1/systemone` endpoint (TypeSafe-compatible
 * wire shape served by `handleSystemOneRequest`) and zod-validates the response.
 * Responses re-enter as untrusted (`LLM_PRIOR` ceiling at truth-seeding time —
 * `admitRemotePropositions` / KernelPerceptionGate source-quality path).
 */
/** The local manifold digest is meaningless for a remote judge; the client
 *  records its own identity so digest-pinned governance stays local. */
export declare const REMOTE_MANIFOLD_BACKEND: BackendId;
export interface HttpManifoldConfig {
    /** Base URL of the remote judge, e.g. `http://127.0.0.1:8420`. */
    endpoint: string;
    /** Shared local cache: produces the context embedding sent as `contextEmbedding`. */
    embeddingCache: EmbeddingCache;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}
export declare function createHttpManifold(config: HttpManifoldConfig): JudgmentManifold;
//# sourceMappingURL=http-manifold.d.ts.map