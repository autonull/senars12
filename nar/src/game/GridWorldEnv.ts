export interface GridWorldConfig {
  grid: string[];
  seed: number;
  maxSteps?: number;
}

export type GridAction = 0 | 1 | 2 | 3;

export interface GridWorldState {
  row: number;
  col: number;
}

export class SeededRNG {
  private state: number;

  constructor(seed: number = 1) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export class GridWorldEnv {
  private rng: SeededRNG;
  private readonly grid: string[][];
  readonly rows: number;
  readonly cols: number;
  readonly startPos!: GridWorldState;
  readonly goalPos!: GridWorldState;
  currentPos: GridWorldState;
  private stepCount = 0;
  readonly maxSteps: number;
  readonly walls: Set<string>;

  constructor(config: GridWorldConfig) {
    this.rng = new SeededRNG(config.seed);
    this.grid = config.grid.map((row) => row.split(''));
    this.rows = this.grid.length;
    this.cols = this.grid[0]!.length;
    this.maxSteps = config.maxSteps ?? 100;

    this.walls = new Set();
    let startFound = false;
    let goalFound = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r]?.[c] ?? ' ';
        if (cell === '#') this.walls.add(`${r},${c}`);
        else if (cell === 'S') {
          this.startPos = { row: r, col: c };
          startFound = true;
        } else if (cell === 'G') {
          this.goalPos = { row: r, col: c };
          goalFound = true;
        }
      }
    }
    if (!startFound || !goalFound) throw new Error('Grid must have S and G');
    this.currentPos = { ...this.startPos };
  }

  reset(): GridWorldState {
    this.currentPos = { ...this.startPos };
    this.stepCount = 0;
    return this.currentPos;
  }

  step(action: GridAction): { state: GridWorldState; reward: number; done: boolean } {
    this.stepCount++;
    const { row, col } = this.currentPos;
    let newRow = row;
    let newCol = col;

    switch (action) {
      case 0:
        newRow = Math.max(0, row - 1);
        break;
      case 1:
        newCol = Math.min(this.cols - 1, col + 1);
        break;
      case 2:
        newRow = Math.min(this.rows - 1, row + 1);
        break;
      case 3:
        newCol = Math.max(0, col - 1);
        break;
    }

    if (!this.walls.has(`${newRow},${newCol}`)) {
      this.currentPos = { row: newRow, col: newCol };
    }

    const done =
      this.currentPos.row === this.goalPos.row &&
      this.currentPos.col === this.goalPos.col;
    const reward = done ? 1 : -0.01;

    return { state: { ...this.currentPos }, reward, done: done || this.stepCount >= this.maxSteps };
  }

  getState(): GridWorldState {
    return { ...this.currentPos };
  }

  getNumActions(): number {
    return 4;
  }

  getStateKey(): string {
    return `${this.currentPos.row},${this.currentPos.col}`;
  }
}