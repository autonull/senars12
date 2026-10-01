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

/**
 * A rule's dispatch cell, read structurally so the gate works on a *loaded*
 * table's entries and on `RegisteredRule`s alike — A10 made the declaration the
 * artefact and the runtime rule a projection of it, and a gate that could only
 * see one of the two would be checking the wrong one.
 */
export interface DeclaredKinds {
  readonly id?: string;
  readonly ruleId?: string;
  readonly pattern?: { left?: { op?: string }; right?: { op?: string } };
  readonly left?: { op?: string };
  readonly right?: { op?: string };
}

const identityOf = (rule: DeclaredKinds): string => rule.ruleId ?? rule.id ?? '(unnamed)';
const declaredOf = (rule: DeclaredKinds): [string | undefined, string | undefined] =>
  rule.pattern
    ? [rule.pattern.left?.op, rule.pattern.right?.op]
    : [rule.left?.op, rule.right?.op];

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

export const kindViolations = (rules: readonly DeclaredKinds[]): KindViolation[] =>
  rules.flatMap((rule): KindViolation[] => {
    const ruleId = identityOf(rule);
    const declared = declaredOf(rule);
    if (declared.some((kind) => !kind)) {
      return [{ ruleId, reason: 'undeclared', detail: declared.map((k) => k ?? '').join(',') }];
    }
    const unknown = declared.filter((kind) => !KNOWN_RULE_KINDS.has(kind!));
    return unknown.length > 0
      ? [{ ruleId, reason: 'unknown-kind', detail: unknown.join(',') }]
      : [];
  });

/** Bucket histogram — the census `§13` quotes, printed rather than assumed. */
export const bucketCensus = (rules: readonly DeclaredKinds[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    const [left, right] = declaredOf(rule);
    const key = `${left}:${right}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};