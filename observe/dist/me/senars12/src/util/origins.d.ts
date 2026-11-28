/**
 * Engine origin discriminants — shared to avoid circular dependencies.
 * The kernel admits; the seam proposes; the distinction is checkable because
 * the origin is a declared field on every cognitive event.
 */
export declare const ENGINE_ORIGINS: readonly ['nar', 'kernel', 'proposer', 'metta'];
export type EngineOrigin = (typeof ENGINE_ORIGINS)[number];
/** The one origin permitted to append proposal events. */
export declare const PROPOSER_ORIGIN: 'proposer';
/** The origin the reasoning engine appends under. */
export declare const NAR_ORIGIN: 'nar';
//# sourceMappingURL=origins.d.ts.map