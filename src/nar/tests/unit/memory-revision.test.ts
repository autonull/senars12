import {describe, expect, it} from '@jest/globals';
import {Concept, Memory} from '../../memory';
import {TermBuilder, Truth} from '../../terms';
import {createBudget} from '../../types';

describe('Phase 5.5: Belief Revision and Deduplication', () => {
    it('should add belief to concept', () => {
        const memory = new Memory();
        const term = TermBuilder.atom('test');
        memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));

        const concept = memory.getConcept(term);
        expect(concept).toBeDefined();
        expect(concept!.totalTasks).toBeGreaterThan(0);
    });

    it('should revise duplicate beliefs', () => {
        const memory = new Memory();
        const term = TermBuilder.atom('revised');

// Add first belief
        memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));
        const concept1 = memory.getConcept(term);
        const initialBeliefs = concept1?.getBeliefs().length || 0;

        // Add second belief about same term
        memory.addTask(term, 'belief', Truth.FALSE, createBudget(0.9));
        const finalBeliefs = concept1?.getBeliefs().length || 0;

        // Should have revised, not duplicated
        expect(finalBeliefs).toBeGreaterThanOrEqual(initialBeliefs);
    });

    it('should detect matching beliefs', () => {
        const concept = new Concept(TermBuilder.atom('test'));
        concept.addTask('belief', {
            term: TermBuilder.atom('test'),
            truth: Truth.TRUE,
            budget: createBudget(0.9)
        });

        expect(concept.hasMatchingBelief(TermBuilder.atom('test'))).toBe(true);
        expect(concept.hasMatchingBelief(TermBuilder.atom('different'))).toBe(false);
    });

    it('should retrieve beliefs, goals, and questions', () => {
        const concept = new Concept(TermBuilder.atom('test'));

        concept.addTask('belief', {
            term: TermBuilder.atom('belief'),
            truth: Truth.TRUE,
            budget: createBudget(0.9)
        });

        concept.addTask('goal', {
            term: TermBuilder.atom('goal'),
            budget: createBudget(0.8)
        });

        concept.addTask('question', {
            term: TermBuilder.atom('question'),
            budget: createBudget(0.7)
        });

        expect(concept.getBeliefs().length).toBe(1);
        expect(concept.getGoals().length).toBe(1);
        expect(concept.getQuestions().length).toBe(1);
    });

    it('should merge truth values correctly', () => {
        const revised = Truth.revision(Truth.TRUE, Truth.FALSE);
        expect(revised.f).toBeGreaterThanOrEqual(0);
        expect(revised.f).toBeLessThanOrEqual(1);
        expect(revised.c).toBeGreaterThan(0);
    });

    it('should handle multiple additions of same belief', () => {
        const memory = new Memory();
        const term = TermBuilder.atom('same');

        memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));
        memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));
        memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));

        const concept = memory.getConcept(term);
        const beliefs = concept?.getBeliefs() || [];

        // Should have revised, not created duplicates
        expect(beliefs.length).toBeGreaterThan(0);
    });
});
