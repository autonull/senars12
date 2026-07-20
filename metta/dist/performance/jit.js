import { hashAtom } from '../core/hash.js';
export class JITCompiler {
  hotPatterns = new Map();
  threshold;
  cache = new Map();
  constructor(threshold = 100) {
    this.threshold = threshold;
  }
  record(pattern) {
    const key = String(hashAtom(pattern));
    const existing = this.hotPatterns.get(key);
    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
    } else {
      this.hotPatterns.set(key, { count: 1, lastUsed: Date.now() });
    }
  }
  isHot(pattern) {
    const key = String(hashAtom(pattern));
    const entry = this.hotPatterns.get(key);
    return entry ? entry.count >= this.threshold : false;
  }
  compile(pattern, impl) {
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
  getCompiled(pattern) {
    const key = String(hashAtom(pattern));
    return this.cache.get(key)?.code;
  }
  getStats() {
    return {
      hotPatterns: this.hotPatterns.size,
      compiled: this.cache.size,
      cacheSize: this.cache.size,
    };
  }
  clear() {
    this.hotPatterns.clear();
    this.cache.clear();
  }
}
function extractArgTypes(atom) {
  if (atom.kind === 2) return ['number'];
  if (atom.kind === 3) return ['string'];
  if (atom.kind === 0) return ['symbol'];
  if (atom.kind === 1) return ['variable'];
  if (atom.kind === 4) return ['expression'];
  return ['grounded'];
}
export const globalJIT = new JITCompiler();
//# sourceMappingURL=jit.js.map
