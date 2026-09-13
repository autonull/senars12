import {
  createBudget,
  createTask,
  Memory,
  TaskManager,
  TermBuilder,
  Truth,
} from '../../../nar/src';

describe('TaskManager', () => {
  let mem: Memory;
  let manager: TaskManager;

  beforeEach(() => {
    mem = new Memory({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
    });
    manager = new TaskManager(mem);
  });

  describe('addTask', () => {
    test('adds task to pending', () => {
      const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));
      manager.addTask(task);
      expect(manager.size).toBe(1);
    });
  });

  describe('processPending', () => {
    test('moves tasks to memory', async () => {
      const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));
      manager.addTask(task);
      const processed = await manager.processPending();
      expect(processed).toHaveLength(1);
      expect(mem.getConcept(TermBuilder.atom('test'))).toBeDefined();
    });

    test('clears pending after processing', async () => {
      const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));
      manager.addTask(task);
      await manager.processPending();
      expect(manager.size).toBe(0);
    });

    test('processes all pending tasks', async () => {
      const t1 = createTask(TermBuilder.atom('a'), 'belief', Truth.TRUE, createBudget(0.9));
      const t2 = createTask(TermBuilder.atom('b'), 'belief', Truth.TRUE, createBudget(0.9));
      manager.addTask(t1);
      manager.addTask(t2);
      const processed = await manager.processPending();
      expect(processed).toHaveLength(2);
    });
  });
});
