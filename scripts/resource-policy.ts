#!/usr/bin/env tsx

/**
 * `resource:policy` — the gate A8 lands (TODO29.a §5.8).
 *
 * Prints the inventory and then checks it. The print is not decoration: an
 * inventory nobody reads is a table, and the table is the deliverable — the
 * reviewable record `resource · owner · capacity · retention · overflow ·
 * pressure signal` exists so a change to any of those six is a reviewable diff
 * rather than something a reader has to reconstruct from six modules.
 *
 * The check is in `lib/resource-policy.ts`; this is the command.
 */

import { RESOURCE_CONTRACTS } from '../nar/src/resources/contracts.js';
import { resourceViolations } from './lib/resource-policy.js';
import { report, verdictLines } from './lib/verdicts.js';

const contracts = RESOURCE_CONTRACTS;

console.log(`resource policy — ${contracts.length} declared resources\n`);
const pad = (text: string, width: number): string => text.padEnd(width);
const idWidth = Math.max(...contracts.map((c) => c.id.length));

for (const contract of contracts) {
  console.log(
    `  ${pad(contract.id, idWidth)}  ${contract.capacity.symbol}${contract.capacity.field ? `.${contract.capacity.field}` : ''}`
  );
  console.log(`  ${' '.repeat(idWidth)}  holds     ${contract.holds}`);
  console.log(`  ${' '.repeat(idWidth)}  owner     ${contract.owner}`);
  console.log(`  ${' '.repeat(idWidth)}  retention ${contract.retention}`);
  console.log(`  ${' '.repeat(idWidth)}  overflow  ${contract.overflow}`);
  console.log(
    `  ${' '.repeat(idWidth)}  signal    ${contract.pressureSignal ?? '(none — capacity cannot be reclaimed)'}`
  );
  console.log('');
}

const violations = await resourceViolations();

report('resource:policy', violations, { lines: verdictLines });

const signaled = contracts.filter((c) => c.pressureSignal !== null).length;
console.log(
  `resource:policy — ${contracts.length} resources, ${signaled} with a pressure signal, ` +
    `${contracts.length - signaled} declaring that capacity cannot be reclaimed`
);
