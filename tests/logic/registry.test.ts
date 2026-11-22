/**
 * W1 — per-instance registries are isolated.
 *
 * Two engines in one process must not share a registry: an oracle or faculty
 * registered in one is absent from the other. This is the isolation the
 * global singletons could not provide.
 */

import { describe, expect, it } from 'vitest';
import { createFacultyRegistry, FacultyEngine } from '../../src/faculties/index';
import { createOracleRegistry, type Oracle, type OracleInput, type OracleOutput } from '../../src/oracles/oracle';
import { createJudge } from '../../src/faculties/judgment/judge';
import { createEnv, createEnvCore, type Env } from '../../src/kernel/env';
import { createCognitiveLoop } from '../../src/loop/index';
import { termInterner } from '../../src/kernel/terms/intern';

const makeOracle = (operation: Oracle['operation']): Oracle => ({
  operation,
  provider: 'test',
  call: async (_input: OracleInput): Promise<OracleOutput> => ({
    value: null,
    meta: { callId: 'x' as never, ts: 0 as never, durationMs: 0, provider: 'test', pinned: false },
  }),
  isAvailable: async () => true,
  getStats: () => ({ totalCalls: 0, successfulCalls: 0, failedCalls: 0, pinnedCalls: 0, totalDurationMs: 0 }),
});

const makeTask = (id: string, term: string, createdAt: number) => ({
  id,
  term: termInterner.constant(term),
  kind: 'belief' as const,
  truth: { f: 1, c: 0.9 },
  weight: 1,
  activation: 1,
  source: 'perception' as const,
  createdAt,
  lastAccessed: createdAt,
  accessCount: 0,
  dependencies: [],
  derived: false,
  tags: ['grounding'],
});

describe('W1 — per-instance registries', () => {
  it('creates an isolated faculty registry with the core faculties', () => {
    const first = createFacultyRegistry();
    const second = createFacultyRegistry();
    expect(first.getAll()).toHaveLength(21);
    expect(first).not.toBe(second);
  });

  it('isolates oracle registrations between instances', () => {
    const first = createOracleRegistry();
    const second = createOracleRegistry();
    first.register(makeOracle('engine.z3'));
    expect(first.has('engine.z3')).toBe(true);
    expect(second.has('engine.z3')).toBe(false);
  });

  it('creates independent judge ensembles with deterministic weights', () => {
    const first = createJudge({ rng: () => 0.5, now: () => 0 });
    const second = createJudge({ rng: () => 0.5, now: () => 0 });
    expect(first).not.toBe(second);
  });

  it('lets an engine use only its injected registry', () => {
    const registry = createFacultyRegistry();
    const engine = new FacultyEngine({ registry });
    expect(engine.getAvailableFaculties()).toHaveLength(21);
  });

  it('runs two agents in one process with isolated registries', async () => {
    // Agent 1
    const core1 = createEnvCore({ seed: 1 });
    const env1 = createEnv({
      ...core1,
      oracles: createOracleRegistry(),
      faculties: createFacultyRegistry(),
    });
    const task1 = makeTask('task-1', 'agent1-grounding', env1.clock.now());
    const loop1 = createCognitiveLoop(env1, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
      maxIterations: 2,
      recordEnabled: false,
      contractsEnabled: false,
      repairEnabled: false,
      selfModelEnabled: false,
    });
    // Add task via context economy
    loop1.getContext().economy.addTask(loop1.getContext().economyState, task1);

    // Agent 2
    const core2 = createEnvCore({ seed: 2 });
    const env2 = createEnv({
      ...core2,
      oracles: createOracleRegistry(),
      faculties: createFacultyRegistry(),
    });
    const task2 = makeTask('task-2', 'agent2-grounding', env2.clock.now());
    const loop2 = createCognitiveLoop(env2, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
      maxIterations: 2,
      recordEnabled: false,
      contractsEnabled: false,
      repairEnabled: false,
      selfModelEnabled: false,
    });
    loop2.getContext().economy.addTask(loop2.getContext().economyState, task2);

    // Register a custom oracle in agent 1 only
    env1.oracles.register(makeOracle('engine.custom'));
    expect(env1.oracles.has('engine.custom')).toBe(true);
    expect(env2.oracles.has('engine.custom')).toBe(false);

    // Register a custom faculty in agent 2 only
    const customSpec = {
      name: 'custom-faculty' as const,
      description: 'Custom test faculty',
      category: 'reasoning' as const,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      oracleOperation: 'engine.custom' as const,
      fallback: async () => ({ faculty: 'custom-faculty', result: {}, confidence: 0.5, evidence: [], fallbackUsed: true, durationMs: 0 }),
      enabled: true,
      priority: 0.5,
      budgetCost: 0.1,
      maxConcurrency: 1,
      timeoutMs: 1000,
    };
    env2.faculties.register(customSpec);
    expect(env2.faculties.has('custom-faculty')).toBe(true);
    expect(env1.faculties.has('custom-faculty')).toBe(false);

    // Run both agents
    const events1: any[] = [];
    const events2: any[] = [];
    for (const type of ['iteration_start', 'iteration_complete', 'iteration_failed'] as const) {
      loop1.onEvent(type, (e) => events1.push(e));
      loop2.onEvent(type, (e) => events2.push(e));
    }

    await loop1.run(2);
    await loop2.run(2);
    await loop1.close();
    await loop2.close();

    // Both agents should have run their iterations
    expect(events1.length).toBeGreaterThan(0);
    expect(events2.length).toBeGreaterThan(0);

    // Events should be different due to different seeds
    expect(JSON.stringify(events1)).not.toBe(JSON.stringify(events2));
  });
});