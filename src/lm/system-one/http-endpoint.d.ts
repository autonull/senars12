import type { TermTruth } from '@senars/types/truth';
import { z } from 'zod';
import type { EmbeddingPointer, JudgmentManifold, JudgmentProposition } from './types';
export declare const SystemOneQuerySchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"classify">;
    instruction: z.ZodString;
    space: z.ZodArray<z.ZodString>;
    axis: z.ZodEnum<{
        epistemic: "epistemic";
        teleological: "teleological";
    }>;
    target: z.ZodOptional<z.ZodString>;
    criticality: any;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"evaluate">;
    instruction: z.ZodString;
    rubric: z.ZodString;
    axis: z.ZodEnum<{
        epistemic: "epistemic";
        teleological: "teleological";
    }>;
    levels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    criticality: any;
}, z.core.$strip>], "kind">;
export declare const SystemOneRequestSchema: z.ZodObject<{
    contextEmbedding: z.ZodArray<z.ZodNumber>;
    queries: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"classify">;
        instruction: z.ZodString;
        space: z.ZodArray<z.ZodString>;
        axis: z.ZodEnum<{
            epistemic: "epistemic";
            teleological: "teleological";
        }>;
        target: z.ZodOptional<z.ZodString>;
        criticality: any;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"evaluate">;
        instruction: z.ZodString;
        rubric: z.ZodString;
        axis: z.ZodEnum<{
            epistemic: "epistemic";
            teleological: "teleological";
        }>;
        levels: z.ZodOptional<z.ZodArray<z.ZodString>>;
        criticality: any;
    }, z.core.$strip>], "kind">>;
    trusted: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export interface SystemOneHttpResponse {
    status: number;
    body: unknown;
}
export declare function handleSystemOneRequest(request: {
    json(): Promise<unknown>;
}, manifold: JudgmentManifold, budget: Parameters<JudgmentManifold['judgeBatch']>[2], embed: (contextEmbedding: readonly number[]) => Promise<EmbeddingPointer>): Promise<SystemOneHttpResponse>;
/** Receiver-side re-entry: cap confidence at the declared source-quality ceiling. */
export declare function admitRemotePropositions(propositions: readonly JudgmentProposition[], sourceQuality: 'LLM_PRIOR' | 'GENERAL' | 'PEER_AGENT'): {
    proposition: JudgmentProposition;
    truth?: TermTruth;
}[];
//# sourceMappingURL=http-endpoint.d.ts.map