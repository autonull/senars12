import { describe, expect, it } from 'vitest';

import { outcomeTasks, perceptionTasks, proposalTasks } from '../../nar/src/focus/task.js';
import { isValidAtomSymbol, toAtomSymbol } from '../../nar/src/terms/impls/valid-atom.js';
import { createTaskWeight } from '../../nar/src/types/core.js';

/** A pinned clock: the projection reads it once per batch, so ids are reproducible. */
const pinned = () => {
  const clock = (): number => 1_000;
  return clock;
};

describe('toAtomSymbol', () => {
  it('collapses reserved runs to a single underscore', () => {
    expect(toAtomSymbol('move,left')).toBe('move_left');
    expect(toAtomSymbol('score = 3')).toBe('score_3');
  });

  it('always yields a valid symbol', () => {
    for (const raw of ['', 'a b', '^^^', 'a--b']) expect(isValidAtomSymbol(toAtomSymbol(raw))).toBe(true);
  });
});

describe('perception projection', () => {
  it('admits state and feature beliefs as serializable terms', () => {
    const tasks = perceptionTasks(
      { stateId: 'snake', confidence: 0.8, features: { score: -3 } } as never,
      pinned()
    );

    expect(tasks.map((t) => t.term.toString())).toEqual(['snake', '[score__3]']);
    expect(tasks.every((t) => t.type === 'belief' && !t.derived)).toBe(true);
    expect(tasks[0]?.truth).toEqual({ f: 1, c: 0.8 });
    expect(tasks[1]?.priority).toBeCloseTo(2.4);
    expect(tasks[1]?.budget.priority).toBe(createTaskWeight(3).priority);
  });

  it('gives the state and its features one confidence default', () => {
    const tasks = perceptionTasks({ stateId: 'snake', features: { score: 3 } } as never, pinned());

    expect(tasks[0]?.truth.c).toBe(0.9);
    expect(tasks[1]?.truth.c).toBe(tasks[0]?.truth.c);
  });

  it('stamps one batch from one clock reading', () => {
    const tasks = perceptionTasks({ stateId: 'snake', features: { score: 3 } } as never, pinned());

    expect(new Set(tasks.map((t) => t.stamp)).size).toBe(1);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });
});

describe('outcome projection', () => {
  it('records terminal outcomes as a sign belief plus a terminal flag', () => {
    const tasks = outcomeTasks({ reward: -0.5, terminal: true } as never, pinned());
    expect(tasks.map((t) => t.term.toString())).toEqual(['[reward_negative]', 'terminal']);
  });

  it('omits the terminal flag while the episode runs', () => {
    expect(outcomeTasks({ reward: 1, terminal: false } as never, pinned()).map((t) => t.term.toString())).toEqual([
      '[reward_positive]',
    ]);
  });
});

describe('proposal projection', () => {
  it('weights a goal by value times confidence', () => {
    const tasks = proposalTasks(
      [{ source: 'reflex-a', action: 'move', args: { dir: 'left' }, value: 0.8, confidence: 0.5 }] as never,
      pinned()
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.type).toBe('goal');
    expect(tasks[0]?.priority).toBeCloseTo(0.4);
    expect(tasks[0]?.truth).toEqual({ f: 0.8, c: 0.5 });
  });
});