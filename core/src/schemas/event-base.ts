/**
 * The fields every cognitive event carries, whatever admitted it.
 *
 * A leaf on purpose: `cognitive-events` and `proposal` both extend it, so it
 * cannot live in either without the other importing across. `engine` is the
 * provenance discriminant — a `proposer` may only append the two proposal events,
 * which is what makes "the seam proposes; the kernel admits" checkable rather
 * than conventional.
 */

import { ENGINE_ORIGINS } from '@senars/util';
import { z } from 'zod';

export const EngineOriginSchema = z.enum(ENGINE_ORIGINS);

export const CognitiveEventBaseSchema = z.object({
  engine: EngineOriginSchema,
  timestamp: z.number().int().positive(),
  correlationId: z.string(),
  causationId: z.string().optional(),
  id: z.string().uuid().optional(),
});

/** The one origin permitted to append proposal events. */
export const PROPOSER_ORIGIN = 'proposer' as const;