/**
 * TODO30 §1.1 (U1) — a query must not answer a different question.
 *
 * The transcript is TODO30 §0.2's, verbatim: three facts, one question, and two
 * fabricated answers that the pre-fix tree reported at high confidence.
 */

import { describe, expect, it } from 'vitest';
import { createNAR, Truth } from '../../nar/src';

const TRANSCRIPT_FACTS = ['(cat --> animal).', '(kitty --> cat).', '(animal --> mortal).'];

const transcriptNAR = async (cycles = 10) => {
  const nar = createNAR({ maxConcepts: 100000 });
  await nar.initialize();
  for (const fact of TRANSCRIPT_FACTS) await nar.input(fact, 'belief', Truth.create(0.9, 0.9));
  await nar.input('(kitty --> mortal).', 'question');
  for (let i = 0; i < cycles; i++) await nar.run(1);
  return nar;
};

describe('U1 — ask() answers only the question it was asked', () => {
  it('answers a term the system derived', async () => {
    const nar = await transcriptNAR();

    const answer = await nar.query.ask('(kitty-->mortal).');

    expect(answer.answer).toBe('(kitty-->mortal)');
    expect(answer.truth?.f).toBeGreaterThan(0);
    expect(answer.evidence.length).toBeGreaterThan(0);

    await nar.dispose();
  });

  it('refuses a term the system has never seen, rather than echoing a neighbour', async () => {
    const nar = await transcriptNAR();

    for (const asked of ['(dog-->mortal).', '(whale-->mortal).']) {
      const answer = await nar.query.ask(asked);

      expect(answer.answer).toBeUndefined();
      expect(answer.truth).toBeUndefined();
    }

    await nar.dispose();
  });

  it('offers adjacency as evidence on a refusal, never as the answer', async () => {
    const nar = await transcriptNAR();

    const answer = await nar.query.ask('(dog-->mortal).');

    expect(answer.answer).toBeUndefined();
    expect(answer.evidence.map((task) => task.term.toString())).toContain('(animal-->mortal)');

    await nar.dispose();
  });

  it('keeps exact-match resolution when the asked term is known', async () => {
    const nar = createNAR();
    await nar.initialize();
    await nar.input('(cat-->animal).', 'belief', Truth.create(0.9, 0.9));
    await nar.run(1);

    expect((await nar.query.ask('(cat-->animal).')).answer).toBe('(cat-->animal)');

    await nar.dispose();
  });

  it('disposes a NAR that was built, initialised, queried and never started', async () => {
    const nar = await transcriptNAR(1);

    await nar.query.ask('(kitty-->mortal).');
    await expect(nar.stop()).resolves.toBeUndefined();
    await expect(nar.dispose()).resolves.toBeUndefined();
    await expect(nar.stop()).resolves.toBeUndefined();
  });
});