#!/usr/bin/env tsx

/**
 * `terms:canonical` — the operator table, the grammar and the serialiser agree,
 * every kind survives the round trip, and the reducer registry reaches a
 * canonical fixed point (TODO29.a §5.12).
 *
 * Six of sixteen kinds could not be read back from their own output: the
 * serialiser wrote `=>`, `||`, `/>` and `/<` where Narsese writes `==>`, `&|`,
 * `=/>` and `=|`; `{a}` and `[a]` were built as kinds the grammar never names;
 * and the comma copula built a conjunction, so no product had a text syntax at
 * all. The round-trip property test saw none of it, because it enumerated the
 * five kinds that worked. The generator was the bug: a list of what passes,
 * written as if it were a list of what exists.
 *
 * This file is the process boundary. The measurement and its failures live in
 * `scripts/lib/terms-canonical.ts`, so a test can call the gate and prove it can
 * fail — §10.1's rule, and `tests/nar/todo29a-a12.test.ts` is that test.
 */

import { canonicalFormFailures } from './lib/terms-canonical.js';
import { OPERATORS } from '../nar/src/terms/operators.js';
import { TASK_REDUCERS, TERM_REDUCERS } from '../nar/src/terms/index.js';

const failures = canonicalFormFailures();

if (failures.length > 0) {
  console.error(`terms:canonical — ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  `terms:canonical — ${Object.keys(OPERATORS).length} kinds round-trip; ` +
    `${TERM_REDUCERS.length} term reducers and ${TASK_REDUCERS.length} task reducer reach a fixed point`
);
