import { z } from 'zod';
/** The `0..1` truth pair every event payload, derivation record, and formalization candidate carries. */
export declare const BeliefTruthSchema: z.ZodObject<{
    frequency: z.ZodNumber;
    confidence: z.ZodNumber;
}, z.core.$strip>;
/** The `{ f, c }` truth shape the engine speaks internally. */
export declare const TermTruthSchema: z.ZodObject<{
    f: z.ZodNumber;
    c: z.ZodNumber;
}, z.core.$strip>;
//# sourceMappingURL=truth-schema.d.ts.map