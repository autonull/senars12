/**
 * Stamp system for tracking derivation history
 */

import {makeId} from '../utils';
import type {Increment, Nat} from '../types';
import {DEPTH_MAX} from '../types';

export type Source = 'INPUT' | 'DERIVED' | 'CONSTITUTION' | 'LM' | 'EXTERNAL_MCP';

export interface Stamp<D extends Nat = 0> {
    readonly id: string;
    readonly creationTime: number;
    readonly source: Source;
    readonly derivations: readonly string[];
    readonly depth: D;
}

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

    derive<D extends Nat>(parentStamps: readonly Stamp<D>[], source: Source = 'DERIVED'): D extends 10 ? undefined : Stamp<Increment<D>> {
        if (parentStamps.length === 0) {
            return Object.freeze({
                id: makeId(),
                creationTime: Date.now(),
                source,
                derivations: [],
                depth: 0
            }) as any;
        }
        const maxDepth = parentStamps.reduce((max, s) => Math.max(max, s.depth), 0);
        if (maxDepth >= DEPTH_MAX) return undefined as any;

        const allDerivations = parentStamps.flatMap(s => [s.id, ...s.derivations]);
        return Object.freeze({
            id: makeId(),
            creationTime: Date.now(),
            source,
            derivations: [...new Set(allDerivations)],
            depth: (maxDepth + 1) as Increment<D>
        }) as any;
    },

    getDepth: (stamp: Stamp): number => stamp.depth,

    getMaxDepth: (stamps: readonly Stamp[]): number =>
        stamps.reduce((max, s) => Math.max(max, s.depth), 0),

    canDerive: (stamps: readonly Stamp[]): boolean =>
        Stamp.getMaxDepth(stamps) < DEPTH_MAX
};


