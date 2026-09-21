/**
 * Game registry + the newer plain-`Game` environments (catch, arithmetic,
 * rps). Contract under test: the registry is the single source of names —
 * every registered spec creates a deterministic, interface-conformant game;
 * each game honors observe/legalActions/step semantics with seeded outcomes.
 */
import type { Game } from '@senars/nar/game';
import {
  createArcadeRegistry,
  createArithmeticGame,
  createCatchGame,
  createGridWorldGame,
  createRPSGame,
  GameRegistry,
  UnknownGameError,
} from '@senars/nar/game';
import { describe, expect, it } from 'vitest';

const play = (game: Game, action: string): { reward: number; terminal: boolean } => game.step(action as never);

describe('GameRegistry', () => {
  it('registers, lists, and creates by name', () => {
    const registry = new GameRegistry();
    expect(registry.has('catch')).toBe(false);
    registry.register({ name: 'catch', description: 'd', actionLegend: 'a', create: (seed) => createCatchGame({ seed }) });
    expect(registry.names()).toEqual(['catch']);
    expect(registry.create('catch', 7).id).toBe('catch');
  });

  it('throws UnknownGameError for unknown names (fail loud)', () => {
    expect(() => createArcadeRegistry().create('nope', 1)).toThrow(UnknownGameError);
  });

  it('default arcade collection ships every game with a description + action legend', () => {
    const registry = createArcadeRegistry();
    for (const name of registry.names()) {
      const spec = registry.get(name)!;
      expect(spec.description.length).toBeGreaterThan(10);
      expect(spec.actionLegend.length).toBeGreaterThan(5);
      const game = spec.create(7);
      expect(game.observe().stateId.length).toBeGreaterThan(0);
      expect(game.legalActions(game.state() as never).length).toBeGreaterThan(0);
    }
  });

  it('same seed ⇒ identical episode for every registered game', () => {
    const registry = createArcadeRegistry();
    for (const name of registry.names()) {
      const run = (game: Game): number[] => {
        const rewards: number[] = [];
        for (let t = 0; t < 8 && !(game.state() as { terminal?: boolean }).terminal; t++) {
          const legal = game.legalActions(game.state() as never).map(String);
          rewards.push(game.step(legal[0] as never).reward);
        }
        return rewards;
      };
      expect(run(registry.create(name, 11))).toEqual(run(registry.create(name, 11)));
    }
  });
});

describe('catch game', () => {
  it('rewards catches (+1) and misses (−1) at the bottom row', () => {
    const game = createCatchGame({ seed: 3 });
    let catches = 0;
    let misses = 0;
    for (let t = 0; t < 60 && !game.state().terminal; t++) {
      const outcome = play(game, '1');
      if (outcome.reward === 1) catches++;
      if (outcome.reward === -1) misses++;
    }
    expect(catches + misses).toBeGreaterThan(0);
    expect(game.state().terminal).toBe(true);
  });

  it('paddle stays in bounds', () => {
    const game = createCatchGame({ seed: 5 });
    for (let t = 0; t < 30 && !game.state().terminal; t++) play(game, '0');
    expect(game.state().paddleC).toBeGreaterThanOrEqual(0);
  });
});

describe('arithmetic game', () => {
  it('every question offers exactly one correct candidate; distractors differ', () => {
    const game = createArithmeticGame({ seed: 9, questions: 20 });
    for (let t = 0; t < 20 && !game.state().terminal; t++) {
      const features = game.observe().features!;
      const candidates = Object.entries(features)
        .filter(([k]) => k.startsWith('option'))
        .map(([, v]) => v as number);
      expect(candidates.length).toBe(4);
      const correct = features.op === 0 ? features.a! + features.b! : features.a! - features.b!;
      expect(candidates.filter((v) => v === correct).length).toBe(1);
      game.step(candidates.indexOf(correct) as never);
    }
    expect(game.state().terminal).toBe(true);
  });

  it('scores correct answers +1, wrong 0', () => {
    const game = createArithmeticGame({ seed: 9, questions: 2 });
    const correctOf = (f: Record<string, number>): number => (f.op === 0 ? f.a! + f.b! : f.a! - f.b!);
    const candidatesOf = (f: Record<string, number>): number[] =>
      Object.entries(f).filter(([k]) => k.startsWith('option')).map(([, v]) => v as number);
    const q1 = game.observe().features!;
    expect(play(game, String(candidatesOf(q1).indexOf(correctOf(q1)))).reward).toBe(1);
    const q2 = game.observe().features!;
    const wrongIndex = (candidatesOf(q2).indexOf(correctOf(q2)) + 1) % candidatesOf(q2).length;
    expect(play(game, String(wrongIndex)).reward).toBe(0);
  });
});

describe('rps game', () => {
  it('pays +1/0/−1 by win/draw/loss against the rotating opponent', () => {
    const game = createRPSGame({ seed: 4, rounds: 9, rotation: 1 });
    const rewards: number[] = [];
    for (let t = 0; t < 9 && !game.state().terminal; t++) {
      rewards.push(play(game, '1').reward); // always paper
    }
    expect(rewards).toEqual(expect.arrayContaining([1, -1, 0])); // opponent rotates through all throws
    expect(game.state().terminal).toBe(true);
  });

  it('same seed ⇒ identical opponent sequence', () => {
    const a = createRPSGame({ seed: 6, rounds: 3 });
    const b = createRPSGame({ seed: 6, rounds: 3 });
    expect(a.state().opponentThrow).toBe(b.state().opponentThrow);
  });
});

describe('gridworld (no Env layer)', () => {
  it('walls block movement and the goal pays +1', () => {
    // Wall right of start forces the down→down→right→right path.
    const game = createGridWorldGame({ id: 'g', grid: ['S#.', '..G'], seed: 1 });
    expect(game.observe().stateId).toBe('0,0');
    const legal = game.legalActions(game.state());
    expect(legal).not.toContain(1); // wall to the right
    for (const action of [2, 1, 1]) game.step(action as never);
    expect(game.observe().stateId).toBe('1,2');
    expect(game.state().terminal).toBe(true);
  });

  it('maxSteps caps the episode', () => {
    const game = createGridWorldGame({ id: 'g', grid: ['S..', '..G'], seed: 1, maxSteps: 3 });
    for (let t = 0; t < 3; t++) game.step(2 as never);
    expect(game.state().terminal).toBe(true);
  });
});
