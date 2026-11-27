/**
 * Phase B (REFACTOR.todo1): append-only parameter change ledger + outcome
 * correlation. Ledgers observe (C2) — never decide: records are consulted by
 * governors (`.parameters` command, retrospectives, `improvedOnly` series);
 * no write path mutates truth values.
 *
 * Ledger-off default (C1): nothing is attached or persisted unless a host
 * wires `ParameterLedger` into the writers (NAR.setParameterLedger, bot).
 *
 * REFACTOR.todo4 Phase B: now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 */
import { type Ledger, type LedgerQuery } from '../util/ledger';
import { z } from 'zod';
export interface ParameterRecord {
    /** Subsystem that performed the write (e.g. 'self-meta-game', 'rlfp'). */
    writer: string;
    /** Parameter-table scope or logical surface ('strategy', 'rlfp'). */
    scope: string;
    parameter: string;
    oldValue: number | string;
    newValue: number | string;
    at: number;
    /** What motivated the change (e.g. tuning update, retrospective digest). */
    trigger?: string;
}
export interface ParameterLedgerOptions {
    /** Append-only JSONL sink directory; omitted ⇒ in-memory only. */
    path?: string;
}
declare const ParameterRecordSchema: z.ZodObject<{
    at: z.ZodNumber;
    correlationId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    writer: z.ZodString;
    scope: z.ZodString;
    parameter: z.ZodString;
    oldValue: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    newValue: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    trigger: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ParameterLedgerEntry = z.infer<typeof ParameterRecordSchema>;
export declare const DEFAULT_LEDGER_PATH: string;
/**
 * ParameterLedger — now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 * Maintains the exact same public API for existing consumers.
 * Sync query methods read from an in-memory cache (hot + explicitly loaded entries).
 */
export declare class ParameterLedger {
    #private;
    constructor(options?: ParameterLedgerOptions);
    get size(): number;
    record(entry: ParameterRecord): void;
    query(filter?: {
        parameter?: string;
        writer?: string;
    }): readonly ParameterRecord[];
    /** Async query with full disk scan (for new consumers). */
    queryAsync(filter?: LedgerQuery): Promise<readonly ParameterLedgerEntry[]>;
    /** Get the underlying ledger for advanced operations (compact, rotate, etc.). */
    get ledger(): Ledger<ParameterLedgerEntry>;
}
export interface OutcomeSample {
    at: number;
    quality: number;
}
export interface ParameterImprovement {
    parameter: string;
    oldValue: number | string;
    newValue: number | string;
    at: number;
    /** Mean outcome quality in `windowMs` before vs after the change. */
    before: number;
    after: number;
    improved: boolean;
}
/**
 * Joins ledger changes against an outcome series (trace grades, Brier scores,
 * retrospective correction rates) — per-parameter improvement evidence.
 */
export declare class OutcomeLinker {
    private readonly ledger;
    private readonly outcomes;
    constructor(ledger: ParameterLedger, outcomes: () => readonly OutcomeSample[]);
    correlate(options?: {
        parameter?: string;
        windowMs?: number;
    }): Promise<ParameterImprovement[]>;
    /** Evidence-gated view (N1): only changes followed by quality improvement. */
    improvedOnly(options?: {
        parameter?: string;
        windowMs?: number;
    }): Promise<ParameterImprovement[]>;
}
export {};
//# sourceMappingURL=parameter-ledger.d.ts.map