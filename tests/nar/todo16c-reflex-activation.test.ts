import { describe, it, expect, vi } from 'vitest';
import { ManifoldReflex } from '../../nar/src/lm/system-one/manifold-reflex.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { EpsilonGreedyReflex } from '../../nar/src/reflex/EpsilonGreedyReflex.js';
import { GameFocus } from '../../nar/src/focus/GameFocus.js';
import { GridWorldGame } from '../../nar/src/game/GridWorldGame.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { Perception } from '../../nar/src/game/Game.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const grid = ['S...', '.#..', '..#.', '...G'];

describe('System One — Semantic Reflex Activation (Bench 18)', () => {
  const actions = ['0', '1', '2', '3'];

  it('warm prefetch table serves manifold-sourced proposals distinct from the incumbent', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const incumbent = new EpsilonGreedyReflex('bandit-fallback', { numArms: 4, epsilon: 0 });
    const reflex = new ManifoldReflex(incumbent);
    const perception: Perception = { stateId: '0,0', confidence: 1.0 };

    const pointer = await cache.write('state 0,0');
    await reflex.prefetch(perception.stateId, pointer as never, actions, manifold, budget);

    const proposals = reflex.propose(perception, actions);
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) expect(p.source).toBe('manifold-reflex');

    const incumbentProposals = incumbent.propose('warm' as never, actions.map(Number) as never);
    const incumbentByAction = new Map(incumbentProposals.map((p) => [p.action, p.value]));
    const differs = proposals.some((p) => incumbentByAction.get(p.action) !== p.value);
    expect(differs).toBe(true);
  });

  it('cold table falls back exactly to the incumbent proposals', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const incumbent = new EpsilonGreedyReflex('bandit-fallback', { numArms: 4, epsilon: 0 });
    const reflex = new ManifoldReflex(incumbent);
    const perception: Perception = { stateId: 'cold', confidence: 1.0 };

    const proposals = reflex.propose(perception, actions);
    const incumbentProposals = incumbent.propose('cold' as never, actions.map(Number) as never);
    expect(proposals).toEqual(incumbentProposals);
  });

  it('prefetch is consumed once — no stale-row serving', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const incumbent = new EpsilonGreedyReflex('bandit-fallback', { numArms: 4, epsilon: 0 });
    const reflex = new ManifoldReflex(incumbent);
    const perception: Perception = { stateId: 's1', confidence: 1.0 };

    const pointer = await cache.write('state s1');
    await reflex.prefetch(perception.stateId, pointer as never, actions, manifold, budget);

    const warm = reflex.propose(perception, actions);
    expect(warm.every((p) => p.source === 'manifold-reflex')).toBe(true);

    // Second propose for the same state: table was consumed, falls back again
    const second = reflex.propose(perception, actions);
    expect(second).toEqual(incumbent.propose('s1' as never, actions.map(Number) as never));
  });

  it('GameFocus calls prefetch at the attend stage, never after propose (sync contract)', async () => {
    const game = new GridWorldGame({ grid, seed: 42 });
    const focus = new GameFocus({ focusId: 'bench18', game });

    const prefetchSpy = vi.fn(async () => {});
    const incumbent = new EpsilonGreedyReflex('bandit-fallback', { numArms: 4, epsilon: 0 });
    const spyReflex = {
      id: 'spy-reflex',
      propose: (state: never, legal: never) => incumbent.propose(state, legal),
      learn: () => {},
      prefetch: prefetchSpy as never,
    };
    focus.bindReflex(spyReflex as never);

    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    focus.setReflexPrefetchContext({
      manifold: createManifold(cache, { abstainThreshold: 0.05 }),
      embeddingCache: cache,
      budget,
    });

    await focus.step(10);
    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    expect(focus.getPrefetchCallCount()).toBe(1);

    const callsAfterFirstStep = prefetchSpy.mock.calls.length;
    await focus.step(10);
    expect(prefetchSpy.mock.calls.length).toBe(callsAfterFirstStep + 1);
  });

  it('no prefetch context ⇒ zero prefetch calls (disabled path byte-identical)', async () => {
    const game = new GridWorldGame({ grid, seed: 42 });
    const focus = new GameFocus({ focusId: 'bench18-off', game });
    const prefetchSpy = vi.fn(async () => {});
    const incumbent = new EpsilonGreedyReflex('bandit-fallback', { numArms: 4, epsilon: 0 });
    focus.bindReflex({
      id: 'spy-reflex',
      propose: (state: never, legal: never) => incumbent.propose(state, legal),
      learn: () => {},
      prefetch: prefetchSpy as never,
    } as never);

    await focus.step(10);
    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
