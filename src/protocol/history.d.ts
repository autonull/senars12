/**
 * Node history message schemas
 */
import { z } from 'zod';
export declare const NodeHistoryRequestMsg: z.ZodObject<{
    term: z.ZodString;
    type: z.ZodLiteral<"node.history.request">;
}, z.core.$strip>;
export declare const NodeHistoryMsg: z.ZodObject<{
    term: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        stampId: z.ZodString;
        timestamp: z.ZodNumber;
        source: z.ZodEnum<{
            derivation: "derivation";
            inference: "inference";
            input: "input";
            revision: "revision";
        }>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"node.history">;
}, z.core.$strip>;
//# sourceMappingURL=history.d.ts.map