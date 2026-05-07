import { Bag } from '../../memory/bag.js';

describe('Bag', () => {
    let bag: Bag<{ id: string }>;

    beforeEach(() => {
        bag = new Bag(3);
    });

    describe('add', () => {
        test('adds item within capacity', () => {
            expect(bag.add({ id: 'a' }, 0.5)).toBe(true);
            expect(bag.size).toBe(1);
        });

        test('rejects when full and low priority', () => {
            bag.add({ id: 'a' }, 0.5);
            bag.add({ id: 'b' }, 0.5);
            bag.add({ id: 'c' }, 0.5);
            expect(bag.add({ id: 'd' }, 0.3)).toBe(false);
            expect(bag.size).toBe(3);
        });

        test('evicts lowest when full and high priority', () => {
            bag.add({ id: 'a' }, 0.3);
            bag.add({ id: 'b' }, 0.3);
            bag.add({ id: 'c' }, 0.3);
            const added = bag.add({ id: 'd' }, 0.9);
            expect(added).toBe(true);
            expect(bag.size).toBe(3);
        });

        test('maintains priority order', () => {
            bag.add({ id: 'low' }, 0.2);
            bag.add({ id: 'high' }, 0.9);
            bag.add({ id: 'med' }, 0.5);
            expect(bag.peek()?.id).toBe('high');
        });
    });

    describe('remove', () => {
        test('removes existing item', () => {
            const item = { id: 'a' };
            bag.add(item, 0.5);
            expect(bag.remove(item)).toBe(true);
            expect(bag.size).toBe(0);
        });

        test('returns false for missing item', () => {
            expect(bag.remove({ id: 'x' })).toBe(false);
        });
    });

    describe('peek', () => {
        test('returns highest priority item', () => {
            bag.add({ id: 'low' }, 0.2);
            bag.add({ id: 'high' }, 0.9);
            expect(bag.peek()?.id).toBe('high');
        });

        test('returns undefined when empty', () => {
            expect(bag.peek()).toBeUndefined();
        });
    });

    describe('pruneTo', () => {
        test('truncates collection', () => {
            bag.add({ id: 'a' }, 0.5);
            bag.add({ id: 'b' }, 0.5);
            bag.add({ id: 'c' }, 0.5);
            bag.pruneTo(1);
            expect(bag.size).toBe(1);
        });
    });

    describe('entries', () => {
        test('yields items with priorities', () => {
            bag.add({ id: 'a' }, 0.5);
            bag.add({ id: 'b' }, 0.3);
            const entries = [...bag.entries()];
            expect(entries).toHaveLength(2);
            const first = entries[0];
            expect(first && first[1]).toBe(0.5);
        });
    });
});