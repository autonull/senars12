/**
 * Shared min/max/default bounds for NAR core config — single source of truth for
 * the engine defaults (`nar/src/types/core.ts`), the config-file schemas
 * (`src/config/schema.ts`) and the UI slider configs (`ui/src/server/config-schema.ts`).
 * Avoids drift between validation limits, engine defaults and UI control ranges.
 */
import { narCoreBound, boundTables, type NarCoreBounds, type NarCoreBoundKey } from './bound-table';

export { type NarCoreBounds, type NarCoreBoundKey };

/** A bound row's limits, never restated: `narCoreNumber('maxDerivationDepth')`. */
export const narCoreNumber = (key: NarCoreBoundKey) => narCoreBound.schema(key, { defaulted: false });

/** The same row carrying its default — what a config-file field wants. */
export const narCoreDefaultedNumber = (key: NarCoreBoundKey) => narCoreBound.schema(key);

/** Every bound's default, keyed by knob — the projection the engine's `DEFAULT_CONFIG`
 *  and the config-file schema's `narCoreDefaults` both wanted and each re-derived. */
export const narCoreDefaults: Record<NarCoreBoundKey, number> = narCoreBound.defaults;

/** The whole table as one zod object, defaults attached — so the schema is the bounds
 *  rather than a hand-maintained transcription of them. */
export const narCoreDefaultsSchema = narCoreBound.defaultsSchema;

// Re-export the raw table for any consumers that need it
export const narCoreBounds = boundTables.narCore;