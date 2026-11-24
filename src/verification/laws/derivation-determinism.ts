import { DerivationRecord, DerivationStepRecord } from '../record';
import { Truth } from '../../kernel/truth';
import { replayDerivation } from '../interpreter';
import type { LawResult } from './types';

/** Law 2: Derivation Determinism */
export function verifyDerivationDeterminism(
  records: DerivationRecord[]
): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    // We need an engine to replay - this is a simplified check
    // In practice, this would use the actual engine's step function
    // For now, we verify that the same premises produce the same conclusions
    // by checking if any step has inconsistent truth given its premises
    const stepMap = new Map<string, DerivationStepRecord>();
    for (const step of record.steps) {
      const key = step.premiseIds.join(',') + '|' + step.ruleId;
      const existing = stepMap.get(key);
      if (existing && !Truth.equals(existing.truth, step.truth)) {
        holds = false;
        counterexample = {
          recordId: record.id,
          step1: existing.id,
          step2: step.id,
          premiseIds: step.premiseIds,
          ruleId: step.ruleId,
          truth1: existing.truth,
          truth2: step.truth,
        };
        break;
      }
      stepMap.set(key, step);
    }
    if (!holds) break;
  }

  return {
    law: 'derivation_determinism',
    holds,
    counterexample,
    description: 'Same premises and rule must produce identical conclusion truth',
    severity: 'critical',
  };
}