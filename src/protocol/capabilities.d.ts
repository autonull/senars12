/**
 * Agent capabilities schema
 */
import { z } from 'zod';
export declare const AgentCapabilities: z.ZodObject<{
    engine: z.ZodEnum<{
        nar: "nar";
    }>;
    supports: z.ZodObject<{
        chat: z.ZodBoolean;
        beliefs: z.ZodBoolean;
        drives: z.ZodBoolean;
        skills: z.ZodBoolean;
        ltm: z.ZodBoolean;
        rlfp: z.ZodBoolean;
        selfReasoning: z.ZodBoolean;
        autonomyLoop: z.ZodBoolean;
    }, z.core.$strip>;
    configSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type AgentCapabilities = z.infer<typeof AgentCapabilities>;
//# sourceMappingURL=capabilities.d.ts.map