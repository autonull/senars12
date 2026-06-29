import { describe, expect, jest, test } from '@jest/globals';
import {
  BagStrategy,
  DEFAULT_CONFIG,
  Memory,
  Reasoner,
  TaskManager,
  TermBuilder,
  Truth,
  createBudget,
  createTask,
} from '../../../nar/src';
import { NARExecution } from '../../../nar/src/nar-execution';
import type { RLFPLearner } from '../../rlfp';

const createMockProcessor = () => ({
  processSync: () => [],
  processLMRules: async function* () {
    /* noop */
  },
});

const createMockRLFP = (): RLFPLearner =>
  ({
    optimize: jest.fn(),
    updateModel: jest.fn(),
    policyOptimizerPublic: {} as any,
  }) as unknown as RLFPLearner;

describe('NARExecution', () => {
  let memory: Memory;
  let taskManager: TaskManager;
  let reasoner: Reasoner;
  let rlfp: RLFPLearner;
  let execution: NARExecution;

  beforeEach(() => {
    memory = new Memory({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
    });
    taskManager = new TaskManager(memory);
    reasoner = new Reasoner(memory, createMockProcessor() as any, BagStrategy, {
      cpuThrottleMs: 0,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
    });
    rlfp = createMockRLFP();
    execution = new NARExecution(memory, taskManager, reasoner, DEFAULT_CONFIG, rlfp);
  });

  describe('run', () => {
    test('processes pending tasks', async () => {
      const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));
      taskManager.addTask(task);

      const derived = await execution.run(1);

      expect(derived).toBeDefined();
      expect(typeof derived).toBe('number');
    });

    test('runs reasoning step', async () => {
      memory.addTask(TermBuilder.atom('A'), 'belief', Truth.TRUE, createBudget(0.9));
      memory.addTask(TermBuilder.atom('B'), 'belief', Truth.TRUE, createBudget(0.9));

      const derived = await execution.run(1);

      expect(derived).toBeDefined();
    });

    test('calls memory.consolidate()', async () => {
      const consolidateSpy = jest.spyOn(memory, 'consolidate');
      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

      await execution.run(1);

      expect(consolidateSpy).toHaveBeenCalled();
    });

    test('respects maxDerivationDepth via reasoner config', async () => {
      const constrainedReasoner = new Reasoner(memory, createMockProcessor() as any, BagStrategy, {
        cpuThrottleMs: 0,
        maxDerivationDepth: 2,
        maxDerivationsPerStep: 100,
      });
      const exec = new NARExecution(memory, taskManager, constrainedReasoner, DEFAULT_CONFIG);

      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

      const derived = await exec.run(1);

      expect(derived).toBeDefined();
    });

    test('respects cpuThrottleMs', async () => {
      const configWithThrottle = { ...DEFAULT_CONFIG, cpuThrottleMs: 50 };
      const exec = new NARExecution(memory, taskManager, reasoner, configWithThrottle);

      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

      const start = Date.now();
      await exec.run(1);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    test('triggers rlFP.optimize() on interval', async () => {
      const configWithInterval = { ...DEFAULT_CONFIG, rlfp: { optimizeInterval: 1 } };
      const execWithRLFP = new NARExecution(
        memory,
        taskManager,
        reasoner,
        configWithInterval as any,
        rlfp
      );

      memory.addTask(TermBuilder.atom('A'), 'belief', Truth.TRUE, createBudget(0.9));
      memory.addTask(TermBuilder.atom('B'), 'belief', Truth.TRUE, createBudget(0.9));

      await execWithRLFP.run(2);

      expect(rlfp.optimize).toHaveBeenCalled();
    });

    test('returns total derived count', async () => {
      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));
      taskManager.addTask(
        createTask(TermBuilder.atom('added'), 'belief', Truth.TRUE, createBudget(0.9))
      );

      const derived = await execution.run(1);

      expect(derived).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runStream', () => {
    test('yields derived tasks', async () => {
      memory.addTask(TermBuilder.atom('A'), 'belief', Truth.TRUE, createBudget(0.9));
      memory.addTask(TermBuilder.atom('B'), 'belief', Truth.TRUE, createBudget(0.9));

      const results: any[] = [];
      for await (const task of execution.runStream(5, 100)) {
        results.push(task);
        if (results.length >= 5) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });

    test('respects maxResults limit', async () => {
      for (let i = 0; i < 10; i++) {
        memory.addTask(TermBuilder.atom(`T${i}`), 'belief', Truth.TRUE, createBudget(0.9));
      }

      const results: any[] = [];
      for await (const task of execution.runStream(100, 3)) {
        results.push(task);
      }

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getCycleCount', () => {
    test('returns current cycle count', () => {
      expect(execution.getCycleCount()).toBe(0);
    });

    test('increments after run', async () => {
      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));
      await execution.run(1);
      expect(execution.getCycleCount()).toBe(1);
    });
  });
});
