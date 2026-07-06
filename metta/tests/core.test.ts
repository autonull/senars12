import { describe, it, expect } from 'vitest';
import { Stamp } from '../src/core/stamp.js';
import { ConceptBag, Concept } from '../src/core/concept-bag.js';
import { serialize, deserialize } from '../src/ipc/protocol.js';

describe('Stamp', () => {
  it('creates stamp with ids', () => {
    const stamp = new Stamp([1, 2, 3]);
    expect(stamp.ids.size).toBe(3);
  });

  it('detects overlapping stamps', () => {
    const s1 = new Stamp([1, 2, 3]);
    const s2 = new Stamp([3, 4, 5]);
    expect(s1.overlaps(s2)).toBe(true);
  });

  it('detects non-overlapping stamps', () => {
    const s1 = new Stamp([1, 2, 3]);
    const s2 = new Stamp([4, 5, 6]);
    expect(s1.overlaps(s2)).toBe(false);
  });

  it('generates next stamp with new id', () => {
    const s1 = new Stamp([1, 2]);
    const s2 = s1.nextStamp();
    expect(s1.ids.size).toBe(2);
    expect(s2.ids.size).toBe(3);
  });
});

describe('ConceptBag', () => {
  it('creates concept if not exists', () => {
    const bag = new ConceptBag();
    const c = bag.getOrCreate('cat');
    expect(c.term).toBe('cat');
    expect(bag.has('cat')).toBe(true);
    expect(bag.size).toBe(1);
  });

  it('returns existing concept', () => {
    const bag = new ConceptBag();
    const c1 = bag.getOrCreate('cat');
    const c2 = bag.getOrCreate('cat');
    expect(c1).toBe(c2);
  });

  it('stores distinct concepts', () => {
    const bag = new ConceptBag();
    bag.getOrCreate('cat');
    bag.getOrCreate('dog');
    expect(bag.size).toBe(2);
  });
});

describe('IPC Protocol', () => {
  it('serializes and deserializes query', () => {
    const msg = { type: 'query' as const, id: '1', pattern: { type: 'symbol' as const, value: 'cat' } };
    const bytes = serialize(msg);
    const parsed = deserialize(bytes);
    expect(parsed.type).toBe('query');
    expect(parsed.id).toBe('1');
  });

  it('serializes and deserializes result', () => {
    const msg = { type: 'result' as const, id: '1', results: [{ type: 'symbol' as const, value: 'cat' }] };
    const bytes = serialize(msg);
    const parsed = deserialize(bytes);
    expect(parsed.type).toBe('result');
    if (parsed.type === 'result') {
      expect(parsed.results).toHaveLength(1);
    }
  });

  it('rejects invalid message type', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: 'invalid' }));
    expect(() => deserialize(bytes)).toThrow();
  });
});