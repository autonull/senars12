import { threadId } from 'node:worker_threads';
import { maxScore, unique } from '@senars/util/collections';
import { DEPTH_MAX } from '../../types/primitives';
/** Deepest derivation lineage across a stamp set; 0 for an empty set. */
const maxDepthOf = (stamps) => maxScore(stamps, (stamp) => stamp.derivations.length);
const nowMicroseconds = () => (Date.now() * 1000);
// Monotonic stamp-ID counter. Atomics-backed so IDs stay unique when the
// underlying buffer is shared across worker threads; the `threadId` prefix keeps
// per-isolate counters distinct without sharing.
const counterView = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
const nextStampId = () => `${threadId}:${Atomics.add(counterView, 0, 1)}`;
/**
 * Advance the ID counter past a persisted ID so reloaded stamps never collide
 * with newly minted ones. No-op for foreign ID formats. CAS loop keeps it
 * correct even if another thread mints concurrently.
 */
export const observeStampId = (id) => {
    const sep = id.lastIndexOf(':');
    if (sep < 0)
        return;
    const n = Number(id.slice(sep + 1));
    if (!Number.isInteger(n) || n < 0)
        return;
    let cur = Atomics.load(counterView, 0);
    while (n >= cur) {
        if (Atomics.compareExchange(counterView, 0, cur, n + 1) === cur)
            return;
        cur = Atomics.load(counterView, 0);
    }
};
export const serializeStamp = (stamp) => ({
    id: stamp.id,
    creationTime: stamp.creationTime,
    source: stamp.source,
    derivations: [...stamp.derivations],
});
export const deserializeStamp = (data) => {
    observeStampId(data.id);
    for (const d of data.derivations)
        observeStampId(d);
    return Object.freeze({
        id: data.id,
        creationTime: data.creationTime,
        source: data.source,
        derivations: [...data.derivations],
    });
};
/**
 * The one construction of a stamp. Three factories used to open the same frozen
 * record with only `id`, `source` and `derivations` varying, which is exactly
 * the set of things a stamp *is* — so a fourth field added to the interface had
 * three places to be remembered in. Callers name the differences; the record has
 * one shape and one creation time per stamp.
 */
const mint = (id, source, derivations = []) => Object.freeze({ id, creationTime: nowMicroseconds(), source, derivations });
export const Stamp = {
    createInput(id) {
        return mint(id ?? nextStampId(), 'INPUT');
    },
    createWithSource(source) {
        return mint(nextStampId(), source);
    },
    derive(parentStamps, source = 'DERIVED') {
        // Lineage gate on ancestor-set size. Exact for linear chains (length ==
        // chain depth); bushy proofs cut sooner, which is resource-principled
        // since set size tracks inference work. Strictly increasing along any
        // path, so termination is preserved.
        const maxLineage = maxDepthOf(parentStamps);
        if (maxLineage >= DEPTH_MAX)
            return undefined;
        // Ordered union of each parent's lineage plus its own id; duplicates —
        // repeated parents and shared ancestors — collapse in one pass.
        const derivations = unique(parentStamps.flatMap((parent) => [...parent.derivations, parent.id]));
        return mint(nextStampId(), source, derivations);
    },
    getDepth: (stamp) => stamp.derivations.length,
    /**
     * Every ancestor `stamp` records, root-most first, with the stamp itself last.
     *
     * The one reading of "how was this claim reached", because `derivations` *is*
     * the ancestor set: there is no parent pointer to walk, so a path had to be
     * reconstructed from a side index or quietly collapse to the stamp alone.
     */
    lineage: (stamp) => (stamp ? [...stamp.derivations, stamp.id] : []),
    getMaxDepth: (stamps) => maxDepthOf(stamps),
    canDerive: (stamps) => Stamp.getMaxDepth(stamps) < DEPTH_MAX,
    overlaps: (a, b) => {
        if (a.id === b.id)
            return true;
        const bIds = new Set(b.derivations);
        bIds.add(b.id);
        for (const id of a.derivations) {
            if (bIds.has(id))
                return true;
        }
        return false;
    },
};
