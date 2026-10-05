import { describe, expect, it } from 'vitest';
import { Layer, LinkManager } from '../../../nar/src/memory/links';
import { Memory } from '../../../nar/src/memory/memory.js';
import { LINK_LAYER } from '../../../nar/src/memory/links/types.js';
import { createLinkLayerStrategy } from '../../../nar/src/strategies/premise/term-link.js';
import { createDefaultRegistry } from '../../../nar/src/cognitive';
import type { Strategy } from '../../../nar/src/strategies/types';
import { atom, Truth, type Term } from '../../../nar/src/terms';
import { createBeliefTask, createTaskWeight } from '../../../nar/src/types';

/** The premise slot, by name — the registry is the only way to get a strategy. */
const premise = (name: string): Strategy => createDefaultRegistry().get<Strategy>('premise', name);

const cat = atom('cat');
const animal = atom('animal');
const whiskers = atom('whiskers');

/** A memory holding `cat`, `animal`, `whiskers` as beliefs, plus a `term` link layer. */
const memoryWith = (): Memory => {
  const memory = new Memory({ enableEmbeddingLayer: false });
  for (const term of [cat, animal, whiskers]) {
    memory
      .addConcept(term)
      .addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createTaskWeight(0.9) });
  }
  return memory;
};

const terms = (tasks: { term: Term }[]): string[] => tasks.map((t) => t.term.toString()).sort();

describe('LinkLayerStrategy', () => {
  it('selects the concepts a layer links to the task term', () => {
    const memory = memoryWith();
    memory.getLinkManager().addLink(cat, animal, { priority: 0.8 });

    const premises = premise('term-link').selectSecondary(
      createBeliefTask(cat, Truth.create(0.9, 0.9), 0.9),
      memory
    );

    expect(terms(premises)).toEqual([animal.toString()]);
  });

  it('adds the subject and predicate neighbourhoods of a compound task term', () => {
    const memory = memoryWith();
    const links = memory.getLinkManager();
    links.addLink(whiskers, cat, { type: 'inheritance', priority: 0.8 });
    links.addLink(animal, whiskers, { type: 'inheritance', priority: 0.8 });

    const task = createBeliefTask(
      { kind: 'inheritance', args: [whiskers, animal], toString: () => '<whiskers-->animal>' },
      Truth.create(0.9, 0.9),
      0.9
    );
    const premises = premise('term-link').selectSecondary(task, memory);

    expect(terms(premises)).toEqual([cat.toString(), whiskers.toString()]);
  });

  it('drops links below the configured priority and duplicates by target term', () => {
    const memory = memoryWith();
    const links = memory.getLinkManager();
    links.addLink(cat, animal, { type: 'term-link', priority: 0.9 });
    links.addLink(cat, animal, { type: 'inheritance', priority: 0.8 });
    links.addLink(cat, whiskers, { priority: 0.05 });

    const premises = createDefaultRegistry()
      .resolve<Strategy>('premise', 'term-link', { minStrength: 0.5 })
      .selectSecondary(createBeliefTask(cat, Truth.create(0.9, 0.9), 0.9), memory);

    expect(terms(premises)).toEqual([animal.toString()]);
  });

  it('reads any registered layer by name, not just the term layer', () => {
    const memory = memoryWith();
    const semantic = new Layer('semantic', 10);
    semantic.addLink({ sourceTerm: cat, targetTerm: animal, type: 'semantic', priority: 0.8 });
    memory.getLinkManager().setLayer('semantic', semantic);

    const premises = createLinkLayerStrategy('semantic').selectSecondary(
      createBeliefTask(cat, Truth.create(0.9, 0.9), 0.9),
      memory
    );

    expect(terms(premises)).toEqual([animal.toString()]);
  });

  it('yields nothing when the layer is not registered', () => {
    const memory = memoryWith();
    const manager = new LinkManager({ layers: { term: 10 } });

    expect(
      createLinkLayerStrategy(LINK_LAYER.EMBEDDING).selectSecondary(
        createBeliefTask(cat, Truth.create(0.9, 0.9), 0.9),
        memory
      )
    ).toEqual([]);
    expect(manager.getLayer(LINK_LAYER.EMBEDDING)).toBeUndefined();
  });

  it('names itself after the layer it reads', () => {
    expect(premise('term-link').name).toBe('term-link');
    expect(premise('embedding-link').name).toBe('embedding-link');
    expect(createLinkLayerStrategy('semantic').name).toBe('semantic-link');
  });
});
