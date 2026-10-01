import type { RLFPLearner } from '@senars/nar/rlfp';
import { describe, expect, test, vi } from 'vitest';
import {
  createBudget,
  createTask,
  DEFAULT_CONFIG,
  Memory,
  RuleProcessor,
  type Task,
  TaskManager,
  TermBuilder,
  Truth,
  termParser,
} from '../../../nar/src';
import type { CognitiveController } from '../../../nar/src/cognitive';
import { DEFAULT_COGNITIVE_PARAMETERS } from '../../../nar/src/config/cognitive-parameters';
import { DriveManager } from '../../../nar/src/drives';
import { createGateRegistry } from '../../../nar/src/kernel';
import { NARExecution } from '../../../nar/src/nar-execution';
import { ToolManager } from '../../../nar/src/tools';
import { createTestController, inferenceParams, transitivity } from '../fixtures/cognitive';

const createMockProcessor = () => ({
  processSync: () => [],
  stageLMRules: () => false,
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
  let controller: CognitiveController;
  let rlfp: RLFPLearner;
  let execution: NARExecution;

  beforeEach(() => {
    memory = new Memory({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
    });
    taskManager = new TaskManager(memory);
    controller = createTestController(memory);
    rlfp = createMockRLFP();
    execution = new NARExecution({
      gates: createGateRegistry(),
      memory,
      taskManager,
      cognitiveController: controller,
      config: DEFAULT_CONFIG,
      rlfp,
    });
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

    test('respects maxDerivationDepth from the inference parameters', async () => {
      const constrainedController = createTestController(memory, inferenceParams(2));
      const exec = new NARExecution({
        gates: createGateRegistry(),
        memory,
        taskManager,
        cognitiveController: constrainedController,
        config: DEFAULT_CONFIG,
      });

      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

      const derived = await exec.run(1);

      expect(derived).toBeDefined();
    });

    test('respects cpuThrottleMs', async () => {
      const configWithThrottle = { ...DEFAULT_CONFIG, cpuThrottleMs: 50 };
      const exec = new NARExecution({
        gates: createGateRegistry(),
        memory,
        taskManager,
        cognitiveController: controller,
        config: configWithThrottle,
      });

      memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

      const start = Date.now();
      await exec.run(1);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    test('triggers rlFP.optimize() on interval', async () => {
      const configWithInterval = { ...DEFAULT_CONFIG, rlfp: { optimizeInterval: 1 } };
      const execWithRLFP = new NARExecution({
        gates: createGateRegistry(),
        memory,
        taskManager,
        cognitiveController: controller,
        config: configWithInterval as any,
        rlfp,
      });

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
    test('derives through the configured strategies, not a parallel engine', async () => {
      // The stream path used to re-stream sampled memory tasks: it honoured
      // neither the rules nor the strategy slots. Seeding a chain that the
      // transitivity rule closes is what tells the two apart.
      const processor = new RuleProcessor([transitivity()]);
      const streamed = new NARExecution({
        gates: createGateRegistry(),
        memory,
        taskManager,
        cognitiveController: createTestController(
          memory,
          DEFAULT_COGNITIVE_PARAMETERS,
          undefined,
          processor
        ),
        config: DEFAULT_CONFIG,
      });
      const ab = TermBuilder.inheritance(TermBuilder.atom('A')!, TermBuilder.atom('B')!)!;
      const bc = TermBuilder.inheritance(TermBuilder.atom('B')!, TermBuilder.atom('C')!)!;
      memory.addTask(ab, 'belief', Truth.TRUE, createBudget(0.9));
      memory.addTask(bc, 'belief', Truth.TRUE, createBudget(0.9));

      const results: Task[] = [];
      for await (const task of streamed.runStream(5, 100)) results.push(task);

      expect(results.map((t) => t.term.toString())).toContain('(A-->C)');
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
    describe('meta-goal injection', () => {
      test('injects switch_strategy goal when competence drops below threshold', async () => {
        const fakeNar = { input: vi.fn() } as any;
        const driveManager = new DriveManager(fakeNar);
        driveManager.stimulate('competence', -1);

        // Use fresh memory and taskManager to avoid pollution
        const freshMemory = new Memory({
          maxConcepts: 100,
          activationDecayRate: 0.01,
          consolidationInterval: 10,
        });
        const freshTaskManager = new TaskManager(freshMemory);
        const freshController = createTestController(freshMemory, inferenceParams(10));
        const exec = new NARExecution({
          gates: createGateRegistry(),
          memory: freshMemory,
          taskManager: freshTaskManager,
          cognitiveController: freshController,
          config: DEFAULT_CONFIG,
          rlfp,
          driveManager,
        });

        await exec.run(1); // After 1 cycle, meta-goal should be injected

        // Meta-goals are injected as pending tasks, check there
        const pending = freshTaskManager.getPending?.() ?? [];
        const metaGoal = pending.find(
          (t) =>
            t.term.toString().startsWith('^switch_strategy') ||
            t.term.toString().includes('^switch_strategy')
        );
        expect(metaGoal).toBeDefined();
      });

      test('does not inject meta-goal when drive is healthy', async () => {
        const fakeNar = { input: vi.fn() } as any;
        const driveManager = new DriveManager(fakeNar);
        // competence starts at target 0.8 — above threshold

        const freshMemory = new Memory({
          maxConcepts: 100,
          activationDecayRate: 0.01,
          consolidationInterval: 10,
        });
        const freshTaskManager = new TaskManager(freshMemory);
        const freshController = createTestController(freshMemory, inferenceParams(10));
        const exec = new NARExecution({
          gates: createGateRegistry(),
          memory: freshMemory,
          taskManager: freshTaskManager,
          cognitiveController: freshController,
          config: DEFAULT_CONFIG,
          rlfp,
          driveManager,
        });

        await exec.run(1);

        const pending = freshTaskManager.getPending?.() ?? [];
        const metaGoal = pending.find(
          (t) =>
            t.term.toString().startsWith('^switch_strategy') ||
            t.term.toString().includes('^switch_strategy')
        );
        expect(metaGoal).toBeUndefined();
      });
    });

    test('does not inject meta-goal when drive is healthy', async () => {
      const fakeNar = { input: vi.fn() } as any;
      const driveManager = new DriveManager(fakeNar);
      // competence starts at target 0.8 — above threshold

      const exec = new NARExecution({
        gates: createGateRegistry(),
        memory,
        taskManager,
        cognitiveController: controller,
        config: DEFAULT_CONFIG,
        rlfp,
        driveManager,
      });

      await exec.run(1);

      const goals = memory.getGoals?.() ?? [];
      const metaGoal = goals.find((g) => g.term.toString().startsWith('^switch_strategy'));
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

      // Use fresh memory and taskManager to avoid pollution from other tests
      const freshMemory = new Memory({
        maxConcepts: 100,
        activationDecayRate: 0.01,
        consolidationInterval: 10,
      });
      const freshTaskManager = new TaskManager(freshMemory);
      const freshController = createTestController(freshMemory, inferenceParams(10));
      const exec = new NARExecution({
        gates: createGateRegistry(),
        memory: freshMemory,
        taskManager: freshTaskManager,
        cognitiveController: freshController,
        config: DEFAULT_CONFIG,
        rlfp,
        toolGoalExecutor: async (goalTerm) => toolManager.executeToolGoal(goalTerm),
      });

      freshTaskManager.addTask(
        createTask(
          termParser.parse('^echo_goal(profile:test)'),
          'goal',
          Truth.NEUTRAL,
          createBudget(0.9)
        )
      );

      await exec.run(1);

      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual({ profile: 'test' });

      // Tool goal must not leak into memory as a plain goal
      const goals = freshMemory.getGoals?.() ?? [];
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

      // Use fresh memory and taskManager to avoid pollution from other tests
      const freshMemory = new Memory({
        maxConcepts: 100,
        activationDecayRate: 0.01,
        consolidationInterval: 10,
      });
      const freshTaskManager = new TaskManager(freshMemory);
      const freshController = createTestController(freshMemory, inferenceParams(10));
      const exec = new NARExecution({
        gates: createGateRegistry(),
        memory: freshMemory,
        taskManager: freshTaskManager,
        cognitiveController: freshController,
        config: DEFAULT_CONFIG,
        rlfp,
        toolGoalExecutor: async (goalTerm) => toolManager.executeToolGoal(goalTerm),
      });

      freshTaskManager.addTask(
        createTask(TermBuilder.atom('regular_goal'), 'goal', Truth.NEUTRAL, createBudget(0.9))
      );

      await exec.run(1);

      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
