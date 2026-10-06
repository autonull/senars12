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
import { timestamp } from '@senars/util/config';
import { z } from 'zod';

export const EngineOriginSchema = z.enum(ENGINE_ORIGINS);

export const CognitiveEventBaseSchema = z.object({
  engine: EngineOriginSchema,
  timestamp: timestamp,
  correlationId: z.string(),
  causationId: z.string().optional(),
  /**
   * The log's own append-order key — a ULID, not a UUID, because both logs
   * range-scan on it. Opaque to the schema and never minted as a payload field,
   * which is where the UUID requirement below belongs.
   */
  id: z.string().optional(),
});

/** The one origin permitted to append proposal events. */
export const PROPOSER_ORIGIN = 'proposer' as const;

/**
 * The origin the reasoning engine appends under, named beside `PROPOSER_ORIGIN`
 * because it is the same thing: the `'nar'` literal was written by hand at seven
 * sites, so `engine` — the discriminant that makes "the seam proposes, the kernel
 * admits" checkable — was the one field of an event with no declared name.
 */
export const NAR_ORIGIN = 'nar' as const;
