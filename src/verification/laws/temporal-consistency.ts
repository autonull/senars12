import { DerivationRecord } from '../record';
import type { LawResult } from './types';

/** Law 9: Temporal Consistency */
export function verifyTemporalConsistency(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    for (const step of record.steps) {
      if (step.ruleId !== 'prediction' && step.ruleId !== 'postdiction') continue;

      // Temporal inference should preserve reasonable confidence bounds
      const minConfidence = Math.min(...step.premises.map(p => p.truth.c));
      if (step.truth.c > minConfidence + 0.1) {
        holds = false;
        counterexample = {
          step: step.id,
          rule: step.ruleId,
          premiseConfidences: step.premises.map(p => p.truth.c),
          conclusionConfidence: step.truth.c,
        };
        break;
      }
    }
    if (!holds) break;
  }

  return {
    law: 'temporal_consistency',
    holds,
    counterexample,
    description: 'Temporal inference should preserve reasonable confidence bounds',
    severity: 'major',
  };
}