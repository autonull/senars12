import { DEFAULT_CONFIG, NAR, TermBuilder } from '@senars/nar';
import { describe, expect, it } from 'vitest';

/**
 * Flow C: a contradiction is resolved by retracting a claim. The retract removes
 * the concept from memory and announces it on the bus (so the graph follows); a
 * retract of a term that was never there reports failure rather than pretending.
 */
describe('NAR.retract', () => {
  it('removes the concept and announces it with the retracted reason', async () => {
    const nar = new NAR({ ...DEFAULT_CONFIG, maxConcepts: 100 });
    await nar.believe('(bird-->animal)');
    const term = TermBuilder.inheritance(TermBuilder.atom('bird'), TermBuilder.atom('animal'))!;
    expect(nar.memory.getConcept(term)).toBeDefined();

    const removed: Array<{ term: unknown; reason: string }> = [];
    nar.getEventBus().on('concept:removed', (event) => removed.push(event));

    expect(nar.retract('(bird-->animal)')).toBe(true);
    expect(nar.memory.getConcept(term)).toBeUndefined();
    expect(removed).toEqual([{ term, reason: 'retracted' }]);
  });

  it('reports failure for a term that was never there', () => {
    const nar = new NAR({ ...DEFAULT_CONFIG });
    expect(nar.retract('(ghost-->nothing)')).toBe(false);
  });
});
