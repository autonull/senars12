#!/usr/bin/env tsx

/**
 * Self-Tune Demo — 5-iteration preview of the `tune` runner.
 * The algorithm lives in src/bin/lib/tune-runner.ts; this only pins the demo size.
 */

import { runEntrypoint } from '../src/bin/lib/fatal-error.js';

const argv = process.argv.slice(2);
if (!argv.some((token) => token === '--iterations' || token === '-i')) {
  process.argv = [...process.argv.slice(0, 2), '--iterations', '5', ...argv];
}

const { runTune } = await import('../src/bin/lib/tune-runner.js');
runEntrypoint(runTune);
