import { sleep } from './helpers.js';

export interface ThrottleConfig {
  intervalMs: number;
  burst: number;
}

export class Throttle {
  private tokens: number;
  private lastRefill = Date.now();
  private config: ThrottleConfig;

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = { intervalMs: config.intervalMs ?? 10, burst: config.burst ?? 1 };
    this.tokens = this.config.burst;
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens > 0) {
        this.tokens--;
        return;
      }
      await sleep(this.config.intervalMs);
    }
  }

  getAvailable(): number {
    this.refill();
    return this.tokens;
  }

  reset(): void {
    this.tokens = this.config.burst;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refills = Math.floor(elapsed / this.config.intervalMs);
    if (refills > 0) {
      this.tokens = Math.min(this.config.burst, this.tokens + refills);
      this.lastRefill = now;
    }
  }
}

export function createThrottle(config?: Partial<ThrottleConfig>): Throttle {
  return new Throttle(config);
}

export async function* throttleGenerator<T>(
  gen: AsyncGenerator<T>,
  intervalMs: number,
  shouldStop?: () => boolean
): AsyncGenerator<T> {
  let lastYield = Date.now();
  for await (const value of gen) {
    if (shouldStop?.()) break;
    yield value;
    if (Date.now() - lastYield > intervalMs) {
      await new Promise((r) => setTimeout(r, 0));
      lastYield = Date.now();
    }
  }
}
