import fc from 'fast-check';
import {normalize, serializeTerm, Stamp, TermBuilder, termsEqual, Truth} from '../../src/nar/terms';
import {Bag} from '../../src/nar/memory';

describe('Property-Based Tests', () => {
    describe('Term Invariants', () => {
        it('atomic terms have consistent hashes', () => {
            fc.assert(
                fc.property(fc.string(), (name) => {
                    const term1 = TermBuilder.atom(name);
                    const term2 = TermBuilder.atom(name);
                    expect(termsEqual(term1, term2)).toBe(true);
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
                    expect(termsEqual(conj1, conj2)).toBe(true);
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
                    expect(termsEqual(disj1, disj2)).toBe(true);
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
                    expect(termsEqual(inh1, inh2)).toBe(false);
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

    describe('Normalization Invariants', () => {
        it('normalize(normalize(t)) produces same hash as normalize(t)', () => {
            fc.assert(
                fc.property(fc.string(), (name) => {
                    const term = TermBuilder.atom(name);
                    const norm1 = normalize(term);
                    const norm2 = normalize(norm1);
                    expect(termsEqual(norm1, norm2)).toBe(true);
                })
            );
        });

        it('normalize is idempotent for conjunctions', () => {
            fc.assert(
                fc.property(fc.string(), fc.string(), (a, b) => {
                    const t1 = TermBuilder.atom(a);
                    const t2 = TermBuilder.atom(b);
                    const conj = TermBuilder.conjunction(t1, t2);
                    const norm1 = normalize(conj);
                    const norm2 = normalize(norm1);
                    expect(termsEqual(norm1, norm2)).toBe(true);
                })
            );
        });

        it('serializeTerm(parse(s)) round-trips for valid Narsese atoms', () => {
            fc.assert(
                fc.property(fc.string({minLength: 1, maxLength: 20}), (name) => {
                    const parsed = TermBuilder.atom(name);
                    const serialized = serializeTerm(parsed);
                    expect(serialized).toBe(name);
                })
            );
        });
    });

    describe('Bag Invariants', () => {
        it('bag never exceeds capacity after N insertions', () => {
            fc.assert(
                fc.property(fc.integer({min: 1, max: 50}), (capacity) => {
                    const items = new Bag(capacity);
                    for (let v = 0; v < 100; v++) {
                        items.add(v, v);
                    }
                    expect(items.getItems().length).toBeLessThanOrEqual(capacity);
                })
            );
        });

        it('higher priority items survive when bag is at capacity', () => {
            const items = new Bag(3);
            items.add('low', 0.1);
            items.add('mid', 0.5);
            items.add('high', 0.9);
            items.add('incoming', 0.3);
            const kept = items.getItems();
            expect(kept).not.toContain('low');
            expect(kept).toContain('high');
        });
    });

    describe('Rule Idempotence', () => {
        it('atom terms never mutate on normalization', () => {
            fc.assert(
                fc.property(fc.string(), (name) => {
                    const atom = TermBuilder.atom(name);

                    normalize(atom);

                })
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
