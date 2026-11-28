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
import type { UUID } from './types';
import type { Clock } from './env';
/** Timestamp in milliseconds since epoch. */
export type TimestampMs = number;
/** Get current timestamp from clock or default. */
export declare const nowOf: (clock?: Clock) => TimestampMs;
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
export declare function createRootStamp(options?: {
    ts?: TimestampMs;
    ruleId?: string;
    clock?: Clock;
}): Stamp;
/** Create a derived stamp from parent stamps. */
export declare function createDerivedStamp(parents: readonly Stamp[], ruleId: string, options?: {
    ts?: TimestampMs;
    additionalRules?: readonly string[];
    clock?: Clock;
}): Stamp;
/** Create a stamp from parent IDs (for replay/reconstruction). */
export declare function createStampFromIds(parentIds: readonly UUID[], ruleId: string, evidence: number, options?: {
    ts?: TimestampMs;
    additionalRules?: readonly string[];
    clock?: Clock;
}): Stamp;
/** Merge multiple stamps (for revision/confluence). */
export declare function mergeStamps(stamps: readonly Stamp[], ruleId: string, clock?: Clock): Stamp;
/** Check if stamp A is causally before stamp B. */
export declare function isBefore(a: Stamp, b: Stamp): boolean;
/** Check if stamp A is causally ancestor of stamp B. */
export declare function isAncestor(ancestor: Stamp, descendant: Stamp, allStamps: Map<UUID, Stamp>): boolean;
/** Get the causal chain from a stamp to its roots. */
export declare function getCausalChain(stamp: Stamp, allStamps: Map<UUID, Stamp>): Stamp[];
/** Get all ancestors of a stamp. */
export declare function getAncestors(stamp: Stamp, allStamps: Map<UUID, Stamp>): Set<UUID>;
/** Get common ancestors of two stamps. */
export declare function getCommonAncestors(a: Stamp, b: Stamp, allStamps: Map<UUID, Stamp>): Set<UUID>;
/** Stamp equality. */
export declare function stampEquals(a: Stamp, b: Stamp): boolean;
/** Stamp ordering (for sorting). */
export declare function stampCompare(a: Stamp, b: Stamp): number;
/** Format stamp for display. */
export declare function formatStamp(stamp: Stamp): string;
/** Stamp store for managing stamp collections. */
export declare class StampStore {
    private stamps;
    /** Add a stamp. */
    add(stamp: Stamp): void;
    /** Get a stamp by ID. */
    get(id: UUID): Stamp | undefined;
    /** Check if stamp exists. */
    has(id: UUID): boolean;
    /** Get all stamps. */
    getAll(): Stamp[];
    /** Get stamps by rule ID. */
    getByRule(ruleId: string): Stamp[];
    /** Get root stamps (no parents). */
    getRoots(): Stamp[];
    /** Get stamps by evidence depth. */
    getByEvidence(evidence: number): Stamp[];
    /** Get causal cone (stamp + all descendants). */
    getCausalCone(stampId: UUID): Stamp[];
    /** Clear store. */
    clear(): void;
    /** Size of store. */
    size(): number;
}
/** Create a new stamp store. */
export declare function createStampStore(): StampStore;
/** Reconstruct stamps from log entries (for replay). */
export interface LogEntryWithStamp {
    seq: number;
    stamp: Stamp;
    termId: UUID;
}
export declare function reconstructStampsFromLog(entries: LogEntryWithStamp[], ruleIdExtractor: (entry: LogEntryWithStamp) => string | undefined): Map<UUID, Stamp>;
//# sourceMappingURL=stamp.d.ts.map