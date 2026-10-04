#!/usr/bin/env tsx
/**
 * `control-budgets` — the gate A7 lands (TODO29.a §5.7).
 *
 * **What the type system already holds.** `BudgetScopeId` is a union, so
 * `charge(...)` cannot name a scope that does not exist, and `BudgetOperation`
 * is the gate's own zod enum, so a scope's declared operation is validated
 * wherever the input is parsed. This gate holds the properties a type cannot
 * express across files: **a declared scope nothing spends** (which is how a
 * budget becomes a comment) and **two scopes claiming one operation** (which
 * makes the documented ceiling not the ceiling that is read).
 *
 * It reads the tree's text, because a rule about *which declarations are
 * honoured* cannot be checked by asking the module that makes them.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  BUDGET_SCOPE_IDS,
  BUDGET_SCOPES,
  scopeTerminationReason,
} from '../nar/src/kernel/budget-scopes.js';
import {
  type BudgetSpend,
  type BudgetSubject,
  budgetViolations,
  spentScopeIds,
} from './lib/control-budgets.js';
import { ROOT } from './lib/root.js';
import { productionSources } from './lib/source-scan.js';

/** The production trees a declared bound's spend may live in. */
const SCAN_ROOTS = ['nar/src', 'src'] as const;

const sources = (): { at: string; lines: string[] }[] =>
  productionSources(SCAN_ROOTS).map((path) => {
    const at = relative(ROOT, path);
    return { at, lines: readFileSync(path, 'utf8').split('\n') };
  });

/** `charge('<scope>')` — the cycle path's way of spending a declared bound. */
const SPEND = /\.\s*(?:charge|check)\(\s*(?:operation:\s*)?'([a-z-]+)'/;

/** A scope charged by its declared symbol rather than by `charge(...)`. */
const REFERENCES: ReadonlyMap<string, RegExp> = new Map(
  BUDGET_SCOPE_IDS.flatMap((scopeId) => {
    const symbol = BUDGET_SCOPES[scopeId].referenceSymbol;
    return symbol ? [[scopeId, new RegExp(`\\b${symbol}\\b`)] as const] : [];
  })
);

/** Every declared scope's spend, wherever it lives. The scope table is exempt. */
const scanSpends = (): BudgetSpend[] =>
  sources().flatMap(({ at, lines }) =>
    lines.flatMap((line, index) => {
      if (at.startsWith('nar/src/kernel/budget-scopes') || /^\s*import\b/.test(line)) return [];
      const charged = line.match(SPEND);
      if (charged) return [{ at: `${at}:${index + 1}`, scopeId: charged[1]! }];
      const referenced = [...REFERENCES].find(([, pattern]) => pattern.test(line));
      return referenced ? [{ at: `${at}:${index + 1}`, scopeId: referenced[0] }] : [];
    })
  );

/** The gate's operation vocabulary, read from the schema enum that owns it. */
const declaredOperations = (): string[] => {
  const source = readFileSync(join(ROOT, 'core/src/schemas/gate-io.ts'), 'utf8');
  const body = source.slice(source.indexOf('BudgetOperationSchema = z.enum(['));
  return [...body.matchAll(/'([a-z-]+)'/g)].map(([, operation]) => operation!);
};

const spends = scanSpends();
const subject: BudgetSubject = {
  scopeIds: BUDGET_SCOPE_IDS,
  spends,
  declaredOperations: declaredOperations(),
};
const violations = budgetViolations(subject);

const sites = new Map<string, number>();
for (const spend of spends) sites.set(spend.scopeId, (sites.get(spend.scopeId) ?? 0) + 1);

console.log(`control budgets — ${BUDGET_SCOPE_IDS.length} declared scopes\n`);
for (const scopeId of BUDGET_SCOPE_IDS) {
  const spec = BUDGET_SCOPES[scopeId];
  console.log(
    `  ${scopeId.padEnd(22)} ${spec.operation.padEnd(20)} ${spec.consumedKey.padEnd(10)} ` +
      `default ${String(spec.defaultLimit).padEnd(5)} ${scopeTerminationReason(scopeId).padEnd(14)} ${spec.owner}`
  );
}
console.log(`\nspend sites: ${[...sites].map(([scope, n]) => `${scope} ×${n}`).join(' · ')}`);
console.log(`spent: ${spentScopeIds(spends).join(', ') || '—'}`);

if (violations.length > 0) {
  console.error(`\ncontrol-budgets — ${violations.length} violation(s)\n`);
  for (const violation of violations) console.error(`  ${violation.rule}\n    ${violation.detail}`);
  process.exit(1);
}

console.log('\ncontrol-budgets — clean');
