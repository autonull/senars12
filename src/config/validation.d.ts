/**
 * Agent options validation — shared schema + validator.
 * @public
 */
import { z } from 'zod';
import { SenarsError } from '../errors';
export declare const contextOptsSchema: z.ZodObject<{
    attention: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
    beliefs: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
    goals: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
    questions: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
    concepts: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
    maxItems: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    recency: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strict>;
export declare const agentOptionsSchema: z.ZodObject<{
    nar: z.ZodOptional<z.ZodUnknown>;
    lmService: z.ZodOptional<z.ZodUnknown>;
    episodicMemory: z.ZodOptional<z.ZodUnknown>;
    systemInstructions: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodObject<{
        attention: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
        beliefs: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
        goals: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
        questions: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
        concepts: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
        maxItems: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        recency: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strict>>;
    maxLoops: z.ZodDefault<z.ZodNumber>;
    logger: z.ZodOptional<z.ZodUnknown>;
    persistKnowledge: z.ZodDefault<z.ZodBoolean>;
    knowledgePath: z.ZodDefault<z.ZodString>;
    workspaceRoot: z.ZodOptional<z.ZodString>;
    externalTools: z.ZodOptional<z.ZodAny>;
    approvalManager: z.ZodOptional<z.ZodAny>;
    autonomyEngine: z.ZodOptional<z.ZodAny>;
    reasoningIntervalMs: z.ZodOptional<z.ZodNumber>;
    sessionHistoryLimit: z.ZodOptional<z.ZodNumber>;
    rateLimitPerMinute: z.ZodOptional<z.ZodNumber>;
    enableNlTranslation: z.ZodOptional<z.ZodBoolean>;
    enableNarseseHumanization: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export type ValidatedAgentOptions = z.infer<typeof agentOptionsSchema>;
/** @public Structured Zod failure — one shape for every untrusted-boundary parse. */
export declare class ZodValidationError extends SenarsError {
    readonly label: string;
    readonly issues: z.core.$ZodIssue[];
    constructor(label: string, issues: z.core.$ZodIssue[]);
}
/** @public Parse `input` or throw a `ZodValidationError` carrying the flattened issue list. */
export declare const parseOrThrow: <S extends z.ZodType>(schema: S, label: string, input: unknown, ErrorType?: new (label: string, issues: z.core.$ZodIssue[]) => Error) => z.output<S>;
/**
 * A named parse-or-throw for one schema. Every boundary that validates a payload
 * published it as a one-line function over {@link parseOrThrow}, and the label —
 * the only part of the failure a reader acts on — was a second hand-written string
 * that could name something other than the schema it was bound to.
 */
export declare const validatorFor: <S extends z.ZodType>(schema: S, label: string) => (input: unknown) => z.output<S>;
//# sourceMappingURL=validation.d.ts.map