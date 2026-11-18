/**
 * Kernel Bag — the working memory bag for terms.
 *
 * The bag stores terms with their truth values and stamps,
 * organized by term identity (interned) for O(1) lookup.
 * Supports attention-based ordering, capacity limits, and revision.
 */

import { Term, termInterner } from './terms/intern.js';
import { Truth } from './truth.js';
import type { TruthValue, UUID, Stamp } from './types.js';
import type { Frequency, Confidence } from './types.js';

/** Bag entry: term + truth + stamp. */
export interface BagEntry {
  readonly term: Term;
  readonly truth: TruthValue;
  readonly stamp: Stamp;
  /** Attention = f * c (for ordering). */
  readonly attention: number;
  /** Expectation = c * (f - 0.5) + 0.5 (for selection). */
  readonly expectation: number;
  /** Entry metadata. */
  readonly meta: BagEntryMeta;
}

/** Entry metadata. */
export interface BagEntryMeta {
  /** Source quality. */
  sourceQuality: 'PRIMARY' | 'SECONDARY' | 'GENERAL' | 'TERTIARY' | 'LLM_PRIOR' | 'PEER_AGENT' | 'SELF_METTA';
  /** Task type that introduced this. */
  taskType: 'belief' | 'goal' | 'question' | 'command';
  /** Revision count. */
  revisionCount: number;
  /** Last access timestamp. */
  lastAccess: number;
  /** Creation timestamp. */
  createdAt: number;
}

/** Bag configuration. */
export interface BagConfig {
  /** Maximum entries in bag. */
  capacity: number;
  /** Minimum attention to retain. */
  minAttention: number;
  /** Minimum confidence to retain. */
  minConfidence: number;
  /** Eviction policy when full. */
  evictionPolicy: 'lru' | 'lfu' | 'attention' | 'expectation';
  /** Enable revision of duplicate terms. */
  enableRevision: boolean;
}

/** Default bag configuration. */
export const defaultBagConfig: BagConfig = {
  capacity: 10000,
  minAttention: 0.01,
  minConfidence: 0.1,
  evictionPolicy: 'attention',
  enableRevision: true,
};

/** Bag statistics. */
export interface BagStats {
  size: number;
  capacity: number;
  utilization: number;
  totalAttention: number;
  avgAttention: number;
  byTaskType: Record<string, number>;
  bySourceQuality: Record<string, number>;
}

/** The bag implementation. */
export class Bag {
  private config: BagConfig;
  private entries = new Map<Term, BagEntry>();
  private accessOrder: Term[] = []; // For LRU
  private accessCounts = new Map<Term, number>(); // For LFU

  constructor(config: Partial<BagConfig> = {}) {
    this.config = { ...defaultBagConfig, ...config };
  }

  /** Get bag configuration. */
  getConfig(): BagConfig {
    return { ...this.config };
  }

  /** Update configuration. */
  setConfig(config: Partial<BagConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get an entry by term. */
  get(term: Term): BagEntry | undefined {
    const entry = this.entries.get(term);
    if (entry) {
      this.recordAccess(term);
      // Return updated entry with new access time
      return { ...entry, meta: { ...entry.meta, lastAccess: Date.now() } };
    }
    return undefined;
  }

  /** Check if term exists in bag. */
  has(term: Term): boolean {
    return this.entries.has(term);
  }

  /** Add or update a term in the bag. */
  put(term: Term, truth: TruthValue, stamp: Stamp, meta: Partial<BagEntryMeta> = {}): BagEntry {
    const attention = truth.f * truth.c;
    const expectation = truth.c * (truth.f - 0.5) + 0.5;
    const now = Date.now();

    const existing = this.entries.get(term);

    let entry: BagEntry;

    if (existing && this.config.enableRevision) {
      // Revise truth with existing
      const revisedTruth = this.reviseTruth(existing.truth, truth);
      const mergedStamp = this.mergeStamps(existing.stamp, stamp);
      entry = {
        term,
        truth: revisedTruth,
        stamp: mergedStamp,
        attention: revisedTruth.f * revisedTruth.c,
        expectation: revisedTruth.c * (revisedTruth.f - 0.5) + 0.5,
        meta: {
          sourceQuality: meta.sourceQuality ?? existing.meta.sourceQuality,
          taskType: meta.taskType ?? existing.meta.taskType,
          revisionCount: existing.meta.revisionCount + 1,
          lastAccess: now,
          createdAt: existing.meta.createdAt,
        },
      };
    } else {
      entry = {
        term,
        truth,
        stamp,
        attention,
        expectation,
        meta: {
          sourceQuality: meta.sourceQuality ?? 'GENERAL',
          taskType: meta.taskType ?? 'belief',
          revisionCount: 0,
          lastAccess: now,
          createdAt: now,
        },
      };
    }

    // Check thresholds
    if (entry.attention < this.config.minAttention) {
      return entry; // Don't store below threshold
    }
    if (entry.truth.c < this.config.minConfidence) {
      return entry; // Don't store below threshold
    }

    this.entries.set(term, entry);
    this.recordAccess(term);
    this.enforceCapacity();

    return entry;
  }

  /** Revise two truth values. */
  private reviseTruth(existing: TruthValue, incoming: TruthValue): TruthValue {
    // Weighted by confidence
    const w1 = Truth.c2w(existing.c);
    const w2 = Truth.c2w(incoming.c);
    const w = w1 + w2;
    const newC = Truth.w2c(w);

    if (newC > Truth.MAX_CONFIDENCE) {
      return {
        f: (existing.f * existing.c + incoming.f * incoming.c) / (existing.c + incoming.c),
        c: Truth.MAX_CONFIDENCE,
      };
    }
    return {
      f: (existing.f * w1 + incoming.f * w2) / w,
      c: newC,
    };
  }

  /** Merge two stamps. */
  private mergeStamps(existing: Stamp, incoming: Stamp): Stamp {
    const allParents = [...new Set([...existing.parents, ...incoming.parents])];
    const allDerivations = [...new Set([...existing.derivation, ...incoming.derivation])];
    const maxEvidence = Math.max(existing.evidence, incoming.evidence);

    return {
      id: existing.id, // Keep existing identity
      ts: Math.max(existing.ts, incoming.ts),
      parents: allParents,
      derivation: allDerivations,
      evidence: maxEvidence,
    };
  }

  /** Record access for eviction policies. */
  private recordAccess(term: Term): void {
    // LRU: move to end
    const idx = this.accessOrder.indexOf(term);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(term);

    // LFU: increment count
    this.accessCounts.set(term, (this.accessCounts.get(term) ?? 0) + 1);
  }

  /** Enforce capacity limit. */
  private enforceCapacity(): void {
    while (this.entries.size > this.config.capacity) {
      const victim = this.selectVictim();
      if (!victim) break;
      this.entries.delete(victim);
      const idx = this.accessOrder.indexOf(victim);
      if (idx >= 0) this.accessOrder.splice(idx, 1);
      this.accessCounts.delete(victim);
    }
  }

  /** Select victim for eviction. */
  private selectVictim(): Term | null {
    if (this.entries.size === 0) return null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        return this.accessOrder[0] ?? null;
      case 'lfu': {
        let minCount = Infinity;
        let victim: Term | null = null;
        for (const [term, count] of this.accessCounts) {
          if (count < minCount) {
            minCount = count;
            victim = term;
          }
        }
        return victim;
      }
      case 'attention': {
        let minAttention = Infinity;
        let victim: Term | null = null;
        for (const [term, entry] of this.entries) {
          if (entry.attention < minAttention) {
            minAttention = entry.attention;
            victim = term;
          }
        }
        return victim;
      }
      case 'expectation': {
        let minExpectation = Infinity;
        let victim: Term | null = null;
        for (const [term, entry] of this.entries) {
          if (entry.expectation < minExpectation) {
            minExpectation = entry.expectation;
            victim = term;
          }
        }
        return victim;
      }
    }
  }

  /** Remove a term from the bag. */
  delete(term: Term): boolean {
    const result = this.entries.delete(term);
    if (result) {
      const idx = this.accessOrder.indexOf(term);
      if (idx >= 0) this.accessOrder.splice(idx, 1);
      this.accessCounts.delete(term);
    }
    return result;
  }

  /** Clear the bag. */
  clear(): void {
    this.entries.clear();
    this.accessOrder = [];
    this.accessCounts.clear();
  }

  /** Get all entries. */
  getAll(): BagEntry[] {
    return Array.from(this.entries.values());
  }

  /** Get entries sorted by attention (descending). */
  getByAttention(limit?: number): BagEntry[] {
    const sorted = this.getAll().sort((a, b) => b.attention - a.attention);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** Get entries sorted by expectation (descending). */
  getByExpectation(limit?: number): BagEntry[] {
    const sorted = this.getAll().sort((a, b) => b.expectation - a.expectation);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** Get entries by task type. */
  getByTaskType(taskType: BagEntryMeta['taskType']): BagEntry[] {
    return this.getAll().filter(e => e.meta.taskType === taskType);
  }

  /** Get entries by source quality. */
  getBySourceQuality(quality: BagEntryMeta['sourceQuality']): BagEntry[] {
    return this.getAll().filter(e => e.meta.sourceQuality === quality);
  }

  /** Get entries with truth above threshold. */
  getAboveThreshold(minExpectation: number): BagEntry[] {
    return this.getAll().filter(e => e.expectation >= minExpectation);
  }

  /** Get bag statistics. */
  getStats(): BagStats {
    const entries = this.getAll();
    const totalAttention = entries.reduce((sum, e) => sum + e.attention, 0);

    const byTaskType: Record<string, number> = {};
    const bySourceQuality: Record<string, number> = {};

    for (const entry of entries) {
      byTaskType[entry.meta.taskType] = (byTaskType[entry.meta.taskType] ?? 0) + 1;
      bySourceQuality[entry.meta.sourceQuality] = (bySourceQuality[entry.meta.sourceQuality] ?? 0) + 1;
    }

    return {
      size: this.entries.size,
      capacity: this.config.capacity,
      utilization: this.entries.size / this.config.capacity,
      totalAttention,
      avgAttention: entries.length > 0 ? totalAttention / entries.length : 0,
      byTaskType,
      bySourceQuality,
    };
  }

  /** Get the term factory for creating terms. */
  getTermFactory() {
    return termInterner.getFactory();
  }
}

/** Create a new bag. */
export function createBag(config?: Partial<BagConfig>): Bag {
  return new Bag(config);
}

/** Multi-bag: separate bags for beliefs, goals, questions. */
export interface MultiBag {
  beliefs: Bag;
  goals: Bag;
  questions: Bag;
  commands: Bag;
}

/** Create a multi-bag with shared configuration. */
export function createMultiBag(config?: Partial<BagConfig>): MultiBag {
  const baseConfig = { ...defaultBagConfig, ...config };
  return {
    beliefs: new Bag(baseConfig),
    goals: new Bag(baseConfig),
    questions: new Bag(baseConfig),
    commands: new Bag(baseConfig),
  };
}

/** Bag view: filtered, sorted view of a bag. */
export class BagView {
  private bag: Bag;
  private filter: (entry: BagEntry) => boolean;
  private sort: (a: BagEntry, b: BagEntry) => number;

  constructor(
    bag: Bag,
    filter: (entry: BagEntry) => boolean = () => true,
    sort: (a: BagEntry, b: BagEntry) => number = (a, b) => b.attention - a.attention
  ) {
    this.bag = bag;
    this.filter = filter;
    this.sort = sort;
  }

  /** Get filtered and sorted entries. */
  getEntries(limit?: number): BagEntry[] {
    return this.bag.getAll()
      .filter(this.filter)
      .sort(this.sort)
      .slice(0, limit);
  }

  /** Get first entry. */
  first(): BagEntry | undefined {
    return this.getEntries(1)[0];
  }

  /** Check if view is empty. */
  isEmpty(): boolean {
    return this.getEntries(1).length === 0;
  }

  /** Get view size. */
  size(): number {
    return this.bag.getAll().filter(this.filter).length;
  }
}

/** Create a bag view. */
export function createBagView(
  bag: Bag,
  filter?: (entry: BagEntry) => boolean,
  sort?: (a: BagEntry, b: BagEntry) => number
): BagView {
  return new BagView(bag, filter, sort);
}