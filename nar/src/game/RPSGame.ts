import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export interface RPSGameConfig {
  seed: number;
  /** Rounds per episode (one step per round). */
  rounds?: number;
  /** The opponent's throw rotates this many positions per round (0 = fixed). */
  rotation?: number;
  id?: string;
}

/** Rock=0, Paper=1, Scissors=2: P beats R, S beats P, R beats S. */
export interface RPSState {
  round: number;
  opponentThrow: number;
  terminal: boolean;
}

/**
 * Repeated rock-paper-scissors against a deterministic rotating opponent —
 * a stationary, learnable policy (+1 win, 0 draw, −1 loss) for testing
 * exploitation of structured non-stationarity.
 */
export class RPSGame implements Game<RPSState, number> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private readonly rounds: number;
  private readonly rotation: number;
  private readonly opponentOffset: number;
  private round = 0;
  private terminal_ = false;

  constructor(config: RPSGameConfig) {
    this.id = config.id ?? 'rps';
    this.rng = new SeededRNG(config.seed);
    this.rounds = config.rounds ?? 30;
    this.rotation = config.rotation ?? 1;
    this.opponentOffset = this.rng.nextInt(3);
  }

  /** The opponent's throw this round (before the agent acts). */
  private opponentThrow(): number {
    return (this.opponentOffset + this.round * this.rotation) % 3;
  }

  observe(): Perception {
    return {
      stateId: `r${this.round}`,
      features: { round: this.round, opponent: this.opponentThrow() },
      confidence: 1.0,
      terminal: this.terminal_,
    };
  }

  state(): RPSState {
    return { round: this.round, opponentThrow: this.opponentThrow(), terminal: this.terminal_ };
  }

  legalActions(): number[] {
    return [0, 1, 2];
  }

  step(action: number): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true, info: { reason: 'terminal' } };
    const opponent = this.opponentThrow();
    const diff = ((action - opponent) % 3 + 3) % 3; // 1 = agent beats opponent, 2 = loses
    const reward = diff === 1 ? 1 : diff === 2 ? -1 : 0;
    this.round++;
    if (this.round >= this.rounds) this.terminal_ = true;
    return { reward, terminal: this.terminal_ };
  }

  render(): string {
    const names = ['rock', 'paper', 'scissors'];
    return `round ${this.round}/${this.rounds}, opponent shows ${names[this.opponentThrow()]}`;
  }
}

export function createRPSGame(config: RPSGameConfig): RPSGame {
  return new RPSGame(config);
}
