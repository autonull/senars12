/**
 * Phase E (REFACTOR.todo1): per-source-key track record → trust ceiling
 * multiplier. Trust-not-truth (RewardGate-compatible, C2): adjusts the
 * source-quality ceiling only — never a Truth value. Accumulates from
 * verification signals only (egress-gate rejections, `.react` corrections,
 * peer shadow-validation failures).
 *
 * REFACTOR.todo4 Phase B: now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 */
import { accumulate, indexMap } from '@senars/util/collections';
import { clamp01, flooredRatio } from '@senars/util/numeric';
import { cachePath } from '@senars/config';
import { LruCache } from '@senars/util/lru-cache';
import { BaseLedgerEntrySchema, createLedger } from '@senars/util/ledger';
import { z } from 'zod';
import { createDefaultClock } from './env';
const ReputationDeltaSchema = BaseLedgerEntrySchema.extend({
    key: z.string(),
    delta: z.object({
        confirmed: z.number().optional(),
        contradicted: z.number().optional(),
    }),
});
const zeroReputation = () => ({ confirmed: 0, contradicted: 0 });
export const DEFAULT_REPUTATION_PATH = cachePath('parameters', 'source-reputation');
export const DEFAULT_REPUTATION_CAPACITY = 10_000;
/**
 * SourceReputation — now backed by the generic `Ledger<T>` primitive.
 * Maintains the exact same public API for existing consumers.
 */
export class SourceReputation {
    #ledger;
    #entries;
    #floor;
    #decayGate;
    #clock;
    /** Resolves once the persisted ledger has been folded into `#entries`. */
    ready;
    constructor(options = {}) {
        this.#floor = options.floor ?? 0.5;
        this.#decayGate = options.contradictionsBeforeDecay ?? 2;
        this.#clock = options.clock ?? createDefaultClock();
        this.#entries = new LruCache({ maxSize: options.capacity ?? DEFAULT_REPUTATION_CAPACITY });
        const path = options.path ?? DEFAULT_REPUTATION_PATH;
        this.#ledger = createLedger(path, ReputationDeltaSchema);
        this.ready = this.#ledger
            .query({})
            .then((entries) => {
            for (const r of entries) {
                accumulate(this.#entries, r.key, zeroReputation, (entry) => {
                    entry.confirmed += r.delta.confirmed ?? 0;
                    entry.contradicted += r.delta.contradicted ?? 0;
                });
            }
        })
            .catch(() => { });
    }
    record(key, outcome) {
        accumulate(this.#entries, key, zeroReputation, (entry) => {
            entry[outcome]++;
        });
        const delta = outcome === 'confirmed'
            ? { confirmed: 1, contradicted: 0 }
            : { confirmed: 0, contradicted: 1 };
        this.#ledger.append({
            at: this.#clock.now(),
            key,
            delta,
        });
    }
    /** Clamped trust multiplier: 1.0 default, decays with contradictions, never below floor. */
    multiplier(key) {
        const entry = this.#entries.get(key);
        if (!entry)
            return 1;
        if (entry.contradicted < this.#decayGate)
            return 1;
        const share = flooredRatio(entry.contradicted, entry.confirmed + entry.contradicted);
        return Math.max(this.#floor, clamp01(1 - share));
    }
    /** `effectiveCeiling = baseQuality × multiplier` (clamped to [0, 1]). */
    effectiveCeiling(baseQuality, key) {
        return clamp01(baseQuality * this.multiplier(key));
    }
    /** Reputation table for `.status` / retrospective audits. */
    table() {
        return indexMap(this.#entries, (entry, key) => ({ ...entry, multiplier: this.multiplier(key) }));
    }
    get size() {
        return this.#entries.size();
    }
    /** Current capacity bound (for diagnostics/tests). */
    get capacity() {
        return this.#entries.maxSize;
    }
}
