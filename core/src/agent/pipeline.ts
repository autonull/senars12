import type { EpisodicMemory } from '@senars/util';
import type { ChatOptions, ChatStreamEvent } from '../ChatService.js';
import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { LLMCortex } from '../cortex/LLMCortex.js';
import type {
  CognitiveStimulus,
  Context,
  Derivation,
  Engine,
  ToolResult,
} from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type { MemoryService } from '../memory/MemoryService.js';
import type { ToolRegistry } from '../motor/ToolRegistry.js';
import { motorToToolSet } from '../motor/toToolSet.js';
import type { PolicyEngine } from '../PolicyEngine.js';

/**
 * Shared macro-cycle pipeline (REFACTOR.todo1 Phase A).
 * The Agent macro-cycle uses the kernel's `TickMiddleware` onion shape
 * (`nar/src/tick/tick.ts`) adapted for the `CycleHost` context: ordered
 * `MacroPhase`s with cooperative `next()` dispatch, streamed narration
 * preserved via the middleware chain.
 */

export interface CycleHost {
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine>;
  readonly policy: PolicyEngine;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;
  readonly episodicMemory?: EpisodicMemory;
  readonly commandParser?: (text: string) => { command: string; args: string[]; raw: string }[];
  /** System One egress gate (§7.4): returns true (or `{grounded, score}`) when the narration is grounded enough to emit. */
  readonly groundednessGate?: (
    narration: string
  ) => Promise<boolean | { grounded: boolean; score?: number }>;
  /** E4: grades the completed cycle (narration + executed tools) into the distillation dataset. */
  readonly traceGrader?: (trace: {
    narration: string;
    toolCalls: readonly { command: string; success: boolean }[];
    correlationId: string;
    /** E4 follow-up (b): egress-gate verdict — groundedness ground truth (reject ⇒ observed 0). */
    egress?: { grounded: boolean; score?: number };
  }) => Promise<unknown>;
  /** H2: default narration tier when the caller passes none. */
  readonly narrateTier?: 'quality' | 'fast' | 'structured';
  /** Phase A: custom macro-cycle phase list; default is `DEFAULT_MACRO_PIPELINE`. */
  readonly macroPipeline?: readonly MacroPhase[];

  emit(event: CognitiveEvent): void;

  getLastResponse(): string;

  setLastResponse(value: string): void;
}

export type NarrationTier = NonNullable<ChatOptions['tier']>;

export interface MacroCycleState {
  cid?: { id?: string };
  context?: Context;
  derivations: Derivation[];
  narrativeText: string;
  egress?: { grounded: boolean; score?: number };
  toolResults: Array<{ command: string; result: ToolResult }>;
}

export interface MacroContext {
  readonly host: CycleHost;
  readonly stimulus: CognitiveStimulus;
  readonly opts?: { signal?: AbortSignal; tier?: NarrationTier };
  /** Streamed narration events, drained by `runCycleStream` while phases dispatch. */
  readonly stream: AsyncQueue<ChatStreamEvent>;
  readonly state: MacroCycleState;
}

export type MacroPhase = (ctx: MacroContext, next: () => Promise<void>) => Promise<void>;

/** Minimal async queue joining middleware-dispatched narration to the consumer generator. */
export class AsyncQueue<T> {
  #items: T[] = [];
  #waiters: (() => void)[] = [];
  #closed = false;

  push(item: T): void {
    if (this.#closed) return;
    this.#items.push(item);
    this.#flush();
  }

  close(): void {
    this.#closed = true;
    this.#flush();
  }

  #flush(): void {
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const w of waiters) w();
  }

  async *drain(): AsyncGenerator<T> {
    let i = 0;
    while (true) {
      while (i < this.#items.length) {
        const item = this.#items[i++];
        if (item !== undefined) yield item;
      }
      if (this.#closed) return;
      await new Promise<void>((resolve) => this.#waiters.push(resolve));
    }
  }
}

/** Onion dispatch — same shape as `runTick` in `nar/src/tick/tick.ts`. */
export const dispatchMacro = async (
  phases: readonly MacroPhase[],
  ctx: MacroContext
): Promise<void> => {
  let index = -1;
  const dispatch = async (i: number): Promise<void> => {
    if (i <= index) throw new Error('next() called multiple times');
    index = i;
    await phases[i]?.(ctx, () => dispatch(i + 1));
  };
  await dispatch(0);
};

export const createMacroContext = (
  host: CycleHost,
  stimulus: CognitiveStimulus,
  opts?: { signal?: AbortSignal; tier?: NarrationTier }
): MacroContext => ({
  host,
  stimulus,
  opts,
  stream: new AsyncQueue<ChatStreamEvent>(),
  state: { derivations: [], narrativeText: '', toolResults: [] },
});

export const motorTools = (host: CycleHost) => motorToToolSet(host.motor);

/** Opt-in phase: promotes an exchange to dialogue capture (replaces fire-and-forget bot hooks). */
export interface ExchangeCapture {
  onExchange(input: {
    correlationId: string;
    utterance: string;
    response: string;
    at: number;
  }): Promise<unknown>;
}

export const createCapturePhase =
  (capture: ExchangeCapture): MacroPhase =>
  async (ctx, next) => {
    try {
      await capture.onExchange({
        correlationId: ctx.stimulus.correlationId,
        utterance: ctx.stimulus.text,
        response: ctx.state.narrativeText || ctx.host.getLastResponse(),
        at: ctx.stimulus.timestamp,
      });
    } catch {
      /* capture is best-effort (I5) — never disrupts the cycle */
    }
    await next();
  };

/** Opt-in phase: metacognitive reflection over the completed cycle. */
export const createReflectPhase =
  (reflect: (host: CycleHost, stimulus: CognitiveStimulus) => Promise<unknown>): MacroPhase =>
  async (ctx, next) => {
    try {
      await reflect(ctx.host, ctx.stimulus);
    } catch {
      /* reflection is best-effort — never disrupts the cycle */
    }
    await next();
  };
