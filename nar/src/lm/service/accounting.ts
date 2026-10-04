/** Per-call accounting for every LM path (text, structured, stream).
 *
 *  A call is only *transport* plus *bookkeeping*. This module owns both: the
 *  breaker gate, grammar scope and provider retry that wrap a transport, and
 *  every bookkeeping step — response cache, spend ledger, per-model stats,
 *  routing telemetry, transport-failure demotion. One protocol, so no path can
 *  silently skip a step its siblings perform (the demotion the structured path
 *  used to miss is the canonical example). */

import { trace } from '@opentelemetry/api';
import {
  createLMStats,
  incrementCount,
  type LMExecutionStats,
  type LMTask,
  recordLMCall,
  stopwatch,
} from '@senars/util';
import type { LMProviderName, LMSettings } from '../env-config.js';
import type { GrammarName } from '../grammars/index.js';
import { loadGrammar } from '../grammars/index.js';
import type { ProviderRuntime } from '../provider-runtime.js';
import { runWithGrammar } from '../providers/llamacpp.js';
import { getLmProvider, getModelChain } from '../providers.js';
import { ResponseCache } from './cache.js';
import { isTransportError, LMUnavailableError, withHint, withRetry } from './errors.js';
import { type ProviderSpend, SpendLedger } from './spend.js';

const NAMED_GRAMMARS: ReadonlySet<string> = new Set<string>(['narsese-term', 'single-word']);

const identity = (raw: string): string => raw;

/** Raw text needs no codec — the cache already holds the value verbatim. */
export const textCodec = { encode: identity, decode: identity };

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
export type CallSpec<T> = CallEnvelope<T> & { run: (ctx: CallContext) => Promise<T> };

/** A cache hit needs no transport; {@link CallEnvelope.decode} reconstructs the value. */
export type CacheHit<T> = { hit: false } | { hit: true; value: T };

/** Provider + settings resolved for a gated call. */
export interface Gate {
  provider: LMProviderName | undefined;
  settings: LMSettings;
}

/** How a settled call reached its outcome. `tokens` overrides the derived
 *  prompt+output count — streaming paths count bytes as they arrive. */
export type CallOutcome<T> =
  | { ok: true; value: T; tokens?: number }
  /** `committed` marks a stream that already handed bytes to the caller: the
   *  prior cache entry survives, since no complete value replaced it. */
  | { ok: false; error: unknown; committed: boolean; tokens?: number };

/** Owns the accounting state and the single protocol every call path follows. */
export class CallAccounting {
  readonly #cache = new ResponseCache();
  readonly #ledger = new SpendLedger();
  readonly #stats: LMExecutionStats = createLMStats();
  /** Per-model-id stats feeding stats-aware chain reordering. */
  readonly perModel: Record<string, LMExecutionStats> = {};
  /** Consecutive transport failures per resolved model id → demotion. */
  readonly #failures = new Map<string, number>();

  constructor(
    readonly runtime: ProviderRuntime,
    private readonly reprobe: () => Promise<void> = async () => undefined
  ) {}

  get stats(): LMExecutionStats {
    return this.#stats;
  }

  getSpend(): Record<string, ProviderSpend> {
    return this.#ledger.snapshot();
  }

  /** Fail fast when the active provider's circuit breaker is open. */
  gate(task: LMTask, provider: LMProviderName | undefined): Gate {
    const settings = this.runtime.getLMSettings();
    if (provider && !this.runtime.canUseProvider(provider, settings)) {
      throw new LMUnavailableError(
        withHint(`Circuit breaker open for provider: ${provider}`, provider),
        provider,
        task
      );
    }
    return { provider, settings };
  }

  /** Charge the provider's spend ledger; throws LMUnavailableError past the cap. */
  bill(task: LMTask, gate: Gate, usage?: TokenUsage): void {
    this.#ledger.record(
      gate.provider ?? 'unknown',
      task,
      this.runtime.lastDecision?.modelId,
      usage?.inputTokens ?? 0,
      usage?.outputTokens ?? 0
    );
  }

  lookup<T>(envelope: CallEnvelope<T>, gate: Gate): CacheHit<T> {
    const raw = this.#cache.get(envelope.cacheKey);
    if (raw === undefined) return { hit: false };
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
  async settle<T>(
    envelope: CallEnvelope<T>,
    durationMs: number,
    gate: Gate,
    outcome: CallOutcome<T>
  ): Promise<void> {
    if (outcome.ok) {
      const raw = envelope.encode(outcome.value);
      this.#cache.set(envelope.cacheKey, raw);
      this.#recordCall(
        true,
        durationMs,
        outcome.tokens ?? envelope.prompt.length + raw.length,
        gate
      );
      this.#clearFailures();
      this.#logRouting(envelope.task, durationMs, true, gate);
      return;
    }
    if (!outcome.committed) this.#cache.clear(envelope.cacheKey);
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
  async execute<T>(spec: CallSpec<T>, gate: Gate): Promise<T> {
    const cached = this.lookup(spec, gate);
    if (cached.hit) return cached.value;

    const elapsed = stopwatch();
    try {
      const value = await inGrammarScope(spec.grammar, () =>
        withRetry(
          () => spec.run({ report: (usage) => this.bill(spec.task, gate, usage) }),
          gate.provider,
          spec.task
        )
      );
      await this.settle(spec, elapsed(), gate, { ok: true, value });
      return value;
    } catch (error) {
      await this.settle(spec, elapsed(), gate, { ok: false, error, committed: false });
      throw error;
    }
  }

  #recordCall(success: boolean, durationMs: number, tokens: number, gate: Gate): void {
    recordLMCall(this.#stats, success, durationMs, tokens);
    this.runtime.recordProviderCall(gate.provider ?? getLmProvider(), success, gate.settings);
    const id = this.runtime.lastDecision?.modelId;
    if (!id) return;
    if (!this.perModel[id]) this.perModel[id] = createLMStats();
    recordLMCall(this.perModel[id], success, durationMs, tokens);
  }

  #clearFailures(): void {
    const id = this.runtime.lastDecision?.modelId;
    if (id) this.#failures.delete(id);
  }

  #noteFailure(): void {
    const id = this.runtime.lastDecision?.modelId;
    if (!id) return;
    const n = incrementCount(this.#failures, id);
    if (n >= 2) this.runtime.demoteModel(id, `repeated transport failures (${n})`);
  }

  #logRouting(task: LMTask, durationMs: number, success: boolean, gate: Gate): void {
    const { provider } = gate;
    const decision = this.runtime.lastDecision;
    trace.getActiveSpan()?.setAttributes({
      'lm.provider': provider ?? 'unknown',
      'lm.model': decision?.modelId ?? '',
      'lm.success': success,
      'lm.latency_ms': durationMs,
    });
    if (!decision) return;
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
const inGrammarScope = <T>(grammar: string | undefined, fn: () => Promise<T>): Promise<T> =>
  grammar
    ? runWithGrammar(
        NAMED_GRAMMARS.has(grammar) ? loadGrammar(grammar as GrammarName) : grammar,
        fn
      )
    : fn();
