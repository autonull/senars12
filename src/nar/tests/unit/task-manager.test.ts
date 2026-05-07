import { TaskManager } from '../../task/manager.js';
import { Memory } from '../../memory/memory.js';
import { createTask } from '../../task/task.js';
import { TermBuilder } from '../../terms/factory.js';
import { Truth } from '../../terms/truth.js';

describe('TaskManager', () => {
    let mem: Memory;
    let manager: TaskManager;

    beforeEach(() => {
        mem = new Memory({
            maxConcepts: 100,
            priorityThreshold: 0.5,
            activationDecayRate: 0.01,
            consolidationInterval: 10
        });
        manager = new TaskManager(mem);
    });

    describe('addTask', () => {
        test('adds task to pending', () => {
            const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, 0.9);
            manager.addTask(task);
            expect(manager.size).toBe(1);
        });
    });

    describe('processPending', () => {
        test('moves tasks to memory', () => {
            const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, 0.9);
            manager.addTask(task);
            const processed = manager.processPending();
            expect(processed).toHaveLength(1);
            expect(mem.getConcept(TermBuilder.atom('test'))).toBeDefined();
        });

        test('clears pending after processing', () => {
            const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, 0.9);
            manager.addTask(task);
            manager.processPending();
            expect(manager.size).toBe(0);
        });

        test('processes all pending tasks', () => {
            const t1 = createTask(TermBuilder.atom('a'), 'belief', Truth.TRUE, 0.9);
            const t2 = createTask(TermBuilder.atom('b'), 'belief', Truth.TRUE, 0.9);
            manager.addTask(t1);
            manager.addTask(t2);
            const processed = manager.processPending();
            expect(processed).toHaveLength(2);
        });
    });
});