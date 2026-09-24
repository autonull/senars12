import { describe, expect, it } from 'vitest';
import { RetrospectiveAdapter } from '@senars/nar/dialogue';
import type { Retrospective } from '@senars/nar/dialogue';
import { emptyReactionDistribution } from '@senars/nar/dialogue';
import type { StrategyType } from '../../nar/src/strategies/index.js';

/**
 * TODO25 Bench 77 — Phase A falsifier: retrospective-driven strategy
 * adaptation. Gate: N1 clamp (strategy-type switches only, snapshot/restore
 * byte-identical) + N2 digest idempotency + correction-dominated gating.
 */
/** Real stateful double — plain object, no mocking framework. */
const controller = () => {
  const strategies = new Map<StrategyType, string>([
    ['derivation', 'svelte'],
    ['sampling', 'random'],
    ['premise', 'all'],
    ['lm-rule', 'round-robin'],
  ]);
  return {
    getStrategy: (type: StrategyType) => strategies.get(type),
    setStrategy: (type: StrategyType, name: string) => strategies.set(type, name),
    snapshot: () => new Map(strategies),
  };
};

const retrospective = (negative: number, positive: number): Retrospective => {
  const d = emptyReactionDistribution();
  d['correct'] = negative;
  d['accept'] = positive;
  return {
    version: 'retrospective-v1',
    sessionId: 's',
    at: 0,
    turnCount: 10,
    reactionCount: negative + positive,
    reactionDistribution: d,
    corrections: [],
    contradictions: [],
    strategyAudit: [],
    proposals: [],
    provenance: { turnIds: ['t1', 't2'] },
    digest: `sha256:d-${negative}-${positive}`,
  };
};

describe('TODO25 Bench 77 — adaptFromRetrospective', () => {
  it('correction-dominated retrospective switches derivation→focused, lm-rule→priority', () => {
    const c = controller();
    const adapter = new RetrospectiveAdapter(c);
    expect(adapter.adaptFromRetrospective(retrospective(3, 1))).toBe(true);
    expect(c.getStrategy('derivation')).toBe('focused');
    expect(c.getStrategy('lm-rule')).toBe('priority');
    // N1: untouched axes stay byte-identical
    expect(c.getStrategy('sampling')).toBe('random');
    expect(c.getStrategy('premise')).toBe('all');
  });

  it('healthy retrospective (negatives below share) never adapts', () => {
    const c = controller();
    const adapter = new RetrospectiveAdapter(c);
    expect(adapter.adaptFromRetrospective(retrospective(1, 4))).toBe(false);
    expect(c.getStrategy('derivation')).toBe('svelte');
    expect(adapter.ledger.length).toBe(0);
  });

  it('N2: one-shot per digest — a second call is a no-op even after content changes', () => {
    const c = controller();
    const adapter = new RetrospectiveAdapter(c);
    expect(adapter.adaptFromRetrospective(retrospective(4, 0))).toBe(true);
    expect(adapter.adaptFromRetrospective(retrospective(4, 0))).toBe(false);
    expect(adapter.ledger.length).toBe(1);
  });

  it('N1 restore: snapshot round-trip returns every axis to its pre-adaptation value', () => {
    const c = controller();
    const adapter = new RetrospectiveAdapter(c);
    const before = c.snapshot();
    adapter.adaptFromRetrospective(retrospective(2, 2));
    expect(adapter.restore()).toBe(true);
    for (const [type, name] of before) expect(c.getStrategy(type)).toBe(name);
    expect(adapter.restore()).toBe(false); // nothing left to restore
  });
});
