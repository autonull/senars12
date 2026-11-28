/** Mints one fresh identifier. */
export type IdSource = () => string;
/**
 * The event log's id source: ULID, monotonic and lexicographically sortable.
 * Reused by a seeded run's `sequentialIdSource`, which is sortable for the same
 * reason — so the log's ids stay ordered under a seed too.
 */
export declare const sortableIdSource: () => IdSource;
/**
 * Install `source` as the process id source and return a restore function.
 * Passing nothing restores ambient entropy.
 */
export declare const installIdSource: (source?: IdSource) => (() => void);
/** A fresh UUID, or the installed source's id when one is set. */
export declare const makeId: () => string;
/**
 * How many ids the installed source has minted. The persistence boundary reads
 * this as its id high-water mark (CORE.19 C4.1), so a restart can prime the
 * ledger rather than re-mint an id the pre-restart process already stamped.
 */
export declare const currentIdCount: () => number;
/** Raise the minted ledger to `count`. Monotonic — it never lowers the watermark. */
export declare const primeIdCount: (count: number) => void;
/**
 * Counter-derived UUIDs, for seeded runs: `00000000-0000-4000-8000-000000000001`
 * and up. UUID-shaped rather than `evt-1` because `CognitiveEventSchema`
 * validates `taskId` as a UUID at the untrusted boundary, and because a replay
 * trace then reads the same as the live one it replaces.
 */
export declare const sequentialIdSource: () => IdSource;
/**
 * A prefixed, human-readable id. The default entropy is the installed id source
 * so a seeded run mints these deterministically too — `Math.random` here let a
 * seeded process stamp random ids beside the ids it had fixed. Pass an
 * injectable `rng` where a specific stream (e.g. a NAR's `SeededRNG`) must own
 * the choice. The `minted` ledger is shared with `makeId`, so the two id
 * domains never collide.
 */
export declare function generateId(prefix: string, rng?: () => number): string;
//# sourceMappingURL=id.d.ts.map