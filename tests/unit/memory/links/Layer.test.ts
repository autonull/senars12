import { Layer, LinkManager } from '../../../../nar/src/memory/links';
import { atom } from '../../../../nar/src/terms';

const cat = atom('cat');
const dog = atom('dog');
const bird = atom('bird');
const whiskers = atom('whiskers');

describe('Layer', () => {
  it('round-trips a link by structural term identity', () => {
    const layer = new Layer('term', 10);

    expect(layer.addLink({ sourceTerm: cat, targetTerm: dog, priority: 0.8 })).not.toBeNull();
    expect(layer.getLinkPriority(cat, dog)).toBe(0.8);
    expect(layer.getLinkPriority(dog, cat)).toBe(0);
  });

  it('treats a re-add as a priority update rather than a second link', () => {
    const layer = new Layer('term', 10);

    layer.addLink({ sourceTerm: cat, targetTerm: dog, priority: 0.2 });
    layer.addLink({ sourceTerm: cat, targetTerm: dog, priority: 0.9 });

    expect(layer.getStats().size).toBe(1);
    expect(layer.getLinkPriority(cat, dog)).toBe(0.9);
  });

  it('removes a link from every view', () => {
    const layer = new Layer('term', 10);
    layer.addLink({ sourceTerm: cat, targetTerm: dog, type: 'inheritance' });

    expect(layer.removeLink(cat, dog, 'inheritance')).toBe(true);
    expect(layer.removeLink(cat, dog, 'inheritance')).toBe(false);
    expect(layer.getLinksByTerm(cat)).toEqual([]);
    expect(layer.getLinksByTerm(cat)).toEqual([]);
  });

  it('does not leave evicted links behind in its indexes', () => {
    const layer = new Layer('term', 2);

    layer.addLink({ sourceTerm: cat, targetTerm: dog, priority: 0.9 });
    layer.addLink({ sourceTerm: cat, targetTerm: bird, priority: 0.8 });
    layer.addLink({ sourceTerm: dog, targetTerm: bird, priority: 0.1 });

    expect(layer.getStats().size).toBe(2);
    expect(layer.getLinkPriority(cat, bird)).toBe(0);
    expect(layer.getLinkPriority(cat, dog)).toBe(0.9);
    expect(layer.getLinksByTerm(cat).map((l) => l.targetTerm)).toEqual([dog]);
  });

  it('purges links decayed below the retention floor', () => {
    const layer = new Layer('term', 10);
    layer.addLink({ sourceTerm: cat, targetTerm: dog, priority: 0.01 });

    layer.applyDecay(0.5);

    expect(layer.getStats().size).toBe(0);
    expect(layer.getLinksByTerm(cat)).toEqual([]);
  });

  it('returns a link from the term index for both endpoints only', () => {
    const layer = new Layer('term', 10);
    layer.addLink({ sourceTerm: cat, targetTerm: dog });

    expect(layer.getLinksByTerm(cat)).toHaveLength(1);
    expect(layer.getLinksByTerm(dog)).toHaveLength(1);
    expect(layer.getLinksByTerm(whiskers)).toEqual([]);
  });

  it('applies type, priority and result-count filters', () => {
    const layer = new Layer('term', 10);
    layer.addLink({ sourceTerm: cat, targetTerm: dog, type: 'term-link', priority: 0.2 });
    layer.addLink({ sourceTerm: cat, targetTerm: bird, type: 'semantic', priority: 0.9 });

    expect(layer.getLinksByTerm(cat, { type: 'semantic' })).toHaveLength(1);
    expect(layer.getLinksByTerm(cat, { minPriority: 0.5 })).toHaveLength(1);
    expect(layer.getLinksByTerm(cat, { maxResults: 1 })).toHaveLength(1);
  });

  it('removeAllLinksForTerm drops links in either direction', () => {
    const layer = new Layer('term', 10);
    layer.addLink({ sourceTerm: cat, targetTerm: dog });
    layer.addLink({ sourceTerm: dog, targetTerm: whiskers });

    layer.removeAllLinksForTerm(dog);

    expect(layer.getStats().size).toBe(0);
  });

  it('evicts the lowest-priority link when at capacity', () => {
    const layer = new Layer('term', 1);

    expect(layer.addLink({ sourceTerm: cat, targetTerm: dog })).not.toBeNull();
    expect(layer.addLink({ sourceTerm: cat, targetTerm: bird, priority: 0.9 })).not.toBeNull();
    expect(layer.getStats().size).toBe(1);
    expect(layer.getLinkPriority(cat, bird)).toBe(0.9);
  });

  it('breaks priority ties by creation order', () => {
    const layer = new Layer('term', 2);

    layer.addLink({ sourceTerm: cat, targetTerm: dog, priority: 0.5 });
    layer.addLink({ sourceTerm: cat, targetTerm: bird, priority: 0.5 });
    layer.addLink({ sourceTerm: cat, targetTerm: whiskers, priority: 0.5 });

    expect(layer.getLinkPriority(cat, dog)).toBe(0);
    expect(layer.getLinkPriority(cat, bird)).toBe(0.5);
  });

  it('refreshes recency on a read under the lru policy', () => {
    const layer = new Layer('term', 2, 'lru');

    layer.addLink({ sourceTerm: cat, targetTerm: dog });
    layer.addLink({ sourceTerm: bird, targetTerm: whiskers });
    layer.getLinksByTerm(cat);
    layer.addLink({ sourceTerm: dog, targetTerm: whiskers });

    expect(layer.getLinkPriority(cat, dog)).toBe(0.5);
    expect(layer.getLinkPriority(bird, whiskers)).toBe(0);
  });

  it('does not refresh recency on a read under the fifo policy', () => {
    const layer = new Layer('term', 2, 'fifo');

    layer.addLink({ sourceTerm: cat, targetTerm: dog });
    layer.addLink({ sourceTerm: bird, targetTerm: whiskers });
    layer.getLinksByTerm(cat);
    layer.addLink({ sourceTerm: dog, targetTerm: whiskers });

    expect(layer.getLinkPriority(cat, dog)).toBe(0);
    expect(layer.getLinkPriority(bird, whiskers)).toBe(0.5);
  });

  it('draws its victim from the injected stream under the random policy', () => {
    const layer = new Layer('term', 2, 'random', () => 0);

    layer.addLink({ sourceTerm: cat, targetTerm: dog });
    layer.addLink({ sourceTerm: bird, targetTerm: whiskers });
    layer.addLink({ sourceTerm: dog, targetTerm: whiskers });

    expect(layer.getLinkPriority(cat, dog)).toBe(0);
    expect(layer.getStats().size).toBe(2);
  });

  it('admit-nothing capacity rejects every link rather than holding one', () => {
    const layer = new Layer('term', 0);

    expect(layer.addLink({ sourceTerm: cat, targetTerm: dog })).toBeNull();
    // `utilization` and `pressure` are the same quantity, so an admit-nothing
    // layer reports full — not the `0/0 = NaN` the unguarded division gave.
    expect(layer.getStats()).toMatchObject({ size: 0, utilization: 1 });
    expect(layer.pressure()).toBe(1);
  });

  it('reports occupancy as pressure', () => {
    const layer = new Layer('term', 4);
    layer.addLink({ sourceTerm: cat, targetTerm: dog });

    expect(layer.pressure()).toBe(0.25);
  });
});

describe('LinkManager', () => {
  it('routes each operation to the requested layer', () => {
    const manager = new LinkManager({ layers: { term: 10 } });
    const other = new Layer('term', 10);
    manager.setLayer('other', other);

    manager.addLink(cat, dog, { layer: 'other', priority: 0.4 });

    expect(manager.getLinkPriority(cat, dog, 'other')).toBe(0.4);
    expect(manager.getLinkPriority(cat, dog)).toBe(0);
    expect(manager.getLinks(cat, { layer: 'other' })).toHaveLength(1);
  });

  it('honours getLinks filters instead of dropping them', () => {
    const manager = new LinkManager({ layers: { term: 10 } });
    manager.addLink(cat, dog, { type: 'term-link', priority: 0.1 });
    manager.addLink(cat, dog, { type: 'inheritance', priority: 0.9 });

    expect(manager.getLinks(cat, { minPriority: 0.5 })).toHaveLength(1);
    expect(manager.getLinks(cat, { type: 'term-link' })).toHaveLength(1);
  });

  it('decays every registered layer together', () => {
    const manager = new LinkManager({ layers: { term: 10, extra: 10 } });
    manager.addLink(cat, dog, { priority: 0.01 });
    manager.addLink(cat, dog, { layer: 'extra', priority: 0.01 });

    manager.applyDecay(0.5);

    expect(manager.getStats()).toMatchObject({ term: { size: 0 }, extra: { size: 0 } });
  });

  it('registers a layer on first use and reuses it afterwards', () => {
    const manager = new LinkManager({ layers: { term: 10 } });

    const first = manager.addLink(cat, dog, { layer: 'lazy' });
    const second = manager.addLink(dog, cat, { layer: 'lazy', priority: 0.6 });

    expect(first).not.toBeNull();
    expect(manager.getLayer('lazy')).toBe(manager.getLayer('lazy'));
    expect(second?.id).not.toBe(first?.id);
    expect(manager.getStats().lazy?.size).toBe(2);
  });

  it('reports no embedding layer unless one was attached', () => {
    const manager = new LinkManager();

    expect(manager.getEmbeddingLayer()).toBeUndefined();
  });
});
