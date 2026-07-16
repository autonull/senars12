import type { LinkEntry } from '../../../../nar/src/memory/links';
import { LinkBag } from '../../../../nar/src/memory/links';
import type { AtomicTerm } from '../../../../nar/src/terms';

const atom = (symbol: string): AtomicTerm => ({
  kind: 'atom',
  symbol,
  toString: () => symbol,
});

const entry = (
  id: string,
  source: string,
  target: string,
  priority: number
): LinkEntry => ({
  id,
  sourceTerm: atom(source),
  targetTerm: atom(target),
  type: 'term-link',
  priority,
  createdAt: Date.now(),
  lastAccessedAt: Date.now(),
});

describe('LinkBag', () => {
  describe('capacity eviction', () => {
    it('should evict lowest priority when at capacity', () => {
      const bag = new LinkBag(3, 'priority');

      const entry1 = entry('1_2_term-link', '1', '2', 0.9);
      const entry2 = entry('2_3_term-link', '2', '3', 0.5);
      const entry3 = entry('3_4_term-link', '3', '4', 0.7);

      expect(bag.add(entry1)).toBe(true);
      expect(bag.add(entry2)).toBe(true);
      expect(bag.add(entry3)).toBe(true);
      expect(bag.size).toBe(3);

      const entry4 = entry('4_5_term-link', '4', '5', 0.8);

      expect(bag.add(entry4)).toBe(true);
      expect(bag.size).toBe(3);

      expect(bag.get('2_3_term-link')).toBeUndefined();
    });
  });

  describe('forget policies', () => {
    it('should evict by priority with priority policy', () => {
      const bag = new LinkBag(2, 'priority');

      const entry1 = entry('1_2_term-link', '1', '2', 0.9);
      const entry2 = entry('2_3_term-link', '2', '3', 0.3);

      bag.add(entry1);
      bag.add(entry2);

      const lowest = bag.peekLowest();
      expect(lowest?.id).toBe('2_3_term-link');
    });
  });

  describe('decay', () => {
    it('should decay priorities and remove sub-threshold', () => {
      const bag = new LinkBag(10, 'priority');

      const e = entry('1_2_term-link', '1', '2', 0.015);

      bag.add(e);
      bag.applyDecay(0.5);

      expect(bag.size).toBe(0);
    });
  });
});
