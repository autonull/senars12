import { hashAtom } from '../core/hash.js';
import type { MeTTaAtom } from '../types/ast.js';

export interface JitCacheEntry {
  readonly code: (...args: MeTTaAtom[]) => MeTTaAtom;
  readonly hits: number;
  readonly compiledAt: number;
  readonly argTypes: readonly string[];
}

export class JITCompiler {
  private hotPatterns = new Map<string, { count: number; lastUsed: number }>();
  private threshold: number;
  private cache = new Map<string, JitCacheEntry>();

  constructor(threshold = 100) {
    this.threshold = threshold;
  }

  record(pattern: MeTTaAtom): void {
    const key = String(hashAtom(pattern));
    const existing = this.hotPatterns.get(key);
    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
    } else {
      this.hotPatterns.set(key, { count: 1, lastUsed: Date.now() });
    }
  }

  isHot(pattern: MeTTaAtom): boolean {
    const key = String(hashAtom(pattern));
    const entry = this.hotPatterns.get(key);
    return entry ? entry.count >= this.threshold : false;
  }

  compile(
    pattern: MeTTaAtom,
    impl: (...args: MeTTaAtom[]) => MeTTaAtom
  ): (...args: MeTTaAtom[]) => MeTTaAtom {
    const key = String(hashAtom(pattern));
    const types = extractArgTypes(pattern);

    this.cache.set(key, {
      code: impl,
      hits: 0,
      compiledAt: Date.now(),
      argTypes: types,
    });

    return impl;
  }

  getCompiled(pattern: MeTTaAtom): ((...args: MeTTaAtom[]) => MeTTaAtom) | undefined {
    const key = String(hashAtom(pattern));
    return this.cache.get(key)?.code;
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
