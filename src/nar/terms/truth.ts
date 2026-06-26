import {clamp, safeDiv} from '../utils';


export type Frequency = number & { readonly __brand: unique symbol };
export type Confidence = number & { readonly __brand: unique symbol };

export interface Truth {

    readonly f: Frequency;
    readonly c: Confidence;
}

const WEAKENING_FACTOR = 10;
const MAX_CONFIDENCE = 0.999;

class TruthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TruthError';
  }
}

const createTruth = (f: number, c: number): Truth => {
  const clampedC = clamp(isNaN(c) ? 0.9 : c, 0, MAX_CONFIDENCE);
  if (c > MAX_CONFIDENCE) {
    throw new TruthError(`Confidence ${c} exceeds maximum ${MAX_CONFIDENCE}`);
  }
  return Object.freeze({f: clamp(isNaN(f) ? 0.5 : f, 0, 1) as Frequency, c: clampedC as Confidence});
};

const c2w = (c: number): number => c === 1 ? 1e10 : c / (1 - c);
const w2c = (w: number): number => w / (w + 1);

const truthOps = {
    binary: <F extends (f1: number, f2: number, c1: number, c2: number) => [number, number]>(fn: F) =>
        (t1: Truth, t2: Truth): Truth => {
            const [f, c] = fn(t1.f, t2.f, t1.c, t2.c);
            return createTruth(f, c);
        },
    unary: <F extends (f: number, c: number) => [number, number]>(fn: F) =>
        (t: Truth): Truth => {
            const [f, c] = fn(t.f, t.c);
            return createTruth(f, c);
        },
    chain: (op: (t1: Truth, t2: Truth) => Truth, t1: Truth, t2: Truth, steps: number): Truth => {
        let result = op(t1, t2);
        for (let i = 1; i < steps; i++) result = op(result, t2);
        return result;
    },
    chainWithRevision: (op: (t1: Truth, t2: Truth) => Truth, t1: Truth, t2: Truth, steps: number): Truth => {
        let result = op(t1, t2);
        for (let i = 1; i < steps; i++) result = Truth.revision(result, op(t1, t2));
        return result;
    }
} as const;

export const Truth = {
create: createTruth,
TRUE: Object.freeze({f: 1.0 as Frequency, c: 0.9 as Confidence}) as Truth,
FALSE: Object.freeze({f: 0.0 as Frequency, c: 0.9 as Confidence}) as Truth,
NEUTRAL: Object.freeze({f: 0.5 as Frequency, c: 0.9 as Confidence}) as Truth,
MAX_CONFIDENCE,
    safeDiv: (a: number, b: number): number => Math.abs(b) < 1e-9 ? 0 : a / b,

    negation: truthOps.unary((f, c) => [1 - f, c]),
    conversion: truthOps.unary((f, c) => [f, f * c]),
    expectation: (t: Truth): number => t.c * (t.f - 0.5) + 0.5,
    harshness: (t: Truth): number => {
        const exp = Truth.expectation(t);
        return (1 - t.c) * (1 - exp) + t.c * exp;
    },

    comparison: truthOps.binary((f1, f2, c1, c2) => {
        const fProd = f1 * f2;
        return [safeDiv(fProd, fProd + (1 - f1) * (1 - f2)), c1 * c2];
    }),
    analogy: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, c1 * c2 * f2]),
    resemblance: truthOps.binary((f1, f2, c1, c2) => [(f1 + f2) / 2, c1 * c2]),
    contraposition: truthOps.binary((f1, f2, c1, c2) => {
        const cf = f2 * (1 - f1);
        return [safeDiv(cf, cf + (1 - f2) * f1), c1 * c2];
    }),
    intersection: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, c1 * c2]),
    union: truthOps.binary((f1, f2, c1, c2) => [1 - (1 - f1) * (1 - f2), c1 * c2]),
    subtract: truthOps.binary((f1, f2, c1, c2) => [Math.max(0, f1 - f2), c1 * c2]),
    diff: truthOps.binary((f1, f2, c1, c2) => [Math.abs(f1 - f2), c1 * c2]),
    exemplification: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, (c1 / (c1 + 1)) * c1 * c2 * f1 * f2]),
    sameness: truthOps.binary((f1, f2, c1, c2) => [1 - Math.abs(f1 - f2), c1 * c2]),
    deduction: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, c1 * c2]),
    deductionWeak: (t1: Truth, t2: Truth): Truth | null => {
        const res = Truth.deduction(t1, t2);
        return res ? createTruth(res.f, res.c / (res.c + WEAKENING_FACTOR)) : null;
    },
    induction: truthOps.binary((f1, f2, c1, c2) => {
        const w = f2 * c1 * c2;
        return [f2, w / (w + 1)];
    }),
    abduction: truthOps.binary((f1, f2, c1, c2) => {
        const w = f1 * c1 * c2;
        return [f1, w / (w + 1)];
    }),
    detachment: truthOps.binary((f1, f2, c1, c2) => [f2, f1 * c1 * c2]),
revision: truthOps.binary((f1, f2, c1, c2) => {
const w1 = c2w(c1), w2 = c2w(c2), w = w1 + w2;
const newC = w2c(w);
if (newC > MAX_CONFIDENCE) {
return [(f1 * c1 + f2 * c2) / (c1 + c2), MAX_CONFIDENCE];
}
return [(f1 * w1 + f2 * w2) / w, newC];
}),
    choice: (t1: Truth, t2: Truth): Truth => Truth.expectation(t1) > Truth.expectation(t2) ? t1 : t2,
    structuralDeduction: truthOps.unary((f, c) => [f * f, c / (c + 1) * c]),
    structuralReduction: truthOps.unary((f, c) => [f, c / (c + WEAKENING_FACTOR)]),
    revisionWeak: truthOps.binary((f1, f2, c1, c2) => {
        const w1 = c2w(c1) / WEAKENING_FACTOR, w2 = c2w(c2) / WEAKENING_FACTOR, w = w1 + w2;
        return [(f1 * w1 + f2 * w2) / w, w2c(w)];
    }),

    isStronger: (t1: Truth, t2: Truth): boolean => Truth.expectation(t1) > Truth.expectation(t2),
    weak: (c: number): number => clamp(c / (c + WEAKENING_FACTOR), 0, 1),
    c2w, w2c,

    serialize: (t: Truth): string => `%${t.f.toFixed(4)};${t.c.toFixed(4)}%`,
    deserialize: (s: string): Truth | null => {
        const match = s.match(/%\s*([0-9.]+)\s*;\s*([0-9.]+)\s*%/);
        return match ? createTruth(parseFloat(match[1]!) ?? 0.5, parseFloat(match[2]!) ?? 0.9) : null;
    },
    equals: (t1: Truth, t2: Truth, epsilon = 1e-3): boolean => Math.abs(t1.f - t2.f) < epsilon && Math.abs(t1.c - t2.c) < epsilon,
    compare: (t1: Truth, t2: Truth): number => {
        const diff = Truth.expectation(t1) - Truth.expectation(t2);
        return Math.abs(diff) < 1e-9 ? 0 : diff > 0 ? 1 : -1;
    },

    deductionChain: (t1: Truth, t2: Truth, steps: number): Truth => truthOps.chain(Truth.deduction, t1, t2, steps),
    inductionChain: (t1: Truth, t2: Truth, steps: number): Truth => truthOps.chainWithRevision(Truth.induction, t1, t2, steps),
    abductionChain: (t1: Truth, t2: Truth, steps: number): Truth => truthOps.chainWithRevision(Truth.abduction, t1, t2, steps),
    conversionChain: (t: Truth, steps: number): Truth => {
        let result = t;
        for (let i = 0; i < steps; i++) result = Truth.conversion(result);
        return result;
    }
} as const;

export const isTruthEqual = (a: Truth, b: Truth, epsilon = 1e-3): boolean =>
    Math.abs(a.f - b.f) < epsilon && Math.abs(a.c - b.c) < epsilon;
