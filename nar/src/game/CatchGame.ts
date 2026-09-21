import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export interface CatchGameConfig {
  seed: number;
  cols?: number;
  rows?: number;
  maxSteps?: number;
  id?: string;
}

/**
 * Catch: a target falls one row per step from a random column; the paddle
 * moves left/stay/right along the bottom row. +1 per catch, −1 per miss;
 * terminal at the step cap.
 */
export class CatchGame implements Game<CatchState, 0 | 1 | 2> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private readonly cols: number;
  private readonly rows: number;
  private readonly maxSteps: number;
  private paddleC: number;
  private targetR = 0;
  private targetC = 0;
  private stepCount = 0;
  private terminal_ = false;

  constructor(config: CatchGameConfig) {
    this.id = config.id ?? 'catch';
    this.rng = new SeededRNG(config.seed);
    this.cols = config.cols ?? 7;
    this.rows = config.rows ?? 5;
    this.maxSteps = config.maxSteps ?? 60;
    this.paddleC = (this.cols - 1) >> 1;
    this.spawnTarget();
  }

  observe(): Perception {
    return {
      stateId: `p${this.paddleC}-t${this.targetR},${this.targetC}`,
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

  state(): CatchState {
    return { paddleC: this.paddleC, targetR: this.targetR, targetC: this.targetC, step: this.stepCount, terminal: this.terminal_ };
  }

  legalActions(): Array<0 | 1 | 2> {
    const moves: Array<0 | 1 | 2> = [0, 1, 2];
    const legal = moves.filter((a) => {
      const c = this.paddleC + (a === 0 ? -1 : a === 2 ? 1 : 0);
      return c >= 0 && c < this.cols;
    });
    return legal.length > 0 ? legal : [1];
  }

  step(action: 0 | 1 | 2): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true, info: { reason: 'terminal' } };
    this.paddleC = Math.max(0, Math.min(this.cols - 1, this.paddleC + (action === 0 ? -1 : action === 2 ? 1 : 0)));
    this.targetR++;
    this.stepCount++;
    let reward = 0;
    if (this.targetR === this.rows - 1) {
      reward = this.targetC === this.paddleC ? 1 : -1;
      this.spawnTarget();
    }
    if (this.stepCount >= this.maxSteps) this.terminal_ = true;
    return { reward, terminal: this.terminal_ };
  }

  render(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        if (r === this.targetR && c === this.targetC) line += 'o';
        else if (r === this.rows - 1 && c === this.paddleC) line += 'A';
        else line += '.';
      }
      lines.push(line);
    }
    return lines.join('\n');
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
