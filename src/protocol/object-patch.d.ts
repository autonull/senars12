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
        truth: any;
        type: z.ZodOptional<z.ZodString>;
        priority: any;
        confidence: any;
    }, z.core.$strip>;
    type: z.ZodLiteral<"object.set">;
}, z.core.$strip>;
//# sourceMappingURL=object-patch.d.ts.map