/**
 * Stamp system for tracking derivation history
 */

import type { Increment, Nat, Timestamp } from '../types';
import { DEPTH_MAX, createTimestamp } from '../types';
import { makeId } from '../utils';

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
      creationTime: createTimestamp(),
      source: 'INPUT' as const,
      derivations: [],
      depth: 0,
    });
  },

  createInputWithId(id: string): Stamp {
    return Object.freeze({
      id,
      creationTime: createTimestamp(),
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
        creationTime: createTimestamp(),
        source,
        derivations: [],
        depth: 0 as Increment<D>,
      });
    }
    const maxDepth = parentStamps.reduce((max, s) => Math.max(max, s.depth), 0);
    if (maxDepth >= DEPTH_MAX) return undefined;

    const seenEvidence = new Set<string>();
    let totalCount = 0;

    for (const stamp of parentStamps) {
      if (!stamp) continue;
      seenEvidence.add(stamp.id);
      totalCount++;
      if (stamp.derivations) {
        for (const derivationId of stamp.derivations) {
          seenEvidence.add(derivationId);
          totalCount++;
        }
      }
    }

    if (seenEvidence.size < totalCount) {
      // Deduplicate if identical parent
      const uniqueParents = new Set(parentStamps.map((s) => s.id));
      if (uniqueParents.size === 1 && parentStamps.length > 1) {
        // Return just one of the parents if they are identical
        return Object.freeze({
          id: makeId(),
          creationTime: createTimestamp(),
          source,
          derivations: Array.from(seenEvidence),
          depth: (maxDepth + 1) as Increment<D>,
        });
      }
      return undefined;
    }

    return Object.freeze({
      id: makeId(),
      creationTime: createTimestamp(),
      source,
      derivations: Array.from(seenEvidence),
      depth: (maxDepth + 1) as Increment<D>,
    });
  },

  getDepth: (stamp: Stamp): number => stamp.depth,

  getMaxDepth: (stamps: readonly Stamp[]): number =>
    stamps.reduce((max, s) => Math.max(max, s.depth), 0),

  canDerive: (stamps: readonly Stamp[]): boolean => Stamp.getMaxDepth(stamps) < DEPTH_MAX,
};
