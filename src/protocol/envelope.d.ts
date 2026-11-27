/**
 * The wire envelope every protocol message shares.
 *
 * Twenty-one message schemas spelled the envelope by hand —
 * `z.object({ type: z.literal('…'), …fields })` — so the discriminator was a
 * second copy of the message's own name, free to disagree with the export it
 * belongs to, and `unions.ts`' two discriminated unions had to be kept in step
 * with both the schema and its literal by hand.
 *
 * `msg` is the same construction with the literal derived from the argument, which
 * is the only place it can now disagree: the constant passed here.
 */
import { z } from 'zod';
export declare const variant: <K extends string, T extends string, S extends z.ZodRawShape>(key: K, tag: T, shape: S) => z.ZodObject<S & Record<K, z.ZodLiteral<T>> extends infer T_1 ? { -readonly [P in keyof T_1]: T_1[P]; } : never, z.core.$strip>;
/** The common case: a protocol message discriminated by its `type`. */
export declare const msg: <T extends string, S extends z.ZodRawShape>(type: T, shape: S) => z.ZodObject<S & Record<"type", z.ZodLiteral<T>> extends infer T_1 ? { -readonly [P in keyof T_1]: T_1[P]; } : never, z.core.$strip>;
//# sourceMappingURL=envelope.d.ts.map