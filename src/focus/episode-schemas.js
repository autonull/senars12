import { accumulate, maxBy, minBy } from '@senars/util/collections';
import { safeRatio } from '@senars/util/numeric';
export function induceEpisodeSchemas(history, options = {}) {
    const minSamples = options.minSamples ?? 2;
    const stats = new Map();
    for (const { action, reward } of history) {
        accumulate(stats, action, () => ({ count: 0, total: 0 }), (s) => {
            s.count++;
            s.total += reward;
        });
    }
    const entries = [...stats.entries()]
        .map(([action, s]) => ({ action, count: s.count, meanReward: safeRatio(s.total, s.count) }))
        .filter((e) => e.count >= minSamples);
    if (entries.length < 2)
        return [];
    const worst = minBy(entries, (e) => e.meanReward);
    const best = maxBy(entries, (e) => e.meanReward);
    if (worst.action === best.action || worst.meanReward >= best.meanReward)
        return [];
    return [
        { action: worst.action, kind: 'bad', meanReward: worst.meanReward },
        { action: best.action, kind: 'good', meanReward: best.meanReward },
    ];
}
