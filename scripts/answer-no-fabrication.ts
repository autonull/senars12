#!/usr/bin/env tsx

/**
 * `answer:no-fabrication` — the gate U1 lands (TODO30 §1.1, §8).
 *
 * `QueryAPI.ask` used to answer a question with a *similar* concept's term and
 * its confidence: asked `(dog-->mortal).` on a store that had never heard of a
 * dog, it replied `(animal-->mortal)` at 0.871. `Answer.answer` is supposed to
 * be the asked term, so the invariant is a shape, not a judgement:
 *
 * - an answer is either the asked term, or an instance of it when the asked
 *   term carries variables, or absent;
 * - a question the system cannot ground returns `confidence: 0` with no answer.
 *
 * The gate asserts the shape over a live transcript rather than over the source,
 * because the defect was a behaviour and a source reading cannot see it.
 */

import { createNAR } from '../nar/src/nar-presets.js';
import { Truth } from '../nar/src/terms/index.js';

const FACTS = ['(cat --> animal).', '(kitty --> cat).', '(animal --> mortal).'];

const transcriptNAR = async (cycles: number) => {
  const nar = createNAR({ maxConcepts: 100000 });
  await nar.initialize();
  for (const fact of FACTS) await nar.input(fact, 'belief', Truth.create(0.9, 0.9));
  await nar.input('(kitty --> mortal).', 'question');
  for (let i = 0; i < cycles; i++) await nar.run(1);
  return nar;
};

interface Case {
  readonly asked: string;
  readonly expectAnswer: string | undefined;
  readonly note: string;
}

const CASES: readonly Case[] = [
  {
    asked: '(kitty-->mortal).',
    expectAnswer: '(kitty-->mortal)',
    note: 'derived by transitivity — the exact-match path',
  },
  {
    asked: '(dog-->mortal).',
    expectAnswer: undefined,
    note: 'never heard of a dog — §0.2 fabricated this one',
  },
  {
    asked: '(whale-->mortal).',
    expectAnswer: undefined,
    note: 'the second fabricated row of §0.2',
  },
];

const failures: string[] = [];

const nar = await transcriptNAR(10);
console.log(`answer:no-fabrication — ${nar.query.getBeliefs().length} beliefs in the store\n`);

for (const testCase of CASES) {
  const answer = await nar.query.ask(testCase.asked);
  const refused = answer.answer === undefined;
  if (refused && answer.confidence !== 0) {
    failures.push(`${testCase.asked} refused but reported confidence ${answer.confidence}`);
  }
  if (!refused && answer.answer !== testCase.expectAnswer) {
    failures.push(
      `${testCase.asked} answered ${answer.answer} — expected ${testCase.expectAnswer ?? 'no answer'}`
    );
  }
  console.log(
    `  ${testCase.asked.padEnd(18)} → ${(answer.answer ?? '(refused)').padEnd(20)}` +
      `conf=${answer.confidence.toFixed(3)} evidence=${answer.evidence.length}  ${testCase.note}`
  );
}

const variables = await nar.query.ask('(kitty-->?what).');
if (variables.answer && variables.answer === '(kitty-->?what).') {
  failures.push('a variable question answered with its own unbound term');
}
console.log(
  `\n  ${'(kitty-->?what).'.padEnd(18)} → ${(variables.answer ?? '(refused)').padEnd(20)}` +
    `conf=${variables.confidence.toFixed(3)} evidence=${variables.evidence.length}  ` +
    'a variable question is answered by a ground instance of it, or not at all'
);

await nar.dispose();

if (failures.length > 0) {
  console.error(`\nanswer:no-fabrication — ${failures.length} violation(s)\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('\nanswer:no-fabrication — clean');