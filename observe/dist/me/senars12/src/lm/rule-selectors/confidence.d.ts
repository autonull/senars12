/**
 * Confidence/conflict-based activation conditions for LM rules.
 */
import type { Term } from '../../terms';
/**
 * No truth reading at all is *not* low confidence: absent is not 0, so this one
 * reads the context itself rather than going through {@link ctxNumber}.
 */
export declare const hasLowConfidence: (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>) => boolean;
export declare const hasConflictingBeliefs: (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>) => boolean;
export declare const hasHighCuriosity: (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>) => boolean;
//# sourceMappingURL=confidence.d.ts.map