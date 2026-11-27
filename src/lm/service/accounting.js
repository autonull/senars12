/** Per-call accounting for every LM path (text, structured, stream).
 *
 *  A call is only *transport* plus *bookkeeping*. This module owns both: the
 *  breaker gate, grammar scope and provider retry that wrap a transport, and
 *  every bookkeeping step — response cache, spend ledger, per-model stats,
 *  routing telemetry, transport-failure demotion. One protocol, so no path can
 *  silently skip a step its siblings perform (the demotion the structured path
 *  used to miss is the canonical example). */
import { trace } from '@opentelemetry/api';
import { CallTallySeries } from '@senars/util/tally';
import { createLMStats, recordLMCall } from '@senars/types/llm';
import { incrementCount } from '@senars/util/collections';
import { stopwatch } from '@senars/util/async';
import { loadGrammar } from '../grammars/index';
import { runWithGrammar } from '../providers/llamacpp';
import { getLmProvider, getModelChain } from '../providers';
import { ResponseCache } from './cache';
import { isTransportError, LMUnavailableError, withHint, withRetry } from './errors';
import { SpendLedger } from './spend';
/** How many models keep a reliability signal; a peer cannot list its way past it. */
const MAX_TRACKED_MODELS = 256;
const NAMED_GRAMMARS = new Set(['narsese-term', 'single-word']);
const identity = (raw) => raw;
/** Raw text needs no codec — the cache already holds the value verbatim. */
export const textCodec = { encode: identity, decode: identity };
/** Owns the accounting state and the single protocol every call path follows. */
export class CallAccounting {
    runtime;
    reprobe;
    #cache = new ResponseCache();
    #ledger = new SpendLedger();
    #stats = createLMStats();
    /**
     * Per-model-id stats feeding stats-aware chain reordering.
     *
     * Bounded because the key set is not ours: a model id arrives from a remote
     * endpoint's advertised catalogue or an alias table, so an unbounded map grew
     * with whatever the peer was willing to list. Eviction costs only the oldest
     * model's reliability signal, which routing then reads as "no history" — the
     * answer it already gave an unmeasured model.
     */
    perModel = new CallTallySeries({
        maxSize: MAX_TRACKED_MODELS,
        create: createLMStats,
    });
    /** Consecutive transport failures per resolved model id → demotion. */
    #failures = new Map();
    constructor(runtime, reprobe = async () => undefined) {
        this.runtime = runtime;
        this.reprobe = reprobe;
    }
    get stats() {
        return this.#stats;
    }
    getSpend() {
        return this.#ledger.snapshot();
    }
    /** Fail fast when the active provider's circuit breaker is open. */
    gate(task, provider) {
        const settings = this.runtime.getLMSettings();
        if (provider && !this.runtime.canUseProvider(provider, settings)) {
            throw new LMUnavailableError(withHint(`Circuit breaker open for provider: ${provider}`, provider), provider, task);
        }
        return { provider, settings };
    }
    /** Charge the provider's spend ledger; throws LMUnavailableError past the cap. */
    bill(task, gate, usage) {
        this.#ledger.record(gate.provider ?? 'unknown', task, this.runtime.lastDecision?.modelId, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0);
    }
    lookup(envelope, gate) {
        const raw = this.#cache.get(envelope.cacheKey);
        if (raw === undefined)
            return { hit: false };
        this.#recordCall(true, Date.now(), envelope.prompt.length + raw.length, gate);
        return { hit: true, value: envelope.decode(raw) };
    }
    /** Publish a settled call: cache, stats, routing telemetry, demotion, and —
     *  for transport failures — a provider re-probe. Never throws the call's own
     *  error; the caller keeps its own control flow.
     *
     *  `durationMs` is the call's own latency, read once here: stats and routing
     *  telemetry describe the same span, so they must not disagree — and must not
     *  absorb the re-probe below, which is this class's overhead, not the call's. */
    async settle(envelope, durationMs, gate, outcome) {
        if (outcome.ok) {
            const raw = envelope.encode(outcome.value);
            this.#cache.set(envelope.cacheKey, raw);
            this.#recordCall(true, durationMs, outcome.tokens ?? envelope.prompt.length + raw.length, gate);
            this.#clearFailures();
            this.#logRouting(envelope.task, durationMs, true, gate);
            return;
        }
        if (!outcome.committed)
            this.#cache.clear(envelope.cacheKey);
        this.#recordCall(false, durationMs, outcome.tokens ?? envelope.prompt.length, gate);
        // Only transport-shaped failures count against the model: a rejected
        // response says nothing about the provider's reachability.
        if (isTransportError(outcome.error)) {
            this.#noteFailure();
            await this.reprobe();
        }
        this.#logRouting(envelope.task, durationMs, false, gate);
    }
    /** Gate, cache, and settle one awaited call end to end. */
    async execute(spec, gate) {
        const cached = this.lookup(spec, gate);
        if (cached.hit)
            return cached.value;
        const elapsed = stopwatch();
        try {
            const value = await inGrammarScope(spec.grammar, () => withRetry(() => spec.run({ report: (usage) => this.bill(spec.task, gate, usage) }), gate.provider, spec.task));
            await this.settle(spec, elapsed(), gate, { ok: true, value });
            return value;
        }
        catch (error) {
            await this.settle(spec, elapsed(), gate, { ok: false, error, committed: false });
            throw error;
        }
    }
    #recordCall(success, durationMs, tokens, gate) {
        recordLMCall(this.#stats, success, durationMs, tokens);
        this.runtime.recordProviderCall(gate.provider ?? getLmProvider(), success, gate.settings);
        const id = this.runtime.lastDecision?.modelId;
        if (!id)
            return;
        recordLMCall(this.perModel.getOrInsert(id), success, durationMs, tokens);
    }
    #clearFailures() {
        const id = this.runtime.lastDecision?.modelId;
        if (id)
            this.#failures.delete(id);
    }
    #noteFailure() {
        const id = this.runtime.lastDecision?.modelId;
        if (!id)
            return;
        const n = incrementCount(this.#failures, id);
        if (n >= 2)
            this.runtime.demoteModel(id, `repeated transport failures (${n})`);
    }
    #logRouting(task, durationMs, success, gate) {
        const { provider } = gate;
        const decision = this.runtime.lastDecision;
        trace.getActiveSpan()?.setAttributes({
            'lm.provider': provider ?? 'unknown',
            'lm.model': decision?.modelId ?? '',
            'lm.success': success,
            'lm.latency_ms': durationMs,
        });
        if (!decision)
            return;
        this.runtime.logRoutingDecision({
            ts: Date.now(),
            task,
            modelId: decision.modelId,
            latencyMs: durationMs,
            success,
            demoted: success && decision.reason === 'failover',
            provider: provider ?? 'unknown',
            chain: getModelChain(provider ?? getLmProvider(), task, this.runtime),
        });
    }
}
/** Run fn under a GBNF grammar scope when one is provided (no-op otherwise).
 *  Grammar names ('narsese-term', 'single-word') resolve to their shipped GBNF
 *  text; raw GBNF passes through untouched. */
const inGrammarScope = (grammar, fn) => grammar
    ? runWithGrammar(NAMED_GRAMMARS.has(grammar) ? loadGrammar(grammar) : grammar, fn)
    : fn();
