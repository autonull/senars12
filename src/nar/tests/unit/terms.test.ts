import { fnv1a, computeHash } from '../../utils/hash.js';
import { isCompound, isAtomic } from '../../terms/types.js';
import { TermBuilder } from '../../terms/factory.js';
import { Truth } from '../../terms/truth.js';

describe('Hash', () => {
    test('fnv1a is deterministic', () => {
        const h1 = fnv1a('test');
        const h2 = fnv1a('test');
        expect(h1).toBe(h2);
    });

    test('computeHash sorts args', () => {
        const h1 = computeHash('test', [1, 2, 3]);
        const h2 = computeHash('test', [3, 2, 1]);
        expect(h1).toBe(h2);
    });
});

describe('TermBuilder', () => {
    beforeEach(() => TermBuilder.clear());

    test('atom creates and caches terms', () => {
        const t1 = TermBuilder.atom('bird');
        const t2 = TermBuilder.atom('bird');
        expect(t1).toBe(t2);
    });

    test('atom returns TRUE singleton', () => {
        expect(TermBuilder.atom('TRUE')).toBe(TermBuilder.atom('TRUE'));
    });

    test('inheritance creates compound', () => {
        const bird = TermBuilder.atom('bird');
        const animal = TermBuilder.atom('animal');
        const t = TermBuilder.inheritance(bird, animal);
        expect(isCompound(t)).toBe(true);
    });

    test('conjunction sorts arguments', () => {
        const a = TermBuilder.atom('A');
        const b = TermBuilder.atom('B');
        const conj1 = TermBuilder.conjunction(a, b);
        const conj2 = TermBuilder.conjunction(b, a);
        expect(conj1).toBe(conj2);
    });

    test('negation handles undefined', () => {
        const t = TermBuilder.negation(undefined);
        expect(isAtomic(t)).toBe(true);
    });

    test('compound with custom kind', () => {
        const a = TermBuilder.atom('A');
        const b = TermBuilder.atom('B');
        const t = TermBuilder.compound('implication', [a, b]);
        expect(isCompound(t)).toBe(true);
    });
});

describe('Truth', () => {
    test('create clamps values', () => {
        const t = Truth.create(0.5, 0.9);
        expect(t.f).toBe(0.5);
        expect(t.c).toBe(0.9);
    });

    test('create clamps out of range', () => {
        const t = Truth.create(1.5, 1.5);
        expect(t.f).toBe(1);
        expect(t.c).toBe(1);
    });

    test('deduction computes conjunction', () => {
        const t1 = Truth.create(0.9, 0.9);
        const t2 = Truth.create(0.9, 0.9);
        const result = Truth.deduction(t1, t2);
        expect(result.f).toBeCloseTo(0.81);
    });

    test('TRUE is singleton', () => {
        expect(Truth.TRUE.f).toBe(1.0);
        expect(Truth.TRUE.c).toBe(0.9);
    });
});