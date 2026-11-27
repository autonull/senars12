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
const objectOf = (shape) => z.object(shape);
export const variant = (key, tag, shape) => objectOf({ [key]: z.literal(tag), ...shape });
/** The common case: a protocol message discriminated by its `type`. */
export const msg = (type, shape) => variant('type', type, shape);
