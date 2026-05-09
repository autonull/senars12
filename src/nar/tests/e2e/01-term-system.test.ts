/**
 * Term System Tests - Canonicalization, Hashing, and Structural Sharing
 */
import {TermBuilder, Truth} from '../../terms';
import {createTestNAR} from '../fixtures';

describe('Term System', () => {
    let nar: ReturnType<typeof createTestNAR>;

    beforeEach(() => {
        nar = createTestNAR();
    });

    describe('Canonicalization', () => {
        it('creates canonical terms with structural sharing', () => {
            const bird1 = TermBuilder.atom('bird');
            const bird2 = TermBuilder.atom('bird');
            expect(bird1).toBe(bird2);
            expect(bird1.hash).toBe(bird2.hash);
        });

        it('normalizes conjunctions for canonical form', () => {
            const a = TermBuilder.atom('A');
            const b = TermBuilder.atom('B');
            const conj1 = TermBuilder.conjunction(a, b);
            const conj2 = TermBuilder.conjunction(b, a);
            expect(conj1.hash).toBe(conj2.hash);
        });

        it('maintains truth value consistency', () => {
            const t1 = Truth.create(0.8, 0.9);
            const t2 = Truth.create(0.8, 0.9);
            expect(t1.f).toBe(t2.f);
            expect(t1.c).toBe(t2.c);
        });
    });

    describe('Compound Terms', () => {
        it('creates inheritance terms', () => {
            const bird = TermBuilder.atom('bird');
            const animal = TermBuilder.atom('animal');
            const inheritance = TermBuilder.inheritance(bird, animal);
            expect(inheritance.kind).toBe('inheritance');
            if ("args" in inheritance) expect(inheritance.args).toHaveLength(2);
        });

        it('creates conjunction terms', () => {
            const a = TermBuilder.atom('A');
            const b = TermBuilder.atom('B');
            const conj = TermBuilder.conjunction(a, b);
            expect(conj.kind).toBe('conjunction');
            if ("args" in conj) expect(conj.args).toHaveLength(2);
        });

        it('creates disjunction terms', () => {
            const a = TermBuilder.atom('A');
            const b = TermBuilder.atom('B');
            const disj = TermBuilder.disjunction(a, b);
            expect(disj.kind).toBe('disjunction');
        });

        it('creates implication terms', () => {
            const a = TermBuilder.atom('A');
            const b = TermBuilder.atom('B');
            const imp = TermBuilder.implication(a, b);
            expect(imp.kind).toBe('implication');
        });
    });
});
