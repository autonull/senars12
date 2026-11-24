import { DerivationRecord } from '../record';
import { verifyTruthAlgebraLaws } from './truth-algebra';
import { verifyDerivationDeterminism } from './derivation-determinism';
import { verifyRevisionCommutativity, verifyRevisionAssociativity } from './revision-laws';
import { verifyNegationInvolution } from './negation-laws';
import { verifyDeductionPreservesTruth } from './deduction-laws';
import { verifyInductionAbductionBounds } from './induction-abduction-bounds';
import { verifyConversionSymmetry } from './conversion-symmetry';
import { verifyTemporalConsistency } from './temporal-consistency';
import { verifyGateFailClosed } from './gate-fail-closed';
import { verifyBudgetConservation } from './budget-conservation';
import { verifyStampCausality } from './stamp-causality';
import { verifyTermIdentity } from './term-identity';
import { summarizeLawResults, criticalLawsPass } from './summary';
import type { LawResult } from './types';

/** Verify all laws against a set of derivations. */
export function verifyAllLaws(
  records: DerivationRecord[],
  options: { sampleSize?: number } = {}
): LawResult[] {
  const results: LawResult[] = [];
  const sample = records.slice(0, options.sampleSize ?? 1000);

  // Law 1: Truth Algebra Laws
  results.push(...verifyTruthAlgebraLaws());

  // Law 2: Derivation Determinism
  results.push(verifyDerivationDeterminism(sample));

  // Law 3: Revision Commutativity
  results.push(verifyRevisionCommutativity(sample));

  // Law 4: Revision Associativity
  results.push(verifyRevisionAssociativity(sample));

  // Law 5: Negation Involution
  results.push(verifyNegationInvolution());

  // Law 6: Deduction Preserves Truth
  results.push(verifyDeductionPreservesTruth(sample));

  // Law 7: Induction/Abduction Bounds
  results.push(verifyInductionAbductionBounds(sample));

  // Law 8: Conversion Symmetry
  results.push(verifyConversionSymmetry(sample));

  // Law 9: Temporal Consistency
  results.push(verifyTemporalConsistency(sample));

  // Law 10: Gate Fail-Closed
  results.push(verifyGateFailClosed());

  // Law 11: Budget Conservation
  results.push(verifyBudgetConservation(sample));

  // Law 12: Stamp Causality
  results.push(verifyStampCausality(sample));

  // Law 13: Term Identity
  results.push(verifyTermIdentity(sample));

  return results;
}

export { summarizeLawResults, criticalLawsPass };