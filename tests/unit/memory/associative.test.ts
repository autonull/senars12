import { describe, expect, it } from 'vitest';
import { ConceptGraph } from '../../../nar/src/memory/ConceptGraph.js';
import { AssociativeRegistry, GraphMemory } from '../../../nar/src/memory/associative.js';
import { Layer, LinkManager } from '../../../nar/src/memory/links';
import { LINK_LAYER } from '../../../nar/src/memory/links/types.js';
import { Memory } from '../../../nar/src/memory/memory.js';
import { atom, Truth } from '../../../nar/src/terms';
import { createBeliefTask, createBudget } from '../../../nar/src/types';

const cat = atom('cat');
const animal = atom('animal');

const belief = (term: typeof cat) => createBeliefTask(term, Truth.create(0.9, 0.9), 0.9);

const memoryWith = (): Memory => {
  const memory = new Memory({ enableEmbeddingLayer: false });
  for (const term of [cat, animal]) {
    memory.addConcept(term).addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createBudget(0.9) });
  }
  return memory;
};

describe('AssociativeRegistry', () => {
  it('recalls through any link layer the manager owns, with no second registration', () => {
    const memory = memoryWith();
    const custom = new Layer('semantic', 10);
    custom.addLink({ sourceTerm: cat, targetTerm: animal, type: 'semantic', priority: 0.7 });
    memory.getLinkManager().setLayer('semantic', custom);

    expect(memory.getAssociativeMemories().recall('semantic', cat)).toEqual([
      { term: animal, strength: 0.7 },
    ]);
  });

  it('observes a layer replaced behind the same name', () => {
    const manager = new LinkManager({ layers: { term: 10 } });
    const registry = new AssociativeRegistry((name) => manager.getLayer(name));
    manager.addLink(cat, animal, { priority: 0.4 });
    expect(registry.recall('term', cat, { limit: 5 })).toHaveLength(1);

    const replacement = new Layer('term', 10);
    manager.setLayer('term', replacement);

    expect(registry.recall('term', cat, { limit: 5 })).toEqual([]);
    replacement.addLink({ sourceTerm: cat, targetTerm: animal, priority: 0.9 });
    expect(registry.recall('term', cat, { limit: 5 })).toEqual([{ term: animal, strength: 0.9 }]);
  });

  it('recalls empty for a name that resolves to nothing', () => {
    const memory = memoryWith();
    const memories = memory.getAssociativeMemories();

    expect(memories.get('nope')).toBeUndefined();
    expect(memories.recall('nope', cat)).toEqual([]);
  });

  it('applies limit and minStrength', () => {
    const memory = memoryWith();
    const links = memory.getLinkManager();
    links.addLink(cat, animal, { priority: 0.9 });
    links.addLink(cat, atom('bird'), { priority: 0.2 });

    const memories = memory.getAssociativeMemories();
    expect(memories.recall('term', cat, { limit: 1 })).toHaveLength(1);
    expect(memories.recall('term', cat, { minStrength: 0.5 })).toHaveLength(1);
  });
});

describe('GraphMemory', () => {
  it('recalls co-activated terms once attached to a memory', () => {
    const memory = memoryWith();
    expect(memory.getAssociativeMemories().recall('graph', cat)).toEqual([]);

    const graph = new ConceptGraph();
    graph.activate(cat, animal);
    memory.attachConceptGraph(graph);

    expect(memory.getAssociativeMemories().recall('graph', cat)).toEqual([
      { term: animal, strength: expect.any(Number) },
    ]);
  });

  it('replaces a prior graph rather than accumulating memories', () => {
    const memory = memoryWith();
    const first = new ConceptGraph();
    first.activate(cat, animal);
    memory.attachConceptGraph(first);

    const second = new ConceptGraph();
    second.activate(cat, atom('bird'));
    memory.attachConceptGraph(second);

    const hits = memory.getAssociativeMemories().recall('graph', cat);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.term.toString()).toBe('bird');
  });

  it('is an ordinary memory: an explicit registration wins over a layer name', () => {
    const memory = memoryWith();
    const stub = new GraphMemory(new ConceptGraph());
    memory.getAssociativeMemories().register(stub);

    expect(memory.getAssociativeMemories().get('graph')).toBe(stub);
  });
});

describe('term layer recall', () => {
  it('is reachable under the well-known layer name', () => {
    const memory = memoryWith();
    memory.getLinkManager().addLink(cat, animal, { priority: 0.6 });

    expect(memory.getAssociativeMemories().recall(LINK_LAYER.TERM, cat)).toEqual([
      { term: animal, strength: 0.6 },
    ]);
    expect(belief(cat).term).toBe(cat);
  });
});
