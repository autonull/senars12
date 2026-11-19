/**
 * Engine origin discriminants — shared to avoid circular dependencies.
 * The kernel admits; the seam proposes; the distinction is checkable because
 * the origin is a declared field on every cognitive event.
 */
export const ENGINE_ORIGINS = ['nar', 'kernel', 'proposer', 'metta'] as const;
export type EngineOrigin = (typeof ENGINE_ORIGINS)[number];

/** The one origin permitted to append proposal events. */
export const PROPOSER_ORIGIN = 'proposer' as const;

/** The origin the reasoning engine appends under. */
export const NAR_ORIGIN = 'nar' as const;