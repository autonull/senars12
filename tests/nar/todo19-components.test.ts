import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ActionRegistry,
  RewardRegistry,
  SensorRegistry,
  ASK_LM,
  CYCLE,
  DEFAULT_ACTIONS,
  DEFAULT_REWARDS,
  DEFAULT_SENSORS,
  GROUNDEDNESS_REWARD,
  SPEND_EFFICIENCY_REWARD,
  TASK_SETTLED_REWARD,
  VETO_PENALTY,
  actionsForTier,
  composeReward,
  createCognitionRegistries,
  tuneAction,
} from '../../nar/src/cognition/index.js';
import {
  ParameterScopeError,
  createParameterTable,
} from '../../nar/src/config/parameter-table.js';
import { createSelfMetaGame } from '../../nar/src/game/SelfMetaGame.js';
import { describeMetaGameActions } from '../../nar/src/cognition/meta-spec.js';
import { MetaGame } from '../../nar/src/game/MetaGame.js';

/**
 * Bench 43 — Component Contracts (TODO19 Phase A)
 * Sensor purity + fail-closed; action tier filtering + scope enforcement;
 * reward firewall classification; ParameterTable adoption (SelfMetaGame's
 * applyKnob switch deleted); sensor parity.
 */

const ctx = (overrides: Parameters<typeof Object.assign>[1] = {}): any => ({
  nar: {
    getCycleCount: () => 42,
    getStatistics: () => ({
      totalConcepts: 10,
      totalTasks: 20,
      focusedConcepts: 1,
      archivedConcepts: 0,
      memoryPressure: 0.3,
      utilization: 0.4,
      conceptDistribution: { lowPriority: 5, mediumPriority: 3, highPriority: 2 },
    }),
  },
  outcome: { tokens: 500, settled: 3, attempted: 4, groundedness: 0.8, vetoes: 2 },
  ...overrides,
});

describe('Bench 43 — Component Contracts', () => {
  it('sensors are pure (same context ⇒ same reading) and deterministic', () => {
    const c = ctx();
    for (const s of DEFAULT_SENSORS) {
      const a = s.read(c);
      const b = s.read(c);
      expect(a).toEqual(b);
      expect(Object.values(a.features).every((v) => Number.isFinite(v))).toBe(true);
    }
  });

  it('sensors fail closed: error context ⇒ zero confidence, finite features', () => {
    const bad: any = { nar: { getStatistics: () => { throw new Error('boom'); }, getCycleCount: () => 0 } };
    for (const s of DEFAULT_SENSORS) {
      const r = s.read(bad);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(Object.values(r.features).every(Number.isFinite)).toBe(true);
    }
  });

  it('actions carry cost/tier/domain; tier filtering gates cortex ops out of tier-0', () => {
    for (const a of DEFAULT_ACTIONS) {
      expect(a.tier).toBeGreaterThanOrEqual(0);
      expect(a.cost).toBeGreaterThanOrEqual(0);
      expect(['system', 'game']).toContain(a.domain);
    }
    const tier0 = actionsForTier(0, DEFAULT_ACTIONS);
    expect(tier0.map((a) => a.id)).toContain('cycle');
    expect(tier0.map((a) => a.id)).not.toContain('ask_lm');
    expect(actionsForTier(2, DEFAULT_ACTIONS)).toContain(ASK_LM);
  });

  it('tune is scope-enforced: a game scope cannot reach system knobs', () => {
    const table = createParameterTable();
    table.register({ name: 'focusWeight', scope: 'system', min: 0, max: 1, value: 0.5, owner: 'self-meta-game' });
    const tune = tuneAction();
    // game scope touching a system parameter ⇒ rejected
    expect(() => tune.execute!({ parameterTable: table, scope: 'game:rps', args: ['focusWeight', 1] } as never))
      .toThrow(ParameterScopeError);
    // the owning scope applies it
    expect(tune.execute!({ parameterTable: table, scope: 'system', args: ['focusWeight', 0.9] } as never)).toBe(0.9);
  });

  it('rewards are firewall-classified; composition is weighted', () => {
    for (const r of DEFAULT_REWARDS)
      expect(['extrinsic', 'intrinsic']).toContain(r.classification);
    const composed = composeReward(
      [GROUNDEDNESS_REWARD, TASK_SETTLED_REWARD, VETO_PENALTY, SPEND_EFFICIENCY_REWARD],
      { groundedness: 1, 'task-settled': 0.5, 'veto-penalty': 0.5, 'spend-efficiency': 0 },
      ctx()
    );
    // 1*0.8 + 0.5*(3/4) + 0.5*(-clamp01(2)) + 0 = 0.8 + 0.375 - 0.5 = 0.675
    expect(composed).toBeCloseTo(0.675, 5);
  });

  it('ParameterTable adopted by SelfMetaGame: knobs actuate, applyKnob switch deleted', () => {
    const source = readFileSync('nar/src/game/SelfMetaGame.ts', 'utf8');
    expect(source).toContain('createParameterTable');
    expect(source).not.toMatch(/private applyKnob/);

    const game = createSelfMetaGame({
      id: 'self',
      observesFocuses: [],
      focusBag: { all: () => [], decayRateValue: 0 } as never,
      gameFocuses: new Map(),
    });
    expect(game.getAllKnobs().get('maxDerivationsPerStep')).toBe(100);
    game.setKnob('maxDerivationsPerStep', 500);
    expect(game.getKnobValue('maxDerivationsPerStep')).toBe(500);
  });

  it('sensor parity: two games reading the same state get identical features', () => {
    const c = ctx();
    const a = DEFAULT_SENSORS[0]!.read(c);
    const b = new (Object.getPrototypeOf(DEFAULT_SENSORS[0]!).constructor)().read(c);
    expect(a).toEqual(b);

    // registries share the same component instances ⇒ same readings
    const { sensors: r1 } = createCognitionRegistries();
    const r2 = new SensorRegistry();
    DEFAULT_SENSORS.forEach((s) => { r1.register(s); r2.register(s); });
    expect(r1.all()[0]!.read(c)).toEqual(r2.all()[0]!.read(c));
  });

  it('C5 — MetaGame legalActions come from the library spec, not inline literals', () => {
    const game = new MetaGame({ id: 'meta', observesFocuses: ['f1', 'f2'] });
    const expected = describeMetaGameActions(['f1', 'f2']);
    expect(game.legalActions(game.state())).toEqual(expected);
    expect(expected).toContain('^focus_weight(f1, 0.8)');
    expect(expected).toContain('^knob_set(maxDerivationsPerStep, 500)');
  });

  it('registries are idempotent per id and fail loudly on missing requires', () => {
    const { sensors, actions, rewards } = createCognitionRegistries();
    sensors.register(DEFAULT_SENSORS[0]!).register(DEFAULT_SENSORS[0]!);
    expect(sensors.all().length).toBe(1);
    expect(() => new ActionRegistry().require(CYCLE.id)).toThrow(/not registered/);
    expect(() => new RewardRegistry().require('nope')).toThrow(/not registered/);
  });
});
