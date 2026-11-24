/**
 * Verification Laws — the formal laws that the NAL system must satisfy.
 *
 * These laws are the acceptance criteria for the verification system.
 * Every law is expressed as a testable property that can be checked
 * against derivation records.
 */

export { verifyAllLaws, criticalLawsPass, summarizeLawResults } from './entry';
export { verifyTruthAlgebraLaws } from './truth-algebra';
export { verifyDerivationDeterminism } from './derivation-determinism';
export { verifyRevisionCommutativity, verifyRevisionAssociativity } from './revision-laws';
export { verifyNegationInvolution } from './negation-laws';
export { verifyDeductionPreservesTruth } from './deduction-laws';
export { verifyInductionAbductionBounds } from './induction-abduction-bounds';
export { verifyConversionSymmetry } from './conversion-symmetry';
export { verifyTemporalConsistency } from './temporal-consistency';
export { verifyGateFailClosed } from './gate-fail-closed';
export { verifyBudgetConservation } from './budget-conservation';
export { verifyStampCausality } from './stamp-causality';
export { verifyTermIdentity } from './term-identity';
export type { LawResult } from './types';