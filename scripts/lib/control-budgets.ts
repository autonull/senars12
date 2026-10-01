/**
 * Verdict logic for `control-budgets` — the A7 gate (TODO29.a §5.7).
 *
 * Every budget is a declared `ReasoningBudget` scope with a named owner, a
 * default, a configuration source, an overflow `TerminationReason`, and a call
 * site that spends it. This module holds the rules; the gate prints them and the
 * test proves each one can fail.
 *
 * The rules exist because the failure is invisible by construction. A scope that
 * nothing spends is a comment, a `scopeId` with no owner has nobody to fix it, a
 * spend whose operation is not the declared one means the ceiling being read is
 * not the ceiling that was documented, and two scopes sharing an operation are
 * one budget with two vocabularies — §4 row 9's shape.
 */

import { BUDGET_SCOPE_IDS, BUDGET_SCOPES } from '../../nar/src/kernel/budget-scopes.js';

export interface BudgetSpend {
  /** Repo-relative `file:line`. */
  readonly at: string;
  readonly scopeId: string;
}

export interface BudgetSubject {
  readonly scopeIds: readonly (keyof typeof BUDGET_SCOPES)[];
  readonly spends: readonly BudgetSpend[];
  /** Operations the budget schema declares, read from its text. */
  readonly declaredOperations: readonly string[];
}

export type BudgetViolation = {
  readonly rule: string;
  readonly at: string;
  readonly detail: string;
};

/** The scope ids actually spent, in declaration order. */
export const spentScopeIds = (spends: readonly BudgetSpend[]): string[] =>
  BUDGET_SCOPE_IDS.filter((scopeId) => spends.some((spend) => spend.scopeId === scopeId));

export type ScopeTable = Record<string, { operation: string }>;

/** An operation claimed by more than one scope — two scopes one call site cannot tell apart. */
export const sharedOperations = (table: ScopeTable, scopeIds: readonly string[]): string[] =>
  scopeIds
    .map((scopeId) => table[scopeId]!.operation)
    .filter((operation, index, all) => all.indexOf(operation) !== index);

export const budgetViolations = (subject: BudgetSubject): BudgetViolation[] => {
  const spent = new Set(spentScopeIds(subject.spends));
  const declared = new Set(subject.scopeIds);
  const operations = new Set<string>(subject.declaredOperations);

  return [
    ...subject.scopeIds
      .filter((scopeId) => !spent.has(scopeId))
      .map((scopeId) => ({
        rule: 'unspent-scope',
        at: 'nar/src/kernel/budget-scopes.ts',
        detail: `'${scopeId}' is declared and nothing spends it — a bound with no call site is a comment`,
      })),
    ...subject.spends
      .filter((spend) => !declared.has(spend.scopeId as keyof typeof BUDGET_SCOPES))
      .map((spend) => ({
        rule: 'unknown-scope',
        at: spend.at,
        detail: `'${spend.scopeId}' is spent but is not a declared scope`,
      })),
    ...subject.scopeIds
      .filter((scopeId) => !operations.has(BUDGET_SCOPES[scopeId].operation))
      .map((scopeId) => ({
        rule: 'unknown-operation',
        at: 'core/src/schemas/gate-io.ts',
        detail: `scope '${scopeId}' declares operation '${BUDGET_SCOPES[scopeId].operation}', which the budget schema does not have`,
      })),
    ...sharedOperations(BUDGET_SCOPES, subject.scopeIds).map((operation) => ({
      rule: 'shared-operation',
      at: 'nar/src/kernel/budget-scopes.ts',
      detail: `'${operation}' is the operation of more than one scope — a call site could not tell them apart`,
    })),
  ];
};
