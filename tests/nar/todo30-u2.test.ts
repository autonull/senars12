/**
 * TODO30 §1.2 (U2) — relevance, not confidence, decides what a reader sees.
 *
 * Option B of §1.2's table: derivation is untouched and only the read path
 * ranks. The acceptance criterion the plan names is a number, so the number is
 * asserted here rather than eyeballed.
 */

import { describe, expect, it } from 'vitest';
import { createNAR } from '../../nar/src/nar-presets.js';
import { byRelevance, relevanceScore, RELEVANCE_EXACT } from '../../nar/src/query/index.js';
import { termParser, Truth, type Term } from '../../nar/src/terms/index.js';

const FOCUS = '(kitty-->mortal)';

const transcriptNAR = async (cycles = 10) => {
  const nar = createNAR({ maxConcepts: 100000 });
  await nar.initialize();
  for (const fact of ['(cat --> animal).', '(kitty --> cat).', '(animal --> mortal).']) {
    await nar.input(fact, 'belief', Truth.create(0.9, 0.9));
  }
  await nar.input('(kitty --> mortal).', 'question');
  for (let i = 0; i < cycles; i++) await nar.run(1);
  return nar;
};

const term = (narsese: string): Term => {
  const parsed = termParser.parse(narsese);
  if (!parsed) throw new Error(`parse failed: ${narsese}`);
  return parsed;
};

describe('U2 — relevanceScore', () => {
  it('scores an exact hit above every partial overlap', () => {
    const focus = [term(FOCUS)];

    expect(relevanceScore(term(FOCUS), focus)).toBe(RELEVANCE_EXACT);
    expect(relevanceScore(term('(kitty-->cat)'), focus)).toBeLessThan(RELEVANCE_EXACT);
    expect(relevanceScore(term('(animal-->mortal)'), focus)).toBeGreaterThan(
      relevanceScore(term('(?cause-->(cat-->animal))'), focus)
    );
  });

  it('is pure — the same inputs always give the same number', () => {
    const focus = [term(FOCUS)];
    const first = relevanceScore(term('(kitty-->mortal)'), focus);

    expect(relevanceScore(term('(kitty-->mortal)'), focus)).toBe(first);
    expect(relevanceScore(term('(kitty-->mortal)'), [])).toBe(0);
  });

  it('ignores truth values — relevance is about which claim, not how sure', () => {
    const focus = [term(FOCUS)];
    const weak = { term: term(FOCUS), truth: Truth.create(0.5, 0.1) };
    const strong = { term: term('(?cause-->(cat-->animal))'), truth: Truth.create(0.99, 0.99) };

    expect(byRelevance([weak, strong], { focus })[0]).toBe(weak);
  });

  it('ranks every score when the floor is 0, and keeps the answer first either way', () => {
    const focus = [term(FOCUS)];
    const tasks = [term('(?cause-->(cat-->animal))'), term(FOCUS), term('(animal-->mortal)')].map(
      (t) => ({ term: t })
    );

    const ranked = byRelevance(tasks, { focus, minScore: 0 });

    expect(ranked).toHaveLength(tasks.length);
    expect(ranked[0]?.term).toBe(term(FOCUS));
    const scores = ranked.map(({ term: t }) => relevanceScore(t, focus));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('defaults the floor to containment, so shared vocabulary is a rank and not a keep', () => {
    const focus = [term(FOCUS)];
    const tasks = [term('(?cause-->(cat-->animal))'), term(FOCUS), term('(animal-->mortal)')].map(
      (t) => ({ term: t })
    );

    expect(byRelevance(tasks, { focus }).map(({ term: t }) => t.toString())).toEqual([FOCUS]);
  });
});

describe('U2 — the read path does not change what is committed', () => {
  it('commits the same derivation set whether or not a reader ranked', async () => {
    const ranked = await transcriptNAR();
    const plain = await transcriptNAR();

    const committed = (nar: Awaited<ReturnType<typeof transcriptNAR>>) =>
      nar.memory.listConcepts().map((c) => c.term.toString()).sort();

    const before = committed(ranked);
    expect(before.length).toBeGreaterThan(0);

    const read = ranked.query.getRelevantBeliefs([term(FOCUS)]);
    expect(read.length).toBeGreaterThan(0);

    expect(committed(ranked)).toEqual(before);
    expect(committed(plain)).toEqual(before);

    await ranked.dispose();
    await plain.dispose();
  });

  it('narrows the §0.2 transcript to the few beliefs that bear on the question', async () => {
    const nar = await transcriptNAR();
    const all = nar.getBeliefs();
    const relevant = nar.query.getRelevantBeliefs([term(FOCUS)]);

    // The measurement §1.2 asks for, asserted rather than eyeballed.
    //
    // The *total* is deliberately not pinned: it is a consequence of the rule
    // table and `maxAdmissions`, so the shipped table's derivation count moves when
    // 51 derive 91 — a ratchet on it fails for reasons unrelated to relevance.
    // `relevance:measured` holds the same floor rather than the exact count.
    // What §1.2 asks for is the narrowing, and that is what is asserted.
    expect(all.length).toBeGreaterThan(relevant.length * 10);
    expect(relevant.length).toBeLessThan(all.length / 10);
    expect(relevant.map((t) => t.term.toString())).toContain(FOCUS);
    expect(relevant[0]?.term.toString()).toBe(FOCUS);

    await nar.dispose();
  });
});