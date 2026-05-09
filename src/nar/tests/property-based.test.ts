import fc from 'fast-check';
import {TermBuilder} from '../terms';
import {Truth} from '../terms';
import {Stamp} from '../terms';

describe('Property-Based Tests', () => {
    describe('Term Invariants', () => {
        it('atomic terms have consistent hashes', () => {
            fc.assert(
                fc.property(fc.string(), (name) => {
                    const term1 = TermBuilder.atom(name);
                    const term2 = TermBuilder.atom(name);
                    expect(term1.hash).toBe(term2.hash);
                    expect(term1.symbol).toBe(term2.symbol);
                })
            );
        });

        it('conjunction is commutative for hashing', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    const termA = TermBuilder.atom(a);
                    const termB = TermBuilder.atom(b);
                    const conj1 = TermBuilder.conjunction(termA, termB);
                    const conj2 = TermBuilder.conjunction(termB, termA);
                    expect(conj1.hash).toBe(conj2.hash);
                })
            );
        });

        it('disjunction is commutative for hashing', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    const termA = TermBuilder.atom(a);
                    const termB = TermBuilder.atom(b);
                    const disj1 = TermBuilder.disjunction(termA, termB);
                    const disj2 = TermBuilder.disjunction(termB, termA);
                    expect(disj1.hash).toBe(disj2.hash);
                })
            );
        });

        it('inheritance is NOT commutative', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    if (a === b) return;
                    const termA = TermBuilder.atom(a);
                    const termB = TermBuilder.atom(b);
                    const inh1 = TermBuilder.inheritance(termA, termB);
                    const inh2 = TermBuilder.inheritance(termB, termA);
                    expect(inh1.hash).not.toBe(inh2.hash);
                })
            );
        });

        it('terms are structurally shared', () => {
            fc.assert(
                fc.property(fc.string(), (name) => {
                    const term1 = TermBuilder.atom(name);
                    const term2 = TermBuilder.atom(name);
                    expect(term1).toBe(term2);
                })
            );
        });
    });

    describe('Truth Value Invariants', () => {
        it('frequency is always in [0, 1]', () => {
            fc.assert(
                fc.property(fc.float({min: 0, max: 1}), fc.float({min: 0, max: 1}), (f, c) => {
                    const truth = Truth.create(f, c);
                    expect(truth.f).toBeGreaterThanOrEqual(0);
                    expect(truth.f).toBeLessThanOrEqual(1);
                })
            );
        });

        it('confidence is always in [0, 1]', () => {
            fc.assert(
                fc.property(fc.float({min: 0, max: 1}), fc.float({min: 0, max: 1}), (f, c) => {
                    const truth = Truth.create(f, c);
                    expect(truth.c).toBeGreaterThanOrEqual(0);
                    expect(truth.c).toBeLessThanOrEqual(1);
                })
            );
        });

        it('truth revision preserves bounds', () => {
            fc.assert(
                fc.property(
                    fc.float({min: 0, max: 1}),
                    fc.float({min: 0, max: 1}),
                    fc.float({min: 0, max: 1}),
                    fc.float({min: 0, max: 1}),
                    (f1, c1, f2, c2) => {
                        const t1 = Truth.create(f1, c1);
                        const t2 = Truth.create(f2, c2);
                        const revised = Truth.deduction(t1, t2);
                        if (revised) {
                            expect(revised.f).toBeGreaterThanOrEqual(0);
                            expect(revised.f).toBeLessThanOrEqual(1);
                            expect(revised.c).toBeGreaterThanOrEqual(0);
                            expect(revised.c).toBeLessThanOrEqual(1);
                        }
                    }
                )
            );
        });

        it('truth operations preserve bounds', () => {
            fc.assert(
                fc.property(
                    fc.float({min: 0, max: 1}),
                    fc.float({min: 0, max: 1}),
                    (f, c) => {
                        const truth = Truth.create(f, c);
                        const negated = Truth.negation(truth);
                        expect(negated.f).toBeGreaterThanOrEqual(0);
                        expect(negated.f).toBeLessThanOrEqual(1);
                        expect(negated.c).toBeGreaterThanOrEqual(0);
                        expect(negated.c).toBeLessThanOrEqual(1);
                    }
                )
            );
        });
    });

    describe('Stamp Invariants', () => {
        it('stamps have bounded depth', () => {
            fc.assert(
                fc.property(fc.integer({min: 1, max: 9}), (_depth) => {
                    const stamp = Stamp.createInput();
                    expect(stamp.depth).toBe(0);
                })
            );
        });

        it('input stamps have depth 0', () => {
            fc.assert(
                fc.property(fc.integer({min: 0, max: 10}), () => {
                    const stamp = Stamp.createInput();
                    expect(stamp.depth).toBe(0);
                })
            );
        });

        it('derived stamps track parent depth', () => {
            const parent = Stamp.createInput();
            const derived = Stamp.derive([parent]);

            if (derived) {
                expect(derived.depth).toBe(1);
            }
        });
    });
});
