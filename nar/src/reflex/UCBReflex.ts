import { ucb1 } from '@senars/util';
import { BanditReflex, type QEntry } from './BanditReflex.js';
import type { Reflex } from './Reflex.js';

interface UCBOptions {
  numArms: number;
  c?: number;
  initialValue?: number;
}

/** UCB1: optimistic untried arms, confidence-scaled exploration thereafter. */
export class UCBReflex extends BanditReflex<UCBOptions> implements Reflex<string, number> {
  private readonly c: number;

  constructor(id: string, options: UCBOptions = { numArms: 10 }) {
    super(id, options);
    this.c = options.c ?? 1.414;
  }

  protected override confidenceOf(entry: QEntry): number {
    return entry.count === 0 ? 0.1 : super.confidenceOf(entry);
  }

  protected explore(entry: QEntry): number {
    return entry.count === 0 ? 1.0 : ucb1(entry.value, entry.count, this.totalSteps + 1, this.c);
  }
}
