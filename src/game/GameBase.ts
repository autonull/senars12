/**
 * GameBase — abstract base class for all games.
 *
 * Eliminates duplication across 14 game implementations.
 * New game = ~30 lines implementing 4 abstract methods.
 * Unified serialization, replay, and testing work automatically.
 */

import { SeededRNG } from '@senars/util/random';
import type { Game, GameOutcome, Perception } from './Game';

export interface GameConfig {
  seed?: number;
  /** Optional: max steps per episode (default: 1000) */
  maxSteps?: number;
  /** Game-specific config (passed through to subclass) */
  [key: string]: unknown;
  id?: string;
}

/** Serialized game state for replay/persistence. */
export interface SerializedGame<State = unknown> {
  gameId: string;
  seed: number;
  stepCount: number;
  state: State;
  config: GameConfig;
}

export abstract class GameBase<State, Action> implements Game<State, Action> {
  readonly id: string;
  protected rng: SeededRNG;
  protected stepCount = 0;
  protected seed: number;
  protected readonly maxSteps: number;

  constructor(id: string, config: GameConfig = {}) {
    this.id = id;
    this.seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.maxSteps = config.maxSteps ?? 1000;
    this.rng = new SeededRNG(this.seed);
  }

  /** Create initial game state. */
  protected abstract getInitialState(): State;

  /** Apply action and return outcome. */
  abstract step(action: Action): GameOutcome;

  /** Check if state is terminal. */
  abstract isTerminal(state: State): boolean;

  /** Get legal actions for a state. */
  abstract legalActions(state: State): Action[];

  /** Current game state. */
  abstract state(): State;

  /** Current perception (for RL agents). */
  observe(): Perception {
    const s = this.state();
    return {
      stateId: this.getStateId(s),
      terminal: this.isTerminal(s),
    };
  }

  /** Convert state to a string ID for perception/embedding. */
  protected abstract getStateId(state: State): string;

  /** Reset game to initial state. Does NOT reseed RNG (use reseed() for that). */
  reset(): State {
    this.stepCount = 0;
    return this.getInitialState();
  }

  /** Explicitly reseed the RNG. */
  reseed(seed?: number): void {
    this.seed = seed ?? this.seed;
    this.rng = new SeededRNG(this.seed);
    this.stepCount = 0;
  }

  /** Serialize game for replay/persistence. */
  serialize(): SerializedGame<State> {
    return {
      gameId: this.id,
      seed: this.seed,
      stepCount: this.stepCount,
      state: this.state(),
      config: { seed: this.seed, maxSteps: this.maxSteps },
    };
  }

  /** Deserialize game from serialized state. */
  static deserialize<State, Action>(
    data: SerializedGame<State>,
    createGame: (config: GameConfig) => GameBase<State, Action>
  ): GameBase<State, Action> {
    const game = createGame({ seed: data.seed, maxSteps: data.config.maxSteps });
    game.stepCount = data.stepCount;
    game.rng = new SeededRNG(data.seed);
    // Advance RNG to correct position
    for (let i = 0; i < data.stepCount; i++) {
      game.rng.next();
    }
    // Note: subclasses must implement state restoration
    return game;
  }

  /** Get current step count. */
  getStepCount(): number {
    return this.stepCount;
  }

  /** Get RNG for subclasses that need it. */
  protected getRNG(): SeededRNG {
    return this.rng;
  }

  /** Increment step counter (called by step implementations). */
  protected incrementStep(): void {
    this.stepCount++;
  }
}

/** Game factory type for deserialization. */
export type GameFactory<State, Action> = (config: GameConfig) => GameBase<State, Action>;