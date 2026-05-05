export interface Truth {
    readonly f: number;
    readonly c: number;
}

export const Truth = {
    create(f: number, c: number): Truth {
        const clampedF = Math.max(0, Math.min(1, isNaN(f) ? 0.5 : f));
        const clampedC = Math.max(0, Math.min(1, isNaN(c) ? 0.9 : c));
        return Object.freeze({ f: clampedF, c: clampedC });
    },

    TRUE: Object.freeze({ f: 1.0, c: 0.9 }) as Truth,
    FALSE: Object.freeze({ f: 0.0, c: 0.9 }) as Truth,
    NEUTRAL: Object.freeze({ f: 0.5, c: 0.9 }) as Truth,

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