/**
 * Phase E (REFACTOR.todo1): per-source-key track record → trust ceiling
 * multiplier. Trust-not-truth (RewardGate-compatible, C2): adjusts the
 * source-quality ceiling only — never a Truth value. Accumulates from
 * verification signals only (egress-gate rejections, `.react` corrections,
 * peer shadow-validation failures).
 *
 * REFACTOR.todo4 Phase B: now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 */
import { z } from 'zod';
import type { Clock } from './env';
export interface ReputationEntry {
    confirmed: number;
    contradicted: number;
}
export interface SourceReputationOptions {
    /** Multiplier floor (default 0.5). */
    floor?: number;
    /** JSONL persistence sink directory (append-only, ledger-style). */
    path?: string;
    /** Contradictions needed before the multiplier starts dropping (default 2). */
    contradictionsBeforeDecay?: number;
    /** Maximum entries in memory (AIKR bound; default 10000). LRU eviction applies. */
    capacity?: number;
    /** Clock for deterministic ledger timestamps. */
    clock?: Clock;
}
declare const ReputationDeltaSchema: any;
export type ReputationDeltaEntry = z.infer<typeof ReputationDeltaSchema>;
export declare const DEFAULT_REPUTATION_PATH: any;
export declare const DEFAULT_REPUTATION_CAPACITY = 10000;
/**
 * SourceReputation — now backed by the generic `Ledger<T>` primitive.
 * Maintains the exact same public API for existing consumers.
 */
export declare class SourceReputation {
    #private;
    /** Resolves once the persisted ledger has been folded into `#entries`. */
    readonly ready: Promise<void>;
    constructor(options?: SourceReputationOptions);
    record(key: string, outcome: 'confirmed' | 'contradicted'): void;
    /** Clamped trust multiplier: 1.0 default, decays with contradictions, never below floor. */
    multiplier(key: string): number;
    /** `effectiveCeiling = baseQuality × multiplier` (clamped to [0, 1]). */
    effectiveCeiling(baseQuality: number, key: string): number;
    /** Reputation table for `.status` / retrospective audits. */
    table(): ReadonlyMap<string, ReputationEntry & {
        multiplier: number;
    }>;
    get size(): number;
    /** Current capacity bound (for diagnostics/tests). */
    get capacity(): number;
}
export {};
//# sourceMappingURL=source-reputation.d.ts.map