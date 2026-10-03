import { z } from 'zod';
import { resourceCostSchema, scoreDistributionSchema } from '../../decision/types.js';
import { createRemoteManifold } from './remote-manifold.js';
import type {
  BackendId,
  EmbeddingCache,
  JudgmentManifold,
  JudgmentProposition,
  ModelDigest,
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
    cost: resourceCostSchema,
    tier: z.number(),
    abstained: z.boolean(),
    abstainReason: z.string().optional(),
  })
  .loose();

const propositionSchema = z.discriminatedUnion('kind', [
  propositionBase.extend({
    kind: z.literal('classify'),
    distribution: z.array(scoreDistributionSchema),
    top: scoreDistributionSchema,
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
  return createRemoteManifold({
    backendId: REMOTE_MANIFOLD_BACKEND,
    endpoint: config.endpoint,
    embeddingCache: config.embeddingCache,
    timeoutMs: config.timeoutMs,
    fetchImpl: config.fetchImpl,
    errorLabel: 'Remote manifold',
    buildRequest: (embedding, queries) => ({
      contextEmbedding: Array.from(embedding),
      queries,
      trusted: false,
    }),
    parseResponse: (body) =>
      responseSchema.parse(body).propositions as unknown as JudgmentProposition[],
  });
}
