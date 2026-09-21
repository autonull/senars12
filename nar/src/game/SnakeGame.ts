import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export type Cell = { r: number; c: number };
export type Direction = 0 | 1 | 2 | 3; // up, right, down, left

const DELTAS: Record<Direction, Cell> = { 0: { r: -1, c: 0 }, 1: { r: 0, c: 1 }, 2: { r: 1, c: 0 }, 3: { r: 0, c: -1 } };
const OPPOSITE: Record<Direction, Direction> = { 0: 2, 1: 3, 2: 0, 3: 1 };

export interface SnakeState {
  snake: Cell[];
  apple: Cell;
  dir: Direction;
  steps: number;
  terminal: boolean;
}

export interface SnakeGameConfig {
  id?: string;
  width?: number;
  height?: number;
  seed?: number;
  maxSteps?: number;
}

export class SnakeGame implements Game<SnakeState, Direction> {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  private readonly maxSteps: number;
  private readonly rng: SeededRNG;
  private readonly spawnBag: Cell[] = [];
  private state_: SnakeState;

  constructor(config: SnakeGameConfig = {}) {
    this.id = config.id ?? 'snake';
    this.width = config.width ?? 8;
    this.height = config.height ?? 8;
    this.maxSteps = config.maxSteps ?? 200;
    this.rng = new SeededRNG(config.seed ?? 1);
    this.state_ = this.initialState();
  }

  private initialState(): SnakeState {
    const mid = Math.floor(this.height / 2);
    const snake: Cell[] = [
      { r: mid, c: 4 },
      { r: mid, c: 3 },
      { r: mid, c: 2 },
    ];
    const state: SnakeState = { snake, apple: { r: 0, c: 0 }, dir: 1, steps: 0, terminal: false };
    state.apple = this.spawnApple(state);
    return state;
  }

  /** Bag-7-style spawn: shuffled bag of free cells, refilled when exhausted. */
  private spawnApple(state: SnakeState): Cell {
    const free = new Set<string>();
    for (let r = 0; r < this.height; r++)
      for (let c = 0; c < this.width; c++) free.add(`${r},${c}`);
    for (const s of state.snake) free.delete(`${s.r},${s.c}`);
    if (free.size === 0) return state.apple;

    let next = this.spawnBag.pop();
    while (next && !free.has(`${next.r},${next.c}`)) next = this.spawnBag.pop();
    if (next) return next;

    const cells = [...free].map((k): Cell => {
      const [r, c] = k.split(',').map(Number) as [number, number];
      return { r, c };
    });
    for (let i = cells.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(i + 1);
      [cells[i], cells[j]] = [cells[j]!, cells[i]!];
    }
    this.spawnBag.push(...cells);
    return this.spawnBag.pop()!;
  }

  reset(): void {
    this.state_ = this.initialState();
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
    copy.state_ = { snake: this.state_.snake.map((s) => ({ ...s })), apple: { ...this.state_.apple }, dir: this.state_.dir, steps: this.state_.steps, terminal: this.state_.terminal };
    copy.rng.setState(this.rng.getState());
    copy.spawnBag.push(...this.spawnBag);
    return copy;
  }

  state(): SnakeState {
    return this.state_;
  }

  private hits(next: Cell, state: SnakeState): boolean {
    if (next.r < 0 || next.c < 0 || next.r >= this.height || next.c >= this.width) return true;
    const body = state.snake.slice(0, -1); // tail vacates unless growing
    return body.some((s) => s.r === next.r && s.c === next.c);
  }

  legalActions(state: SnakeState): Direction[] {
    if (state.terminal) return [];
    const out: Direction[] = [];
    for (const dir of [0, 1, 2, 3] as Direction[]) {
      if (dir === OPPOSITE[state.dir] && state.snake.length > 1) continue;
      const d = DELTAS[dir];
      if (!this.hits({ r: state.snake[0]!.r + d.r, c: state.snake[0]!.c + d.c }, state)) out.push(dir);
    }
    return out;
  }

  step(action: Direction): GameOutcome {
    const state = this.state_;
    if (state.terminal || !this.legalActions(state).includes(action))
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };

    const d = DELTAS[action];
    const head = { r: state.snake[0]!.r + d.r, c: state.snake[0]!.c + d.c };
    const eats = head.r === state.apple.r && head.c === state.apple.c;
    if (!eats) state.snake.pop();
    state.snake.unshift(head);
    state.dir = action;
    state.steps++;

    let reward = 0;
    if (eats) {
      reward = 1;
      state.apple = this.spawnApple(state);
    }
    if (state.snake.length === this.width * this.height) state.terminal = true;
    if (state.steps >= this.maxSteps) state.terminal = true;

    return { reward, terminal: state.terminal, info: { steps: state.steps, length: state.snake.length } };
  }

  observe(): Perception {
    const s = this.state_;
    const head = s.snake[0]!;
    return {
      stateId: this.stateKey(),
      features: {
        headR: head.r,
        headC: head.c,
        appleR: s.apple.r,
        appleC: s.apple.c,
        length: s.snake.length,
        dir: s.dir,
        steps: s.steps,
      },
      confidence: 1,
      terminal: s.terminal,
    };
  }

  stateKey(): string {
    const s = this.state_;
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill('.'));
    for (const seg of s.snake) grid[seg.r]![seg.c] = 'o';
    grid[s.apple.r]![s.apple.c] = 'A';
    return grid.map((row) => row.join('')).join('|') + `#${s.dir}`;
  }

  render(): string {
    const s = this.state_;
    const grid = Array.from({ length: this.height }, () => Array(this.width).fill('.'));
    for (const seg of s.snake) grid[seg.r]![seg.c] = 'o';
    grid[s.snake[0]!.r]![s.snake[0]!.c] = '@';
    grid[s.apple.r]![s.apple.c] = 'A';
    return grid.map((row) => row.join(' ')).join('\n');
  }
}

export function createSnakeGame(config: SnakeGameConfig = {}): SnakeGame {
  return new SnakeGame(config);
}
