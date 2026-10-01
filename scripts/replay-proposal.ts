#!/usr/bin/env tsx

/**
 * `replay:proposal` — the gate A9 lands (TODO29.a §5.9).
 *
 * **The claim being gated: a recorded proposal stream is a sufficient fixture.**
 * Not "there is a proposal fixture" — that would be a fixture format of its own,
 * a second representation of state that could disagree with the event log the
 * kernel already keeps. The fixture here *is* the event log, in the log's own
 * schema, and the gate reduces it with the same reducer production uses.
 *
 * Four rules, each a failure case first:
 *
 *  1. **Purity** — the reduction is a function of the log. Two replays of one
 *     recorded stream are equal, byte for byte, in any process.
 *  2. **No provider** — the replay path reaches no provider. Enforced over the
 *     module closure of the two files that implement it, because "run it with
 *     the provider unset" cannot distinguish a path that never asks from one that
 *     asks and is politely refused.
 *  3. **Version refusal** — a stream recorded under a schema version this build
 *     does not speak fails loudly and identifies the version.
 *  4. **Revision refusal** — a stream recorded against revision *R* is stale
 *     against *R+1*, and the stale admissions are named.
 */

import { readFileSync } from 'node:fs';
import { CognitiveEventSchema, PROPOSAL_SCHEMA_VERSION } from '@senars/core/schemas';
import {
  ProposalReplayError,
  isProposalEvent,
  isProposalStream,
  recordedSchemaVersions,
  replayProposalStream,
  staleAdmissions,
} from '../nar/src/proposal/replay.js';
import { replayCognitiveState } from '../nar/src/kernel/EventLogPersistence.js';
import { moduleClosure, specifiersOf } from './lib/module-closure.js';
import { fromRoot } from './lib/root.js';

const FIXTURE = fromRoot('tests/fixtures/proposal-stream.jsonl');

/** The files whose closure must contain no provider module. */
const REPLAY_MODULES = [fromRoot('nar/src/proposal/replay.ts'), fromRoot('nar/src/kernel/replay.ts')];

/** Module prefixes that would mean a replay could ask a provider. */
const PROVIDER_PREFIXES = ['nar/src/lm/', 'nar/src/reflex/', 'nar/src/game/', 'nar/src/focus/'];

const load = (): CognitiveEvent[] =>
  readFileSync(FIXTURE, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const parsed = CognitiveEventSchema.safeParse(JSON.parse(line));
      if (!parsed.success)
        throw new Error(`fixture line ${index + 1} is not a CognitiveEvent — a proposal fixture is an event log, not a second format`);
      return parsed.data;
    });

const violations: string[] = [];
const fail = (rule: string, detail: string): void => {
  violations.push(`${rule}\n    ${detail}`);
};

const events = load();
const first = replayProposalStream(events);
const second = replayProposalStream(events);

// 1 — purity.
const canonical = (state: unknown): string => JSON.stringify(state);
if (canonical(first) !== canonical(second))
  fail('replay:purity', 'two reductions of one recorded stream differ');

// 1b — the second reducer agrees with the first. `replayCognitiveState` folds the
// whole log including the proposal events, and §5.9's claim is that the proposal
// half is *the same fold*, not a parallel one. Two reducers that disagree here
// would be the "second representation of state" §5.9 refuses.
const snapshot = replayCognitiveState(events).proposals;
if (snapshot.revision !== first.revision)
  fail('replay:agrees', `cognitive-state head r${snapshot.revision} vs proposal head r${first.revision}`);
if (snapshot.admissions.length !== first.admissions.length)
  fail(
    'replay:agrees',
    `cognitive-state counted ${snapshot.admissions.length} admissions, the proposal reducer ${first.admissions.length}`
  );
if (snapshot.rejections.length !== first.rejections.length)
  fail(
    'replay:agrees',
    `cognitive-state counted ${snapshot.rejections.length} rejections, the proposal reducer ${first.rejections.length}`
  );

// 2 — no provider in the replay closure.
for (const module of REPLAY_MODULES) {
  for (const specifier of moduleClosure(module)) {
    const hit = PROVIDER_PREFIXES.find((prefix) => specifier.includes(prefix));
    if (hit) fail('replay:no-provider', `${module} reaches ${hit} via ${specifier}`);
  }
  for (const specifier of specifiersOf(module))
    if (specifier.includes('@senars/lm')) fail('replay:no-provider', `${module} imports ${specifier}`);
}

// 3 — a stream from a future commit must not replay against incompatible state.
const future = events.map((event) =>
  event.type === 'proposal.admitted'
    ? { ...event, payload: { ...event.payload, schemaVersion: PROPOSAL_SCHEMA_VERSION + 1 } }
    : event
);
let refusal: string | undefined;
try {
  replayProposalStream(future);
} catch (error) {
  if (!(error instanceof ProposalReplayError)) throw error;
  refusal = error.message;
}
if (!refusal) fail('replay:schema-version', `a v${PROPOSAL_SCHEMA_VERSION + 1} stream replayed without complaint`);
else if (!refusal.includes(`v${PROPOSAL_SCHEMA_VERSION + 1}`))
  fail('replay:schema-version', `the refusal does not name the offending version: ${refusal}`);

// 4 — revision refusal.
if (first.revision === 0) fail('replay:revision', 'the fixture recorded no admission, so it gates nothing');
const staleAtFinal = staleAdmissions(events, first.revision);
if (staleAtFinal.length > 0)
  fail('replay:revision', `the stream's own head revision calls ${staleAtFinal.length} of its admissions stale`);
const staleOneShort = staleAdmissions(events, first.revision - 1);
const expectedStale = first.admissions.filter((a) => a.resultingRevision === first.revision).length;
if (staleOneShort.length !== expectedStale)
  fail('replay:revision', `R against R-1 flagged ${staleOneShort.length} stale admissions, expected ${expectedStale}`);

console.log(
  `replay:proposal — fixture ${FIXTURE.replace(`${process.cwd()}/`, '')}\n` +
    `  events: ${events.length} · proposal events: ${events.filter(isProposalEvent).length} · ` +
    `revision head r${first.revision} · recorded under schema v${recordedSchemaVersions(events).join(', v') || '—'} (core v${PROPOSAL_SCHEMA_VERSION})`
);
for (const admission of first.admissions) {
  console.log(
    `  admitted ${admission.kind.padEnd(7)} ${admission.proposalId.padEnd(12)} r${admission.baseRevision}→r${admission.resultingRevision}` +
      (admission.declaration ? `  ${admission.declaration.ruleId} (${admission.declaration.truthFn})` : '')
  );
}
for (const rejection of first.rejections) {
  console.log(`  rejected ${rejection.kind.padEnd(7)} ${rejection.proposalId.padEnd(12)} ${rejection.reason}`);
}
console.log(
  `  two reductions byte-identical: ${canonical(first) === canonical(second)}\n` +
    `  replay closure reaches no provider: ${!violations.some((v) => v.startsWith('replay:no-provider'))}`
);

if (violations.length > 0) {
  console.error(`\nreplay:proposal — ${violations.length} violation(s)\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log('\nreplay:proposal — clean');
