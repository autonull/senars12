import { DerivationRecord, DerivationStepRecord } from '../record';
import { Truth } from '../../kernel/truth';
import type { LawResult } from './types';

/** Law 6: Deduction Preserves Truth */
export function verifyDeductionPreservesTruth(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    for (const step of record.steps) {
      if (step.ruleId !== 'deduction') continue;

      // For deduction, conclusion confidence should not exceed min premise confidence
      const minConfidence = Math.min(...step.premises.map(p => p.truth.c));
      if (step.truth.c > minConfidence + 1e-10) {
        holds = false;
        counterexample = {
          step: step.id,
          premiseConfidences: step.premises.map(p => p.truth.c),
          conclusionConfidence: step.truth.c,
        };
        break;
      }

      // Conclusion frequency should be within [minF, maxF] of premises
      const minFreq = Math.min(...step.premises.map(p => p.truth.f));
      const maxFreq = Math.max(...step.premises.map(p => p.truth.f));
      if (step.truth.f < minFreq - 1e-10 || step.truth.f > maxFreq + 1e-10) {
        holds = false;
        counterexample = {
          step: step.id,
          premiseFrequencies: step.premises.map(p => p.truth.f),
          conclusionFrequency: step.truth.f,
        };
        break;
      }
    }
    if (!holds) break;
  }

  return {
    law: 'deduction_preserves_truth',
    holds,
    counterexample,
    description: 'Deduction conclusion truth should be bounded by premise truths',
    severity: 'critical',
  };
}