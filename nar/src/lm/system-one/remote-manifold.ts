import { withDeadline } from '@senars/util';
import type {
  BackendId,
  ConsensusResult,
  EmbeddingCache,
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ReasoningBudget,
} from './types.js';

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
  buildRequest: (
    embedding: NonNullable<ReturnType<EmbeddingCache['read']>>,
    queries: readonly JudgmentQuery[]
  ) => unknown;
  /** Validate the decoded body into propositions (fail closed). */
  parseResponse: (body: unknown, queries: readonly JudgmentQuery[]) => JudgmentProposition[];
}

/**
 * The one remote-judge client: bounded POST, health/breaker bookkeeping, and
 * the single-query consensus wrapper. Wire dialects (SeNARS `/v1/systemone`,
 * Open replica) differ only in request shape and response parsing.
 */
export function createRemoteManifold({
  backendId,
  endpoint,
  embeddingCache,
  timeoutMs = 30_000,
  fetchImpl = fetch,
  errorLabel,
  buildRequest,
  parseResponse,
}: RemoteManifoldOptions): JudgmentManifold {
  const url = `${endpoint.replace(/\/$/, '')}/v1/systemone`;
  const health: ManifoldHealth = {
    backendId,
    ready: true,
    breakerOpen: false,
    rollingEce: 0,
    queueDepth: 0,
  };

  const judgeBatch = async (
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    _budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> => {
    const embedding = embeddingCache.read(sharedContext);
    if (!embedding) throw new Error(`Embedding not found for pointer ${sharedContext}`);

    try {
      const res = await withDeadline(
        (signal) =>
          fetchImpl(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildRequest(embedding, queries)),
            signal,
          }),
        timeoutMs
      );
      if (!res.ok) throw new Error(`${errorLabel} HTTP ${res.status}`);
      const propositions = parseResponse(await res.json(), queries);
      health.ready = true;
      health.breakerOpen = false;
      return propositions;
    } catch (e) {
      health.ready = false;
      health.breakerOpen = true;
      throw e;
    }
  };

  return {
    judgeBatch,
    async consensus(
      sharedContext: EmbeddingPointer,
      query: JudgmentQuery,
      k: number,
      budget: ReasoningBudget
    ): Promise<ConsensusResult> {
      // One batched remote pass; `k` judges the endpoint's internal fan-out.
      const proposition = (await judgeBatch(sharedContext, [query], budget))[0];
      void k;
      if (!proposition) throw new Error(`${errorLabel} returned no proposition for consensus`);
      return { proposition, agreement: 1, independent: false };
    },
    health: () => ({ ...health }),
  };
}
