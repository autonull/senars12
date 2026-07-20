import type { Space } from '../core/space.js';
import type { MeTTaAtom } from '../types/ast.js';
export interface PersistedSpaceData {
  id: string;
  atoms: MeTTaAtom[];
  timestamp: number;
}
export interface PersistentSpaceOptions {
  readonly storageDir: string;
  readonly autoSave?: boolean;
  readonly saveInterval?: number;
}
export declare class PersistentSpace implements Space {
  readonly id: string;
  private readonly _atoms;
  private readonly opts;
  private saveTimer;
  constructor(id: string, opts: PersistentSpaceOptions);
  load(): Promise<void>;
  private persist;
  add(atom: MeTTaAtom): void;
  remove(atom: MeTTaAtom): boolean;
  query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
  get size(): number;
  get atoms(): ReadonlyArray<MeTTaAtom>;
  [Symbol.dispose](): void;
}
//# sourceMappingURL=persistent-space.d.ts.map
