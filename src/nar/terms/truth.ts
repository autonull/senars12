export interface Truth {
    readonly f: number;
    readonly c: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const WEAKENING_FACTOR = 10;

export const Truth = {
    create(f: number, c: number): Truth {
        const clampedF = Math.max(0, Math.min(1, isNaN(f) ? 0.5 : f));
        const clampedC = Math.max(0, Math.min(1, isNaN(c) ? 0.9 : c));
        return Object.freeze({ f: clampedF, c: clampedC });
    },

    TRUE: Object.freeze({ f: 1.0, c: 0.9 }) as Truth,
    FALSE: Object.freeze({ f: 0.0, c: 0.9 }) as Truth,
    NEUTRAL: Object.freeze({ f: 0.5, c: 0.9 }) as Truth,

    safeDiv(num: number, den: number): number {
        return den === 0 ? 0 : clamp(num / den, 0, 1);
    },

    _binary(t1: Truth | null, t2: Truth | null, op: (a: Truth, b: Truth) => Truth): Truth | null {
        if (!t1 || !t2) return null;
        return op(t1, t2);
    },

    _unary(t: Truth | null, op: (truth: Truth) => Truth): Truth | null {
        if (!t) return null;
        return op(t);
    },

    negation(t: Truth): Truth {
        return Truth.create(1 - t.f, t.c);
    },

    conversion(t: Truth): Truth {
        return Truth.create(t.f, t.f * t.c);
    },

    expectation(t: Truth): number {
        return t.c * (t.f - 0.5) + 0.5;
    },

    comparison(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) => {
            const fProd = a.f * b.f;
            const denom = fProd + (1 - a.f) * (1 - b.f);
            return Truth.create(Truth.safeDiv(fProd, denom), a.c * b.c);
        })!;
    },

    analogy(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) =>
            Truth.create(a.f * b.f, a.c * b.c * b.f)
        )!;
    },

    resemblance(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) =>
            Truth.create((a.f + b.f) / 2, a.c * b.c)
        )!;
    },

    contraposition(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) => {
            const contraFreq = b.f * (1 - a.f);
            const denom = contraFreq + (1 - b.f) * a.f;
            return Truth.create(Truth.safeDiv(contraFreq, denom), a.c * b.c);
        })!;
    },

    intersection(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) => Truth.create(a.f * b.f, a.c * b.c))!;
    },

    union(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) =>
            Truth.create(1 - (1 - a.f) * (1 - b.f), a.c * b.c)
        )!;
    },

    subtract(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) =>
            Truth.create(Math.max(0, a.f - b.f), a.c * b.c)
        )!;
    },

    diff(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) =>
            Truth.create(Math.abs(a.f - b.f), a.c * b.c)
        )!;
    },

    exemplification(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) => {
            const w = a.c / (a.c + 1);
            return Truth.create(a.f * b.f, w * a.c * b.c * a.f * b.f);
        })!;
    },

    sameness(t1: Truth, t2: Truth): Truth {
        return Truth._binary(t1, t2, (a, b) => {
            const d = Math.abs(a.f - b.f);
            return Truth.create(1 - d, a.c * b.c);
        })!;
    },

    deductionWeak(t1: Truth, t2: Truth): Truth | null {
        const res = Truth.deduction(t1, t2);
        return res ? Truth.create(res.f, Truth.weak(res.c)) : null;
    },

    structuralDeduction(t: Truth): Truth {
        return Truth._unary(t, (truth) => {
            const c = truth.c / (truth.c + 1);
            return Truth.create(truth.f * truth.f, c * truth.c);
        })!;
    },

    structuralReduction(t: Truth): Truth {
        // Use the passed truth for computations (previously referenced outer name incorrectly).
        return Truth._unary(t, (truth) => Truth.create(truth.f, Truth.weak(truth.c)))!;
    },

    isStronger(t1: Truth, t2: Truth): boolean {
        return Truth.expectation(t1) > Truth.expectation(t2);
    },

    weak(c: number): number {
        return clamp(c / (c + WEAKENING_FACTOR), 0, 1);
    },

    deduction(t1: Truth, t2: Truth): Truth {
        return Truth.create(t1.f * t2.f, t1.c * t2.c);
    },

    induction(t1: Truth, t2: Truth): Truth {
        const w = t2.f * t1.c * t2.c;
        return Truth.create(t2.f, Truth.w2c(w));
    },

    abduction(t1: Truth, t2: Truth): Truth {
        const w = t1.f * t1.c * t2.c;
        return Truth.create(t1.f, Truth.w2c(w));
    },

    detachment(t1: Truth, t2: Truth): Truth {
        return Truth.create(t2.f, t1.f * t1.c * t2.c);
    },

    revision(t1: Truth, t2: Truth): Truth {
        const w1 = Truth.c2w(t1.c);
        const w2 = Truth.c2w(t2.c);
        const w = w1 + w2;
        const f = (t1.f * w1 + t2.f * w2) / w;
        const c = Truth.w2c(w);
        return Truth.create(f, c);
    },

    choice(t1: Truth, t2: Truth): Truth {
        if (!t1) return t2!;
        if (!t2) return t1;
        return Truth.expectation(t1) > Truth.expectation(t2) ? t1 : t2;
    },

    c2w(c: number): number {
        return c === 1 ? 1e10 : (c / (1 - c));
    },

    w2c(w: number): number {
        return w / (w + 1);
    }
};

export function isTruthEqual(a: Truth, b: Truth, epsilon = 1e-9): boolean {
    return Math.abs(a.f - b.f) < epsilon && Math.abs(a.c - b.c) < epsilon;
}
