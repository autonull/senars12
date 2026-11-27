/** Per-call accounting for every LM path (text, structured, stream).
 *
 *  A call is only *transport* plus *bookkeeping*. This module owns both: the
 *  breaker gate, grammar scope and provider retry that wrap a transport, and
 *  every bookkeeping step — response cache, spend ledger, per-model stats,
 *  routing telemetry, transport-failure demotion. One protocol, so no path can
 *  silently skip a step its siblings perform (the demotion the structured path
 *  used to miss is the canonical example). */
import type { LMProviderName, LMSettings } from '../env-config';
import type { ProviderRuntime } from '../provider-runtime';
import { type ProviderSpend } from './spend';
import type { LMTask, LMExecutionStats } from '@senars/types/llm';
declare const identity: (raw: string) => string;
/** Raw text needs no codec — the cache already holds the value verbatim. */
export declare const textCodec: {
    encode: typeof identity;
    decode: typeof identity;
};
/** Token counts the AI SDK reports once a call settles. */
export interface TokenUsage {
    inputTokens?: number;
    outputTokens?: number;
}
/** Seams handed to a transport body. */
export interface CallContext {
    /** Publish usage to the spend ledger; throws once the budget is spent. */
    report: (usage?: TokenUsage) => void;
}
/** Everything about one call except the provider transport itself. */
export interface CallEnvelope<T> {
    task: LMTask;
    prompt: string;
    cacheKey: string;
    /** Cached string ⇄ value codec — identity for raw text, JSON for objects. */
    encode: (value: T) => string;
    decode: (raw: string) => T;
    /** GBNF grammar to enforce for the duration of the call. */
    grammar?: string;
}
/** An envelope `execute` can drive to completion with no caller-side loop. */
export type CallSpec<T> = CallEnvelope<T> & {
    run: (ctx: CallContext) => Promise<T>;
};
/** A cache hit needs no transport; {@link CallEnvelope.decode} reconstructs the value. */
export type CacheHit<T> = {
    hit: false;
} | {
    hit: true;
    value: T;
};
/** Provider + settings resolved for a gated call. */
export interface AccountingGate {
    provider: LMProviderName | undefined;
    settings: LMSettings;
}
/** How a settled call reached its outcome. `tokens` overrides the derived
 *  prompt+output count — streaming paths count bytes as they arrive. */
export type CallOutcome<T> = {
    ok: true;
    value: T;
    tokens?: number;
}
/** `committed` marks a stream that already handed bytes to the caller: the
 *  prior cache entry survives, since no complete value replaced it. */
 | {
    ok: false;
    error: unknown;
    committed: boolean;
    tokens?: number;
};
/** Owns the accounting state and the single protocol every call path follows. */
export declare class CallAccounting {
    #private;
    readonly runtime: ProviderRuntime;
    private readonly reprobe;
    /**
     * Per-model-id stats feeding stats-aware chain reordering.
     *
     * Bounded because the key set is not ours: a model id arrives from a remote
     * endpoint's advertised catalogue or an alias table, so an unbounded map grew
     * with whatever the peer was willing to list. Eviction costs only the oldest
     * model's reliability signal, which routing then reads as "no history" — the
     * answer it already gave an unmeasured model.
     */
    readonly perModel: any;
    constructor(runtime: ProviderRuntime, reprobe?: () => Promise<void>);
    get stats(): LMExecutionStats;
    getSpend(): Record<string, ProviderSpend>;
    /** Fail fast when the active provider's circuit breaker is open. */
    gate(task: LMTask, provider: LMProviderName | undefined): AccountingGate;
    /** Charge the provider's spend ledger; throws LMUnavailableError past the cap. */
    bill(task: LMTask, gate: AccountingGate, usage?: TokenUsage): void;
    lookup<T>(envelope: CallEnvelope<T>, gate: AccountingGate): CacheHit<T>;
    /** Publish a settled call: cache, stats, routing telemetry, demotion, and —
     *  for transport failures — a provider re-probe. Never throws the call's own
     *  error; the caller keeps its own control flow.
     *
     *  `durationMs` is the call's own latency, read once here: stats and routing
     *  telemetry describe the same span, so they must not disagree — and must not
     *  absorb the re-probe below, which is this class's overhead, not the call's. */
    settle<T>(envelope: CallEnvelope<T>, durationMs: number, gate: AccountingGate, outcome: CallOutcome<T>): Promise<void>;
    /** Gate, cache, and settle one awaited call end to end. */
    execute<T>(spec: CallSpec<T>, gate: AccountingGate): Promise<T>;
}
export {};
//# sourceMappingURL=accounting.d.ts.map