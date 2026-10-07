import { loadScenario, SCENARIOS, scenarioById, scenarioIds } from '@senars/ui/scenarios';
import { describe, expect, it, vi } from 'vitest';

describe('scenario catalog', () => {
  it('exposes stable ids and a bootstrap default', () => {
    expect(scenarioIds()).toContain('bootstrap');
    expect(scenarioById('bootstrap')).toBe(SCENARIOS.bootstrap);
    expect(scenarioById('missing')).toBeUndefined();
  });

  it('every scenario declares a narrative and at least one belief', () => {
    for (const scenario of Object.values(SCENARIOS)) {
      expect(scenario.narrative.length).toBeGreaterThan(0);
      expect(scenario.beliefs.length).toBeGreaterThan(0);
    }
  });

  it('loads beliefs, goals and cycles through the engine in order', async () => {
    const calls: string[] = [];
    const engine = {
      believe: vi.fn(async (s: string) => {
        calls.push(`believe:${s}`);
      }),
      goal: vi.fn(async (s: string) => {
        calls.push(`goal:${s}`);
      }),
      run: vi.fn((n: number) => {
        calls.push(`run:${n}`);
      }),
    };

    await loadScenario(engine, {
      id: 'x',
      narrative: 'n',
      beliefs: ['<a --> b>.'],
      goals: ['<g>!'],
      runCycles: 7,
    });

    expect(calls).toEqual(['believe:<a --> b>.', 'goal:<g>!', 'run:7']);
  });
});
