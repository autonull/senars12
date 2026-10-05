#!/usr/bin/env tsx
/**
 * Every registered rule declares both of its kinds (TODO29.a §5.6).
 *
 * `RulePattern` requires them, so a statically written wildcard does not
 * compile — but `RuleRegistry.register` takes a value, and A10's rule queue will
 * hand it one it read from data. This is the runtime half of the same contract,
 * and it prints the bucket census so the hot cell is a number someone can quote
 * rather than a claim in a document.
 */
import { loadBuiltinTable } from '../nar/src/rules/impls/builtin-table.js';
import { bucketCensus, kindViolations } from './lib/dispatch-table.js';

const table = loadBuiltinTable();
const rules = table.entries();
const violations = kindViolations(rules);

if (violations.length > 0) {
  console.error('dispatch:no-wildcard FAILED — a rule sits under an undeclared kind:');
  for (const v of violations) console.error(`  ${v.ruleId} — ${v.reason}: ${v.detail}`);
  console.error('\n  A rule declares both kinds or it does not register (TODO29.a §5.6).');
  process.exit(1);
}

const census = bucketCensus(rules);
const [hottest, hotCount] = [...census][0] ?? ['(none)', 0];

console.log(
  `dispatch:no-wildcard ok — ${rules.length} rules in ${census.size} buckets, ` +
    `hottest ${hottest} at ${hotCount}, no wildcard bucket`
);
