/**
 * Agent options validation — shared schema + validator.
 * @public
 */
import { z } from 'zod';
import { SenarsError } from '../errors/senars-error.js';
import { formatIssues } from '../utils/diagnostics.js';
import { intBetween, nonEmpty, nonNegativeInt, positiveInt } from './boundary.js';
import { cachePath } from './paths.js';

export const contextOptsSchema = z
  .object({
    attention: z.union([z.boolean(), z.array(z.string())]).optional(),
    beliefs: z.union([z.boolean(), z.array(z.string())]).optional(),
    goals: z.union([z.boolean(), z.array(z.string())]).optional(),
    questions: z.union([z.boolean(), z.array(z.string())]).optional(),
    concepts: z.union([z.boolean(), z.array(z.string())]).optional(),
    maxItems: positiveInt.optional(),
    recency: nonNegativeInt.optional(),
  })
  .strict()
  .partial();

export const agentOptionsSchema = z
  .object({
    nar: z.unknown().optional(),
    lmService: z.unknown().optional(),
    episodicMemory: z.unknown().optional(),
    systemInstructions: nonEmpty.max(16_000).optional(),
    context: contextOptsSchema.optional(),
    maxLoops: intBetween(0, 50).default(5),
    logger: z.unknown().optional(),
    persistKnowledge: z.boolean().default(false),
    // Lazy default: `cachePath` calls `node:path.join`, and this schema is
    // reachable from the browser bundle through `@senars/util`'s barrel. Eager
    // evaluation made loading the client touch the externalized `node:path`
    // module and throw. The default is only needed at parse time, on the server.
    knowledgePath: z.string().default(() => cachePath('agent-knowledge.json')),
    workspaceRoot: z.string().optional(),
    externalTools: z.any().optional(),
    approvalManager: z.any().optional(),
    autonomyEngine: z.any().optional(),
    reasoningIntervalMs: nonNegativeInt.optional(),
    sessionHistoryLimit: nonNegativeInt.optional(),
    rateLimitPerMinute: nonNegativeInt.optional(),
    enableNlTranslation: z.boolean().optional(),
    enableNarseseHumanization: z.boolean().optional(),
  })
  .strict();

export type ValidatedAgentOptions = z.infer<typeof agentOptionsSchema>;

/** @public Structured Zod failure — one shape for every untrusted-boundary parse. */
export class SchemaValidationError extends SenarsError {
  constructor(
    readonly label: string,
    readonly issues: z.core.$ZodIssue[]
  ) {
    super(`Invalid ${label}: ${formatIssues(issues)}`, 'VALIDATION_ERROR', { label, issues });
    this.name = 'SchemaValidationError';
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

/**
 * A named parse-or-throw for one schema. Every boundary that validates a payload
 * published it as a one-line function over {@link parseOrThrow}, and the label —
 * the only part of the failure a reader acts on — was a second hand-written string
 * that could name something other than the schema it was bound to.
 */
export const validatorFor =
  <S extends z.ZodType>(schema: S, label: string) =>
  (input: unknown): z.output<S> =>
    parseOrThrow(schema, label, input);
