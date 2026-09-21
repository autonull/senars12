/**
 * G2 — episode-level schema induction. After each episode the (action,
 * reward) history is aggregated; the worst and best action patterns are
 * promoted into advisory focus beliefs (`(<action> ==> bad|good_outcome)`)
 * that the Negotiator weighs next episode — the arcade learning loop closes
 * without any LM dependency.
 */
export interface EpisodeTick {
  action: string;
  reward: number;
}

export interface PromotedSchema {
  action: string;
  kind: 'bad' | 'good';
  meanReward: number;
}

export interface SchemaInductionOptions {
  /** Minimum samples per action before it is eligible for promotion. */
  minSamples?: number;
}

export function induceEpisodeSchemas(
  history: readonly EpisodeTick[],
  options: SchemaInductionOptions = {}
): PromotedSchema[] {
  const minSamples = options.minSamples ?? 2;
  const stats = new Map<string, { count: number; total: number }>();
  for (const { action, reward } of history) {
    const s = stats.get(action) ?? { count: 0, total: 0 };
    s.count++;
    s.total += reward;
    stats.set(action, s);
  }
  const entries = [...stats.entries()]
    .map(([action, s]) => ({ action, count: s.count, meanReward: s.total / s.count }))
    .filter((e) => e.count >= minSamples);
  if (entries.length < 2) return [];

  const worst = entries.reduce((a, b) => (b.meanReward < a.meanReward ? b : a));
  const best = entries.reduce((a, b) => (b.meanReward > a.meanReward ? b : a));
  if (worst.action === best.action || worst.meanReward >= best.meanReward) return [];
  return [
    { action: worst.action, kind: 'bad', meanReward: worst.meanReward },
    { action: best.action, kind: 'good', meanReward: best.meanReward },
  ];
}
