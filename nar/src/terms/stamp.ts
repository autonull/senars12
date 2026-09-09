import {threadId} from 'node:worker_threads';
import type {Timestamp} from '../types';
import {DEPTH_MAX} from '../types';

const nowMicroseconds = (): Timestamp => (Date.now() * 1000) as Timestamp;

// Monotonic stamp-ID counter. Atomics-backed so IDs stay unique when the
// underlying buffer is shared across worker threads (see shareStampCounterBuffer);
// the `threadId` prefix keeps per-isolate counters distinct without sharing.
let counterView = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

const nextStampId = (): string => `${threadId}:${Atomics.add(counterView, 0, 1)}`;

/** Share one counter buffer across threads (post the result to workers) for process-wide unique IDs. */
export const getStampCounterBuffer = (): SharedArrayBuffer => counterView.buffer as SharedArrayBuffer;

/** Adopt a shared counter buffer created elsewhere (e.g. received from the main thread). */
export const shareStampCounterBuffer = (sab: SharedArrayBuffer): void => {
    counterView = new Int32Array(sab);
};

/**
 * Advance the ID counter past a persisted ID so reloaded stamps never collide
 * with newly minted ones. No-op for foreign ID formats. CAS loop keeps it
 * correct even if another thread mints concurrently.
 */
export const observeStampId = (id: string): void => {
    const sep = id.lastIndexOf(':');
    if (sep < 0) return;
    const n = Number(id.slice(sep + 1));
    if (!Number.isInteger(n) || n < 0) return;
    let cur = Atomics.load(counterView, 0);
    while (n >= cur) {
        if (Atomics.compareExchange(counterView, 0, cur, n + 1) === cur) return;
        cur = Atomics.load(counterView, 0);
    }
};

export interface SerializedStamp {
    id: string;
    creationTime: number;
    source: Source;
    derivations: readonly string[];
}

export const serializeStamp = (stamp: Stamp): SerializedStamp => ({
    id: stamp.id,
    creationTime: stamp.creationTime,
    source: stamp.source,
    derivations: [...stamp.derivations],
});

export const deserializeStamp = (data: SerializedStamp): Stamp => {
    observeStampId(data.id);
    for (const d of data.derivations) observeStampId(d);
    return Object.freeze({
        id: data.id,
        creationTime: data.creationTime as Timestamp,
        source: data.source,
        derivations: [...data.derivations],
    });
};

export type Source = 'INPUT' | 'DERIVED' | 'CONSTITUTION' | 'LM' | 'EXTERNAL_MCP';

export interface Stamp {
    readonly id: string;
    readonly creationTime: Timestamp;
    readonly source: Source;
    readonly derivations: readonly string[];
}

export const Stamp = {
    createInput(): Stamp {
        return Object.freeze({
            id: nextStampId(),
            creationTime: nowMicroseconds(),
            source: 'INPUT' as const,
            derivations: [],
        });
    },

    createInputWithId(id: string): Stamp {
        return Object.freeze({
            id,
            creationTime: nowMicroseconds(),
            source: 'INPUT' as const,
            derivations: [],
        });
    },

    derive(parentStamps: readonly Stamp[], source: Source = 'DERIVED'): Stamp | undefined {
        if (parentStamps.length === 0) {
            return Object.freeze({
                id: nextStampId(),
                creationTime: nowMicroseconds(),
                source,
                derivations: [],
            });
        }
        // Lineage gate on ancestor-set size. Exact for linear chains (length ==
        // chain depth); bushy proofs cut sooner, which is resource-principled
        // since set size tracks inference work. Strictly increasing along any
        // path, so termination is preserved.
        let maxLineage = 0;
        for (const stamp of parentStamps) {
            if (stamp.derivations.length > maxLineage) maxLineage = stamp.derivations.length;
        }
        if (maxLineage >= DEPTH_MAX) return undefined;

        // Fast path: single parent stamp (most common case)
        if (parentStamps.length === 1) {
            const parent = parentStamps[0]!;
            const derivations = parent.derivations.length > 0
                ? [...parent.derivations, parent.id]
                : [parent.id];
            return Object.freeze({
                id: nextStampId(),
                creationTime: nowMicroseconds(),
                source,
                derivations,
            });
        }

        // Multiple parents: use array + sort + dedupe instead of Set for small N
        const derivations: string[] = [];
        for (const stamp of parentStamps) {
            if (!stamp) continue;
            // Add parent id if not already present
            let found = false;
            for (const d of derivations) {
                if (d === stamp.id) { found = true; break; }
            }
            if (!found) derivations.push(stamp.id);
            // Add parent's derivations
            for (const derivationId of stamp.derivations) {
                found = false;
                for (const d of derivations) {
                    if (d === derivationId) { found = true; break; }
                }
                if (!found) derivations.push(derivationId);
            }
        }

        // Check for duplicate parent stamps (same id appearing multiple times)
        let hasDuplicateParents = false;
        for (let i = 0; i < parentStamps.length; i++) {
            for (let j = i + 1; j < parentStamps.length; j++) {
                if (parentStamps[i]!.id === parentStamps[j]!.id) {
                    hasDuplicateParents = true;
                    break;
                }
            }
            if (hasDuplicateParents) break;
        }

        if (hasDuplicateParents && parentStamps.length > 1) {
            // All parent stamps have the same id - treat as single parent
            const parent = parentStamps[0]!;
            const derivs = parent.derivations.length > 0
                ? [...parent.derivations, parent.id]
                : [parent.id];
            return Object.freeze({
                id: nextStampId(),
                creationTime: nowMicroseconds(),
                source,
                derivations: derivs,
            });
        }

        return Object.freeze({
            id: nextStampId(),
            creationTime: nowMicroseconds(),
            source,
            derivations,
        });
    },

    getDepth: (stamp: Stamp): number => stamp.derivations.length,

    getMaxDepth: (stamps: readonly Stamp[]): number =>
        stamps.reduce((max, s) => Math.max(max, s.derivations.length), 0),

    canDerive: (stamps: readonly Stamp[]): boolean => Stamp.getMaxDepth(stamps) < DEPTH_MAX,

    overlaps: (a: Stamp, b: Stamp): boolean => {
        if (a.id === b.id) return true;
        const bIds = new Set<string>(b.derivations);
        bIds.add(b.id);
        for (const id of a.derivations) {
            if (bIds.has(id)) return true;
        }
        return false;
    },
};
