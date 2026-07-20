import type { MeTTaAtom } from '../types/ast.js';
export interface JitCacheEntry {
  readonly code: (...args: MeTTaAtom[]) => MeTTaAtom;
  readonly hits: number;
  readonly compiledAt: number;
  readonly argTypes: readonly string[];
}
export declare class JITCompiler {
  private hotPatterns;
  private threshold;
  private cache;
  constructor(threshold?: number);
  record(pattern: MeTTaAtom): void;
  isHot(pattern: MeTTaAtom): boolean;
  compile(
    pattern: MeTTaAtom,
    impl: (...args: MeTTaAtom[]) => MeTTaAtom
  ): (...args: MeTTaAtom[]) => MeTTaAtom;
  getCompiled(pattern: MeTTaAtom): ((...args: MeTTaAtom[]) => MeTTaAtom) | undefined;
  getStats(): {
    hotPatterns: number;
    compiled: number;
    cacheSize: number;
  };
  clear(): void;
}
export declare const globalJIT: JITCompiler;
//# sourceMappingURL=jit.d.ts.map
