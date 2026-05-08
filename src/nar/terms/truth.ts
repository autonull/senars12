/**
 * Truth value system
 * Handles frequency, confidence, and truth operations
 */

import {clamp, safeDiv} from '../utils';

export interface Truth {
    readonly f: number; // frequency
    readonly c: number; // confidence
}

const WEAKENING_FACTOR = 10;

const binary = (
    t1: Truth | null,
    t2: Truth | null,
    op: (a: Truth, b: Truth) => Truth
): Truth | null => (t1 && t2 ? op(t1, t2) : null);

const unary = (
    t: Truth | null,
    op: (truth: Truth) => Truth
): Truth | null => (t ? op(t) : null);

export const Truth = {
    create: (f: number, c: number): Truth =>
        Object.freeze({
            f: Math.max(0, Math.min(1, isNaN(f) ? 0.5 : f)),
            c: Math.max(0, Math.min(1, isNaN(c) ? 0.9 : c))
        }),

    TRUE: Object.freeze({f: 1.0, c: 0.9}) as Truth,
    FALSE: Object.freeze({f: 0.0, c: 0.9}) as Truth,
    NEUTRAL: Object.freeze({f: 0.5, c: 0.9}) as Truth,

    safeDiv,

    negation: (t: Truth): Truth => Truth.create(1 - t.f, t.c),

    conversion: (t: Truth): Truth => Truth.create(t.f, t.f * t.c),

    expectation: (t: Truth): number => t.c * (t.f - 0.5) + 0.5,

    comparison: (t1: Truth, t2: Truth): Truth =>
        binary(
            t1,
            t2,
            (a, b) => {
                const fProd = a.f * b.f;
                return Truth.create(safeDiv(fProd, fProd + (1 - a.f) * (1 - b.f)), a.c * b.c);
            }
        )!,

    analogy: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create(a.f * b.f, a.c * b.c * b.f))!,

    resemblance: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create((a.f + b.f) / 2, a.c * b.c))!,

    contraposition: (t1: Truth, t2: Truth): Truth =>
        binary(
            t1,
            t2,
            (a, b) => {
                const contraFreq = b.f * (1 - a.f);
                return Truth.create(safeDiv(contraFreq, contraFreq + (1 - b.f) * a.f), a.c * b.c);
            }
        )!,

    intersection: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create(a.f * b.f, a.c * b.c))!,

    union: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create(1 - (1 - a.f) * (1 - b.f), a.c * b.c))!,

    subtract: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create(Math.max(0, a.f - b.f), a.c * b.c))!,

    diff: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create(Math.abs(a.f - b.f), a.c * b.c))!,

    exemplification: (t1: Truth, t2: Truth): Truth =>
        binary(
            t1,
            t2,
            (a, b) => {
                const w = a.c / (a.c + 1);
                return Truth.create(a.f * b.f, w * a.c * b.c * a.f * b.f);
            }
        )!,

    sameness: (t1: Truth, t2: Truth): Truth =>
        binary(t1, t2, (a, b) => Truth.create(1 - Math.abs(a.f - b.f), a.c * b.c))!,

    deduction: (t1: Truth, t2: Truth): Truth => Truth.create(t1.f * t2.f, t1.c * t2.c),

    deductionWeak: (t1: Truth, t2: Truth): Truth | null => {
        const res = Truth.deduction(t1, t2);
        return res ? Truth.create(res.f, res.c / (res.c + WEAKENING_FACTOR)) : null;
    },

    induction: (t1: Truth, t2: Truth): Truth => {
        const w = t2.f * t1.c * t2.c;
        return Truth.create(t2.f, w / (w + 1));
    },

    abduction: (t1: Truth, t2: Truth): Truth => {
        const w = t1.f * t1.c * t2.c;
        return Truth.create(t1.f, w / (w + 1));
    },

    detachment: (t1: Truth, t2: Truth): Truth => Truth.create(t2.f, t1.f * t1.c * t2.c),

    revision: (t1: Truth, t2: Truth): Truth => {
        const w1 = Truth.c2w(t1.c);
        const w2 = Truth.c2w(t2.c);
        const w = w1 + w2;
        return Truth.create((t1.f * w1 + t2.f * w2) / w, Truth.w2c(w));
    },

    choice: (t1: Truth, t2: Truth): Truth =>
        !t1 ? t2! : !t2 ? t1 : Truth.expectation(t1) > Truth.expectation(t2) ? t1 : t2,

    structuralDeduction: (t: Truth): Truth =>
        unary(t, truth => Truth.create(truth.f * truth.f, truth.c / (truth.c + 1) * truth.c))!,

  structuralReduction: (t: Truth): Truth =>
  unary(t, truth => Truth.create(truth.f, truth.c / (truth.c + WEAKENING_FACTOR)))!,

  revisionWeak: (t1: Truth, t2: Truth): Truth => {
    const w1 = Truth.c2w(t1.c) / WEAKENING_FACTOR;
    const w2 = Truth.c2w(t2.c) / WEAKENING_FACTOR;
    const w = w1 + w2;
    return Truth.create((t1.f * w1 + t2.f * w2) / w, Truth.w2c(w));
  },

  isStronger: (t1: Truth, t2: Truth): boolean => Truth.expectation(t1) > Truth.expectation(t2),

    weak: (c: number): number => clamp(c / (c + WEAKENING_FACTOR), 0, 1),

    c2w: (c: number): number => (c === 1 ? 1e10 : c / (1 - c)),

    w2c: (w: number): number => w / (w + 1)
};

export const isTruthEqual = (a: Truth, b: Truth, epsilon = 1e-9): boolean =>
    Math.abs(a.f - b.f) < epsilon && Math.abs(a.c - b.c) < epsilon;
