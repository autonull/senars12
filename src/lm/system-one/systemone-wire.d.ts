import { z } from 'zod';
/**
 * TODO17 D1: the community System One wire shape (`{state, questions}` —
 * kev / von / openjev-sglang / simple-jev interop). SeNARS JudgmentQueries
 * translate in; answers translate back out at the `LLM_PRIOR` ceiling.
 */
export declare const openQuestionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        boolean: "boolean";
        choice: "choice";
        score: "score";
    }>;
    options: z.ZodOptional<z.ZodArray<z.ZodString>>;
    levels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    instruction: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const openRequestSchema: z.ZodObject<{
    state: z.ZodString;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            boolean: "boolean";
            choice: "choice";
            score: "score";
        }>;
        options: z.ZodOptional<z.ZodArray<z.ZodString>>;
        levels: z.ZodOptional<z.ZodArray<z.ZodString>>;
        instruction: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const openAnswerSchema: z.ZodObject<{
    id: z.ZodString;
    choice: z.ZodOptional<z.ZodString>;
    distribution: z.ZodOptional<z.ZodArray<z.ZodObject<{
        option: z.ZodString;
        p: z.ZodNumber;
    }, z.core.$strip>>>;
    score: z.ZodOptional<z.ZodNumber>;
    boolean: z.ZodOptional<z.ZodBoolean>;
    abstained: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const openResponseSchema: z.ZodObject<{
    model: z.ZodDefault<z.ZodString>;
    answers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        choice: z.ZodOptional<z.ZodString>;
        distribution: z.ZodOptional<z.ZodArray<z.ZodObject<{
            option: z.ZodString;
            p: z.ZodNumber;
        }, z.core.$strip>>>;
        score: z.ZodOptional<z.ZodNumber>;
        boolean: z.ZodOptional<z.ZodBoolean>;
        abstained: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type OpenQuestion = z.infer<typeof openQuestionSchema>;
export type OpenRequest = z.infer<typeof openRequestSchema>;
export type OpenAnswer = z.infer<typeof openAnswerSchema>;
export type OpenResponse = z.infer<typeof openResponseSchema>;
//# sourceMappingURL=systemone-wire.d.ts.map