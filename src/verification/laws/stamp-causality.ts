import { DerivationRecord } from '../record';
import type { LawResult } from './types';

/** Law 12: Stamp Causality */
export function verifyStampCausality(records: DerivationRecord[]): LawResult {
  let holds = true;
  let counterexample: unknown = undefined;

  for (const record of records) {
    for (const step of record.steps) {
      // Stamp evidence should be >= max premise evidence + 1
      const maxPremiseEvidence = Math.max(...step.premises.map(p => p.stamp.evidence), 0);
      if (step.stamp.evidence < maxPremiseEvidence + 1) {
        holds = false;
        counterexample = { step: step.id, maxPremiseEvidence, stepEvidence: step.stamp.evidence };
        break;
      }
      // Stamp timestamp should be >= max premise timestamp
      const maxPremiseTs = Math.max(...step.premises.map(p => p.stamp.ts), 0);
      if (step.stamp.ts < maxPremiseTs) {
        holds = false;
        counterexample = { step: step.id, maxPremiseTs, stepTs: step.stamp.ts };
        break;
      }
      // Stamp parents should include premise stamps
      for (const premise of step.premises) {
        if (!step.stamp.parents.includes(premise.stamp.id)) {
          holds = false;
          counterexample = { step: step.id, missingParent: premise.stamp.id };
          break;
        }
      }
    }
    if (!holds) break;
  }

  return {
    law: 'stamp_causality',
    holds,
    counterexample,
    description: 'Derived stamps must correctly track causal parents and evidence depth',
    severity: 'critical',
  };
}