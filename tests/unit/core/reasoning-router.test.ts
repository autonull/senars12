import { describe, expect, it } from 'vitest';
import type { Capability, ReasoningBackend } from '@senars/core';
import { ReasoningRouter } from '@senars/core';

function mockBackend(id: string, caps: Capability[]): ReasoningBackend {
  return {
    id,
    label: id,
    capabilities: new Set(caps),
    initialize: async () => {},
    shutdown: async () => {},
    health: () => ({ status: 'healthy' as const }),
    reason: async () => ({ backendId: id, success: true, events: [] }),
  };
}

function makeRouter(backends: ReasoningBackend[]): ReasoningRouter {
  const map = new Map(backends.map((b) => [b.id, b]));
  return new ReasoningRouter(map);
}

describe('ReasoningRouter', () => {
  it('routes Narsese to nar backend', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance', 'truth-revision']),
      mockBackend('metta', ['pattern-match']),
    ]);
    const route = router.route('<bird --> animal>.', []);
    expect(route.primaryBackend).toBe('nar');
    expect(route.steps).toHaveLength(1);
    expect(route.steps[0].backendId).toBe('nar');
    expect(route.steps[0].type).toBe('belief');
  });

  it('routes MeTTa s-expression to metta backend', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance']),
      mockBackend('metta', ['pattern-match']),
    ]);
    const route = router.route('(match (atom $x) (-> $x (process $x)))', []);
    expect(route.primaryBackend).toBe('metta');
    expect(route.steps[0].type).toBe('skill');
  });

  it('routes skill: prefix to metta backend via routeForChat', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance']),
      mockBackend('metta', ['skill-execution']),
    ]);
    const route = router.routeForChat('skill:metta-match "(color $x)"', []);
    expect(route.primaryBackend).toBe('metta');
    expect(route.steps[0].type).toBe('skill');
  });

  it('routes (skill ...) to metta backend via routeForChat', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance']),
      mockBackend('metta', ['skill-execution']),
    ]);
    const route = router.routeForChat('(skill write_file "hello" "/tmp/x.txt")', []);
    expect(route.primaryBackend).toBe('metta');
  });

  it('routes plain chat to nar via routeForChat', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance', 'llm-completion']),
      mockBackend('metta', ['pattern-match']),
    ]);
    const route = router.routeForChat('hello world', []);
    expect(route.primaryBackend).toBe('nar');
  });

  it('infers capabilities from keywords for routing', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance', 'truth-revision', 'goal-management']),
      mockBackend('metta', ['pattern-match', 'rewrite', 'query']),
    ]);
    const route = router.route('I want to achieve world peace', []);
    expect(route.steps.length).toBeGreaterThan(0);
    expect(route.steps.some((s) => s.backendId === 'nar')).toBe(true);
  });

  it('routes match/rewrite/query keywords to metta', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance']),
      mockBackend('metta', ['pattern-match', 'rewrite', 'query']),
    ]);
    const route = router.route('find pattern in space', []);
    expect(route.steps.some((s) => s.backendId === 'metta')).toBe(true);
  });

  it('falls back to nar for unknown input', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance', 'llm-completion']),
    ]);
    const route = router.route('what is the meaning of life?', []);
    expect(route.primaryBackend).toBe('nar');
  });

  it('returns empty steps when no backends registered', () => {
    const router = makeRouter([]);
    const route = router.route('hello', []);
    expect(route.steps).toHaveLength(1);
    expect(route.primaryBackend).toBe('nar');
  });

  it('scores backends correctly', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance', 'truth-revision', 'goal-management']),
      mockBackend('metta', ['pattern-match']),
    ]);

    const route = router.route('I want to achieve peace', []);
    const hasNar = route.steps.filter((s) => s.backendId === 'nar').length > 0;
    expect(hasNar).toBe(true);
  });

  it('creates multi-step pipeline for complex queries', () => {
    const router = makeRouter([
      mockBackend('nar', ['inheritance', 'truth-revision', 'goal-management', 'episodic-memory']),
      mockBackend('metta', ['pattern-match', 'rewrite', 'query', 'skill-execution']),
    ]);

    const route = router.route('remember to execute match query', []);
    expect(route.steps.length).toBeGreaterThan(1);
    expect(route.steps.some((s) => s.backendId === 'nar')).toBe(true);
    expect(route.steps.some((s) => s.backendId === 'metta')).toBe(true);
  });

  it('isNarsese detects Narsese syntax', () => {
    const router = makeRouter([mockBackend('nar', ['inheritance'])]);
    expect(router.route('<bird --> animal>.', []).primaryBackend).toBe('nar');
    expect(router.route('(cat --> animal).', []).primaryBackend).toBe('nar');
    expect(router.route('(call_mom)!', []).primaryBackend).toBe('nar');
    expect(router.route('(cat --> ?)?', []).primaryBackend).toBe('nar');
  });
});
