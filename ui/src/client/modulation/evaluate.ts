import { getMemoCache } from './memo.js';
import type { MemoCache } from './memo.js';
import { evaluateModulation } from './operators.js';
import type { Delta, Item, Lens, Modulation, View } from './types.js';

export interface EvaluateOptions {
  dirtyIds?: Set<string>;
  memoCache?: MemoCache;
}

export function evaluate(
  items: Iterable<Item>,
  lens: Lens,
  view: View,
  options?: EvaluateOptions
): Delta {
  const cache = options?.memoCache ?? getMemoCache();
  const dirtyIds = options?.dirtyIds;
  const result: Delta = new Map();
  const mod = applyCache(lens.modulation, cache);

  for (const item of items) {
    if (dirtyIds && !dirtyIds.has(item.id)) {
      const cached = cache.getDelta(item.id);
      if (cached !== undefined) {
        result.set(item.id, cached);
        continue;
      }
    }
    const delta = evaluateModulation(mod, item, view);
    const record = delta.get(item.id);
    if (record) {
      result.set(item.id, record);
      cache.setDelta(item.id, record);
    }
  }

  return result;
}

export function diffDelta(prev: Delta, next: Delta): Delta {
  const diff: Delta = new Map();
  for (const [id, channels] of next) {
    const prevChannels = prev.get(id);
    if (!prevChannels) {
      diff.set(id, channels);
      continue;
    }
    const changed: Record<string, unknown> = {};
    let hasChanged = false;
    for (const [key, value] of Object.entries(channels)) {
      if (prevChannels[key as keyof typeof prevChannels] !== value) {
        changed[key] = value;
        hasChanged = true;
      }
    }
    if (hasChanged) diff.set(id, changed as typeof channels);
  }
  return diff;
}

function applyCache(mod: Modulation, cache: MemoCache): Modulation {
  if (mod.op === 'memo') {
    const cached = cache.getModulation(mod.id);
    if (cached) return cached;
    cache.setModulation(mod.id, mod.child);
    return mod.child;
  }
  if (mod.op === 'union') {
    return { ...mod, children: mod.children.map((c) => applyCache(c, cache)) };
  }
  if (mod.op === 'when') {
    return { ...mod, child: applyCache(mod.child, cache) };
  }
  if (mod.op === 'channel') {
    return { ...mod, child: applyCache(mod.child, cache) };
  }
  return mod;
}
