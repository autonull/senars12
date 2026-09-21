import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export interface ArithmeticGameConfig {
  seed: number;
  /** Questions per episode (each question is one step). */
  questions?: number;
  /** Largest operand. */
  maxOperand?: number;
  /** Number of answer candidates (correct + distractors). */
  candidates?: number;
  id?: string;
}

export interface ArithmeticState {
  questionIndex: number;
  terminal: boolean;
}

/**
 * Arithmetic quiz: answer `a+b` or `a−b` by picking among shuffled candidates
 * (correct answer always present). +1 correct, 0 wrong; terminal after the
 * question budget — a per-step System One probe (numeric reasoning).
 */
export class ArithmeticGame implements Game<ArithmeticState, number> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private readonly questions: number;
  private readonly maxOperand: number;
  private readonly numCandidates: number;
  private questionIndex = 0;
  private operandA = 0;
  private operandB = 0;
  private op = 0;
  private correct = 0;
  private options: number[] = [];
  private terminal_ = false;

  constructor(config: ArithmeticGameConfig) {
    this.id = config.id ?? 'arithmetic';
    this.rng = new SeededRNG(config.seed);
    this.questions = config.questions ?? 10;
    this.maxOperand = config.maxOperand ?? 9;
    this.numCandidates = config.candidates ?? 4;
    this.nextQuestion();
  }

  observe(): Perception {
    const features: Record<string, number> = {
      a: this.operandA,
      b: this.operandB,
      op: this.op,
    };
    for (let i = 0; i < this.options.length; i++) features[`option${i}`] = this.options[i] ?? 0;
    return {
      stateId: `q${this.questionIndex}`,
      features,
      confidence: 1.0,
      terminal: this.terminal_,
    };
  }

  /** Rendered question text for LM decision prompts (not part of `Perception`). */
  questionText(): string {
    return `What is ${this.operandA} ${this.op === 0 ? '+' : '−'} ${this.operandB}?`;
  }

  state(): ArithmeticState {
    return { questionIndex: this.questionIndex, terminal: this.terminal_ };
  }

  legalActions(): number[] {
    return this.options.map((_, i) => i);
  }

  step(action: number): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true, info: { reason: 'terminal' } };
    const reward = this.options[action] === this.correct ? 1 : 0;
    this.questionIndex++;
    if (this.questionIndex >= this.questions) this.terminal_ = true;
    else this.nextQuestion();
    return { reward, terminal: this.terminal_ };
  }

  render(): string {
    return `${this.questionText()} options: ${this.options.join(' | ')}`;
  }

  private nextQuestion(): void {
    this.operandA = this.rng.nextInt(this.maxOperand + 1);
    this.operandB = this.rng.nextInt(this.maxOperand + 1);
    this.op = this.rng.nextInt(2);
    this.correct = this.op === 0 ? this.operandA + this.operandB : this.operandA - this.operandB;
    const distractors = new Set<number>();
    while (distractors.size < this.numCandidates - 1) {
      const delta = this.rng.nextInt(2 * this.maxOperand + 1) - this.maxOperand || 1;
      distractors.add(this.correct + delta);
    }
    this.options = [this.correct, ...distractors].map((value, i) => ({ value, k: this.rng.nextInt(1000) + i })).sort((a, b) => a.k - b.k).map(({ value }) => value);
  }
}

export function createArithmeticGame(config: ArithmeticGameConfig): ArithmeticGame {
  return new ArithmeticGame(config);
}
