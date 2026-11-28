import type { BackendId, EmbeddingCache, JudgmentManifold, JudgmentProposition, JudgmentQuery } from './types';
export interface RemoteManifoldOptions {
    backendId: BackendId;
    /** Base URL of the remote judge; `/v1/systemone` is appended. */
    endpoint: string;
    /** Shared local cache: produces the context embedding sent on the wire. */
    embeddingCache: EmbeddingCache;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    /** Error label for the HTTP status line (`Remote manifold HTTP 502`). */
    errorLabel: string;
    /** Wire request body from the shared context embedding and the query set. */
    buildRequest: (embedding: NonNullable<ReturnType<EmbeddingCache['read']>>, queries: readonly JudgmentQuery[]) => unknown;
    /** Validate the decoded body into propositions (fail closed). */
    parseResponse: (body: unknown, queries: readonly JudgmentQuery[]) => JudgmentProposition[];
}
/**
 * The one remote-judge client: bounded POST, health/breaker bookkeeping, and
 * the single-query consensus wrapper. Wire dialects (SeNARS `/v1/systemone`,
 * Open replica) differ only in request shape and response parsing.
 */
export declare function createRemoteManifold({ backendId, endpoint, embeddingCache, timeoutMs, fetchImpl, errorLabel, buildRequest, parseResponse, }: RemoteManifoldOptions): JudgmentManifold;
//# sourceMappingURL=remote-manifold.d.ts.map