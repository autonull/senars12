import { Map as ImmMap, Set as ImmSet } from 'immutable';
import { hashAtom } from '../core/hash.js';
import type { MeTTaAtom } from '../types/ast.js';

interface EClass {
  readonly id: number;
  readonly nodes: ImmSet<MeTTaAtom>;
  readonly children: ImmMap<string, number>;
}

export interface RewriteRule {
  name: string;
  match: (atom: MeTTaAtom) => MeTTaAtom | null;
}

export class EGraph {
  private eclasses: ImmMap<number, EClass> = ImmMap();
  private hashCons: ImmMap<string, number> = ImmMap();
  private nextIdCounter = 0;

  add(atom: MeTTaAtom): number {
    const key = this.hashKey(atom);
    const existing = this.hashCons.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const id = this.nextId();
    const eclass: EClass = {
      id,
      nodes: ImmSet([atom]),
      children: ImmMap(),
    };

    this.eclasses = this.eclasses.set(id, eclass);
    this.hashCons = this.hashCons.set(key, id);

    return id;
  }

  saturate(rules: readonly RewriteRule[]): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const rule of rules) {
        if (this.applyRule(rule)) {
          changed = true;
        }
      }
    }
  }

  extract(root: number, costFn: (atom: MeTTaAtom) => number): MeTTaAtom {
    const best = this.eclasses.get(root);
    if (!best) throw new Error(`EClass ${root} not found`);

    let bestAtom = best.nodes.first();
    let bestCost = bestAtom ? costFn(bestAtom) : Number.POSITIVE_INFINITY;

    for (const atom of best.nodes) {
      const c = costFn(atom);
      if (c < bestCost) {
        bestCost = c;
        bestAtom = atom;
      }
    }

    if (!bestAtom) throw new Error(`EClass ${root} is empty`);
    return bestAtom;
  }

  private applyRule(rule: RewriteRule): boolean {
    let changed = false;
    for (const [key, id] of this.hashCons) {
      const eclass = this.eclasses.get(id);
      if (!eclass) continue;

      for (const atom of eclass.nodes) {
        const replacement = rule.match(atom);
        if (!replacement) continue;

        const repKey = this.hashKey(replacement);
        if (!this.hashCons.has(repKey)) {
          this.eclasses = this.eclasses.set(id, {
            ...eclass,
            nodes: eclass.nodes.add(replacement),
          });
          this.hashCons = this.hashCons.set(repKey, id);
          changed = true;
        }
      }
    }
    return changed;
  }

  private hashKey(atom: MeTTaAtom): string {
    return String(hashAtom(atom));
  }

  private nextId(): number {
    const id = this.nextIdCounter;
    this.nextIdCounter++;
    return id;
  }
}
