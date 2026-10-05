/**
 * TODO30 T2 — terms:no-bool-task gate
 *
 * Asserts that a Bool atom (TRUE, FALSE, NULL) cannot name a Task.
 * A task term that reduces to, or contains, a Bool atom is not created.
 * The cascade reduces (a&TRUE) to a, so (a-->(b&TRUE)) creates a task for (a-->b).
 */

import { termParser, validateTaskTerm } from '../nar/src/terms';
import { createNAR, Truth } from '../nar/src';

const NARSESE_CASES = [
  // These should be INVALID (create no task)
  { narsese: '(a-->TRUE)', expectValid: false, desc: 'predicate is TRUE' },
  { narsese: '(a-->FALSE)', expectValid: false, desc: 'predicate is FALSE' },
  { narsese: '(a-->(b|TRUE))', expectValid: false, desc: 'predicate contains TRUE in disjunction' },
  { narsese: '(--TRUE)', expectValid: false, desc: 'negation of TRUE' },
  { narsese: 'NULL', expectValid: false, desc: 'bare NULL atom' },
  { narsese: '(a-->NULL)', expectValid: false, desc: 'predicate is NULL' },

  // This should be VALID — the cascade reduces (b&TRUE) to b
  {
    narsese: '(a-->(b&TRUE))',
    expectValid: true,
    desc: 'predicate reduces to b via conjunction-TRUE identity',
  },
];

async function runGate(): Promise<void> {
  console.log('TODO30 T2 — terms:no-bool-task gate\n');

  let allPassed = true;

  for (const { narsese, expectValid, desc } of NARSESE_CASES) {
    const parsed = termParser.parse(narsese);
    if (!parsed) {
      console.log(`FAIL  ${narsese.padEnd(25)} — parse failed`);
      allPassed = false;
      continue;
    }

    const validation = validateTaskTerm(parsed);
    const passed = validation.valid === expectValid;

    if (!passed) {
      console.log(
        `FAIL  ${narsese.padEnd(25)} — expected ${expectValid ? 'VALID' : 'INVALID'}, got ${validation.valid ? 'VALID' : 'INVALID'} (${validation.valid ? '' : validation.reason}) — ${desc}`
      );
      allPassed = false;
    } else {
      console.log(
        `PASS  ${narsese.padEnd(25)} — ${validation.valid ? 'VALID' : 'INVALID'} — ${desc}`
      );
    }
  }

  // End-to-end test: NAR should reject invalid task terms
  console.log('\n--- End-to-end NAR rejection test ---');
  const nar = createNAR({ maxConcepts: 1000 });
  await nar.initialize();

  for (const { narsese, expectValid, desc } of NARSESE_CASES) {
    const beforeCount = nar.getBeliefs().length;
    await nar.input(narsese, 'belief', Truth.create(0.9, 0.9));
    await nar.run(1);
    const afterCount = nar.getBeliefs().length;

    const wasAdded = afterCount > beforeCount;
    const passed = wasAdded === expectValid;

    if (!passed) {
      console.log(
        `FAIL  ${narsese.padEnd(25)} — NAR ${wasAdded ? 'accepted' : 'rejected'}, expected ${expectValid ? 'accept' : 'reject'} — ${desc}`
      );
      allPassed = false;
    } else {
      console.log(
        `PASS  ${narsese.padEnd(25)} — NAR ${wasAdded ? 'accepted' : 'rejected'} — ${desc}`
      );
    }
  }

  await nar.dispose();

  // Test the cascade: (a-->(b&TRUE)) should create a task for (a-->b)
  console.log('\n--- Cascade test: (a-->(b&TRUE)) → (a-->b) ---');
  const nar2 = createNAR({ maxConcepts: 1000 });
  await nar2.initialize();
  await nar2.input('(a-->(b&TRUE)).', 'belief', Truth.create(0.9, 0.9));
  await nar2.run(1);

  const beliefs = nar2.getBeliefs().map((b) => b.term.toString());
  const hasAtoB = beliefs.includes('(a-->b)');
  const hasAtoBandTRUE = beliefs.includes('(a-->(b&TRUE))');

  if (hasAtoB && !hasAtoBandTRUE) {
    console.log('PASS  Cascade reduces (a-->(b&TRUE)) to (a-->b)');
  } else {
    console.log(`FAIL  Cascade failed: beliefs = [${beliefs.join(', ')}]`);
    allPassed = false;
  }

  await nar2.dispose();

  console.log(`\n${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  if (!allPassed) process.exit(1);
}

runGate().catch((err) => {
  console.error(err);
  process.exit(1);
});
