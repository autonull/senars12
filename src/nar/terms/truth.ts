/**
 * Truth value system
 * Handles frequency, confidence, and truth operations
 */

import {clamp, safeDiv} from '../utils';

export interface Truth {
    readonly f: number;
    readonly c: number;
}

const WEAKENING_FACTOR = 10;

const createTruth = (f: number, c: number): Truth =>
    Object.freeze({
        f: Math.max(0, Math.min(1, isNaN(f) ? 0.5 : f)),
        c: Math.max(0, Math.min(1, isNaN(c) ? 0.9 : c))
    });

const binaryOp = (fn: (f1: number, f2: number, c1: number, c2: number) => [number, number]) =>
    (t1: Truth, t2: Truth): Truth => {
        const [f, c] = fn(t1.f, t2.f, t1.c, t2.c);
        return createTruth(f, c);
    };

const unaryOp = (fn: (f: number, c: number) => [number, number]) =>
    (t: Truth): Truth => {
        const [f, c] = fn(t.f, t.c);
        return createTruth(f, c);
    };

const c2w = (c: number): number => c === 1 ? 1e10 : c / (1 - c);
const w2c = (w: number): number => w / (w + 1);
const deductionBinary = binaryOp((f1, f2, c1, c2) => [f1 * f2, c1 * c2]);
const inductionBinary = binaryOp((f1, f2, c1, c2) => {
    const w = f2 * c1 * c2;
    return [f2, w / (w + 1)];
});
const abductionBinary = binaryOp((f1, f2, c1, c2) => {
    const w = f1 * c1 * c2;
    return [f1, w / (w + 1)];
});
const revisionBinary = binaryOp((f1, f2, c1, c2) => {
    const w1 = c2w(c1);
    const w2 = c2w(c2);
    const w = w1 + w2;
    return [(f1 * w1 + f2 * w2) / w, w2c(w)];
});
const conversion = unaryOp((f, c) => [f, f * c]);

export const Truth = {
    create: createTruth,

    TRUE: Object.freeze({f: 1.0, c: 0.9}) as Truth,
    FALSE: Object.freeze({f: 0.0, c: 0.9}) as Truth,
    NEUTRAL: Object.freeze({f: 0.5, c: 0.9}) as Truth,

    safeDiv,

    negation: unaryOp((f, c) => [1 - f, c]),
    conversion: unaryOp((f, c) => [f, f * c]),
    expectation: (t: Truth): number => t.c * (t.f - 0.5) + 0.5,

    harshness: (t: Truth): number => {
        const exp = t.c * (t.f - 0.5) + 0.5;
        return (1 - t.c) * (1 - exp) + t.c * exp;
    },

    comparison: binaryOp((f1, f2, c1, c2) => {
        const fProd = f1 * f2;
        return [safeDiv(fProd, fProd + (1 - f1) * (1 - f2)), c1 * c2];
    }),

    analogy: binaryOp((f1, f2, c1, c2) => [f1 * f2, c1 * c2 * f2]),
    resemblance: binaryOp((f1, f2, c1, c2) => [(f1 + f2) / 2, c1 * c2]),

    contraposition: binaryOp((f1, f2, c1, c2) => {
        const contraFreq = f2 * (1 - f1);
        return [safeDiv(contraFreq, contraFreq + (1 - f2) * f1), c1 * c2];
    }),

    intersection: binaryOp((f1, f2, c1, c2) => [f1 * f2, c1 * c2]),
    union: binaryOp((f1, f2, c1, c2) => [1 - (1 - f1) * (1 - f2), c1 * c2]),
    subtract: binaryOp((f1, f2, c1, c2) => [Math.max(0, f1 - f2), c1 * c2]),
    diff: binaryOp((f1, f2, c1, c2) => [Math.abs(f1 - f2), c1 * c2]),

    exemplification: binaryOp((f1, f2, c1, c2) => {
        const w = c1 / (c1 + 1);
        return [f1 * f2, w * c1 * c2 * f1 * f2];
    }),

    sameness: binaryOp((f1, f2, c1, c2) => [1 - Math.abs(f1 - f2), c1 * c2]),
    deduction: binaryOp((f1, f2, c1, c2) => [f1 * f2, c1 * c2]),

    deductionWeak: (t1: Truth, t2: Truth): Truth | null => {
        const res = deductionBinary(t1, t2);
        return res ? createTruth(res.f, res.c / (res.c + WEAKENING_FACTOR)) : null;
    },

    induction: binaryOp((f1, f2, c1, c2) => {
        const w = f2 * c1 * c2;
        return [f2, w / (w + 1)];
    }),

    abduction: binaryOp((f1, f2, c1, c2) => {
        const w = f1 * c1 * c2;
        return [f1, w / (w + 1)];
    }),

    detachment: binaryOp((f1, f2, c1, c2) => [f2, f1 * c1 * c2]),

    revision: binaryOp((f1, f2, c1, c2) => {
        const w1 = c2w(c1);
        const w2 = c2w(c2);
        const w = w1 + w2;
        return [(f1 * w1 + f2 * w2) / w, w2c(w)];
    }),

    choice: (t1: Truth, t2: Truth): Truth => {
        const exp1 = t1.c * (t1.f - 0.5) + 0.5;
        const exp2 = t2.c * (t2.f - 0.5) + 0.5;
        return !t1 ? t2! : !t2 ? t1 : exp1 > exp2 ? t1 : t2;
    },

    structuralDeduction: unaryOp((f, c) => [f * f, c / (c + 1) * c]),
    structuralReduction: unaryOp((f, c) => [f, c / (c + WEAKENING_FACTOR)]),

    revisionWeak: binaryOp((f1, f2, c1, c2) => {
        const w1 = c2w(c1) / WEAKENING_FACTOR;
        const w2 = c2w(c2) / WEAKENING_FACTOR;
        const w = w1 + w2;
        return [(f1 * w1 + f2 * w2) / w, w2c(w)];
    }),

    isStronger: (t1: Truth, t2: Truth): boolean => {
        const exp1 = t1.c * (t1.f - 0.5) + 0.5;
        const exp2 = t2.c * (t2.f - 0.5) + 0.5;
        return exp1 > exp2;
    },
    weak: (c: number): number => clamp(c / (c + WEAKENING_FACTOR), 0, 1),
    c2w: (c: number): number => c === 1 ? 1e10 : c / (1 - c),
    w2c: (w: number): number => w / (w + 1),

    serialize: (t: Truth): string => `%${t.f.toFixed(4)};${t.c.toFixed(4)}%`,

    deserialize: (s: string): Truth | null => {
        const match = s.match(/%\s*([0-9.]+)\s*;\s*([0-9.]+)\s*%/);
        return match ? createTruth(parseFloat(match[1]!) ?? 0.5, parseFloat(match[2]!) ?? 0.9) : null;
    },

    equals: (t1: Truth, t2: Truth, epsilon = 1e-9): boolean =>
        Math.abs(t1.f - t2.f) < epsilon && Math.abs(t1.c - t2.c) < epsilon,

    compare: (t1: Truth, t2: Truth): number => {
        const exp1 = t1.c * (t1.f - 0.5) + 0.5;
        const exp2 = t2.c * (t2.f - 0.5) + 0.5;
        return Math.abs(exp1 - exp2) < 1e-9 ? 0 : exp1 > exp2 ? 1 : -1;
    },

    conversionChain: (t: Truth, steps: number): Truth => {
        let result = t;
        for (let i = 0; i < steps; i++) result = conversion(result);
        return result;
    },

    deductionChain: (t1: Truth, t2: Truth, steps: number): Truth => {
        let result = deductionBinary(t1, t2);
        for (let i = 1; i < steps; i++) result = deductionBinary(result, t2);
        return result;
    },

    inductionChain: (t1: Truth, t2: Truth, steps: number): Truth => {
        let result = inductionBinary(t1, t2);
        for (let i = 1; i < steps; i++) result = revisionBinary(result, inductionBinary(t1, t2));
        return result;
    },

    abductionChain: (t1: Truth, t2: Truth, steps: number): Truth => {
        let result = abductionBinary(t1, t2);
        for (let i = 1; i < steps; i++) result = revisionBinary(result, abductionBinary(t1, t2));
        return result;
    }
};

export const isTruthEqual = (a: Truth, b: Truth, epsilon = 1e-9): boolean =>
    Math.abs(a.f - b.f) < epsilon && Math.abs(a.c - b.c) < epsilon;
