import { Temporal } from '@js-temporal/polyfill';
import type { Increment, Nat, Timestamp } from '../types';
import { DEPTH_MAX } from '../types';
import { makeId } from '../utils';

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
      const uniqueParents = new Set(parentStamps.map((s) => s.id));
      if (uniqueParents.size === 1 && parentStamps.length > 1) {
        return Object.freeze({
          id: makeId(),
          creationTime: toMicroseconds(Temporal.Now.instant()),
          source,
          derivations: Array.from(seenEvidence),
          depth: (maxDepth + 1) as Increment<D>,
        });
      }
      return undefined;
    }

    return Object.freeze({
      id: makeId(),
      creationTime: toMicroseconds(Temporal.Now.instant()),
      source,
      derivations: Array.from(seenEvidence),
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
