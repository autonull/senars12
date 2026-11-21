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
import type { UUID } from './types.js';
import type { Clock } from './env.js';
import { createDefaultClock } from './env.js';

/** Timestamp in milliseconds since epoch. */
export type TimestampMs = number;

/** Get current timestamp from clock or default. */
export const nowOf = (clock?: Clock): TimestampMs => (clock ?? createDefaultClock()).now();

/** Stamp for a term/belief. */
export interface Stamp {
  /** Globally unique identifier. */
  readonly id: UUID;
  /** Creation timestamp (milliseconds since epoch). */
  readonly ts: TimestampMs;
  /** Parent stamp IDs (causal parents). */
  readonly parents: readonly UUID[];
  /** Rule IDs used in derivation. */
  readonly derivation: readonly string[];
  /** Derivation depth (evidential distance from observations). */
  readonly evidence: number;
}

/** Stamp creation options. */
export interface StampOptions {
  /** Parent stamps. */
  parents?: readonly Stamp[];
  /** Parent stamp IDs (alternative to parents). */
  parentIds?: readonly UUID[];
  /** Rule ID that produced this stamp. */
  ruleId?: string;
  /** Rule IDs (alternative to ruleId). */
  ruleIds?: readonly string[];
  /** Base evidence depth. */
  baseEvidence?: number;
}

/** Create a new root stamp (observation/axiom). */
export function createRootStamp(options: { ts?: TimestampMs; ruleId?: string; clock?: Clock } = {}): Stamp {
  return {
    id: randomUUID(),
    ts: options.ts ?? nowOf(options.clock),
    parents: [],
    derivation: options.ruleId ? [options.ruleId] : [],
    evidence: 0,
  };
}

/** Create a derived stamp from parent stamps. */
export function createDerivedStamp(
  parents: readonly Stamp[],
  ruleId: string,
  options: { ts?: TimestampMs; additionalRules?: readonly string[]; clock?: Clock } = {}
): Stamp {
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
export function createStampFromIds(
  parentIds: readonly UUID[],
  ruleId: string,
  evidence: number,
  options: { ts?: TimestampMs; additionalRules?: readonly string[]; clock?: Clock } = {}
): Stamp {
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
export function mergeStamps(stamps: readonly Stamp[], ruleId: string, clock?: Clock): Stamp {
  if (stamps.length === 0) throw new Error('Cannot merge empty stamp set');
  if (stamps.length === 1) return stamps[0]!;

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
export function isBefore(a: Stamp, b: Stamp): boolean {
  return a.ts < b.ts || (a.ts === b.ts && a.id < b.id);
}

/** Check if stamp A is causally ancestor of stamp B. */
export function isAncestor(ancestor: Stamp, descendant: Stamp, allStamps: Map<UUID, Stamp>): boolean {
  if (ancestor.id === descendant.id) return false;
  const visited = new Set<UUID>();
  const queue = [...descendant.parents];

  while (queue.length > 0) {
    const id = queue.pop()!;
    if (id === ancestor.id) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    const stamp = allStamps.get(id);
    if (stamp) queue.push(...stamp.parents);
  }
  return false;
}

/** Get the causal chain from a stamp to its roots. */
export function getCausalChain(stamp: Stamp, allStamps: Map<UUID, Stamp>): Stamp[] {
  const chain: Stamp[] = [stamp];
  const visited = new Set<UUID>([stamp.id]);
  let current: Stamp | undefined = stamp;

  while (current && current.parents.length > 0) {
    // For simplicity, follow first parent (could be all parents)
    const parentId = current.parents[0]!;
    if (visited.has(parentId)) break;
    const parent = allStamps.get(parentId);
    if (!parent) break;
    chain.push(parent);
    current = parent;
    visited.add(parentId);
  }

  return chain;
}

/** Get all ancestors of a stamp. */
export function getAncestors(stamp: Stamp, allStamps: Map<UUID, Stamp>): Set<UUID> {
  const ancestors = new Set<UUID>();
  const queue = [...stamp.parents];

  while (queue.length > 0) {
    const id = queue.pop()!;
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    const s = allStamps.get(id);
    if (s) queue.push(...s.parents);
  }

  return ancestors;
}

/** Get common ancestors of two stamps. */
export function getCommonAncestors(a: Stamp, b: Stamp, allStamps: Map<UUID, Stamp>): Set<UUID> {
  const ancestorsA = getAncestors(a, allStamps);
  const ancestorsB = getAncestors(b, allStamps);
  const common = new Set<UUID>();

  for (const id of ancestorsA) {
    if (ancestorsB.has(id)) common.add(id);
  }

  return common;
}

/** Stamp equality. */
export function stampEquals(a: Stamp, b: Stamp): boolean {
  return a.id === b.id;
}

/** Stamp ordering (for sorting). */
export function stampCompare(a: Stamp, b: Stamp): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  return a.id < b.id ? -1 : 1;
}

/** Format stamp for display. */
export function formatStamp(stamp: Stamp): string {
  const parents = stamp.parents.length > 0 ? ` parents=[${stamp.parents.join(', ')}]` : '';
  const deriv = stamp.derivation.length > 0 ? ` rules=[${stamp.derivation.join(', ')}]` : '';
  return `Stamp(${stamp.id.slice(0, 8)} ts=${stamp.ts} ev=${stamp.evidence}${parents}${deriv})`;
}

/** Stamp store for managing stamp collections. */
export class StampStore {
  private stamps = new Map<UUID, Stamp>();

  /** Add a stamp. */
  add(stamp: Stamp): void {
    this.stamps.set(stamp.id, stamp);
  }

  /** Get a stamp by ID. */
  get(id: UUID): Stamp | undefined {
    return this.stamps.get(id);
  }

  /** Check if stamp exists. */
  has(id: UUID): boolean {
    return this.stamps.has(id);
  }

  /** Get all stamps. */
  getAll(): Stamp[] {
    return Array.from(this.stamps.values());
  }

  /** Get stamps by rule ID. */
  getByRule(ruleId: string): Stamp[] {
    return Array.from(this.stamps.values()).filter(s => s.derivation.includes(ruleId));
  }

  /** Get root stamps (no parents). */
  getRoots(): Stamp[] {
    return Array.from(this.stamps.values()).filter(s => s.parents.length === 0);
  }

  /** Get stamps by evidence depth. */
  getByEvidence(evidence: number): Stamp[] {
    return Array.from(this.stamps.values()).filter(s => s.evidence === evidence);
  }

  /** Get causal cone (stamp + all descendants). */
  getCausalCone(stampId: UUID): Stamp[] {
    const cone: Stamp[] = [];
    const stamp = this.stamps.get(stampId);
    if (!stamp) return cone;

    const visited = new Set<UUID>();
    const queue = [stamp];

    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current.id)) continue;
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
  clear(): void {
    this.stamps.clear();
  }

  /** Size of store. */
  size(): number {
    return this.stamps.size;
  }
}

/** Create a new stamp store. */
export function createStampStore(): StampStore {
  return new StampStore();
}

/** Reconstruct stamps from log entries (for replay). */
export interface LogEntryWithStamp {
  seq: number;
  stamp: Stamp;
  termId: UUID;
}

export function reconstructStampsFromLog(
  entries: LogEntryWithStamp[],
  ruleIdExtractor: (entry: LogEntryWithStamp) => string | undefined
): Map<UUID, Stamp> {
  const store = new Map<UUID, Stamp>();

  for (const entry of entries) {
    const ruleId = ruleIdExtractor(entry);
    if (!ruleId) continue;

    // For simplicity, assume single parent for now
    // In practice, would need to track premise stamps
    const parentIds = entry.stamp.parents;
    const parentStamps = parentIds.map(id => store.get(id)).filter((s): s is Stamp => s !== undefined);

    const newStamp = parentStamps.length > 0
      ? createDerivedStamp(parentStamps, ruleId, { ts: entry.stamp.ts })
      : createRootStamp({ ts: entry.stamp.ts, ruleId });

    // Preserve the original ID from log
    const preservedStamp: Stamp = {
      ...newStamp,
      id: entry.stamp.id,
    };

    store.set(preservedStamp.id, preservedStamp);
  }

  return store;
}