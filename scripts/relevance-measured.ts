#!/usr/bin/env tsx

/**
 * `relevance:measured` — the gate U2 lands (TODO30 §1.2, §8).
 *
 * Two claims, and they are different in kind.
 *
 * **The read path is not a write path.** Relevance ranks an unchanged store, so
 * committing the same episode with and without ranking must produce the same
 * `listConcepts()`. This is §7 invariant 1 in test form: if relevance could move
 * what is committed, option B of §1.2's table would have been option A wearing
 * a different name.
 *
 * **The number.** §1.2 asks for a measurement before it asks for a mechanism:
 * how many of the §0.2 transcript's beliefs bear on the one question. It is
 * printed, and the gate holds the *floor* rather than the exact count — 133 is
 * `maxAdmissions`-sensitive, so a ratchet on the total would fail for an
 * unrelated reason — but the answer being first is not negotiable.
 */

import { createNAR } from '../nar/src/nar-presets.js';
import { byRelevance, relevanceScore, RELEVANCE_CONTAINMENT } from '../nar/src/query/index.js';
import { termParser, Truth, type Term } from '../nar/src/terms/index.js';

const FOCUS = '(kitty-->mortal)';

/** One in twenty of the committed beliefs may reach the reader. The rest is §0.2's noise. */
const MAX_RELEVANT_FRACTION = 0.05;

const failures: string[] = [];

const term = (narsese: string): Term => {
  const parsed = termParser.parse(narsese);
  if (!parsed) throw new Error(`relevance:measured — parse failed: ${narsese}`);
  return parsed;
};

const transcript = async (cycles: number) => {
  const nar = createNAR({ maxConcepts: 100000 });
  await nar.initialize();
  for (const fact of ['(cat --> animal).', '(kitty --> cat).', '(animal --> mortal).']) {
    await nar.input(fact, 'belief', Truth.create(0.9, 0.9));
  }
  await nar.input('(kitty --> mortal).', 'question');
  for (let i = 0; i < cycles; i++) await nar.run(1);
  return nar;
};

const focus = [term(FOCUS)];

const ranked = await transcript(10);
const committedBefore = ranked.memory.listConcepts().map((c) => c.term.toString()).sort();

const beliefs = ranked.getBeliefs();
const relevant = ranked.query.getRelevantBeliefs(focus);
const rankedZero = byRelevance(beliefs, { focus, minScore: 0 });

console.log(
  `relevance:measured — ${beliefs.length} committed beliefs, focus ${FOCUS}\n` +
    `  relevance >= containment (${RELEVANCE_CONTAINMENT}): ${relevant.length}` +
    `  (${((100 * relevant.length) / beliefs.length).toFixed(1)}%)\n` +
    `  any score at all: ${rankedZero.length}\n`
);
for (const task of relevant.slice(0, 5)) {
  console.log(`    ${relevanceScore(task.term, focus).toFixed(3)}  ${task.term.toString()}`);
}

const committedAfter = ranked.memory.listConcepts().map((c) => c.term.toString()).sort();
if (committedAfter.join() !== committedBefore.join()) {
  failures.push('reading with relevance ranking changed the committed store');
}

if (relevant.length === 0) {
  failures.push('relevance ranking returned nothing for a question the store answers');
} else if (relevant[0]?.term.toString() !== FOCUS) {
  failures.push(`the answer is not first; got ${relevant[0]?.term.toString()}`);
}

if (relevant.length > beliefs.length * MAX_RELEVANT_FRACTION) {
  failures.push(
    `${relevant.length} of ${beliefs.length} beliefs cleared the floor — ` +
      `relevance is ranking rather than narrowing`
  );
}

const control = await transcript(10);
if (control.memory.listConcepts().length !== ranked.memory.listConcepts().length) {
  failures.push('the same episode committed a different number of concepts twice — not comparable');
}
await control.dispose();
await ranked.dispose();

if (failures.length > 0) {
  console.error(`\nrelevance:measured — ${failures.length} violation(s)\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('\nrelevance:measured — clean');