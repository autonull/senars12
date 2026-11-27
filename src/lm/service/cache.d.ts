import type { LMGenerateOptions } from '@senars/types/llm';
import { type Clock } from '@senars/util/clock';
/**
 * The key covers every field that can change a completion, in a fixed order.
 * The parts are length-prefixed rather than delimiter-joined: a GBNF `grammar`
 * is full of `|`, so a joined key cannot tell a grammar from a prompt that
 * straddled the same delimiter.
 */
export declare function buildCacheKey(prompt: string, options?: LMGenerateOptions): string;
/**
 * Prompt-hash-keyed semantic cache with a 60s TTL, cleared on failure so a retry
 * re-populates.
 *
 * D16: bounded memory without a timer. The sweep runs at most once per TTL
 * window rather than on every write — `settle` is on the innermost LM path, and
 * a per-write `purgeExpired` walked the whole map per completion to reclaim
 * entries a read would have reclaimed anyway, since `BoundedMap` treats an
 * expired entry as absent on every read. Reclaiming within one TTL period is the
 * same bound to within a factor of the call rate, and it is amortized O(1) per
 * write instead of O(size).
 */
export declare class ResponseCache {
    #private;
    constructor(opts?: {
        ttlMs?: number;
        now?: Clock;
    });
    /** Entries the map holds — live, plus any expired not yet swept. */
    get size(): number;
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    clear(key: string): void;
}
//# sourceMappingURL=cache.d.ts.map