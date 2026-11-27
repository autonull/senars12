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
import { dirname } from 'node:path';
import { BaseLedgerEntrySchema, createLedger, } from '../util/ledger';
import { cachePath } from './paths';
import { mean } from '../util/numeric';
import { z } from 'zod';
const ParameterRecordSchema = BaseLedgerEntrySchema.extend({
    writer: z.string(),
    scope: z.string(),
    parameter: z.string(),
    oldValue: z.union([z.number(), z.string()]),
    newValue: z.union([z.number(), z.string()]),
    trigger: z.string().optional(),
});
export const DEFAULT_LEDGER_PATH = cachePath('parameters');
/**
 * How many records the synchronous view keeps. A parameter table is read for its
 * recent history — the CLI's `.parameters` shows the tail — so this is a window,
 * and the unbounded array it replaces was an accumulator nothing could bound.
 */
const PARAMETER_LEDGER_WINDOW = 10_000;
/**
 * ParameterLedger — now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 * Maintains the exact same public API for existing consumers.
 * Sync query methods read from an in-memory cache (hot + explicitly loaded entries).
 */
export class ParameterLedger {
    #ledger;
    constructor(options = {}) {
        const basePath = options.path ? dirname(options.path) : DEFAULT_LEDGER_PATH;
        this.#ledger = createLedger(basePath, ParameterRecordSchema, {
            mirror: { maxSize: PARAMETER_LEDGER_WINDOW },
        });
    }
    get size() {
        return this.#ledger.size;
    }
    record(entry) {
        this.#ledger.append(entry);
    }
    query(filter = {}) {
        return this.#ledger
            .records()
            .filter((r) => (!filter.parameter || r.parameter === filter.parameter) &&
            (!filter.writer || r.writer === filter.writer));
    }
    /** Async query with full disk scan (for new consumers). */
    async queryAsync(filter = {}) {
        return this.#ledger.query(filter);
    }
    /** Get the underlying ledger for advanced operations (compact, rotate, etc.). */
    get ledger() {
        return this.#ledger;
    }
}
/**
 * Joins ledger changes against an outcome series (trace grades, Brier scores,
 * retrospective correction rates) — per-parameter improvement evidence.
 */
export class OutcomeLinker {
    ledger;
    outcomes;
    constructor(ledger, outcomes) {
        this.ledger = ledger;
        this.outcomes = outcomes;
    }
    async correlate(options = {}) {
        const windowMs = options.windowMs ?? 60_000;
        const samples = this.outcomes();
        const windowMean = (from, to) => {
            const inWindow = samples.filter((s) => s.at >= from && s.at < to).map((s) => s.quality);
            if (inWindow.length === 0)
                return null;
            return mean(inWindow);
        };
        const entries = await this.ledger.queryAsync({});
        const filtered = options.parameter
            ? entries.filter((r) => r.parameter === options.parameter)
            : entries;
        const out = [];
        for (const r of filtered) {
            const before = windowMean(r.at - windowMs, r.at);
            const after = windowMean(r.at, r.at + windowMs);
            if (before === null || after === null)
                continue;
            out.push({
                parameter: r.parameter,
                oldValue: r.oldValue,
                newValue: r.newValue,
                at: r.at,
                before,
                after,
                improved: after > before,
            });
        }
        return out;
    }
    /** Evidence-gated view (N1): only changes followed by quality improvement. */
    async improvedOnly(options = {}) {
        return (await this.correlate(options)).filter((i) => i.improved);
    }
}
