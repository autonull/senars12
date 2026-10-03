import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AssociativeRegistry, LinkLayerMemory } from '@senars/nar/memory/associative';
import { LINK_LAYER } from '@senars/nar/memory/links';
import { Layer } from '../../nar/src/memory/links/Layer.js';
import { Memory } from '@senars/nar/memory';
import { atom } from '../../nar/src/terms/index.js';
import { createBeliefTask, createTaskWeight } from '../../nar/src/types/index.js';
import { Truth } from '../../nar/src/terms/index.js';
import { TermLinkStrategy } from '@senars/nar/strategies/premise/term-link.js';
import type { Strategy } from '../../nar/src/strategies/types.js';

/**
 * TODO27 Bench 104 — the associative port can write, and the memory path holds
 * no unbounded accumulator.
 *
 * Falsifies: "a strategy that records an association must reach past the port"
 * (finding 7) and "the vector store is one call away from a budget violation"
 * (finding 8).
 */

describe('Bench 104 — the associative port is read-write', () => {
  const layers = (): Map<string, Layer> =>
    new Map([[LINK_LAYER.TERM, new Layer(LINK_LAYER.TERM, 16)]]);
  const registry = (map = layers()) => new AssociativeRegistry((name) => map.get(name));

  it('associate then recall round-trips through the port', () => {
    const memories = registry();
    expect(memories.associate(LINK_LAYER.TERM, atom('cat'), atom('animal'), { strength: 0.8 })).toBe(
      true
    );
    const hits = memories.recall(LINK_LAYER.TERM, atom('cat'));
    expect(hits.map((hit) => hit.term.toString())).toEqual(['animal']);
    expect(hits[0]?.strength).toBeCloseTo(0.8);
  });

  it('a read-only view degrades to false without throwing', () => {
    const memories = registry();
    memories.register({ name: 'frozen', recall: () => [] });
    expect(memories.associate('frozen', atom('cat'), atom('animal'))).toBe(false);
  });

  it('an unresolvable memory name is false, not an exception', () => {
    expect(registry().associate('no-such-layer', atom('cat'), atom('animal'))).toBe(false);
  });

  it('a memory with no layer behind it is false', () => {
    const memory = new LinkLayerMemory('detached', () => undefined);
    expect(memory.associate(atom('cat'), atom('animal'))).toBe(false);
  });

  it('a strategy records an association without importing a link type', () => {
    const memories = registry();
    const strategy = new TermLinkStrategy({ minStrength: 0, limit: 10 });
    const m = new Memory({ enableEmbeddingLayer: false });
    for (const term of [atom('cat'), atom('animal')]) {
      m.addConcept(term).addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createTaskWeight(0.9) });
    }
    const task = createBeliefTask(atom('cat'), Truth.create(0.9, 0.9), 0.9);

    expect(strategy.selectSecondary(task, m)).toEqual([]);
    memories.associate(LINK_LAYER.TERM, atom('cat'), atom('animal'), { strength: 0.9 });
    // A MemoryView over the same concepts, reading through the port under test.
    const view = Object.create(m, {
      getAssociativeMemories: { value: () => memories },
    }) as Parameters<Strategy['selectSecondary']>[1];
    expect(strategy.selectSecondary(task, view).map((t) => t.term.toString())).toEqual(['animal']);
  });

  it('the embedding layer keeps no document store', () => {
    const source = readFileSync(
      join(process.cwd(), 'nar/src/memory/links/EmbeddingLayer.ts'),
      'utf8'
    );
    expect(source).not.toContain('storedEntries');
    expect(source).not.toContain('StoredEntry');
  });

});
