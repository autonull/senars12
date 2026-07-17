import { Map as ImmMap, Set as ImmSet } from 'immutable';
import { hashAtom } from '../core/hash.js';
export class EGraph {
    eclasses = ImmMap();
    hashCons = ImmMap();
    nextIdCounter = 0;
    add(atom) {
        const key = this.hashKey(atom);
        const existing = this.hashCons.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const id = this.nextId();
        const eclass = {
            id,
            nodes: ImmSet([atom]),
            children: ImmMap(),
        };
        this.eclasses = this.eclasses.set(id, eclass);
        this.hashCons = this.hashCons.set(key, id);
        return id;
    }
    saturate(rules) {
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
    extract(root, costFn) {
        const best = this.eclasses.get(root);
        if (!best)
            throw new Error(`EClass ${root} not found`);
        let bestAtom = best.nodes.first();
        let bestCost = bestAtom ? costFn(bestAtom) : Number.POSITIVE_INFINITY;
        for (const atom of best.nodes) {
            const c = costFn(atom);
            if (c < bestCost) {
                bestCost = c;
                bestAtom = atom;
            }
        }
        if (!bestAtom)
            throw new Error(`EClass ${root} is empty`);
        return bestAtom;
    }
    applyRule(rule) {
        let changed = false;
        for (const [key, id] of this.hashCons) {
            const eclass = this.eclasses.get(id);
            if (!eclass)
                continue;
            for (const atom of eclass.nodes) {
                const replacement = rule.match(atom);
                if (!replacement)
                    continue;
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
    hashKey(atom) {
        return String(hashAtom(atom));
    }
    nextId() {
        const id = this.nextIdCounter;
        this.nextIdCounter++;
        return id;
    }
}
//# sourceMappingURL=egraph.js.map