/**
 * Kernel Contracts — DerivationRecord
 * TypeScript types derived from Zod schemas for standalone verification.
 * Breaks cycles: rules/recorder.ts → @senars/kernel/schemas
 */
import type { DerivationRecord, DerivationStep, TruthValue } from './schemas.js';

export type { DerivationRecord, DerivationStep, TruthValue };

export interface VerificationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export interface VerifyOptions {
  readonly strict: boolean;
  readonly epsilon: number;
}

export function verifyRecord(
  record: DerivationRecord,
  options: VerifyOptions
): VerificationResult {
  const errors: string[] = [];

  if (options.strict) {
    if (!record.derivationId) errors.push('Missing derivationId');
    if (!record.taskId) errors.push('Missing taskId');
    if (!record.goalTerm) errors.push('Missing goalTerm');
    if (!record.steps || record.steps.length === 0) errors.push('No derivation steps');
    if (!record.finalTruth) errors.push('Missing finalTruth');
  }

  for (let i = 0; i < record.steps.length; i++) {
    const step = record.steps[i];
    if (options.strict) {
      if (!step.stepId) errors.push(`Step ${i}: missing stepId`);
      if (!step.ruleId) errors.push(`Step ${i}: missing ruleId`);
      if (!step.premises || step.premises.length !== 2) {
        errors.push(`Step ${i}: expected 2 premises, got ${step.premises?.length ?? 0}`);
      }
      if (!step.conclusion) errors.push(`Step ${i}: missing conclusion`);
      if (!step.truth) errors.push(`Step ${i}: missing truth`);
    }

    if (step.premiseTruths && step.premiseTruths.length !== step.premises.length) {
      errors.push(
        `Step ${i}: premiseTruths length (${step.premiseTruths.length}) !== premises length (${step.premises.length})`
      );
    }

    if (step.premiseTruths) {
      for (let j = 0; j < step.premiseTruths.length; j++) {
        const pt = step.premiseTruths[j];
        if (pt.f < 0 || pt.f > 1 || pt.c < 0 || pt.c > 1) {
          errors.push(`Step ${i}, premise ${j}: truth values out of range`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}