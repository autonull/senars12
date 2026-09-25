import { fixedClock } from '@senars/nar/clock.js';
import { DialogueCapture } from '@senars/nar/dialogue';
import { causalConnections, episodeSalience } from '@senars/nar/memory/episode-consolidator.js';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { MemoryQuery } from '@senars/nar/query/memory-query.js';
import { Memory } from '@senars/nar/memory';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const PINNED = 1_700_000_000_000;
const clock = fixedClock(PINNED);

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const makeEpisodic = async (): Promise<EpisodicMemory> =>
  new EpisodicMemory({ basePath: await mkdtemp(join(tmpdir(), 'bench92-')).then((d) => (dirs.push(d), d)), clock });

const makeCapture = (episodic?: EpisodicMemory): DialogueCapture =>
  new DialogueCapture({ episodic, config: { enabled: true } });

describe('Bench 92 — episode graph completeness & MemoryQuery hardening (REFACTOR.todo3 Phase B)', () => {
  it('dialogue turn episodes carry `id: turnId` — reaction causes resolve', async () => {
    const episodic = await makeEpisodic();
    const capture = makeCapture(episodic);
    const turnId = await capture.onExchange({
      correlationId: 'c1',
      utterance: 'hello',
      response: 'hi',
    });
    await capture.bindReaction(turnId!, 'accept');

    const reaction = (await episodic.getEpisodes({ type: 'reaction' }))[0]!;
    expect(reaction.causes).toContain(turnId);
    // Full chain traversal: the dialogue episode's id IS the turnId, so the
    // reaction's `causes` edge resolves against a real episode (CausalIndex).
    const turn = (await episodic.getEpisodes({ type: 'dialogue' }))[0]!;
    expect(turn.id).toBe(turnId);
    expect(turn.causes).toBeUndefined();
  });

  it('episode leg ranks by recency × salience × (1 + causal connections)', async () => {
    const episodic = await makeEpisodic();
    // Same recency, different causal degree + type salience.
    await episodic.log('dialogue', 'plain turn', { id: 'plain' });
    await episodic.log('error', 'causal error', { id: 'linked', causes: ['plain'], consequences: ['x'] });
    const mem = new Memory({ maxConcepts: 10 });
    const q = new MemoryQuery({ memory: mem, episodic, clock });
    const results = await q.search({ limit: 10 });
    const scores = new Map(results.map((r) => [r.episode!.id, r.score]));
    // error (salience 0.9, 2 connections) > dialogue (0.8, 0 connections).
    expect(scores.get('linked')!).toBeGreaterThan(scores.get('plain')!);
    // Formula parity with EpisodeConsolidator priors.
    const linked = (await episodic.getEpisodes({ limit: 10 })).find((e) => e.id === 'linked')!;
    const expected =
      (1 / (1 + 0 / 3_600_000)) * episodeSalience(linked) * (1 + causalConnections(linked));
    expect(scores.get('linked')!).toBeCloseTo(expected, 6);
  });

  it('SelfMetaGame drain budget reads `proposals.budget` from config', async () => {
    const { createSelfMetaGame } = await import('@senars/nar/game/SelfMetaGame.js');
    const { FocusBag } = await import('@senars/nar/focus/FocusBag.js');
    const game = createSelfMetaGame({
      id: 'g',
      focusBag: new FocusBag({ capacity: 16 }),
      gameFocuses: new Map(),
      drainBudget: 7,
    } as never);
    // Internal plumbing: the drain call must receive the configured budget, not 4.
    const routed: number[] = [];
    (game as never as { proposalRouter: { route: () => number } }).proposalRouter = {
      route: () => routed.length,
    };
    const drained: unknown[] = [];
    (game as never as { proposalBag: { drainIfPressured: (r: unknown, o: { budget: number }) => Promise<unknown[]> } }).proposalBag =
      { drainIfPressured: (_r, o) => (drained.push(o.budget), Promise.resolve([])) };
    await (game as never as { routeProposals: () => Promise<void> }).routeProposals();
    expect(drained).toEqual([7]);
  });
});
