#!/usr/bin/env tsx

/**
 * `attention:write-surface` — the gate A4 lands (TODO29.a §5.4).
 *
 * **What the compiler already holds.** `Concept.priority` has no public setter,
 * so the plan's primary acceptance — "the only module that can write it is the
 * attention owner's" — is a type, not a review convention. This gate is the
 * backstop the plan asks for by name, and it says the things a type cannot:
 * which reasons exist, that each is written with, that the decay sweep has one
 * caller, and that `topConcepts` / `sampleWindow` contain no write.
 *
 * It reads the tree's text rather than importing `Concept`, because a rule about
 * *where a value is written* cannot be checked by asking the value's class.
 */

import {
  ATTENTION_REASONS,
  scanSubject,
  surfaceViolations,
  writeSites,
} from './lib/attention-surface.js';
import { report } from './lib/verdicts.js';

const subject = scanSubject();
const sites = writeSites(subject);
const violations = surfaceViolations(subject);

console.log(
  `attention write surface — ${sites.length} writes across ${subject.files.length} files\n`
);
for (const site of sites) console.log(`  ${site.reason.padEnd(10)} ${site.at}`);
console.log(`\nreasons declared: ${ATTENTION_REASONS.join(', ')}`);

report('attention:write-surface', violations, {
  lines: ({ at, rule, detail }) => [`[${rule}] at ${at}`, `  ${detail}`],
  clean: 'clean',
});
