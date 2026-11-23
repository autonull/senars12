import { clamp } from '@senars/util/numeric';
import { SeededRNG } from '@senars/util/random';
import type { Game, GameOutcome, Perception } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';
import { renderGrid } from '../render';

export interface CatchGameConfig extends GameConfig {
  cols?: number;
  rows?: number;
  maxSteps?: number;
}

/**
 * Catch: a target falls one row per step from a random column; the paddle
 * moves left/stay/right along the bottom row. +1 per catch, −1 per miss;
 * terminal at the step cap.
 */
export class CatchGame extends GameBase<CatchState, 0 | 1 | 2> {
  private readonly cols: number;
  private readonly rows: number;
  private paddleC: number;
  private targetR = 0;
  private targetC = 0;
  private terminal_ = false;

  constructor(config: CatchGameConfig) {
    super(config.id ?? 'catch', { ...config, maxSteps: config.maxSteps ?? 60 });
    this.cols = config.cols ?? 7;
    this.rows = config.rows ?? 5;
    this.paddleC = (this.cols - 1) >> 1;
    this.spawnTarget();
  }

  protected override getInitialState(): CatchState {
    return {
      paddleC: this.paddleC,
      targetR: this.targetR,
      targetC: this.targetC,
      step: 0,
      terminal: false,
    };
  }

  protected override getStateId(state: CatchState): string {
    return `p${state.paddleC}-t${state.targetR},${state.targetC}`;
  }

  override step(action: 0 | 1 | 2): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true, info: { reason: 'terminal' } };
    this.paddleC = clamp(
      this.paddleC + (action === 0 ? -1 : action === 2 ? 1 : 0),
      0,
      this.cols - 1
    );
    this.targetR++;
    this.incrementStep();
    let reward = 0;
    if (this.targetR === this.rows - 1) {
      reward = this.targetC === this.paddleC ? 1 : -1;
      this.spawnTarget();
    }
    if (this.stepCount >= this.maxSteps) this.terminal_ = true;
    return { reward, terminal: this.terminal_ };
  }

  override isTerminal(state: CatchState): boolean {
    return state.terminal;
  }

  override legalActions(_state: CatchState): Array<0 | 1 | 2> {
    const moves: Array<0 | 1 | 2> = [0, 1, 2];
    const legal = moves.filter((a) => {
      const c = this.paddleC + (a === 0 ? -1 : a === 2 ? 1 : 0);
      return c >= 0 && c < this.cols;
    });
    return legal.length > 0 ? legal : [1];
  }

  override state(): CatchState {
    return {
      paddleC: this.paddleC,
      targetR: this.targetR,
      targetC: this.targetC,
      step: this.stepCount,
      terminal: this.terminal_,
    };
  }

  override observe(): Perception {
    return {
      stateId: this.getStateId(this.state()),
      features: {
        paddle: this.paddleC,
        targetR: this.targetR,
        targetC: this.targetC,
        closing: this.targetR - (this.rows - 1),
      },
      confidence: 1.0,
      terminal: this.terminal_,
    };
  }

  override reset(): CatchState {
    this.paddleC = (this.cols - 1) >> 1;
    this.terminal_ = false;
    this.stepCount = 0;
    this.spawnTarget();
    return this.getInitialState();
  }

  render(): string {
    return renderGrid(this.rows, this.cols, (r, c) =>
      r === this.targetR && c === this.targetC
        ? 'o'
        : r === this.rows - 1 && c === this.paddleC
          ? 'A'
          : '.'
    );
  }

  private spawnTarget(): void {
    this.targetR = 0;
    this.targetC = this.rng.nextInt(this.cols);
  }
}

export interface CatchState {
  paddleC: number;
  targetR: number;
  targetC: number;
  step: number;
  terminal: boolean;
}

export function createCatchGame(config: CatchGameConfig): CatchGame {
  return new CatchGame(config);
}