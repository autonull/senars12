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

  get size(): number {
    return this._atoms.length;
  }

  get atoms(): ReadonlyArray<MeTTaAtom> {
    return this._atoms;
  }

  async load(): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(this.opts.storageDir, `${this.id}.metta.json`);

    let data: string;
    try {
      data = await fs.readFile(file, 'utf-8');
    } catch {
      return; // fresh space — no file yet
    }
    // D9: a corrupt file is quarantined, never silently overwritten with
    // an empty in-memory state.
    try {
      const parsed: PersistedSpaceData = JSON.parse(data);
      this._atoms.push(...parsed.atoms);
    } catch (error) {
      await fs.rename(file, `${file}.corrupt`);
      throw new Error(
        `PersistentSpace '${this.id}': corrupt persisted state quarantined as ${file}.corrupt — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  add(atom: MeTTaAtom): void {
    this._atoms.push(atom);
    if (this.opts.autoSave && !this.saveTimer) {
      // D9: guarded save + unref — a persist failure must neither crash the
      // process nor hold the event loop open.
      this.saveTimer = setInterval(() => {
        this.persist().catch((error) => {
          console.error(`[metta] PersistentSpace '${this.id}' auto-save failed:`, error);
          PersistentSpace.failedSaves++;
        });
      }, this.opts.saveInterval);
      this.saveTimer.unref();
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

  [Symbol.dispose](): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
    // D9: final flush — dispose must not lose up to saveInterval of writes.
    void this.persist().catch((error) => {
      console.error(`[metta] PersistentSpace '${this.id}' final save failed:`, error);
      PersistentSpace.failedSaves++;
    });
  }

  /** D9: auto-save failures observed across all spaces. */
  static failedSaves = 0;

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
