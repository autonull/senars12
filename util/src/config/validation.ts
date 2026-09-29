/**
 * Agent options validation — shared schema + validator.
 * @public
 */
import { z } from 'zod';
import { formatIssues } from '../utils/shared.js';
import { cachePath } from './paths.js';

export const contextOptsSchema = z
  .object({
    attention: z.union([z.boolean(), z.array(z.string())]).optional(),
    beliefs: z.union([z.boolean(), z.array(z.string())]).optional(),
    goals: z.union([z.boolean(), z.array(z.string())]).optional(),
    questions: z.union([z.boolean(), z.array(z.string())]).optional(),
    concepts: z.union([z.boolean(), z.array(z.string())]).optional(),
    maxItems: z.number().int().positive().optional(),
    recency: z.number().int().min(0).optional(),
  })
  .strict()
  .partial();

export const agentOptionsSchema = z
  .object({
    nar: z.unknown().optional(),
    lmService: z.unknown().optional(),
    episodicMemory: z.unknown().optional(),
    systemInstructions: z.string().min(1).max(16_000).optional(),
    context: contextOptsSchema.optional(),
    maxLoops: z.number().int().min(0).max(50).default(5),
    logger: z.unknown().optional(),
    persistKnowledge: z.boolean().default(false),
    knowledgePath: z.string().default(cachePath('agent-knowledge.json')),
    workspaceRoot: z.string().optional(),
    externalTools: z.any().optional(),
    approvalManager: z.any().optional(),
    autonomyEngine: z.any().optional(),
    reasoningIntervalMs: z.number().int().min(0).optional(),
    sessionHistoryLimit: z.number().int().min(0).optional(),
    rateLimitPerMinute: z.number().int().min(0).optional(),
    enableNlTranslation: z.boolean().optional(),
    enableNarseseHumanization: z.boolean().optional(),
  })
  .strict();

export type ValidatedAgentOptions = z.infer<typeof agentOptionsSchema>;

/** @public Structured Zod failure — one shape for every untrusted-boundary parse. */
export class SchemaValidationError extends Error {
  override name: string = 'SchemaValidationError';

  constructor(
    readonly label: string,
    readonly issues: z.core.$ZodIssue[]
  ) {
    super(`Invalid ${label}: ${formatIssues(issues)}`);
  }
}

/** @public Parse `input` or throw a `SchemaValidationError` carrying the flattened issue list. */
export const parseOrThrow = <S extends z.ZodType>(
  schema: S,
  label: string,
  input: unknown,
  ErrorType: new (label: string, issues: z.core.$ZodIssue[]) => Error = SchemaValidationError
): z.output<S> => {
  const result = schema.safeParse(input);
  if (!result.success) throw new ErrorType(label, result.error.issues);
  return result.data;
};

/** @deprecated since 0.2.0 — use `SchemaValidationError`. */
export class AgentOptionsValidationError extends SchemaValidationError {
  override name = 'AgentOptionsValidationError';
}

export const validateAgentOptions = (opts: unknown): ValidatedAgentOptions =>
  parseOrThrow(agentOptionsSchema, 'AgentOptions', opts, AgentOptionsValidationError);
