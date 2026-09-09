import {describe, expect, it} from 'vitest';
import {createBudget, Stamp, TermBuilder, Truth} from '../../../nar/src';
import {deserialize, Memory, repair, serialize, validate} from '../../../nar/src/memory';

describe('Phase 5.4: Memory Serialization', () => {
    it('should serialize empty memory', () => {
        const memory = new Memory();
        const data = serialize(memory);

        expect(data.version).toBe(1);
        expect(data.concepts.length).toBe(0);
        expect(data.statistics.totalConcepts).toBe(0);
    });

    it('should serialize and deserialize memory with concepts', () => {
        const memory = new Memory();
        memory.addConcept(TermBuilder.atom('test'));
        memory.addConcept(TermBuilder.atom('concept'));

        const data = serialize(memory);
        expect(data.concepts.length).toBe(2);
        expect(validate(data)).toBe(true);
    });

    it('should deserialize into new memory', async () => {
        const memory1 = new Memory();
        memory1.addConcept(TermBuilder.atom('test'));
        memory1.addConcept(TermBuilder.atom('concept'));

        const data = serialize(memory1);
        const memory2 = new Memory();
        await deserialize(data, memory2);

        expect(memory2.size).toBe(memory1.size);
    });

    it('should validate correct data', () => {
        const data = {
            version: 1,
            timestamp: Date.now(),
            concepts: [],
            statistics: {totalConcepts: 0, totalTasks: 0},
        };
        expect(validate(data)).toBe(true);
    });

    it('should reject invalid version', () => {
        const data = {
            version: 999,
            concepts: [],
            statistics: {totalConcepts: 0, totalTasks: 0},
        };
        expect(validate(data)).toBe(false);
    });

    it('should repair missing fields', () => {
        const data: any = {concepts: []};
        const repaired = repair(data);
        expect(repaired).toBeDefined();
        expect(repaired?.version).toBe(1);
    });

    it('should preserve truth values during serialization', async () => {
        const memory = new Memory();
        const term = TermBuilder.atom('withTruth');
        memory.addTask(term, 'belief', Truth.TRUE, createBudget(0.9));

        const data = serialize(memory);
        const concept = data.concepts[0];
        expect(concept).toBeDefined();
        expect(concept?.beliefs.length).toBeGreaterThan(0);
        expect(concept?.beliefs[0]?.truth).toBeDefined();
    });

    it('should round-trip tasks with stamps', async () => {
        const memory1 = new Memory();
        const s0 = Stamp.createInput();
        const s1 = Stamp.derive([s0], 'DERIVED')!;
        const s2 = Stamp.derive([s1], 'DERIVED')!;
        const inh = TermBuilder.inheritance(TermBuilder.atom('bird'), TermBuilder.atom('animal'))!;
        memory1.addTask(inh, 'belief', Truth.create(1, 0.9), createBudget(0.8), s2);
        memory1.addTask(TermBuilder.atom('goal1'), 'goal', Truth.create(1, 0.9), createBudget(0.7));
        memory1.addTask(TermBuilder.atom('q1'), 'question', undefined, createBudget(0.6));
        memory1.getConcept(inh)!.priority = 0.75;

        const data = JSON.parse(JSON.stringify(serialize(memory1)));
        const memory2 = new Memory();
        await deserialize(data, memory2);

        expect(memory2.size).toBe(memory1.size);
        const concept = memory2.getConcept(inh);
        expect(concept).toBeDefined();
        expect(concept!.priority).toBeCloseTo(0.75);
        const beliefs = concept!.getBeliefs();
        expect(beliefs).toHaveLength(1);
        expect(beliefs[0]!.truth?.f).toBe(1);
        expect(beliefs[0]!.truth?.c).toBe(0.9);
        expect(beliefs[0]!.budget.priority).toBe(0.8);
        expect(beliefs[0]!.stamp?.id).toBe(s2.id);
        expect(beliefs[0]!.stamp?.derivations).toEqual([...s2.derivations]);
        expect(beliefs[0]!.stamp?.source).toBe('DERIVED');
        expect(memory2.getConcept(TermBuilder.atom('goal1'))?.getGoals()).toHaveLength(1);
        expect(memory2.getConcept(TermBuilder.atom('q1'))?.getQuestions()).toHaveLength(1);

        const suffix = (id: string): number => Number(id.split(':').pop());
        const after = Stamp.createInput();
        expect(suffix(after.id)).toBeGreaterThan(suffix(s2.id));
    });
});
