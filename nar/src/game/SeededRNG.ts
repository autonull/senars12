/** Deterministic LCG RNG (Numerical Recipes parameters) for reproducible RL experiments. */
export class SeededRNG {
  private state: number;

  constructor(seed: number = 1) {
    this.state = seed >>> 0;
  }

  /** Random float in [0, 1). */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /** Random integer in [0, max). */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Random element; throws on empty input. */
  choice<T>(arr: readonly T[]): T {
    const picked = arr[this.nextInt(arr.length)];
    if (picked === undefined) throw new Error('choice from empty array');
    return picked;
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}
