import { describe, expect, it } from 'vitest';

import { PerceptionGate } from '../../nar/src/gates/PerceptionGate.js';
import { RewardGate } from '../../nar/src/gates/RewardGate.js';
import { toAtomSymbol } from '../../nar/src/terms/impls/valid-atom.js';
import { isValidAtomSymbol } from '../../nar/src/terms/impls/valid-atom.js';
import { createBudget } from '../../nar/src/types/core.js';

describe('toAtomSymbol', () => {
  it('collapses reserved runs to a single underscore', () => {
    expect(toAtomSymbol('move,left')).toBe('move_left');
    expect(toAtomSymbol('score = 3')).toBe('score_3');
  });

  it('always yields a valid symbol', () => {
    for (const raw of ['', 'a b', '^^^', 'a--b']) expect(isValidAtomSymbol(toAtomSymbol(raw))).toBe(true);
  });
});

describe('focus gate task construction', () => {
  it('admits state and feature beliefs as serializable terms', () => {
    const gate = new PerceptionGate();
    const tasks = gate.toBeliefs({ stateId: 'snake', confidence: 0.8, features: { score: -3 } } as never);

    expect(tasks.map((t) => t.term.toString())).toEqual(['snake', '[score__3]']);
    expect(tasks.every((t) => t.type === 'belief' && !t.derived)).toBe(true);
    expect(tasks[0]?.truth).toEqual({ f: 1, c: 0.8 });
    expect(tasks[1]?.priority).toBeCloseTo(2.4);
    expect(tasks[1]?.budget.priority).toBe(createBudget(3).priority);
  });

  it('records terminal outcomes as a sign belief plus a terminal flag', () => {
    const tasks = new RewardGate().toBeliefs({ reward: -0.5, terminal: true } as never);
    expect(tasks.map((t) => t.term.toString())).toEqual(['[reward_negative]', 'terminal']);
  });

  it('gives the state and its features one confidence default', () => {
    const tasks = new PerceptionGate().toBeliefs({
      stateId: 'snake',
      features: { score: 3 },
    } as never);

    expect(tasks[0]?.truth.c).toBe(0.9);
    expect(tasks[1]?.truth.c).toBe(tasks[0]?.truth.c);
  });
});
