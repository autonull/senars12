import type { Game, GameOutcome, Perception } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';
import { SeededRNG, shuffleInPlace } from '@senars/util/random';

export type Cell = { r: number; c: number };
export type Direction = 0 | 1 | 2 | 3; // up, right, down, left

const DELTAS: Record<Direction, Cell> = {
  0: { r: -1, c: 0 },
  1: { r: 0, c: 1 },
  2: { r: 1, c: 0 },
  3: { r: 0, c: -1 },
};
const OPPOSITE: Record<Direction, Direction> = { 0: 2, 1: 3, 2: 0, 3: 1 };

export interface SnakeState {
  snake: Cell[];
  apple: Cell;
  dir: Direction;
  steps: number;
  terminal: boolean;
}

export interface SnakeGameConfig extends GameConfig {
  width?: number;
  height?: number;
}

export class SnakeGame extends GameBase<SnakeState, Direction> {
  readonly width: number;
  readonly height: number;
  private readonly spawnBag: Cell[] = [];
  private snake: Cell[];
  private apple: Cell;
  private dir: Direction;
  private steps = 0;
  private terminal_ = false;

  constructor(config: SnakeGameConfig = {}) {
    super(config.id ?? 'snake', { ...config, maxSteps: config.maxSteps ?? 200 });
    this.width = config.width ?? 8;
    this.height = config.height ?? 8;
    const mid = Math.floor(this.height / 2);
    this.snake = [
      { r: mid, c: 4 },
      { r: mid, c: 3 },
      { r: mid, c: 2 },
    ];
    this.dir = 1;
    this.apple = this.spawnApple();
  }

  protected override getInitialState(): SnakeState {
    const mid = Math.floor(this.height / 2);
    const snake: Cell[] = [
      { r: mid, c: 4 },
      { r: mid, c: 3 },
      { r: mid, c: 2 },
    ];
    const state: SnakeState = { snake, apple: { r: 0, c: 0 }, dir: 1, steps: 0, terminal: false };
    state.apple = this.spawnApple();
    return state;
  }

  protected override getStateId(state: SnakeState): string {
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill('.'));
    for (const seg of state.snake) grid[seg.r]![seg.c] = 'o';
    grid[state.apple.r]![state.apple.c] = 'A';
    return grid.map((row) => row.join('')).join('|') + `#${state.dir}`;
  }

  /** Bag-7-style spawn: shuffled bag of free cells, refilled when exhausted. */
  private spawnApple(): Cell {
    const free = new Set<string>();
    for (let r = 0; r < this.height; r++)
      for (let c = 0; c < this.width; c++) free.add(`${r},${c}`);
    for (const s of this.snake) free.delete(`${s.r},${s.c}`);
    if (free.size === 0) return this.apple;

    let next = this.spawnBag.pop();
    while (next && !free.has(`${next.r},${next.c}`)) next = this.spawnBag.pop();
    if (next) return next;

    const cells = [...free].map((k): Cell => {
      const [r, c] = k.split(',').map(Number) as [number, number];
      return { r, c };
    });
    this.spawnBag.push(...shuffleInPlace(cells, this.rng.source));
    return this.spawnBag.pop()!;
  }

  private hits(next: Cell): boolean {
    if (next.r < 0 || next.c < 0 || next.r >= this.height || next.c >= this.width) return true;
    // The tail vacates unless the snake is growing, so the last segment is not
    // in the way — walked by index rather than sliced, because this runs once
    // per direction per step over a body that reaches the whole grid.
    for (let i = 0, end = this.snake.length - 1; i < end; i++) {
      const seg = this.snake[i]!;
      if (seg.r === next.r && seg.c === next.c) return true;
    }
    return false;
  }

  override step(action: Direction): GameOutcome {
    if (this.terminal_ || !this.legalActions(this.state()).includes(action))
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };

    const d = DELTAS[action];
    const head = { r: this.snake[0]!.r + d.r, c: this.snake[0]!.c + d.c };
    const eats = head.r === this.apple.r && head.c === this.apple.c;
    if (!eats) this.snake.pop();
    this.snake.unshift(head);
    this.dir = action;
    this.steps++;
    this.incrementStep();

    let reward = 0;
    if (eats) {
      reward = 1;
      this.apple = this.spawnApple();
    }
    if (this.snake.length === this.width * this.height) this.terminal_ = true;
    if (this.steps >= this.maxSteps) this.terminal_ = true;

    return {
      reward,
      terminal: this.terminal_,
      info: { steps: this.steps, length: this.snake.length },
    };
  }

  override isTerminal(state: SnakeState): boolean {
    return state.terminal;
  }

  override legalActions(state: SnakeState): Direction[] {
    if (state.terminal) return [];
    const out: Direction[] = [];
    for (const dir of [0, 1, 2, 3] as Direction[]) {
      if (dir === OPPOSITE[state.dir] && state.snake.length > 1) continue;
      const d = DELTAS[dir];
      if (!this.hits({ r: state.snake[0]!.r + d.r, c: state.snake[0]!.c + d.c })) out.push(dir);
    }
    return out.length > 0 ? out : [1];
  }

  override state(): SnakeState {
    return {
      snake: this.snake.map((s) => ({ ...s })),
      apple: { ...this.apple },
      dir: this.dir,
      steps: this.steps,
      terminal: this.terminal_,
    };
  }

  override observe(): Perception {
    const head = this.snake[0]!;
    return {
      stateId: this.getStateId(this.state()),
      features: {
        headR: head.r,
        headC: head.c,
        appleR: this.apple.r,
        appleC: this.apple.c,
        length: this.snake.length,
        dir: this.dir,
        steps: this.steps,
      },
      confidence: 1,
      terminal: this.terminal_,
    };
  }

  override reset(): SnakeState {
    const mid = Math.floor(this.height / 2);
    this.snake = [
      { r: mid, c: 4 },
      { r: mid, c: 3 },
      { r: mid, c: 2 },
    ];
    this.dir = 1;
    this.steps = 0;
    this.terminal_ = false;
    this.stepCount = 0;
    this.spawnBag.length = 0;
    this.apple = this.spawnApple();
    return this.getInitialState();
  }

  stateKey(): string {
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill('.'));
    for (const seg of this.snake) grid[seg.r]![seg.c] = 'o';
    grid[this.apple.r]![this.apple.c] = 'A';
    return grid.map((row) => row.join('')).join('|') + `#${this.dir}`;
  }

  render(): string {
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill('.'));
    for (const seg of this.snake) grid[seg.r]![seg.c] = 'o';
    grid[this.snake[0]!.r]![this.snake[0]!.c] = '@';
    grid[this.apple.r]![this.apple.c] = 'A';
    return grid.map((row) => row.join(' ')).join('\n');
  }

  /** Deep copy (rng + spawn bag included) for baseline lookahead. */
  clone(): SnakeGame {
    const copy = new SnakeGame({
      id: this.id,
      width: this.width,
      height: this.height,
      seed: 1,
      maxSteps: this.maxSteps,
    });
    copy.snake = this.snake.map((s) => ({ ...s }));
    copy.apple = { ...this.apple };
    copy.dir = this.dir;
    copy.steps = this.steps;
    copy.terminal_ = this.terminal_;
    copy.stepCount = this.stepCount;
    copy.rng = new SeededRNG(this.seed);
    for (let i = 0; i < this.stepCount; i++) copy.rng.next();
    copy.spawnBag.push(...this.spawnBag);
    return copy;
  }
}

export function createSnakeGame(config: SnakeGameConfig = {}): SnakeGame {
  return new SnakeGame(config);
}