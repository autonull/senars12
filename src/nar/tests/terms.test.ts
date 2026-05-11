import {atom, serializeTerm} from '../terms/index.js';
import {TermBuilder, Truth} from '../terms';

describe('Term', () => {
    test('atom creates term with hash', () => {
        const t = atom('bird');
        expect(t.kind).toBe('atom');
        expect(t.symbol).toBe('bird');
        expect(t.hash).toBeDefined();
    });

    test('serializeTerm renders atom', () => {
        const t = atom('bird');
        expect(serializeTerm(t)).toBe('bird');
    });

    test('FNV-1a hash is deterministic', () => {
        const t1 = atom('bird');
        const t2 = atom('bird');
        expect(t1.hash).toBe(t2.hash);
    });

    test('TermBuilder memoizes terms', () => {
        const t1 = TermBuilder.atom('bird');
        const t2 = TermBuilder.atom('bird');
        expect(t1).toBe(t2);
    });
});

describe('Truth', () => {
    test('create clamps values', () => {
        const t = Truth.create(0.5, 0.9);
        expect(t.f).toBe(0.5);
        expect(t.c).toBe(0.9);
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
