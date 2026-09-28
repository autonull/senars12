#!/usr/bin/env tsx
/**
 * Cycle-budget gate (TODO20 D04): fails when the dependency graph gains NEW cycles.
 * Runs dpdm, counts raw circular chains from its JSON report, compares against baseline.
 *
 * Reducing cycles? Lower BASELINE in the same commit. Adding cycles? The gate fails —
 * either break the cycle or justify + raise the baseline explicitly.
 */
import { errMsg } from '@senars/util';
import { circularChains } from './lib/dpdm.js';

/** Documented raw-cycle count at gate introduction (CLI prints 10 deduplicated chains). */
/** 276 = 272 TODO5 baseline + 4 accepted TODO6 edges, net of −2 removed by C21 work
 * (`core/src/cognitive-thread.ts` no longer imports the `@senars/nar` barrel for types).
 *
 * The 4 accepted edges, each with the seam that would break it:
 *  1. `nar/memory/memory.ts -> memory/state/index.ts -> memory/state/serialization.ts`
 *     — type-only (`import type { Memory }`); dpdm counts type edges. Needs `--transform`.
 *  2. `nar/terms/factory.ts -> terms/serialize.ts -> terms/parser-peggy.ts`
 *     — `serializeTerm` caches a canonical form on every term at construction; the parser
 *     is the only canonicalizer. Needs the cache moved out of `factory`.
 *  3. + 4. `io/bridge/ConnectionBinder.ts -> @senars/core` barrel -> `Agent` / `SessionManager`
 *     — `Agent` is exported only from the core root. Needs a deep subpath export (minor
 *     semver) before the barrel import can be narrowed.
 *
 * With `--transform` flag (TODO7 D3), type-only edges (1) are excluded.
 * Remaining cycles: 2 & 3/4 = 25.
 * Baseline updated 2026-09-26 (TODO7 Phase D — dpdm --transform). */
const BASELINE = 25;

try {
  const circulars = circularChains();
  const count = circulars.length;
  if (count > BASELINE) {
    console.error(
      `deps:gate FAILED — ${count} cycles > baseline ${BASELINE} (+${count - BASELINE} new)`
    );
    for (const c of circulars.slice(BASELINE)) console.error(`  new: ${c.join(' -> ')}`);
    process.exit(1);
  }
  console.log(`deps:gate ok — ${count} cycles ≤ baseline ${BASELINE}`);
} catch (err) {
  console.error(`deps:gate ERROR — dpdm failed: ${errMsg(err)}`);
  process.exit(1);
}
