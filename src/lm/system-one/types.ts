/**
 * Re-export of the decision layer's vocabulary, now at `nar/src/decision/types.ts`
 * (TODO29.a §5.11).
 *
 * A shim rather than a move in effect: the layer's importers keep the path they
 * had, and the *core* can name the same committed types without importing
 * anything under `lm/` — which is the condition A2's gate makes structural and
 * §5.11's "typed in the layer's own vocabulary" needs to be satisfiable at all.
 */
export * from '../../decision/types.js';
