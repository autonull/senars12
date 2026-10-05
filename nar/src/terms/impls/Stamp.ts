import { threadId } from 'node:worker_threads';
import { maxScore } from '@senars/util';
import { DEPTH_MAX, type Timestamp } from '../../types/primitives.js';

/** Deepest derivation lineage across a stamp set; 0 for an empty set. */
const maxDepthOf = (stamps: readonly Stamp[]): number =>
  maxScore(stamps, (stamp) => stamp.derivations.length);

const nowMicroseconds = (): Timestamp => (Date.now() * 1000) as Timestamp;

// Monotonic stamp-ID counter. Atomics-backed so IDs stay unique when the
// underlying buffer is shared across worker threads; the `threadId` prefix keeps
// per-isolate counters distinct without sharing.
const counterView = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

const nextStampId = (): string => `${threadId}:${Atomics.add(counterView, 0, 1)}`;

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

/**
 * The one construction of a stamp. Three factories used to open the same frozen
 * record with only `id`, `source` and `derivations` varying, which is exactly
 * the set of things a stamp *is* — so a fourth field added to the interface had
 * three places to be remembered in. Callers name the differences; the record has
 * one shape and one creation time per stamp.
 */
const mint = (id: string, source: Source, derivations: readonly string[] = []): Stamp =>
  Object.freeze({ id, creationTime: nowMicroseconds(), source, derivations });

export const Stamp = {
  createInput(id?: string): Stamp {
    return mint(id ?? nextStampId(), 'INPUT');
  },

  createWithSource(source: Source): Stamp {
    return mint(nextStampId(), source);
  },

  derive(parentStamps: readonly Stamp[], source: Source = 'DERIVED'): Stamp | undefined {
    // Lineage gate on ancestor-set size. Exact for linear chains (length ==
    // chain depth); bushy proofs cut sooner, which is resource-principled
    // since set size tracks inference work. Strictly increasing along any
    // path, so termination is preserved.
    const maxLineage = maxDepthOf(parentStamps);
    if (maxLineage >= DEPTH_MAX) return undefined;

    // Ordered union of each parent's lineage plus its own id; duplicates —
    // repeated parents and shared ancestors — collapse in one pass.
    const seen = new Set<string>();
    const derivations: string[] = [];
    for (const parent of parentStamps) {
      for (const id of [...parent.derivations, parent.id]) {
        if (seen.has(id)) continue;
        seen.add(id);
        derivations.push(id);
      }
    }

    return mint(nextStampId(), source, derivations);
  },

  getDepth: (stamp: Stamp): number => stamp.derivations.length,

  /**
   * Every ancestor `stamp` records, root-most first, with the stamp itself last.
   *
   * The one reading of "how was this claim reached", because `derivations` *is*
   * the ancestor set: there is no parent pointer to walk, so a path had to be
   * reconstructed from a side index or quietly collapse to the stamp alone.
   */
  lineage: (stamp: Stamp | undefined): string[] => (stamp ? [...stamp.derivations, stamp.id] : []),

  getMaxDepth: (stamps: readonly Stamp[]): number => maxDepthOf(stamps),

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
