import type { TermTruth } from '@senars/util';
import { criticalitySchema } from '@senars/util/config';
import { z } from 'zod';
import { seedTruth } from './seed.js';
import type {
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
} from './types.js';

/**
 * TypeSafe-compatible `/v1/systemone` endpoint (§10). Requests are
 * Zod-validated; results from untrusted remotes are marked so the receiver
 * seeds them at the `LLM_PRIOR` ceiling — never above 0.5 confidence.
 */

import { cognitiveAxisSchema } from '../../decision/types.js';

export const SystemOneQuerySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('classify'),
    instruction: z.string(),
    space: z.array(z.string()).min(1),
    axis: cognitiveAxisSchema,
    target: z.string().optional(),
    criticality: criticalitySchema.optional(),
  }),
  z.object({
    kind: z.literal('evaluate'),
    instruction: z.string(),
    rubric: z.string(),
    axis: cognitiveAxisSchema,
    levels: z.array(z.string()).optional(),
    criticality: criticalitySchema.optional(),
  }),
]);

export const SystemOneRequestSchema = z.object({
  contextEmbedding: z.array(z.number()).min(1),
  queries: z.array(SystemOneQuerySchema).min(1).max(64),
  /** Trust level declared by the caller; server decides final ceilings. */
  trusted: z.boolean().optional(),
});

export interface SystemOneHttpResponse {
  status: number;
  body: unknown;
}

export async function handleSystemOneRequest(
  request: { json(): Promise<unknown> },
  manifold: JudgmentManifold,
  budget: Parameters<JudgmentManifold['judgeBatch']>[2],
  embed: (contextEmbedding: readonly number[]) => Promise<EmbeddingPointer>
): Promise<SystemOneHttpResponse> {
  let parsed: z.infer<typeof SystemOneRequestSchema>;
  try {
    parsed = SystemOneRequestSchema.parse(await request.json());
  } catch {
    return { status: 400, body: { error: 'Invalid /v1/systemone request' } };
  }

  const pointer = await embed(parsed.contextEmbedding);
  try {
    const propositions = await manifold.judgeBatch(
      pointer,
      parsed.queries as JudgmentQuery[],
      budget
    );
    return {
      status: 200,
      body: {
        propositions,
        // Untrusted remote results are seeded at the LLM_PRIOR ceiling on re-entry.
        sourceQuality: parsed.trusted === true ? 'GENERAL' : 'LLM_PRIOR',
      },
    };
  } catch {
    return { status: 503, body: { error: 'Judgment backend unavailable' } };
  }
}

/** Receiver-side re-entry: cap confidence at the declared source-quality ceiling. */
export function admitRemotePropositions(
  propositions: readonly JudgmentProposition[],
  sourceQuality: 'LLM_PRIOR' | 'GENERAL' | 'PEER_AGENT'
): { proposition: JudgmentProposition; truth?: TermTruth }[] {
  return propositions.map((p) => ({
    proposition: p,
    // Abstained propositions carry no seeded truth (§6.4)
    truth: p.abstained ? undefined : seedTruth(p, sourceQuality),
  }));
}
