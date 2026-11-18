/**
 * NL-facing schema surface.
 * Canonical definitions live in `lm/rule-templates/schemas.ts` — re-exported here to break the
 * rule-builders → rule-templates → nl → nar import cycle while preserving this module's path.
 */
export * from '../lm/rule-templates/schemas.js';
