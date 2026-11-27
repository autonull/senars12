/**
 * Kernel Stamp — temporal and causal identity for terms.
 *
 * Stamps provide:
 * - Unique identity (UUID)
 * - Temporal ordering (timestamp)
 * - Causal lineage (parent stamps)
 * - Derivation tracking (rule IDs)
 * - Evidential depth
 */
import { randomUUID } from 'crypto';
import { createDefaultClock } from './env';
import { SenarsError } from '../errors/senars-error';
/** Get current timestamp from clock or default. */
export const nowOf = (clock) => (clock ?? createDefaultClock()).now();
/** Create a new root stamp (observation/axiom). */
export function createRootStamp(options = {}) {
    return {
        id: randomUUID(),
        ts: options.ts ?? nowOf(options.clock),
        parents: [],
        derivation: options.ruleId ? [options.ruleId] : [],
        evidence: 0,
    };
}
/** Create a derived stamp from parent stamps. */
export function createDerivedStamp(parents, ruleId, options = {}) {
    const parentIds = parents.map(p => p.id);
    const maxEvidence = parents.reduce((max, p) => Math.max(max, p.evidence), 0);
    const allRules = [ruleId, ...(options.additionalRules ?? [])];
    return {
        id: randomUUID(),
        ts: options.ts ?? nowOf(options.clock),
        parents: parentIds,
        derivation: allRules,
        evidence: maxEvidence + 1,
    };
}
/** Create a stamp from parent IDs (for replay/reconstruction). */
export function createStampFromIds(parentIds, ruleId, evidence, options = {}) {
    const allRules = [ruleId, ...(options.additionalRules ?? [])];
    return {
        id: randomUUID(),
        ts: options.ts ?? nowOf(options.clock),
        parents: parentIds,
        derivation: allRules,
        evidence,
    };
}
/** Merge multiple stamps (for revision/confluence). */
export function mergeStamps(stamps, ruleId, clock) {
    if (stamps.length === 0)
        throw new SenarsError('Cannot merge empty stamp set', 'VALIDATION_ERROR');
    if (stamps.length === 1)
        return stamps[0];
    const allParents = stamps.flatMap(s => s.parents);
    const uniqueParents = [...new Set(allParents)];
    const maxEvidence = Math.max(...stamps.map(s => s.evidence));
    const allDerivations = stamps.flatMap(s => s.derivation);
    const uniqueDerivations = [...new Set([...allDerivations, ruleId])];
    return {
        id: randomUUID(),
        ts: nowOf(clock),
        parents: uniqueParents,
        derivation: uniqueDerivations,
        evidence: maxEvidence + 1,
    };
}
/** Check if stamp A is causally before stamp B. */
export function isBefore(a, b) {
    return a.ts < b.ts || (a.ts === b.ts && a.id < b.id);
}
/** Check if stamp A is causally ancestor of stamp B. */
export function isAncestor(ancestor, descendant, allStamps) {
    if (ancestor.id === descendant.id)
        return false;
    const visited = new Set();
    const queue = [...descendant.parents];
    while (queue.length > 0) {
        const id = queue.pop();
        if (id === ancestor.id)
            return true;
        if (visited.has(id))
            continue;
        visited.add(id);
        const stamp = allStamps.get(id);
        if (stamp)
            queue.push(...stamp.parents);
    }
    return false;
}
/** Get the causal chain from a stamp to its roots. */
export function getCausalChain(stamp, allStamps) {
    const chain = [stamp];
    const visited = new Set([stamp.id]);
    let current = stamp;
    while (current && current.parents.length > 0) {
        // For simplicity, follow first parent (could be all parents)
        const parentId = current.parents[0];
        if (visited.has(parentId))
            break;
        const parent = allStamps.get(parentId);
        if (!parent)
            break;
        chain.push(parent);
        current = parent;
        visited.add(parentId);
    }
    return chain;
}
/** Get all ancestors of a stamp. */
export function getAncestors(stamp, allStamps) {
    const ancestors = new Set();
    const queue = [...stamp.parents];
    while (queue.length > 0) {
        const id = queue.pop();
        if (ancestors.has(id))
            continue;
        ancestors.add(id);
        const s = allStamps.get(id);
        if (s)
            queue.push(...s.parents);
    }
    return ancestors;
}
/** Get common ancestors of two stamps. */
export function getCommonAncestors(a, b, allStamps) {
    const ancestorsA = getAncestors(a, allStamps);
    const ancestorsB = getAncestors(b, allStamps);
    const common = new Set();
    for (const id of ancestorsA) {
        if (ancestorsB.has(id))
            common.add(id);
    }
    return common;
}
/** Stamp equality. */
export function stampEquals(a, b) {
    return a.id === b.id;
}
/** Stamp ordering (for sorting). */
export function stampCompare(a, b) {
    if (a.ts !== b.ts)
        return a.ts - b.ts;
    return a.id < b.id ? -1 : 1;
}
/** Format stamp for display. */
export function formatStamp(stamp) {
    const parents = stamp.parents.length > 0 ? ` parents=[${stamp.parents.join(', ')}]` : '';
    const deriv = stamp.derivation.length > 0 ? ` rules=[${stamp.derivation.join(', ')}]` : '';
    return `Stamp(${stamp.id.slice(0, 8)} ts=${stamp.ts} ev=${stamp.evidence}${parents}${deriv})`;
}
/** Stamp store for managing stamp collections. */
export class StampStore {
    stamps = new Map();
    /** Add a stamp. */
    add(stamp) {
        this.stamps.set(stamp.id, stamp);
    }
    /** Get a stamp by ID. */
    get(id) {
        return this.stamps.get(id);
    }
    /** Check if stamp exists. */
    has(id) {
        return this.stamps.has(id);
    }
    /** Get all stamps. */
    getAll() {
        return Array.from(this.stamps.values());
    }
    /** Get stamps by rule ID. */
    getByRule(ruleId) {
        return Array.from(this.stamps.values()).filter(s => s.derivation.includes(ruleId));
    }
    /** Get root stamps (no parents). */
    getRoots() {
        return Array.from(this.stamps.values()).filter(s => s.parents.length === 0);
    }
    /** Get stamps by evidence depth. */
    getByEvidence(evidence) {
        return Array.from(this.stamps.values()).filter(s => s.evidence === evidence);
    }
    /** Get causal cone (stamp + all descendants). */
    getCausalCone(stampId) {
        const cone = [];
        const stamp = this.stamps.get(stampId);
        if (!stamp)
            return cone;
        const visited = new Set();
        const queue = [stamp];
        while (queue.length > 0) {
            const current = queue.pop();
            if (visited.has(current.id))
                continue;
            visited.add(current.id);
            cone.push(current);
            // Find children
            for (const s of this.stamps.values()) {
                if (s.parents.includes(current.id) && !visited.has(s.id)) {
                    queue.push(s);
                }
            }
        }
        return cone;
    }
    /** Clear store. */
    clear() {
        this.stamps.clear();
    }
    /** Size of store. */
    size() {
        return this.stamps.size;
    }
}
/** Create a new stamp store. */
export function createStampStore() {
    return new StampStore();
}
export function reconstructStampsFromLog(entries, ruleIdExtractor) {
    const store = new Map();
    for (const entry of entries) {
        const ruleId = ruleIdExtractor(entry);
        if (!ruleId)
            continue;
        // For simplicity, assume single parent for now
        // In practice, would need to track premise stamps
        const parentIds = entry.stamp.parents;
        const parentStamps = parentIds.map(id => store.get(id)).filter((s) => s !== undefined);
        const newStamp = parentStamps.length > 0
            ? createDerivedStamp(parentStamps, ruleId, { ts: entry.stamp.ts })
            : createRootStamp({ ts: entry.stamp.ts, ruleId });
        // Preserve the original ID from log
        const preservedStamp = {
            ...newStamp,
            id: entry.stamp.id,
        };
        store.set(preservedStamp.id, preservedStamp);
    }
    return store;
}
