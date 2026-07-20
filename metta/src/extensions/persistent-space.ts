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

export class PersistentSpace implements Space {
  readonly id: string;
  private readonly _atoms: MeTTaAtom[] = [];
  private readonly opts: PersistentSpaceOptions;
  private saveTimer: ReturnType<typeof setInterval> | undefined;

  constructor(id: string, opts: PersistentSpaceOptions) {
    this.id = id;
    this.opts = { autoSave: true, saveInterval: 5000, ...opts };
  }

  async load(): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(this.opts.storageDir, `${this.id}.metta.json`);

    try {
      const data = await fs.readFile(file, 'utf-8');
      const parsed: PersistedSpaceData = JSON.parse(data);
      this._atoms.push(...parsed.atoms);
    } catch {
      return;
    }
  }

  private async persist(): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(this.opts.storageDir, `${this.id}.metta.json`);

    const data: PersistedSpaceData = {
      id: this.id,
      atoms: this._atoms,
      timestamp: Date.now(),
    };

    await fs.mkdir(this.opts.storageDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }

  add(atom: MeTTaAtom): void {
    this._atoms.push(atom);
    if (this.opts.autoSave && !this.saveTimer) {
      this.saveTimer = setInterval(async () => {
        await this.persist();
      }, this.opts.saveInterval);
    }
  }

  remove(atom: MeTTaAtom): boolean {
    const index = this._atoms.indexOf(atom as never);
    if (index === -1) return false;
    this._atoms.splice(index, 1);
    return true;
  }

  *query(pattern: MeTTaAtom): Generator<MeTTaAtom> {
    for (const atom of this._atoms) {
      if (matches(atom, pattern)) {
        yield atom;
      }
    }
  }

  get size(): number {
    return this._atoms.length;
  }

  get atoms(): ReadonlyArray<MeTTaAtom> {
    return this._atoms;
  }

  [Symbol.dispose](): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
  }
}

function matches(atom: MeTTaAtom, pattern: MeTTaAtom): boolean {
  if (pattern.kind === 1) return true;
  if (atom.kind !== pattern.kind) return false;

  switch (atom.kind) {
    case 0:
      return (atom as { value: string }).value === (pattern as { value: string }).value;
    case 2:
      return (atom as { value: number }).value === (pattern as { value: number }).value;
    case 3:
      return (atom as { value: string }).value === (pattern as { value: string }).value;
    case 4: {
      const a = atom as { operator: MeTTaAtom; args: readonly MeTTaAtom[] };
      const p = pattern as { operator: MeTTaAtom; args: readonly MeTTaAtom[] };
      if (!matches(a.operator, p.operator)) return false;
      if (a.args.length !== p.args.length) return false;
      for (let i = 0; i < a.args.length; i++) {
        if (!matches(a.args[i] as MeTTaAtom, p.args[i] as MeTTaAtom)) return false;
      }
      return true;
    }
    case 5: {
      const a = atom as { op: string; args: readonly MeTTaAtom[] };
      const p = pattern as { op: string; args: readonly MeTTaAtom[] };
      if (a.op !== p.op) return false;
      if (a.args.length !== p.args.length) return false;
      for (let i = 0; i < a.args.length; i++) {
        if (!matches(a.args[i] as MeTTaAtom, p.args[i] as MeTTaAtom)) return false;
      }
      return true;
    }
    default:
      return true;
  }
}
