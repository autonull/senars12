#!/usr/bin/env tsx

/**
 * `proposal:protocol` — the gate A3 lands (TODO29.a §5.3).
 *
 * **What the type system already holds.** The content/rule distinction is a
 * `discriminatedUnion` arm with disjoint payloads, so a rule payload cannot be
 * read as a content payload and the routing is decided by the compiler. This gate
 * is the backstop for the part a type cannot: that the eight decisions are
 * *written down*, that each one names the reason code its rejection carries, and
 * that the document and the code have not drifted apart.
 *
 * It reads the tree's text rather than importing the lifecycle, because a rule
 * about *which decisions are declared* cannot be checked by asking the module
 * that implements them.
 */

import {
  DECISIONS,
  PROTOCOL_DOC,
  protocolViolations,
  scanProtocol,
} from './lib/proposal-protocol.js';

const subject = scanProtocol();
const violations = protocolViolations(subject);

console.log(`proposal protocol — ${DECISIONS.length} decisions declared in ${PROTOCOL_DOC}\n`);
for (const { id, title, reason } of DECISIONS) {
  console.log(`  ${id}  ${title.padEnd(48)} ${reason ?? '—'}`);
}
console.log(
  `\nkinds: ${subject.kinds.join(', ')} · schema v${subject.schemaVersion} · ` +
    `queues: ${subject.limits.maxPendingContent} content, ${subject.limits.maxPendingRules} rules`
);
console.log(`rejection reasons: ${subject.reasons.join(', ')}`);

if (violations.length > 0) {
  console.error(`\nproposal:protocol — ${violations.length} violation(s)\n`);
  for (const violation of violations) {
    console.error(`  ${violation.rule}\n    ${violation.detail}`);
  }
  process.exit(1);
}

console.log('\nproposal:protocol — clean');
