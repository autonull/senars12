/**
 * Kernel Contracts — DerivationRecord
 * TypeScript types derived from Zod schemas for standalone verification.
 * Breaks cycles: rules/recorder.ts → @senars/kernel/schemas
 *
 * @deprecated since 1.0 — use `@senars/kernel/verify-derivation` instead. This module performs a
 * structural presence check only; `verify-derivation` additionally recomputes the truth algebra,
 * validates substitution, checks lineage DAG, and verifies the independence flag. Reach for this
 * only if you specifically need the cheap shape-only pass.
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

/** @deprecated since 1.0 — use `verifyRecord` from `@senars/kernel/verify-derivation`. */
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

  for (const [i, step] of record.steps.entries()) {
    if (!step) {
      errors.push(`Step ${i}: missing step`);
      continue;
    }
    if (options.strict) checkStepPresence(errors, i, step);

    const premises = step.premises?.length ?? 0;
    const premiseTruths = step.premiseTruths;
    if (premiseTruths && premiseTruths.length !== premises) {
      errors.push(
        `Step ${i}: premiseTruths length (${premiseTruths.length}) !== premises length (${premises})`
      );
    }

    for (const [j, pt] of (premiseTruths ?? []).entries()) {
      if (
        pt &&
        (pt.frequency < 0 ||
          pt.frequency > 1 ||
          pt.confidence < 0 ||
          pt.confidence > 1)
      ) {
        errors.push(`Step ${i}, premise ${j}: truth values out range`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function checkStepPresence(errors: string[], i: number, step: DerivationStep): void {
  if (!step.stepId) errors.push(`Step ${i}: missing stepId`);
  if (!step.ruleId) errors.push(`Step ${i}: missing ruleId`);
  if (!step.premises || step.premises.length !== 2) {
    errors.push(`Step ${i}: expected 2 premises, got ${step.premises?.length ?? 0}`);
  }
  if (!step.conclusion) errors.push(`Step ${i}: missing conclusion`);
  if (!step.truth) errors.push(`Step ${i}: missing truth`);
}
