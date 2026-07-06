import type { ChannelValue, Modulation } from './types.js';

export interface MemoCache {
  getDelta(id: string): Partial<Record<string, ChannelValue>> | undefined;
  setDelta(id: string, channels: Partial<Record<string, ChannelValue>>): void;
  getModulation(id: string): Modulation | undefined;
  setModulation(id: string, mod: Modulation): void;
  invalidate(id: string): void;
  clear(): void;
}

export function createMemoCache(): MemoCache {
  const deltaCache = new Map<string, Partial<Record<string, ChannelValue>>>();
  const modCache = new Map<string, Modulation>();

  return {
    getDelta(id: string) {
      return deltaCache.get(id);
    },
    setDelta(id: string, channels: Partial<Record<string, ChannelValue>>) {
      deltaCache.set(id, channels);
    },
    getModulation(id: string) {
      return modCache.get(id);
    },
    setModulation(id: string, mod: Modulation) {
      modCache.set(id, mod);
    },
    invalidate(id: string) {
      deltaCache.delete(id);
    },
    clear() {
      deltaCache.clear();
      modCache.clear();
    },
  };
}

let globalCache: MemoCache | null = null;

export function getMemoCache(): MemoCache {
  if (!globalCache) globalCache = createMemoCache();
  return globalCache;
}

export function resetMemoCache(): void {
  globalCache = null;
}
