// Small collection helpers to reduce common Map boilerplate
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
