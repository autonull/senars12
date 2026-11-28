/**
 * Term validation - detect tautologies, contradictions, and invalid task terms
 */
import type { Term } from '../types';
export declare const isTautology: (term: Term) => boolean;
export declare const isInvalidTaskTerm: (term: Term) => boolean;
export declare const validateTaskTerm: (term: Term) => {
    valid: true;
} | {
    valid: false;
    reason: string;
};
//# sourceMappingURL=validation.d.ts.map