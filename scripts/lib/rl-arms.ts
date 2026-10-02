import { SeededRNG } from '../../nar/src/game/index.js';

export interface RLStep {
  action: string;
  predicted: number;
}

export interface RLLearner {
  act(stateKey: string, legal: string[]): RLStep;
  feedback(reward: number, nextKey: string, nextLegal: string[], terminal: boolean): void;
  endEpisode(): void;
}

const row = (
  table: Map<string, Map<string, number>>,
  key: string,
  legal: string[]
): Map<string, number> => {
  let m = table.get(key);
  if (!m) {
    m = new Map(legal.map((a) => [a, 0]));
    table.set(key, m);
  }
  for (const a of legal) if (!m.has(a)) m.set(a, 0);
  return m;
};

const softmax = (values: number[]): number[] => {
  const m = Math.max(...values);
  const ex = values.map((v) => Math.exp(v - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
};

export class TabularQLearner implements RLLearner {
  private readonly table = new Map<string, Map<string, number>>();
  private pending: { key: string; action: string } | null = null;

  constructor(
    private readonly rng: SeededRNG,
    private readonly alpha = 0.1,
    private readonly gamma = 0.99,
    private readonly epsilon = 0.1
  ) {}

  act(key: string, legal: string[]): RLStep {
    const q = row(this.table, key, legal);
    const action =
      this.rng.next() < this.epsilon
        ? legal[this.rng.nextInt(legal.length)]!
        : [...q.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const probs = softmax(legal.map((a) => q.get(a)!));
    this.pending = { key, action };
    return { action, predicted: probs[legal.indexOf(action)]! };
  }

  feedback(reward: number, nextKey: string, nextLegal: string[], terminal: boolean): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    const q = row(this.table, p.key, [p.action]);
    const vals = terminal ? [] : [...row(this.table, nextKey, nextLegal).values()];
    const target = reward + (vals.length ? this.gamma * Math.max(...vals) : 0);
    q.set(p.action, q.get(p.action)! + this.alpha * (target - q.get(p.action)!));
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
          th.set(a, p + this.alpha * (returns[t]! - this.baseline) * ((a === s.action ? 1 : 0) - probs[i]!));
        });
      });
      this.traj.length = 0;
    }
  }
}
