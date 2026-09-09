import {Temporal} from '@js-temporal/polyfill';
import type {Increment, Nat, Timestamp} from '../types';
import {DEPTH_MAX} from '../types';
import {makeId} from '../utils';

const toMicroseconds = (instant: Temporal.Instant): Timestamp => {
    const nanos = BigInt(instant.epochNanoseconds);
    return Number(nanos / 1000n) as Timestamp;
};

export type Source = 'INPUT' | 'DERIVED' | 'CONSTITUTION' | 'LM' | 'EXTERNAL_MCP';

export interface Stamp<D extends Nat = 0> {
    readonly id: string;
    readonly creationTime: Timestamp;
    readonly source: Source;
    readonly derivations: readonly string[];
    readonly depth: D;
}

export const Stamp = {
    createInput(): Stamp {
        return Object.freeze({
            id: makeId(),
            creationTime: toMicroseconds(Temporal.Now.instant()),
            source: 'INPUT' as const,
            derivations: [],
            depth: 0,
        });
    },

    createInputWithId(id: string): Stamp {
        return Object.freeze({
            id,
            creationTime: toMicroseconds(Temporal.Now.instant()),
            source: 'INPUT' as const,
            derivations: [],
            depth: 0,
        });
    },

    derive<D extends Nat>(
        parentStamps: readonly Stamp<D>[],
        source: Source = 'DERIVED'
    ): Stamp<Increment<D>> | undefined {
        if (parentStamps.length === 0) {
            return Object.freeze({
                id: makeId(),
                creationTime: toMicroseconds(Temporal.Now.instant()),
                source,
                derivations: [],
                depth: 0 as Increment<D>,
            });
        }
        let maxDepth = 0;
        for (const stamp of parentStamps) {
            if (stamp.depth > maxDepth) maxDepth = stamp.depth;
        }
        if (maxDepth >= DEPTH_MAX) return undefined;

        // Fast path: single parent stamp (most common case)
        if (parentStamps.length === 1) {
            const parent = parentStamps[0]!;
            const derivations = parent.derivations.length > 0
                ? [...parent.derivations, parent.id]
                : [parent.id];
            return Object.freeze({
                id: makeId(),
                creationTime: toMicroseconds(Temporal.Now.instant()),
                source,
                derivations,
                depth: (maxDepth + 1) as Increment<D>,
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
                id: makeId(),
                creationTime: toMicroseconds(Temporal.Now.instant()),
                source,
                derivations: derivs,
                depth: (maxDepth + 1) as Increment<D>,
            });
        }

        return Object.freeze({
            id: makeId(),
            creationTime: toMicroseconds(Temporal.Now.instant()),
            source,
            derivations,
            depth: (maxDepth + 1) as Increment<D>,
        });
    },

    getDepth: (stamp: Stamp): number => stamp.depth,

    getMaxDepth: (stamps: readonly Stamp[]): number =>
        stamps.reduce((max, s) => Math.max(max, s.depth), 0),

    canDerive: (stamps: readonly Stamp[]): boolean => Stamp.getMaxDepth(stamps) < DEPTH_MAX,

    overlaps: <D1 extends Nat, D2 extends Nat>(a: Stamp<D1>, b: Stamp<D2>): boolean => {
        if (a.id === b.id) return true;
        const bIds = new Set<string>(b.derivations);
        bIds.add(b.id);
        for (const id of a.derivations) {
            if (bIds.has(id)) return true;
        }
        bIds.add(a.id);
        return false;
    },
};
