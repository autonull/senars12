import { z } from 'zod';
import type {
  BackendId,
  ConsensusResult,
  EmbeddingCache,
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ModelDigest,
  ReasoningBudget,
} from './types.js';

/**
 * D4/X (§0.4): remote manifold client for `provider: 'http'`. POSTs
 * `{contextEmbedding, queries}` to a `/v1/systemone` endpoint (TypeSafe-compatible
 * wire shape served by `handleSystemOneRequest`) and zod-validates the response.
 * Responses re-enter as untrusted (`LLM_PRIOR` ceiling at truth-seeding time —
 * `admitRemotePropositions` / KernelPerceptionGate source-quality path).
 */

/** The local manifold digest is meaningless for a remote judge; the client
 *  records its own identity so digest-pinned governance stays local. */
export const REMOTE_MANIFOLD_DIGEST = 'sha256:remote-manifold-client' as ModelDigest;
export const REMOTE_MANIFOLD_BACKEND = 'http-remote' as BackendId;

/** Structural validation of a proposition on the wire (kind-specific payloads). */
const propositionBase = z
  .object({
    axis: z.string(),
    queryId: z.string(),
    backendId: z.string(),
    modelDigest: z.string(),
    calibration: z.object({ version: z.string(), ece: z.number() }),
    latencyMs: z.number(),
    cost: z.object({
      tokensIn: z.number(),
      tokensOut: z.number(),
      computeMs: z.number(),
      memoryMb: z.number(),
    }),
    tier: z.number(),
    abstained: z.boolean(),
    abstainReason: z.string().optional(),
  })
  .loose();

const propositionSchema = z.discriminatedUnion('kind', [
  propositionBase.extend({
    kind: z.literal('classify'),
    distribution: z.array(z.object({ option: z.string(), p: z.number() })),
    top: z.object({ option: z.string(), p: z.number() }),
    entropy: z.number(),
  }),
  propositionBase.extend({ kind: z.literal('evaluate'), score: z.number() }),
]);

const responseSchema = z.object({
  propositions: z.array(propositionSchema),
  sourceQuality: z.string().optional(),
});

export interface HttpManifoldConfig {
  /** Base URL of the remote judge, e.g. `http://127.0.0.1:8420`. */
  endpoint: string;
  /** Shared local cache: produces the context embedding sent as `contextEmbedding`. */
  embeddingCache: EmbeddingCache;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createHttpManifold(config: HttpManifoldConfig): JudgmentManifold {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;
  const health: ManifoldHealth = {
    backendId: REMOTE_MANIFOLD_BACKEND,
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
    const embedding = config.embeddingCache.read(sharedContext);
    if (!embedding) throw new Error(`Embedding not found for pointer ${sharedContext}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${config.endpoint.replace(/\/$/, '')}/v1/systemone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contextEmbedding: Array.from(embedding),
          queries,
          trusted: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Remote manifold HTTP ${res.status}`);
      const parsed = responseSchema.parse(await res.json());
      health.ready = true;
      health.breakerOpen = false;
      return parsed.propositions as unknown as JudgmentProposition[];
    } catch (e) {
      health.ready = false;
      health.breakerOpen = true;
      throw e;
    } finally {
      clearTimeout(timer);
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
      // One batched remote pass; k judges the endpoint's internal fan-out.
      const propositions = await judgeBatch(sharedContext, [query], budget);
      void k;
      const proposition = propositions[0];
      if (!proposition) throw new Error('Remote manifold returned no proposition for consensus');
      // One batched remote pass; k judges the endpoint's internal fan-out.
      return { proposition, agreement: 1, independent: false };
    },
    health: () => ({ ...health }),
  };
}
