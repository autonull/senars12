import type { MeTTaAtom } from '../types/ast.js';
import { PersistentSpace } from '../extensions/persistent-space.js';
import { parseMeTTa } from '../parser/runtime.js';

export class MettaLTM {
  #spaces = new Map<string, PersistentSpace>();

  getSpace(spaceId: string, storageDir = './data/metta'): PersistentSpace {
    let space = this.#spaces.get(spaceId);
    if (!space) {
      space = new PersistentSpace(spaceId, { storageDir });
      space.load().catch(() => {});
      this.#spaces.set(spaceId, space);
    }
    return space;
  }

  async store(atom: string, spaceId = 'default', storageDir = './data/metta'): Promise<void> {
    const space = this.getSpace(spaceId, storageDir);
    const parsed = parseMeTTa(atom);
    space.add(parsed);
  }

  async recall(pattern: string, _limit = 20, spaceId?: string, storageDir = './data/metta'): Promise<MeTTaAtom[]> {
    const space = spaceId ? this.getSpace(spaceId, storageDir) : this.getSpace('default', storageDir);
    const parsed = parseMeTTa(pattern);
    return [...space.query(parsed)];
  }

  async importKnowledge(sources: string | string[], spaceId = 'default', storageDir = './data/metta'): Promise<void> {
    const sourceList = Array.isArray(sources) ? sources : [sources];
    for (const source of sourceList) {
      const parsed = parseMeTTa(source);
      const space = this.getSpace(spaceId, storageDir);
      space.add(parsed);
    }
  }

  dispose(): void {
    for (const space of this.#spaces.values()) {
      space[Symbol.dispose]();
    }
    this.#spaces.clear();
  }
}
