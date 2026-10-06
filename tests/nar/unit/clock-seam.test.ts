/**
 * The memory's clock is a seam, not a wall-clock read.
 *
 * `consolidation.evictionOrder` ranks concepts by `lastAccessedAt` and documents
 * itself as "a difference between two stamps from the same store's own clock" —
 * a claim a store that read `Date.now()` could not honour and no test could
 * pin. These assert the claim holds.
 */
import { fixedClock } from '@senars/util';
import { describe, expect, it } from 'vitest';

import { Layer } from '../../../nar/src/memory/links/Layer.js';
import { ConceptGraph } from '../../../nar/src/memory/ConceptGraph.js';
import { Concept, Stamp, TermBuilder, Truth } from '../../../nar/src';

const AT = 1_700_000_000_000;

describe('memory clock seam', () => {
  it('stamps a concept from the injected clock, and two reads agree', () => {
    const concept = new Concept(TermBuilder.atom('cat'), { bag: { clock: fixedClock(AT) } });
    expect(concept.createdAt).toBe(AT);
    expect(concept.lastAccessedAt).toBe(AT);
    concept.addTask('belief', {
      term: TermBuilder.atom('mammal'),
      truth: Truth.create(0.8, 0.9),
      budget: {} as never,
      stamp: Stamp.createInput(),
    });
    expect(concept.lastAccessedAt).toBe(AT);
  });

  it('falls back to the wall clock when none is injected', () => {
    const before = Date.now();
    const concept = new Concept(TermBuilder.atom('dog'));
    expect(concept.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('ranks graph activations by the injected clock', () => {
    const graph = new ConceptGraph({ clock: fixedClock(AT) });
    graph.activate(
      TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'))!
    );
    const [, subject] = graph.serialize().nodes.children[0] ?? [];
    const [, predicate] = subject?.children[0] ?? [];
    expect(predicate?.lastActivated).toBe(AT);
  });

  it('stamps link recency from the injected clock', () => {
    const layer = new Layer('term', 8, 'priority', undefined, fixedClock(AT));
    const link = layer.addLink({
      sourceTerm: TermBuilder.atom('cat'),
      targetTerm: TermBuilder.atom('animal'),
    });
    expect(link?.lastAccessedAt).toBe(AT);
  });
});
