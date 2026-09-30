#!/usr/bin/env tsx
/**
 * Cycle-budget gate (TODO20 D04): fails when the dependency graph gains NEW cycles.
 * Runs dpdm, counts raw circular chains from its JSON report, compares against baseline.
 *
 * The verdict is `checkCycleBudget`, which fails on slack as well as regression —
 * see that module for why a one-sided ceiling is not a ratchet.
 *
 * Reducing cycles? Lower BASELINE in the same commit. Adding cycles? The gate fails —
 * either break the cycle or justify + raise the baseline explicitly.
 */
import { errMsg } from '@senars/util';
import { checkCycleBudget } from './lib/cycles.js';
import { circularChains } from './lib/dpdm.js';

/** Runtime-cycle budget. This counts dpdm's `circular` report with `--transform`,
  * which erases type-only edges; `complexity-budget.ts` budgets the same report
  * over all edges, so the two ratchets are not interchangeable.
  *
  * At introduction the count was 276 — 272 TODO5 baseline + 4 accepted TODO6
  * edges — and it has since fallen to 4. The history of how it got there:
  *
  *  1. `nar/memory/memory.ts -> memory/state/index.ts -> memory/state/serialization.ts`
  *     — type-only (`import type { Memory }`); dpdm counts type edges. Needs `--transform`.
  *  2. `nar/terms/factory.ts -> terms/serialize.ts -> terms/parser-peggy.ts`
  *     — `serializeTerm` caches a canonical form on every term at construction; the parser
  *     is the only canonicalizer. Needs the cache moved out of `factory`.
  *  3. + 4. `io/bridge/ConnectionBinder.ts -> @senars/core` barrel -> `Agent` / `SessionManager`
  *     — `Agent` is exported only from the core root. Needs a deep subpath export (minor
  *     semver) before the barrel import can be narrowed.
  *
  * `--transform` (TODO7 D3) removed edge 1; contract/impl splits removed 2 and 3/4. */
const BASELINE = 4;

try {
  const chains = circularChains();
  const count = chains.length;
  const verdict = checkCycleBudget(count, BASELINE, chains);
  if (!verdict.ok) {
    if (verdict.reason === 'regression') {
      console.error(
        `deps:gate FAILED — ${count} cycles > baseline ${BASELINE} (+${verdict.over} new)`
      );
      for (const chain of verdict.chains) console.error(`  new: ${chain.join(' -> ')}`);
    } else {
      console.error(
        `deps:gate FAILED — baseline ${BASELINE} is ${verdict.slack} above the measured ${count}.\n` +
          '  A ratchet with slack cannot fail. Lower BASELINE in this commit.'
      );
    }
    process.exit(1);
  }
  console.log(`deps:gate ok — ${count} cycles ≤ baseline ${BASELINE}`);
} catch (err) {
  console.error(`deps:gate ERROR — dpdm failed: ${errMsg(err)}`);
  process.exit(1);
}
