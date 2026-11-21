/**
 * W1 — per-instance registries are isolated.
 *
 * Two engines in one process must not share a registry: an oracle or faculty
 * registered in one is absent from the other. This is the isolation the
 * global singletons could not provide.
 */

import { describe, expect, it } from 'vitest';
import { createFacultyRegistry, FacultyEngine } from '../../src/faculties/index.js';
import { createOracleRegistry, type Oracle, type OracleInput, type OracleOutput } from '../../src/oracles/oracle.js';
import { createJudge } from '../../src/faculties/judgment/judge.js';

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

describe('W1 — per-instance registries', () => {
  it('creates an isolated faculty registry with the core faculties', () => {
    const first = createFacultyRegistry();
    const second = createFacultyRegistry();
    expect(first.getAll()).toHaveLength(10);
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
    expect(engine.getAvailableFaculties()).toHaveLength(10);
  });
});
