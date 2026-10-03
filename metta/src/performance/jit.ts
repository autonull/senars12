import { LruCache } from '@senars/util';
import { atomKey } from '../core/hash.js';
import type { MeTTaAtom } from '../types/ast.js';

export interface JitCacheEntry {
  readonly code: (...args: MeTTaAtom[]) => MeTTaAtom;
  readonly compiledAt: number;
  readonly argTypes: readonly string[];
}

/** Hotness tally — the counter behind threshold promotion. */
interface HotPattern {
  count: number;
  lastUsed: number;
}

const DEFAULT_HOT_PATTERNS = 4096;
const DEFAULT_COMPILED = 1024;

/** Hot-pattern detector and compiled-code store over bounded recency caches. */
export class JITCompiler {
  private readonly hotPatterns: LruCache<string, HotPattern>;
  private readonly cache: LruCache<string, JitCacheEntry>;
  private threshold: number;

  constructor(threshold = 100) {
    this.threshold = threshold;
    this.hotPatterns = new LruCache({ maxSize: DEFAULT_HOT_PATTERNS });
    this.cache = new LruCache({ maxSize: DEFAULT_COMPILED });
  }

  record(pattern: MeTTaAtom): void {
    const key = atomKey(pattern);
    const existing = this.hotPatterns.peek(key);
    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
      this.hotPatterns.set(key, existing);
    } else {
      this.hotPatterns.set(key, { count: 1, lastUsed: Date.now() });
    }
  }

  isHot(pattern: MeTTaAtom): boolean {
    const entry = this.hotPatterns.peek(atomKey(pattern));
    return entry ? entry.count >= this.threshold : false;
  }

  compile(
    pattern: MeTTaAtom,
    impl: (...args: MeTTaAtom[]) => MeTTaAtom
  ): (...args: MeTTaAtom[]) => MeTTaAtom {
    this.cache.set(atomKey(pattern), {
      code: impl,
      compiledAt: Date.now(),
      argTypes: extractArgTypes(pattern),
    });
    return impl;
  }

  getCompiled(pattern: MeTTaAtom): ((...args: MeTTaAtom[]) => MeTTaAtom) | undefined {
    return this.cache.get(atomKey(pattern))?.code;
  }

  getStats(): { hotPatterns: number; compiled: number; cacheSize: number } {
    return {
      hotPatterns: this.hotPatterns.size,
      compiled: this.cache.size,
      cacheSize: this.cache.size,
    };
  }

  clear(): void {
    this.hotPatterns.clear();
    this.cache.clear();
  }
}

function extractArgTypes(atom: MeTTaAtom): string[] {
  if (atom.kind === 2) return ['number'];
  if (atom.kind === 3) return ['string'];
  if (atom.kind === 0) return ['symbol'];
  if (atom.kind === 1) return ['variable'];
  if (atom.kind === 4) return ['expression'];
  return ['grounded'];
}

export const globalJIT = new JITCompiler();
