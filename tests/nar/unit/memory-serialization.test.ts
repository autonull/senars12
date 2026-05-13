import {describe, expect, it} from '@jest/globals';
import {deserialize, Memory, repair, serialize, validate} from '../../../src/nar/memory/memory.js';
import {TermBuilder, Truth} from '../../../src/nar/terms';
import {createBudget} from '../../../src/nar/types';

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
            statistics: {totalConcepts: 0, totalTasks: 0}
        };
        expect(validate(data)).toBe(true);
    });

    it('should reject invalid version', () => {
        const data = {
            version: 999,
            concepts: [],
            statistics: {totalConcepts: 0, totalTasks: 0}
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
});
