import { getOrInsert, lerpUpdate, maxBy, QTable, softmax } from '@senars/util';
import type { SeededRNG } from '../../nar/src/game/index.js';

export interface RLStep {
  action: string;
  predicted: number;
}

export interface RLLearner {
  act(stateKey: string, legal: string[]): RLStep;
  feedback(reward: number, nextKey: string, _nextLegal: string[], terminal: boolean): void;
  endEpisode(): void;
}

/** A preference row holding every legal action, defaulting the unpulled ones. */
const row = (
  prefs: Map<string, Map<string, number>>,
  key: string,
  legal: string[]
): Map<string, number> => {
  const weights = getOrInsert(prefs, key, () => new Map<string, number>());
  for (const action of legal) if (!weights.has(action)) weights.set(action, 0);
  return weights;
};

export class TabularQLearner implements RLLearner {
  private readonly table: QTable;
  private pending: { key: string; action: string } | null = null;

  constructor(
    private readonly rng: SeededRNG,
    alpha = 0.1,
    private readonly gamma = 0.99,
    private readonly epsilon = 0.1
  ) {
    this.table = new QTable(lerpUpdate(alpha));
  }

  act(key: string, legal: string[]): RLStep {
    const qOf = (action: string): number => this.table.read(key, action).value;
    const action =
      this.rng.next() < this.epsilon
        ? legal[this.rng.nextInt(legal.length)]!
        : maxBy(legal, qOf, legal[0])!;
    const probs = softmax(legal.map(qOf));
    this.pending = { key, action };
    return { action, predicted: probs[legal.indexOf(action)]! };
  }

  feedback(reward: number, nextKey: string, _nextLegal: string[], terminal: boolean): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    // A negative Q must stay negative here, so this is `maxBy` and not the
    // zero-floored `maxScore`: the bootstrap target is the estimate, not a rate.
    const best = terminal
      ? undefined
      : maxBy(this.table.arms(nextKey).values(), (e) => e.value)?.value;
    this.table.revise(p.key, p.action, reward + this.gamma * (best ?? 0));
  }

  endEpisode(): void {
    this.pending = null;
  }
}

export class ReinforceLearner implements RLLearner {
  private readonly prefs = new Map<string, Map<string, number>>();
  private readonly traj: { key: string; action: string; reward: number }[] = [];
  private baseline = 0;
  private episodes = 0;

  constructor(
    private readonly rng: SeededRNG,
    private readonly alpha = 0.05,
    private readonly gamma = 0.99
  ) {}

  act(key: string, legal: string[]): RLStep {
    const th = row(this.prefs, key, legal);
    const probs = softmax(legal.map((a) => th.get(a)!));
    let r = this.rng.next();
    let i = 0;
    while (i < probs.length - 1) {
      r -= probs[i]!;
      if (r <= 0) break;
      i++;
    }
    this.traj.push({ key, action: legal[i]!, reward: 0 });
    return { action: legal[i]!, predicted: probs[i]! };
  }

  feedback(reward: number): void {
    this.traj[this.traj.length - 1]!.reward = reward;
  }

  endEpisode(): void {
    const returns: number[] = new Array(this.traj.length);
    let g = 0;
    for (let t = this.traj.length - 1; t >= 0; t--) {
      g = this.traj[t]!.reward + this.gamma * g;
      returns[t] = g;
    }
    if (this.traj.length) {
      this.episodes++;
      this.baseline += (returns[0]! - this.baseline) / this.episodes;
      this.traj.forEach((s, t) => {
        const th = this.prefs.get(s.key)!;
        const entries = [...th.entries()];
        const probs = softmax(entries.map(([, p]) => p));
        entries.forEach(([a, p], i) => {
          th.set(
            a,
            p + this.alpha * (returns[t]! - this.baseline) * ((a === s.action ? 1 : 0) - probs[i]!)
          );
        });
      });
      this.traj.length = 0;
    }
  }
}
