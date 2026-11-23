import type { Game, GameOutcome, Perception } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';
import { SeededRNG } from '@senars/util/random';

export interface RPSGameConfig extends GameConfig {
  /** Rounds per episode (one step per round). */
  rounds?: number;
  /** The opponent's throw rotates this many positions per round (0 = fixed). */
  rotation?: number;
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
export class RPSGame extends GameBase<RPSState, number> {
  private readonly rounds: number;
  private readonly rotation: number;
  private readonly opponentOffset: number;
  private round = 0;
  private terminal_ = false;

  constructor(config: RPSGameConfig) {
    super(config.id ?? 'rps', config);
    this.rounds = config.rounds ?? 30;
    this.rotation = config.rotation ?? 1;
    this.opponentOffset = this.rng.nextInt(3);
  }

  protected override getInitialState(): RPSState {
    return { round: 0, opponentThrow: this.opponentOffset % 3, terminal: false };
  }

  protected override getStateId(state: RPSState): string {
    return `r${state.round}`;
  }

  /** The opponent's throw this round (before the agent acts). */
  private opponentThrow(): number {
    return (this.opponentOffset + this.round * this.rotation) % 3;
  }

  override step(action: number): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true, info: { reason: 'terminal' } };
    const opponent = this.opponentThrow();
    const diff = (((action - opponent) % 3) + 3) % 3; // 1 = agent beats opponent, 2 = loses
    const reward = diff === 1 ? 1 : diff === 2 ? -1 : 0;
    this.round++;
    this.incrementStep();
    if (this.round >= this.rounds) this.terminal_ = true;
    return { reward, terminal: this.terminal_ };
  }

  override isTerminal(state: RPSState): boolean {
    return state.terminal;
  }

  override legalActions(_state: RPSState): number[] {
    return [0, 1, 2];
  }

  override state(): RPSState {
    return { round: this.round, opponentThrow: this.opponentThrow(), terminal: this.terminal_ };
  }

  override observe(): Perception {
    return {
      stateId: this.getStateId(this.state()),
      features: { round: this.round, opponent: this.opponentThrow() },
      confidence: 1.0,
      terminal: this.terminal_,
    };
  }

  override reset(): RPSState {
    this.round = 0;
    this.terminal_ = false;
    this.stepCount = 0;
    return this.getInitialState();
  }

  render(): string {
    const names = ['rock', 'paper', 'scissors'];
    return `round ${this.round}/${this.rounds}, opponent shows ${names[this.opponentThrow()]}`;
  }
}

export function createRPSGame(config: RPSGameConfig): RPSGame {
  return new RPSGame(config);
}