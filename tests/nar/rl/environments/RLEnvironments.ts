/**
 * Seeded Random Number Generator for deterministic RL experiments
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number = 1) {
    this.state = seed >>> 0;
  }

  /** Returns random float in [0, 1) */
  next(): number {
    // LCG: X_n+1 = (a * X_n + c) mod m
    // Using Numerical Recipes parameters
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296; // 2^32
  }

  /** Returns random integer in [0, max) */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Returns random element from array */
  choice<T>(arr: T[]): T {
    return arr[this.nextInt(arr.length)];
  }

  /** Get current state for serialization */
  getState(): number {
    return this.state;
  }

  /** Set state for deserialization */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}

/** Simple Multi-Armed Bandit Environment */
export interface BanditEnvConfig {
  numArms: number;
  armMeans: number[]; // True reward means for each arm
  seed: number;
}

export class BanditEnv {
  private rng: SeededRNG;
  private readonly armMeans: number[];
  private readonly numArms: number;
  private stepCount = 0;

  constructor(config: BanditEnvConfig) {
    this.rng = new SeededRNG(config.seed);
    this.numArms = config.numArms;
    this.armMeans = config.armMeans;
  }

  reset(): void {
    this.stepCount = 0;
  }

  step(action: number): { reward: number; done: boolean } {
    if (action < 0 || action >= this.numArms) {
      throw new Error(`Invalid action: ${action}`);
    }
    this.stepCount++;
    // Bernoulli reward with mean = armMeans[action]
    const reward = this.rng.next() < this.armMeans[action] ? 1 : 0;
    return { reward, done: false };
  }

  getNumArms(): number {
    return this.numArms;
  }

  getOptimalArm(): number {
    return this.armMeans.indexOf(Math.max(...this.armMeans));
  }

  getStepCount(): number {
    return this.stepCount;
  }

  /** For serialization */
  getState(): { stepCount: number; rngState: number } {
    return { stepCount: this.stepCount, rngState: this.rng.getState() };
  }

  /** For deserialization */
  setState(state: { stepCount: number; rngState: number }): void {
    this.stepCount = state.stepCount;
    this.rng.setState(state.rngState);
  }
}

/** GridWorld Environment - Deterministic */
export interface GridWorldConfig {
  grid: string[]; // e.g., ['S...', '.#..', '..#.', '...G']
  seed: number;
  maxSteps?: number;
}

export type GridAction = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left

export interface GridWorldState {
  row: number;
  col: number;
}

export class GridWorldEnv {
  private rng: SeededRNG;
  private readonly grid: string[][];
  private readonly rows: number;
  private readonly cols: number;
  private readonly startPos: GridWorldState;
  private readonly goalPos: GridWorldState;
  private currentPos: GridWorldState;
  private stepCount = 0;
  private readonly maxSteps: number;
  private readonly walls: Set<string>;

  constructor(config: GridWorldConfig) {
    this.rng = new SeededRNG(config.seed);
    this.grid = config.grid.map(row => row.split(''));
    this.rows = this.grid.length;
    this.cols = this.grid[0].length;
    this.maxSteps = config.maxSteps ?? 100;

    this.walls = new Set();
    let startFound = false, goalFound = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell === '#') this.walls.add(`${r},${c}`);
        else if (cell === 'S') { this.startPos = { row: r, col: c }; startFound = true; }
        else if (cell === 'G') { this.goalPos = { row: r, col: c }; goalFound = true; }
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
    let newRow = row, newCol = col;

    switch (action) {
      case 0: newRow = Math.max(0, row - 1); break;
      case 1: newCol = Math.min(this.cols - 1, col + 1); break;
      case 2: newRow = Math.min(this.rows - 1, row + 1); break;
      case 3: newCol = Math.max(0, col - 1); break;
    }

    // Check wall collision
    if (!this.walls.has(`${newRow},${newCol}`)) {
      this.currentPos = { row: newRow, col: newCol };
    }

    const done = this.currentPos.row === this.goalPos.row && this.currentPos.col === this.goalPos.col;
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

  /** For serialization */
  serialize(): { pos: GridWorldState; stepCount: number; rngState: number } {
    return { pos: { ...this.currentPos }, stepCount: this.stepCount, rngState: this.rng.getState() };
  }

  /** For deserialization */
  deserialize(state: { pos: GridWorldState; stepCount: number; rngState: number }): void {
    this.currentPos = { ...state.pos };
    this.stepCount = state.stepCount;
    this.rng.setState(state.rngState);
  }
}

/**
 * Stochastic GridWorld - actions have probabilistic outcomes
 */
export interface StochasticGridWorldConfig {
  grid: string[];
  seed: number;
  slipProbability?: number; // Probability of moving in random direction instead of intended
  maxSteps?: number;
}

export class StochasticGridWorldEnv {
  private rng: SeededRNG;
  private readonly grid: string[][];
  private readonly rows: number;
  private readonly cols: number;
  private readonly startPos: GridWorldState;
  private readonly goalPos: GridWorldState;
  private currentPos: GridWorldState;
  private stepCount = 0;
  private readonly maxSteps: number;
  private readonly walls: Set<string>;
  private readonly slipProb: number;

  constructor(config: StochasticGridWorldConfig) {
    this.rng = new SeededRNG(config.seed);
    this.grid = config.grid.map(row => row.split(''));
    this.rows = this.grid.length;
    this.cols = this.grid[0].length;
    this.maxSteps = config.maxSteps ?? 100;
    this.slipProb = config.slipProbability ?? 0.1;

    this.walls = new Set();
    let startFound = false, goalFound = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell === '#') this.walls.add(`${r},${c}`);
        else if (cell === 'S') { this.startPos = { row: r, col: c }; startFound = true; }
        else if (cell === 'G') { this.goalPos = { row: r, col: c }; goalFound = true; }
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

    // With slipProbability, take random action instead
    let actualAction = action;
    if (this.rng.next() < this.slipProb) {
      actualAction = this.rng.nextInt(4) as GridAction;
    }

    const { row, col } = this.currentPos;
    let newRow = row, newCol = col;

    switch (actualAction) {
      case 0: newRow = Math.max(0, row - 1); break;
      case 1: newCol = Math.min(this.cols - 1, col + 1); break;
      case 2: newRow = Math.min(this.rows - 1, row + 1); break;
      case 3: newCol = Math.max(0, col - 1); break;
    }

    if (!this.walls.has(`${newRow},${newCol}`)) {
      this.currentPos = { row: newRow, col: newCol };
    }

    const done = this.currentPos.row === this.goalPos.row && this.currentPos.col === this.goalPos.col;
    const reward = done ? 1 : -0.01;

    return { state: { ...this.currentPos }, reward, done: done || this.stepCount >= this.maxSteps };
  }

  getState(): GridWorldState {
    return { ...this.currentPos };
  }

  getNumActions(): number {
    return 4;
  }

  getSlipProbability(): number {
    return this.slipProb;
  }

  serialize(): { pos: GridWorldState; stepCount: number; rngState: number } {
    return { pos: { ...this.currentPos }, stepCount: this.stepCount, rngState: this.rng.getState() };
  }

  deserialize(state: { pos: GridWorldState; stepCount: number; rngState: number }): void {
    this.currentPos = { ...state.pos };
    this.stepCount = state.stepCount;
    this.rng.setState(state.rngState);
  }
}

/**
 * Non-Stationary Bandit - arm means change over time
 */
export interface NonStationaryBanditConfig {
  numArms: number;
  initialMeans: number[];
  changeInterval: number; // Steps between mean changes
  changeMagnitude: number; // Max change per interval
  seed: number;
}

export class NonStationaryBanditEnv {
  private rng: SeededRNG;
  private readonly numArms: number;
  private armMeans: number[];
  private readonly changeInterval: number;
  private readonly changeMagnitude: number;
  private stepCount = 0;
  private episodeStepCount = 0;

  constructor(config: NonStationaryBanditConfig) {
    this.rng = new SeededRNG(config.seed);
    this.numArms = config.numArms;
    this.armMeans = [...config.initialMeans];
    this.changeInterval = config.changeInterval;
    this.changeMagnitude = config.changeMagnitude;
  }

  reset(): void {
    this.episodeStepCount = 0;
  }

  step(action: number): { reward: number; done: boolean } {
    if (action < 0 || action >= this.numArms) {
      throw new Error(`Invalid action: ${action}`);
    }

    this.stepCount++;
    this.episodeStepCount++;

    // Check if means should change
    if (this.stepCount > 0 && this.stepCount % this.changeInterval === 0) {
      this.driftMeans();
    }

    const reward = this.rng.next() < this.armMeans[action] ? 1 : 0;
    return { reward, done: false };
  }

  private driftMeans(): void {
    for (let i = 0; i < this.numArms; i++) {
      const change = (this.rng.next() - 0.5) * 2 * this.changeMagnitude;
      this.armMeans[i] = Math.max(0, Math.min(1, this.armMeans[i] + change));
    }
  }

  getNumArms(): number {
    return this.numArms;
  }

  getCurrentMeans(): number[] {
    return [...this.armMeans];
  }

  getOptimalArm(): number {
    return this.armMeans.indexOf(Math.max(...this.armMeans));
  }

  getStepCount(): number {
    return this.stepCount;
  }

  getEpisodeStepCount(): number {
    return this.episodeStepCount;
  }

  serialize(): { armMeans: number[]; stepCount: number; episodeStepCount: number; rngState: number } {
    return { armMeans: [...this.armMeans], stepCount: this.stepCount, episodeStepCount: this.episodeStepCount, rngState: this.rng.getState() };
  }

  deserialize(state: { armMeans: number[]; stepCount: number; episodeStepCount: number; rngState: number }): void {
    this.armMeans = [...state.armMeans];
    this.stepCount = state.stepCount;
    this.episodeStepCount = state.episodeStepCount;
    this.rng.setState(state.rngState);
  }
}

/**
 * Memory-Pressure Environment
 * 
 * Runs the same tasks under controlled memory limits (maxConcepts).
 * Measures return degradation, belief loss, confidence degradation, concept eviction, recovery.
 */
export interface MemoryPressureEnvConfig {
  baseEnv: 'bandit' | 'gridworld';
  baseConfig: any;
  maxConcepts: number; // Artificial memory limit
  seed: number;
}

export class MemoryPressureEnv {
  private baseEnv: BanditEnv | GridWorldEnv | NonStationaryBanditEnv;
  private readonly maxConcepts: number;
  private evictionCount = 0;
  private conceptCount = 0;

  constructor(config: MemoryPressureEnvConfig) {
    this.maxConcepts = config.maxConcepts;
    
    switch (config.baseEnv) {
      case 'bandit':
        this.baseEnv = new BanditEnv(config.baseConfig);
        break;
      case 'gridworld':
        this.baseEnv = new GridWorldEnv(config.baseConfig);
        break;
      case 'nonstationary':
        this.baseEnv = new NonStationaryBanditEnv(config.baseConfig);
        break;
    }
  }

  reset(): void {
    this.baseEnv.reset();
    this.evictionCount = 0;
    this.conceptCount = 0;
  }

  step(action: number): { reward: number; done: boolean } {
    return this.baseEnv.step(action);
  }

  getNumArms(): number {
    return 'getNumArms' in this.baseEnv ? this.baseEnv.getNumArms() : 0;
  }

  getOptimalArm(): number {
    return 'getOptimalArm' in this.baseEnv ? this.baseEnv.getOptimalArm() : 0;
  }

  getState(): any {
    return 'getState' in this.baseEnv ? this.baseEnv.getState() : null;
  }

  /** Simulate memory pressure by tracking concept count */
  recordConcept(count: number): void {
    this.conceptCount = count;
    if (count > this.maxConcepts) {
      this.evictionCount += count - this.maxConcepts;
    }
  }

  getEvictionCount(): number {
    return this.evictionCount;
  }

  getConceptCount(): number {
    return this.conceptCount;
  }

  getMemoryPressure(): number {
    return Math.min(1.0, this.conceptCount / this.maxConcepts);
  }

  getBaseEnv(): BanditEnv | GridWorldEnv | NonStationaryBanditEnv {
    return this.baseEnv;
  }
}