import type { CognitiveEvent } from '../schemas/index';
import { PushQueue } from '@senars/events/push-queue';
import type { ChatOptions, ChatStreamEvent } from './chat';
import type { LLMCortex } from '../cortex/LLMCortex';
import type { CognitiveStimulus, Context, Derivation, GroundednessGate, TraceGrader, EgressVerdict } from '@senars/types/cognitive';
import type { LMTask } from '@senars/types/llm';
import type { Engine } from '@senars/types/engine';
import type { ToolResult } from '@senars/types/engine';
import type { EventLog } from '../log/index';
import type { MemoryService } from '../memory/MemoryService';
import type { ToolRegistry } from '../motor/ToolRegistry';
import type { PolicyEngine } from './PolicyEngine';
import type { CorrelationScopeStore } from './correlation-scope';
import type { EpisodicMemory } from '@senars/types/episodic-memory';
import type { ParsedCommand } from './types';
import type { Middleware } from '@senars/util/middleware';
/**
 * Shared macro-cycle pipeline (REFACTOR.todo1 Phase A).
 * The Agent macro-cycle uses an onion shape adapted for the `CycleHost` context: ordered
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
    readonly commandParser?: (text: string) => ParsedCommand[];
    /** System One egress gate (§7.4): returns true (or `{grounded, score}`) when the narration is grounded enough to emit. */
    readonly groundednessGate?: GroundednessGate;
    /** E4: grades the completed cycle (narration + executed tools) into the distillation dataset. */
    readonly traceGrader?: TraceGrader;
    /** H2: default narration tier when the caller passes none. */
    readonly narrateTier?: LMTask;
    /** Phase A: custom macro-cycle phase list; default is `DEFAULT_MACRO_PIPELINE`. */
    readonly macroPipeline?: readonly MacroPhase[];
    /** Phase A (REFACTOR.todo2): end-of-cycle learning consolidation — pressure-gated, inert below threshold. */
    readonly consolidateLearning?: (options: {
        budget?: number;
    }) => Promise<void>;
    /** Consolidation config: default enabled, optional per-invocation budget. */
    readonly consolidation?: {
        enabled?: boolean;
        budget?: number;
    };
    /** Phase A (REFACTOR.todo4): per-correlationId scope for ContrastiveMemory isolation. */
    readonly threadScope?: CorrelationScopeStore;
    emit(event: CognitiveEvent): void;
    /** An engine or tool-absorb step faulted inside the cycle. Optional: a host that
     *  does not tally simply keeps no per-engine error count. */
    onEngineError?(engineId: string, error: string): void;
    getLastResponse(): string;
    setLastResponse(value: string): void;
}
export type NarrationTier = NonNullable<ChatOptions['tier']>;
export interface MacroCycleState {
    cid?: {
        id?: string;
    };
    context?: Context;
    derivations: Derivation[];
    narrativeText: string;
    egress?: EgressVerdict;
    toolResults: Array<{
        command: string;
        result: ToolResult;
    }>;
}
export interface MacroContext {
    readonly host: CycleHost;
    readonly stimulus: CognitiveStimulus;
    readonly opts?: {
        signal?: AbortSignal;
        tier?: NarrationTier;
    };
    /** Streamed narration events, drained by `runCycleStream` while phases dispatch. */
    readonly stream: PushQueue<ChatStreamEvent>;
    readonly state: MacroCycleState;
}
export type MacroPhase = Middleware<MacroContext>;
export declare const createMacroContext: (host: CycleHost, stimulus: CognitiveStimulus, opts?: {
    signal?: AbortSignal;
    tier?: NarrationTier;
}) => MacroContext;
export declare const motorTools: (host: CycleHost) => import("ai").ToolSet;
/** Opt-in phase: promotes an exchange to dialogue capture (replaces fire-and-forget bot hooks). */
export interface ExchangeCapture {
    onExchange(input: {
        correlationId: string;
        utterance: string;
        response: string;
        at: number;
    }): Promise<unknown>;
}
export declare const createCapturePhase: (capture: ExchangeCapture) => MacroPhase;
/** Opt-in phase: metacognitive reflection over the completed cycle. */
export declare const createReflectPhase: (reflect: (host: CycleHost, stimulus: CognitiveStimulus) => Promise<unknown>) => MacroPhase;
//# sourceMappingURL=pipeline.d.ts.map