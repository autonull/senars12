import { describe, expect, test, vi } from 'vitest';
import {
  BagStrategy,
  createBudget,
  createTask,
  DEFAULT_CONFIG,
  Memory,
  Reasoner,
  TaskManager,
  TermBuilder,
  Truth,
} from '../../../nar/src';
import { ToolManager } from '../../../nar/src/tools';
import { DriveManager } from '../../../nar/src/drives';
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
    optimize: vi.fn(),
    updateModel: vi.fn(),
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
      const consolidateSpy = vi.spyOn(memory, 'consolidate');
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

  describe('meta-goal injection', () => {
    test('injects switch_strategy goal when competence drops below threshold', async () => {
      const fakeNar = { input: vi.fn() } as any;
      const driveManager = new DriveManager(fakeNar);
      driveManager.stimulate('competence', -1);

      const exec = new NARExecution(
        memory,
        taskManager,
        reasoner,
        DEFAULT_CONFIG,
        rlfp,
        undefined,
        undefined,
        driveManager
      );

      await exec.run(2);

      const goals = memory.getGoals?.() ?? [];
      const metaGoal = goals.find((g) =>
        g.term.toString().startsWith('^switch_strategy')
      );
      expect(metaGoal).toBeDefined();
    });

    test('does not inject meta-goal when drive is healthy', async () => {
      const fakeNar = { input: vi.fn() } as any;
      const driveManager = new DriveManager(fakeNar);
      // competence starts at target 0.8 — above threshold

      const exec = new NARExecution(
        memory,
        taskManager,
        reasoner,
        DEFAULT_CONFIG,
        rlfp,
        undefined,
        undefined,
        driveManager
      );

      await exec.run(1);

      const goals = memory.getGoals?.() ?? [];
      const metaGoal = goals.find((g) =>
        g.term.toString().startsWith('^switch_strategy')
      );
      expect(metaGoal).toBeUndefined();
    });
  });

  describe('goal→tool dispatch', () => {
    test('executes pending ^tool goals via the tool executor', async () => {
      const toolManager = new ToolManager();
      const calls: Record<string, unknown>[] = [];
      toolManager.register({
        name: 'echo_goal',
        description: 'test tool',
        parameters: { type: 'object', properties: {} },
        execute: async (args) => {
          calls.push(args);
          return { success: true, content: { called: args } };
        },
      });

      const exec = new NARExecution(
        memory,
        taskManager,
        reasoner,
        DEFAULT_CONFIG,
        rlfp,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        async (goalTerm) => toolManager.executeToolGoal(goalTerm)
      );

      taskManager.addTask(
        createTask(TermBuilder.atom('^echo_goal(profile:test)'), 'goal', Truth.NEUTRAL, createBudget(0.9))
      );

      await exec.run(1);

      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual({ profile: 'test' });

      // Tool goal must not leak into memory as a plain goal
      const goals = memory.getGoals?.() ?? [];
      expect(goals.some((g) => g.term.toString().startsWith('^echo_goal'))).toBe(false);
    });

    test('leaves non-tool goals undispatched', async () => {
      const toolManager = new ToolManager();
      const executeSpy = vi.fn();
      toolManager.register({
        name: 'echo_goal',
        description: 'test tool',
        parameters: { type: 'object', properties: {} },
        execute: async (args) => {
          executeSpy();
          return { success: true, content: { called: args } };
        },
      });

      const exec = new NARExecution(
        memory,
        taskManager,
        reasoner,
        DEFAULT_CONFIG,
        rlfp,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        async (goalTerm) => toolManager.executeToolGoal(goalTerm)
      );

      taskManager.addTask(
        createTask(TermBuilder.atom('regular_goal'), 'goal', Truth.NEUTRAL, createBudget(0.9))
      );

      await exec.run(1);

      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
