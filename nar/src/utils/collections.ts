// Small collection helpers to reduce common Map boilerplate

/**
 * Returns the top `n` items from an iterable ranked by `score`, descending.
 * Single-pass with a bounded buffer — avoids materializing/sorting the full input.
 */
export function selectTopN<T>(
    items: Iterable<T>,
    n: number,
    score: (item: T) => number
): T[] {
    if (n <= 0) return [];
    const result: T[] = [];
    const scores: number[] = [];
    for (const item of items) {
        const s = score(item);
        if (result.length < n) {
            result.push(item);
            scores.push(s);
            let i = result.length - 1;
            while (i > 0 && scores[i - 1]! < s) {
                result[i] = result[i - 1]!;
                scores[i] = scores[i - 1]!;
                i--;
            }
            result[i] = item;
            scores[i] = s;
        } else if (s > scores[n - 1]!) {
            result[n - 1] = item;
            scores[n - 1] = s;
            let i = n - 1;
            while (i > 0 && scores[i - 1]! < s) {
                result[i] = result[i - 1]!;
                scores[i] = scores[i - 1]!;
                i--;
            }
            result[i] = item;
            scores[i] = s;
        }
    }
    return result;
}

export function getOrInsert<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
    const existing = map.get(key);
    if (existing !== undefined) return existing;
    const v = factory();
    map.set(key, v);
    return v;
}

export function incrementCount<K>(map: Map<K, number>, key: K, delta = 1): number {
    const prev = map.get(key) ?? 0;
    const next = prev + delta;
    map.set(key, next);
    return next;
}

export function addToSet<K, T>(map: Map<K, Set<T>>, key: K, value: T): void {
    const set = map.get(key) ?? new Set<T>();
    set.add(value);
    map.set(key, set);
}
