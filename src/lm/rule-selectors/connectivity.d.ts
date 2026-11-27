/**
 * Connectivity/structural activation conditions for LM rules.
 */
import type { Term } from '../../terms';
export declare const isUnderconnected: (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>) => boolean;
export declare const hasStructuralSimilarityNoOverlap: (primary: Term, secondary?: Term) => boolean;
//# sourceMappingURL=connectivity.d.ts.map