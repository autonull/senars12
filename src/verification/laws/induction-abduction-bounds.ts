import { DerivationRecord, DerivationStepRecord } from '../record';
import type { LawResult } from './types';

/** Law 7: Induction/Abduction Bounds */
export function verifyInductionAbductionBounds(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    for (const step of record.steps) {
      if (step.ruleId !== 'induction' && step.ruleId !== 'abduction') continue;

      // Induction/Abduction confidence should be <= min premise confidence
      const minConfidence = Math.min(...step.premises.map(p => p.truth.c));
      if (step.truth.c > minConfidence + 1e-10) {
        holds = false;
        counterexample = {
          step: step.id,
          rule: step.ruleId,
          premiseConfidences: step.premises.map(p => p.truth.c),
          conclusionConfidence: step.truth.c,
        };
        break;
      }

      // Frequency should be bounded
      const minFreq = Math.min(...step.premises.map(p => p.truth.f));
      const maxFreq = Math.max(...step.premises.map(p => p.truth.f));
      if (step.truth.f < minFreq - 1e-10 || step.truth.f > maxFreq + 1e-10) {
        holds = false;
        counterexample = {
          step: step.id,
          rule: step.ruleId,
          premiseFrequencies: step.premises.map(p => p.truth.f),
          conclusionFrequency: step.truth.f,
        };
        break;
      }
    }
    if (!holds) break;
  }

  return {
    law: 'induction_abduction_bounds',
    holds,
    counterexample,
    description: 'Induction and abduction conclusions should be bounded by premises',
    severity: 'critical',
  };
}