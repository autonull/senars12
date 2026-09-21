import type { Game } from './Game.js';
import { createArithmeticGame } from './ArithmeticGame.js';
import { createBanditGame } from './BanditGame.js';
import { createCatchGame } from './CatchGame.js';
import { createGame2048 } from './Game2048.js';
import { createGridWorldGame } from './GridWorldGame.js';
import { createRPSGame } from './RPSGame.js';
import { createSnakeGame } from './SnakeGame.js';
import { createTetrisGame } from './TetrisGame.js';
import { createTicTacToeGame } from './TicTacToe.js';
import { createReasoningGame, REASONING_SPECS } from '../cognition/ReasoningGame.js';

/** A named `Game` factory in the playable-games collection. */
export interface GameSpec {
  /** Arcade identifier (snake, bandit, …). */
  readonly name: string;
  /** One-line description: what the agent controls, its actions, its rewards. */
  readonly description: string;
  /** Action-space legend for LM decision prompts and docs. */
  readonly actionLegend: string;
  /** Deterministic factory — same seed, same episode. */
  create(seed: number): Game;
}

/** Thrown for an unknown game name; callers fail loudly, never silently skip. */
export class UnknownGameError extends Error {
  constructor(name: string, available: readonly string[]) {
    super(`unknown game '${name}' (available: ${available.join(', ')})`);
    this.name = 'UnknownGameError';
  }
}

/** Open registry of playable games — adding a game is implementing `Game` + one spec. */
export class GameRegistry {
  private readonly specs = new Map<string, GameSpec>();

  register(spec: GameSpec): this {
    this.specs.set(spec.name, spec);
    return this;
  }

  has(name: string): boolean {
    return this.specs.has(name);
  }

  get(name: string): GameSpec | undefined {
    return this.specs.get(name);
  }

  names(): string[] {
    return [...this.specs.keys()];
  }

  create(name: string, seed: number): Game {
    const spec = this.specs.get(name);
    if (!spec) throw new UnknownGameError(name, this.names());
    return spec.create(seed);
  }
}

/** The default arcade collection: every shipped game with its demo config. */
export function createArcadeRegistry(): GameRegistry {
  return registerReasoningGames(
  new GameRegistry()
    .register({
      name: 'snake',
      description: 'Snake on a bounded grid eats apples (+1); body/wall hits end the episode.',
      actionLegend: 'Actions: 0=up, 1=right, 2=down, 3=left. Goal: reach the apple (headR/appleR, headC/appleC converge). Never reverse into your own body.',
      create: (seed) => createSnakeGame({ seed, maxSteps: 120 }),
    })
    .register({
      name: 'tetris',
      description: 'Tetris placements (hard drop); clear lines score, topping out ends the episode.',
      actionLegend: 'Actions: place:r<rotation>:c<column> hard-drops the piece; illegal placements are excluded from legalActions.',
      create: (seed) => createTetrisGame({ seed, width: 10, height: 10, pieceCap: 30 }),
    })
    .register({
      name: '2048',
      description: 'Slide tiles to merge equals; illegal (no-op) moves end the episode.',
      actionLegend: 'Actions: 0=left, 1=up, 2=right, 3=down.',
      create: (seed) => createGame2048({ seed }),
    })
    .register({
      name: 'tictactoe',
      description: 'X vs a built-in opponent; +1 win, 0 draw, −1 loss.',
      actionLegend: 'Actions: empty cell 0-8 (row-major, 0=top-left).',
      create: (seed) => createTicTacToeGame({ seed }),
    })
    .register({
      name: 'gridworld',
      description: 'Grid maze to the goal (+1); each non-goal step costs −0.01.',
      actionLegend: 'Actions: 0=up, 1=right, 2=down, 3=left (clamped at edges; walls block).',
      create: (seed) => createGridWorldGame({ id: 'grid', grid: ['S..', '..G'], seed }),
    })
    .register({
      name: 'bandit',
      description: 'Multi-armed bandit, Bernoulli rewards with known arm means.',
      actionLegend: 'Actions: arm index 0..N-1; reward 1/0 Bernoulli per arm mean.',
      create: (seed) => createBanditGame({ seed, numArms: 3, armMeans: [0.2, 0.5, 0.8] }),
    })
    .register({
      name: 'catch',
      description: 'Catch falling targets with the paddle: +1 catch, −1 miss.',
      actionLegend: 'Actions: 0=left, 1=stay, 2=right; target o falls one row per step, paddle A on the bottom row.',
      create: (seed) => createCatchGame({ seed }),
    })
    .register({
      name: 'arithmetic',
      description: 'Answer a+b / a−b by picking a candidate: +1 correct, 0 wrong.',
      actionLegend: 'Actions: index of the answer candidate (values in the optionN features).',
      create: (seed) => createArithmeticGame({ seed }),
    })
    .register({
      name: 'rps',
      description: 'Repeated rock-paper-scissors vs a rotating deterministic opponent.',
      actionLegend: 'Actions: 0=rock, 1=paper, 2=scissors; +1 beats the opponent, 0 draw, −1 loss.',
      create: (seed) => createRPSGame({ seed }),
    })
);
}

/** R1: ReasoningGame domain presets, assembled from the cognition library. */
export const registerReasoningGames = (registry: GameRegistry): GameRegistry => {
  for (const spec of Object.values(REASONING_SPECS)) {
    registry.register({
      name: spec.id,
      description: `ReasoningGame (${spec.id}): cognitive operations over an eval task suite.`,
      actionLegend:
        'Actions: cycle, revise, spawn_subgoal, clarify, consolidate, ask_lm, rest, settle, finish — tier-gated (ask_lm requires tier ≥ 2).',
      create: (seed) => createReasoningGame(spec, seed),
    });
  }
  return registry;
};

