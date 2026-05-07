/**
 * Stamp system for tracking derivation history
 */

import {makeId} from '../utils';

export type Source = 'INPUT' | 'DERIVED';

export interface Stamp {
    readonly id: string;
    readonly creationTime: number;
    readonly source: Source;
    readonly derivations: readonly string[];
    readonly depth: number;
}

const MAX_DEPTH = 10;

export const Stamp = {
    createInput(): Stamp {
        return Object.freeze({
            id: makeId(),
            creationTime: Date.now(),
            source: 'INPUT' as const,
            derivations: [],
            depth: 0
        });
    },

    derive(parentStamps: readonly Stamp[], source: Source = 'DERIVED'): Stamp | undefined {
        if (parentStamps.length === 0) {
            return Object.freeze({
                id: makeId(),
                creationTime: Date.now(),
                source,
                derivations: [],
                depth: 0
            });
        }
        const maxDepth = parentStamps.reduce((max, s) => Math.max(max, s.depth), 0);
        if (maxDepth >= MAX_DEPTH) return undefined;

        const allDerivations = parentStamps.flatMap(s => [s.id, ...s.derivations]);
        return Object.freeze({
            id: makeId(),
            creationTime: Date.now(),
            source,
            derivations: [...new Set(allDerivations)],
            depth: maxDepth + 1
        });
    },

    getDepth: (stamp: Stamp): number => stamp.depth,

    getMaxDepth: (stamps: readonly Stamp[]): number =>
        stamps.reduce((max, s) => Math.max(max, s.depth), 0),

    canDerive: (stamps: readonly Stamp[]): boolean =>
        Stamp.getMaxDepth(stamps) < MAX_DEPTH
};

export {MAX_DEPTH};
