/**
 * Object/node patch schemas
 */
import { z } from 'zod';
export declare const ObjectSetMsg: z.ZodObject<{
    kind: z.ZodEnum<{
        edge: "edge";
        node: "node";
    }>;
    id: z.ZodString;
    patch: z.ZodObject<{
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        type: z.ZodOptional<z.ZodString>;
        priority: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"object.set">;
}, z.core.$strip>;
//# sourceMappingURL=object-patch.d.ts.map