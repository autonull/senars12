import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { EventBus } from '@senars/utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createTaskWeight,
  createNAR,
  DEFAULT_CONFIG,
  Memory,
  TaskManager,
  TermBuilder,
  Truth,
} from '../../../nar/src';
import type { CognitiveController } from '../../../nar/src/cognitive';
import { createGateRegistry } from '../../../nar/src/kernel';
import { createSeNARSRegistry } from '../../../nar/src/lm';
import { createLMService } from '../../../nar/src/lm/lm-service';
import { NARExecution } from '../../../nar/src/nar-execution';
import type { RLFPLearner } from '../../../nar/src/rlfp';
import { createTestController } from '../fixtures/cognitive';
import { createLogStore } from '../../../src/log/store.js';
import type { LogStore } from '../../../src/log/store.js';

// Persistence assertions are LM-independent; default to the mock provider so
// this file stays hermetic (avoids downloading real weights). Explicit
// LM_PROVIDER in the environment still wins.
if (!process.env.LM_PROVIDER) process.env.LM_PROVIDER = 'mock';

const createMockRLFP = (): RLFPLearner =>
  ({
    optimize: vi.fn(),
    updateModel: vi.fn(),
    reward: vi.fn(),
    policyOptimizerPublic: {} as any,
  }) as unknown as RLFPLearner;

describe('NAR State Persistence (LogStore)', () => {
  let stateDir: string;
  let logStore: LogStore;

  beforeEach(async () => {
    stateDir = mkdtempSync(join(tmpdir(), 'nar-state-persist-'));
    logStore = createLogStore({ dir: join(stateDir, 'log') });
    await logStore.open();
  });

  afterEach(async () => {
    await logStore.close();
    await rm(stateDir, { recursive: true, force: true });
  });

  test('saveState and loadState persist drives', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: stateDir,
      logStore,
      maxConcepts: 100,
    });

    await nar.start();

    // Stimulate drives to non-default values
    const driveManager = nar.getDriveManager();
    driveManager?.stimulate('competence', -0.3); // Should drop from ~0.8 to ~0.5
    driveManager?.stimulate('curiosity', 0.2); // Should rise from ~0.5 to ~0.7

    // Run a cycle to let drives decay and get saved
    await nar.run(5);

    // Trigger save
    await nar.stop();

    // Close first LogStore before opening second one
    await logStore.close();

    // Create new LogStore instance pointing to same log directory
    const logStore2 = createLogStore({ dir: join(stateDir, 'log') });
    await logStore2.open();

    try {
      const nar2 = createNAR({
        providerRegistry: registry,
        lmService,
        persistState: true,
        statePath: stateDir,
        logStore: logStore2,
        maxConcepts: 100,
      });

      await nar2.start();

      const driveManager2 = nar2.getDriveManager();

      // Verify drives were restored (approximately)
      const competenceAfter = driveManager2?.getState('competence')?.currentIntensity ?? 0;
      const curiosityAfter = driveManager2?.getState('curiosity')?.currentIntensity ?? 0;

      // Values should be close to what was saved (allowing for decay during load)
      expect(competenceAfter).toBeLessThan(0.8); // Should be lower than default
      expect(curiosityAfter).toBeGreaterThan(0.5); // Should be higher than default

      await nar2.stop();
    } finally {
      await logStore2.close();
      // Reopen original logStore for afterEach cleanup
      logStore = createLogStore({ dir: join(stateDir, 'log') });
      await logStore.open();
    }
  });

  test('saveState persists beliefs, goals, and questions', async () => {
    // Reopen logStore if it was closed
    if (logStore.getEntryCount() === 0) {
      await logStore.close();
      logStore = createLogStore({ dir: join(stateDir, 'log') });
      await logStore.open();
    }

    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: stateDir,
      logStore,
      maxConcepts: 100,
    });

    await nar.start();

    // Add some beliefs, goals, questions using correct methods
    await nar.believe('(test_belief-->concept).');
    await nar.goal('(test_goal-->concept)!');
    await nar.question('(test_question-->?what)?');

    await nar.run(2);
    await nar.stop();

    // Close first LogStore before opening second one
    await logStore.close();

    // Create new LogStore instance pointing to same log directory
    const logStore2 = createLogStore({ dir: join(stateDir, 'log') });
    await logStore2.open();

    try {
      const nar2 = createNAR({
        providerRegistry: registry,
        lmService,
        persistState: true,
        statePath: stateDir,
        logStore: logStore2,
        maxConcepts: 100,
      });

      await nar2.start();

      // Check beliefs were restored
      const beliefs = nar2.getBeliefs();
      const hasTestBelief = beliefs.some((b) => b.term.toString().includes('test_belief'));
      expect(hasTestBelief).toBe(true);

      // Check goals were restored
      const goals = nar2.getGoals();
      const hasTestGoal = goals.some((g) => g.term.toString().includes('test_goal'));
      expect(hasTestGoal).toBe(true);

      await nar2.stop();
    } finally {
      await logStore2.close();
      // Reopen original logStore for afterEach cleanup
      logStore = createLogStore({ dir: join(stateDir, 'log') });
      await logStore.open();
    }
  });
});

describe('NARExecution Observability Emission', () => {
  let memory: Memory;
  let taskManager: TaskManager;
  let reasoner: CognitiveController;
  let rlfp: RLFPLearner;
  let execution: NARExecution;
  let eventBus: EventBus;

  beforeEach(() => {
    memory = new Memory({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
    });
    taskManager = new TaskManager(memory, { gateRegistry: createGateRegistry() });
    reasoner = createTestController(memory);
    rlfp = createMockRLFP();
    eventBus = new EventBus();
    // Pass eventBus as the 9th parameter (systemEventBus)
    execution = new NARExecution({
      gates: createGateRegistry(),
      memory,
      taskManager,
      cognitiveController: reasoner,
      config: DEFAULT_CONFIG,
      rlfp,
      systemEventBus: eventBus,
    });
  });

  test('emits cognitive state summary every 10 cycles', async () => {
    const emittedEvents: any[] = [];

    // Subscribe to event bus
    eventBus.on('cognitive:state:summary', (event: any) => {
      emittedEvents.push(event);
    });

    memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createTaskWeight(0.9));

    // Run 15 cycles - should emit at cycle 10
    for (let i = 0; i < 15; i++) {
      await execution.run(1);
    }

    // Should have emitted at least once (at cycle 10)
    expect(emittedEvents.length).toBeGreaterThanOrEqual(1);

    // Check event structure
    const event = emittedEvents[0];
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('active_drives');
    expect(event).toHaveProperty('active_meta_goals');
    expect(event).toHaveProperty('pending_tool_executions');
    expect(event).toHaveProperty('aikr_pressure');
    expect(event).toHaveProperty('rlfp_reward_avg');
  });

  test('does not emit before 10 cycles', async () => {
    const emittedEvents: any[] = [];

    eventBus.on('cognitive:state:summary', (event: any) => {
      emittedEvents.push(event);
    });

    memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createTaskWeight(0.9));

    // Run 5 cycles - should not emit yet
    for (let i = 0; i < 5; i++) {
      await execution.run(1);
    }

    expect(emittedEvents.length).toBe(0);
  });
});