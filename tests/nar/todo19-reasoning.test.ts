import { describe, expect, it } from 'vitest';
import { createReasoningGame, generateEvalTasks, ReasoningGame, type ReasoningGameOptions } from '../../nar/src/cognition/ReasoningGame.js';
import { ReasoningMetaGame } from '../../nar/src/cognition/ReasoningMetaGame.js';
import { REASONING_SPECS } from '../../nar/src/cognition/ReasoningGame.js';
import { DEFAULT_ACTIONS, DEFAULT_REWARDS } from '../../nar/src/cognition/index.js';
import { ParameterScopeError } from '../../nar/src/config/parameter-table.js';
import { GameFocus } from '../../nar/src/focus/GameFocus.js';
import { createArcadeRegistry, registerReasoningGames } from '../../nar/src/game/registry.js';
import type { Game, GameOutcome, Perception } from '../../nar/src/game/Game.js';
import type { ActionProposal, LearningEvent, Reflex } from '../../nar/src/reflex/Reflex.js';

/**
 * Bench 44 — ReasoningGame Falsification (TODO19 Phase B, R4)
 * Item 7 (schema induction persistence) lands with L4/SchemaStore in Phase C.
 */

const createSpec = (overrides: Partial<ReasoningGameOptions> = {}): ReasoningGameOptions => ({
  ...REASONING_SPECS['reasoning:conversation'],
  sensors: [],
  actions: [...DEFAULT_ACTIONS],
  rewards: [...DEFAULT_REWARDS],
  ...overrides,
} as ReasoningGameOptions);

const playPolicy = (spec: ReasoningGameOptions, policy: (legal: string[]) => string, ticks: number) => {
  const game = createReasoningGame(spec, 7);
  let total = 0;
  for (let t = 0; t < ticks; t++) {
    const action = policy(game.legalActions(game.state()));
    const outcome = game.step(action);
    total += outcome.reward;
    if (outcome.terminal) break;
  }
  const state = game.state();
  return { total, settled: state.settled, tokens: state.tokens, tasks: state.taskIndex };
};

/** Greedy "assembled arm": settle as soon as clearable, then clarify/ask_lm to clear. */
const greedyPolicy = (legal: string[]): string => {
  if (legal.includes('settle')) return 'settle';
  if (legal.includes('clarify')) return 'clarify';
  return legal[0]!;
};

/** Default scheduler arm: round-robin over legal actions. */
const schedulerPolicy = (legal: string[]): string => legal[0]!;

describe('Bench 44 — ReasoningGame Falsification', () => {
  it('R4.1 — assembled arm ≥ default scheduler arm (settled fraction; same seed, fixed suite)', () => {
    const spec = createSpec();
    const assembled = playPolicy(spec, greedyPolicy, 30);
    const scheduler = playPolicy(spec, schedulerPolicy, 30);
    expect(assembled.settled).toBeGreaterThanOrEqual(scheduler.settled);
    expect(assembled.settled).toBeGreaterThan(0);
    // settled fraction beats the naive round-robin arm
    expect(assembled.settled / spec.tasksPerEpisode).toBeGreaterThanOrEqual(0.5);
  });

  it('R4.2/4.3 — tier gating: tier-0 never offers ask_lm/clarify; tier-2 does', () => {
    const tier0 = createReasoningGame(createSpec({ tier: 0 }), 7);
    expect(tier0.legalActions(tier0.state())).not.toContain('ask_lm');
    expect(tier0.legalActions(tier0.state())).not.toContain('clarify');
    const tier2 = createReasoningGame(createSpec({ tier: 2 }), 7);
    expect(tier2.legalActions(tier2.state())).toContain('ask_lm');
    // dynamic escalation: tier-0 game cannot reduce ambiguity ⇒ lower settledness
    const lowTier = playPolicy(createSpec({ tier: 0 }), greedyPolicy, 30);
    const highTier = playPolicy(createSpec({ tier: 2 }), greedyPolicy, 30);
    expect(highTier.settled).toBeGreaterThan(lowTier.settled);
  });

  it('R4.4 — scope enforcement: game-scoped meta cannot reach system knobs; own weights apply', () => {
    const game = createReasoningGame(createSpec(), 7);
    const meta = new ReasoningMetaGame(game, { 'task-settled': 0.6, 'ambiguity-reduction': 0.3 });
    expect(meta.getRewardWeight('task-settled')).toBe(0.6);
    meta.setRewardWeight('task-settled', 0.9);
    expect(meta.getRewardWeights()['task-settled']).toBe(0.9);
    expect(() => meta.tuneSystemKnob('maxDerivationsPerStep', 500)).toThrow(ParameterScopeError);
  });

  it('R4.6 — sensor parity: same episode state ⇒ identical observation features', () => {
    const a = createReasoningGame(createSpec(), 7);
    const b = createReasoningGame(createSpec(), 7);
    for (let t = 0; t < 5; t++) {
      const action = 'cycle';
      expect(a.observe().features).toEqual(b.observe().features);
      a.step(action);
      b.step(action);
    }
    expect(a.observe()).toEqual(b.observe());
  });

  it('R4.5 — NAL veto transplant: seeded trap rule vetoes ask_lm post-first-veto; rule-free ⇒ zero vetoes', async () => {
    class FixedActionReflex implements Reflex {
      readonly id = 'fixed-action';
      constructor(private readonly action: string) {}
      propose(): ActionProposal[] {
        return [{ action: this.action, value: 0.9, confidence: 0.9, source: this.id }];
      }
      learn(_event: LearningEvent): void {}
    }

    const runFocus = async (seeded: boolean): Promise<GameFocus> => {
      const game = createReasoningGame(createSpec(), 7);
      const focus = new GameFocus({ focusId: 'reasoning-nal', game, cognitive: true });
      if (seeded) focus.seedRule('ask_lm', 'costly_op', { f: 0.1, c: 0.95 });
      focus.bindReflex(new FixedActionReflex('ask_lm'));
      for (let t = 0; t < 20; t++) await focus.step(10);
      return focus;
    };

    const seeded = await runFocus(true);
    const panel = seeded.getPanelLog();
    const firstVeto = panel.findIndex((p) => p.decision.vetoedBy !== null && p.decision.vetoedBy !== 'below-threshold');
    expect(firstVeto).toBeGreaterThanOrEqual(0);
    for (const entry of panel.slice(firstVeto))
      expect(entry.decision.actionExecuted).not.toBe('ask_lm');

    const ruleFree = await runFocus(false);
    expect(ruleFree.getVetoStats().totalVetos).toBe(0);
  });

  it('R1 — registry integration: reasoning:* specs resolve through the arcade GameRegistry', () => {
    const registry = registerReasoningGames(createArcadeRegistry());
    for (const name of ['reasoning:conversation', 'reasoning:tool-use', 'reasoning:research'])
      expect(registry.has(name)).toBe(true);
    const game = registry.create('reasoning:research', 42) as ReasoningGame;
    expect(game.id).toBe('reasoning:research');
    expect(game.legalActions(game.state()).length).toBeGreaterThan(0);
  });

  it('R1 — eval suites are spec data: same seed ⇒ same tasks', () => {
    const spec = createSpec();
    expect(generateEvalTasks(spec, 11)).toEqual(generateEvalTasks(spec, 11));
    expect(generateEvalTasks(spec, 12)).not.toEqual(generateEvalTasks(spec, 11));
  });

  it('R4.2 — fault-injected judgeBatch: reasoning ops fail closed, episode survives on the incumbent', async () => {
    const { ManifoldReflex } = await import('../../nar/src/lm/system-one/manifold-reflex.js');
    const { EpsilonGreedyReflex } = await import('../../nar/src/reflex/EpsilonGreedyReflex.js');
    const faulted = {
      judgeBatch: async () => {
        throw new Error('manifold fault');
      },
    };
    const game = createReasoningGame(createSpec(), 7);
    const focus = new GameFocus({ focusId: 'reasoning-fault', game, cognitive: true });
    focus.setReflexPrefetchContext({
      manifold: faulted as never,
      embeddingCache: { write: async () => ({ digest: 'x' }) } as never,
      budget: { maxCycles: 10, maxDepth: 5, maxMemoryOps: 10, maxLMCalls: 5, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } },
    });
    focus.bindReflex(new ManifoldReflex(new EpsilonGreedyReflex('incumbent', { numArms: 4, epsilon: 0.3 })));
    // The faulted judgeBatch must not throw out of the tick loop…
    for (let t = 0; t < 15; t++) await expect(focus.step(10)).resolves.toBeDefined();
    // …and the episode still progressed on the incumbent reflex (fail-closed ≠ frozen).
    expect(game.state().cycle).toBeGreaterThan(0);
    const panel = focus.getPanelLog();
    expect(panel.length).toBeGreaterThan(0);
    for (const entry of panel) expect(entry.decision.vetoedBy).toBeNull();
  });
});
