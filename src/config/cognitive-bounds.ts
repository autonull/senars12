/**
 * Shared min/max/default bounds for cognitive parameters — single source of truth for
 * validation schemas (nar/src/config/cognitive-parameters.ts), config file schema
 * (src/config/schema.ts), and UI slider configs.
 * Avoids drift between validation limits, config defaults, and UI control ranges.
 */
import { cognitiveBound, boundTables, type CognitiveBounds, type CognitiveBoundCategory } from './bound-table';

export { type CognitiveBounds, type CognitiveBoundCategory };

// Re-export the raw table for any consumers that need it
export const cognitiveBounds = boundTables.cognitive;