import { z } from 'zod';

/**
 * TODO17 D1: the community System One wire shape (`{state, questions}` —
 * kev / von / openjev-sglang / simple-jev interop). SeNARS JudgmentQueries
 * translate in; answers translate back out at the `LLM_PRIOR` ceiling.
 */

export const openQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['choice', 'score', 'boolean']),
  /** choice: the option space (SeNARS classify space). */
  options: z.array(z.string()).optional(),
  /** score/boolean: the level legend (SeNARS evaluate levels). */
  levels: z.array(z.string()).optional(),
  instruction: z.string().default(''),
});

export const openRequestSchema = z.object({
  state: z.string(),
  questions: z.array(openQuestionSchema),
});

export const openAnswerSchema = z.object({
  id: z.string(),
  choice: z.string().optional(),
  distribution: z.array(z.object({ option: z.string(), p: z.number() })).optional(),
  score: z.number().optional(),
  boolean: z.boolean().optional(),
  abstained: z.boolean().default(false),
});

export const openResponseSchema = z.object({
  model: z.string().default('open-replica'),
  answers: z.array(openAnswerSchema),
});

export type OpenQuestion = z.infer<typeof openQuestionSchema>;
export type OpenRequest = z.infer<typeof openRequestSchema>;
export type OpenAnswer = z.infer<typeof openAnswerSchema>;
export type OpenResponse = z.infer<typeof openResponseSchema>;
