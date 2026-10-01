/**
 * The dispatch census (TODO29.a §5.6).
 *
 * Three of four dispatch buckets were empty: 0 of 55 registered rules used a
 * wildcard, so `*:<right>`, `<left>:*` and `*:*` were three lookups on the
 * innermost path that could never return a rule. The type now forbids the
 * wildcard — `RulePattern` requires both kinds — so this is the runtime half of
 * a contract the compiler already holds, and it is where a *dynamically*
 * registered rule (A10's rule queue, a test fixture) is caught.
 *
 * Pure verdict logic: the census and one predicate per rule, so a failure reads
 * as a sentence about the table rather than a stack trace.
 */
import { OPERATORS } from '../../nar/src/terms/operators.js';
import type { RegisteredRule } from '../../nar/src/rules/types.js';

export interface KindViolation {
  readonly ruleId: string;
  readonly reason: 'undeclared' | 'unknown-kind';
  readonly detail: string;
}

/** Every kind a rule may declare: the atom kind plus the operator table. */
export const KNOWN_RULE_KINDS: ReadonlySet<string> = new Set([
  'atom',
  ...Object.keys(OPERATORS),
]);

export const kindViolations = (rules: readonly RegisteredRule[]): KindViolation[] =>
  rules.flatMap((rule): KindViolation[] => {
    const declared = [rule.pattern?.left?.op, rule.pattern?.right?.op];
    if (declared.some((kind) => !kind)) {
      return [{ ruleId: rule.id, reason: 'undeclared' as const, detail: String(declared) }];
    }
    const unknown = declared.filter((kind) => !KNOWN_RULE_KINDS.has(kind));
    return unknown.length > 0
      ? [{ ruleId: rule.id, reason: 'unknown-kind' as const, detail: unknown.join(',') }]
      : [];
  });

/** Bucket histogram — the census `§13` quotes, printed rather than assumed. */
export const bucketCensus = (rules: readonly RegisteredRule[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    const key = `${rule.pattern.left.op}:${rule.pattern.right.op}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};