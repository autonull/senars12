import { DerivationRecord, DerivationStepRecord } from '../record';
import type { LawResult } from './types';

/** Law 11: Budget Conservation */
export function verifyBudgetConservation(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    // Check that total steps don't exceed a reasonable budget
    // This is a placeholder - actual budget tracking would be in the meta field
    const totalSteps = record.steps.length;
    const maxBudget = (record.meta?.budget as number) ?? 1000;
    if (totalSteps > maxBudget) {
      holds = false;
      counterexample = { record: record.id, totalSteps, maxBudget };
      break;
    }
  }

  return {
    law: 'budget_conservation',
    holds,
    counterexample,
    description: 'Total derivation steps should not exceed allocated budget',
    severity: 'major',
  };
}