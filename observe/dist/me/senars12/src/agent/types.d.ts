import type { AgentOptions as UtilAgentOptions, HealthStatus, ParsedCommand, SkillDefinition, BridgeOptions as UtilBridgeOptions } from '@senars/types/agent';
import type { EpisodicMemory } from '@senars/types/episodic-memory';
import type { LMTask } from '@senars/types/llm';
import type { ToolFeedbackObserver } from '@senars/feedback';
import type { ChatOptions, ChatStreamEvent } from './chat';
import type { GroundednessGate, TraceGrader } from '@senars/types/cognitive';
/**
 * Agent public type definitions.
 */
import type { LLMCortex } from '../cortex/LLMCortex';
import type { CognitiveStimulus, Context, Derivation } from '@senars/types/cognitive';
import type { Engine } from '@senars/types/engine';
import type { ToolResult } from '@senars/types/engine';
import type { PersistableSessionManager } from '../memory/types';
import type { LogStore } from '@senars/log/store';
import type { PinStore } from '../motor/builtin-tools';
import type { EventLog } from '../log/index';
import type { AgentCapabilities } from '../protocol/index';
import type { CognitiveEvent } from '../schemas/index';
import type { MacroPhase } from './pipeline';
import type { CorrelationScopeStore } from './correlation-scope';
/** `util` owns the shape; re-exported so `core` importers keep one spelling. */
export type { CognitiveStimulus, Context, Derivation, ParsedCommand, ToolResult };
export type { CorrelationScopeStore } from './correlation-scope';
export interface AgentOptions extends UtilAgentOptions {
    log?: EventLog;
    logStore?: LogStore;
    cortex?: LLMCortex;
    episodicMemory?: EpisodicMemory;
    /** Evaluate a MeTTa expression; backs the `metta` builtin tool. */
    mettaExecutor?: (expression: string) => Promise<unknown[]>;
    /** Key/value pin store; backs the `pin` builtin tool. */
    pinStore?: PinStore;
    sessionManager?: PersistableSessionManager;
    /** Shared feedback observer for unified tool statistics. */
    feedbackObserver?: ToolFeedbackObserver;
    /** System One egress gate: returns true (or `{grounded, score}`) when a narration draft is grounded enough to emit. */
    groundednessGate?: GroundednessGate;
    /** E4 agent-trace grading: grades the completed cycle's narration + executed tools into the distillation dataset. */
    traceGrader?: TraceGrader;
    /** H2: default narration tier for chat cycles when the caller passes none. */
    narrateTier?: LMTask;
    /** Phase A (REFACTOR.todo1): custom macro-cycle phases; default `DEFAULT_MACRO_PIPELINE`. */
    macroPipeline?: MacroPhase[];
    /** Phase A (REFACTOR.todo2): end-of-cycle learning consolidation (pressure-gated, inert below threshold). */
    consolidateLearning?: (options: {
        budget?: number;
    }) => Promise<void>;
    /** Consolidation config: enabled by default, optional per-invocation budget. */
    consolidation?: {
        enabled?: boolean;
        budget?: number;
    };
    /** Phase A (REFACTOR.todo4): per-correlationId scope for ContrastiveMemory isolation. */
    threadScope?: CorrelationScopeStore;
    /**
     * Honest capability overrides (CORE.19 C2.5/D15). The default baseline reports
     * the optional subsystems absent; a composition root that wired one supplies the
     * real answer here rather than the Agent guessing from a contract it cannot see.
     */
    capabilities?: Partial<AgentCapabilities['supports']>;
}
/** Options once the cortex has been resolved from a service. `util`'s
 *  `ValidatedAgentOptions` is the *validated config* type — a different record
 *  that had taken this name on `core`'s public surface. */
export type ResolvedAgentOptions = Required<Pick<AgentOptions, 'cortex'>> & AgentOptions;
/** Refines the canonical util contract with core-owned memory typing; the auth/commandRegistry
 *  shape lives in util (`BridgeAuthHandler`) so core never imports io. */
export interface BridgeOptions extends UtilBridgeOptions {
    episodicMemory?: EpisodicMemory;
}
export type { AgentCapabilities, ChatOptions, ChatStreamEvent, CognitiveEvent, Engine, HealthStatus, SkillDefinition, };
//# sourceMappingURL=types.d.ts.map