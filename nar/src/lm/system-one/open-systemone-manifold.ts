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
import { openResponseSchema, type OpenRequest, type OpenResponse } from './systemone-wire.js';

export const OPEN_REPLICA_BACKEND = 'open-systemone' as BackendId;

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
export const canonicalState = (embedding: Float32Array): string =>
  JSON.stringify(Array.from(embedding, (v) => +v.toFixed(4)));

export const toOpenQuestions = (queries: readonly JudgmentQuery[]): OpenRequest['questions'] =>
  queries.map((query, i) => {
    const id = `q${i}`;
    if (query.kind === 'classify')
      return { id, type: 'choice' as const, options: [...query.space], instruction: query.instruction };
    return {
      id,
      type: 'score' as const,
      levels: query.levels ? [...query.levels] : undefined,
      instruction: query.instruction,
    };
  });

const buildProposition = (
  query: JudgmentQuery,
  answer: OpenResponse['answers'][number],
  model: string
): JudgmentProposition => {
  const base = {
    queryId: answer.id as unknown as import('./types.js').QueryId,
    backendId: OPEN_REPLICA_BACKEND,
    modelDigest: `open:${model}` as ModelDigest,
    calibration: { version: `open-replica:${model}`, ece: -1 },
    latencyMs: 0,
    cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
    tier: 1 as const,
    abstained: answer.abstained,
  };
  if (query.kind === 'classify') {
    const distribution = answer.distribution ?? (answer.choice ? [{ option: answer.choice, p: 1 }] : []);
    const top = distribution.reduce(
      (best, d) => (d.p > best.p ? d : best),
      distribution[0] ?? { option: '', p: 0 }
    );
    return {
      ...base,
      kind: 'classify',
      axis: query.axis,
      distribution,
      top,
      entropy: -distribution.reduce((s, d) => s + (d.p > 0 ? d.p * Math.log(d.p) : 0), 0),
    } as unknown as JudgmentProposition;
  }
  const score = answer.score ?? (answer.boolean === undefined ? 0 : answer.boolean ? 1 : 0);
  return { ...base, kind: 'evaluate', axis: query.axis, score } as unknown as JudgmentProposition;
};

export function createOpenSystemOneManifold(config: OpenSystemOneManifoldConfig): JudgmentManifold {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;
  const health: ManifoldHealth = {
    backendId: OPEN_REPLICA_BACKEND,
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

    const request: OpenRequest = {
      state: canonicalState(embedding),
      questions: toOpenQuestions(queries),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${config.endpoint.replace(/\/$/, '')}/v1/systemone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Open replica HTTP ${res.status}`);
      const parsed = openResponseSchema.parse(await res.json());
      health.ready = true;
      health.breakerOpen = false;

      // Malformed/missing answers fail closed. Propositions pass through raw
      // (D4 semantics); consumers re-enter them untrusted at the LLM_PRIOR
      // ceiling via seedTruth — asserted in todo17-open-replica.test.ts.
      return queries.map((query, i) => {
        const answer = parsed.answers[i];
        if (!answer) {
          return {
            ...buildProposition(query, { id: `q${i}`, abstained: true }, parsed.model),
            abstained: true,
            abstainReason: 'low-confidence' as const,
          };
        }
        return buildProposition(query, answer, parsed.model);
      });
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
      const propositions = await judgeBatch(sharedContext, [query], budget);
      void k;
      const proposition = propositions[0];
      if (!proposition) throw new Error('Open replica returned no proposition for consensus');
      return { proposition, agreement: 1, independent: false };
    },
    health: () => ({ ...health }),
  };
}
