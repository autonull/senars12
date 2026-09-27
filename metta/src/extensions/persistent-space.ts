import { ArraySpace } from '../core/space.js';
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

export class PersistentSpace extends ArraySpace {
  private readonly opts: PersistentSpaceOptions;
  private saveTimer: ReturnType<typeof setInterval> | undefined;

  constructor(id: string, opts: PersistentSpaceOptions) {
    super(id);
    this.opts = { autoSave: true, saveInterval: 5000, ...opts };
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

  protected override onAdd(_atom: MeTTaAtom): void {
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
