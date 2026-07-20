import type { sym } from '../types/ast.js';
export interface InternOptions {
  readonly weakRefs?: boolean;
}
export declare class SymbolInterner implements Disposable {
  private readonly cache;
  constructor(opts?: InternOptions);
  intern(name: string): ReturnType<typeof sym>;
  get(name: string): ReturnType<typeof sym> | undefined;
  has(name: string): boolean;
  clear(): void;
  [Symbol.dispose](): void;
}
//# sourceMappingURL=intern.d.ts.map
