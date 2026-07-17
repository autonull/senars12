/**
 * Agent options validation — shared schema + validator.
 * @public
 */
import { z } from 'zod';

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
    knowledgePath: z.string().default('.cache/agent-knowledge.json'),
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

export class AgentOptionsValidationError extends Error {
  override name = 'AgentOptionsValidationError' as const;

  constructor(
    message: string,
    readonly issues: z.ZodIssue[]
  ) {
    super(message);
  }
}

export const validateAgentOptions = (opts: unknown): ValidatedAgentOptions => {
  const result = agentOptionsSchema.safeParse(opts);
  if (!result.success) {
    throw new AgentOptionsValidationError(
      `Invalid AgentOptions: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      result.error.issues
    );
  }
  return result.data;
};
