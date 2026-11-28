/**
 * Canonical Event Taxonomy — standardized event names and payloads.
 *
 * This is the single source of truth for all event types in the system.
 * All event emission sites should use these canonical names and shapes.
 */
import type { Term } from '../kernel/terms';
import type { Truth } from '../kernel/truth';
import type { CognitiveEvent } from '../schemas/cognitive-events';
/** Event channel prefixes. */
export declare const EventChannel: {
    readonly kernel: 'kernel';
    readonly cognition: 'cognition';
    readonly ui: 'ui';
    readonly loop: 'loop';
    readonly mining: 'mining';
    readonly telemetry: 'telemetry';
    readonly agent: 'agent';
    readonly tool: 'tool';
    readonly nl: 'nl';
    readonly autonomy: 'autonomy';
    readonly lm: 'lm';
    readonly system: 'system';
};
export type ChannelPrefix = (typeof EventChannel)[keyof typeof EventChannel];
/** Build a canonical event name: `channel:name`. */
export declare function eventName(channel: ChannelPrefix, name: string): string;
/** Base event structure. */
export interface BaseEvent {
    /** Canonical event name (channel:name). */
    type: string;
    /** Unix timestamp in milliseconds. */
    timestamp: number;
    /** Correlation ID for tracing. */
    correlationId: string;
    /** Iteration/cycle number (if applicable). */
    iteration?: number;
}
/** Kernel events. */
export interface KernelEventMap {
    /** Budget slice created. */
    'kernel:budget:slice:created': {
        sliceId: string;
        parentId: string | null;
        limits: Record<string, number>;
    };
    /** Budget slice consumed. */
    'kernel:budget:slice:consumed': {
        sliceId: string;
        resource: string;
        amount: number;
        budget: Record<string, number>;
    };
    /** Budget slice exhausted. */
    'kernel:budget:slice:exhausted': {
        sliceId: string;
        reason: string;
        budget: Record<string, number>;
    };
    /** Budget slice merged. */
    'kernel:budget:slice:merged': {
        parentId: string;
        childId: string;
        childBudget: Record<string, number>;
    };
    /** Cognitive event from kernel gates. */
    'kernel:cognitive': CognitiveEvent;
    /** Memory pressure event. */
    'kernel:memory:pressure': {
        level: number;
        utilization: number;
    };
    /** Memory consolidated event. */
    'kernel:memory:consolidated': {
        conceptsRemoved: number;
        conceptsArchived: number;
    };
    /** LM call event. */
    'kernel:lm:call': {
        modelId: string;
        inputTokens: number;
        outputTokens: number;
        duration: number;
    };
    /** LM error event. */
    'kernel:lm:error': {
        ruleId: string;
        error: Error;
        duration: number;
    };
    /** Kernel cycle state. */
    'kernel:cycle:state': {
        state: import('../schemas/index').KernelControlState;
        cycle: number;
        phase: string;
        activeTasks: number;
        budget: Record<string, number>;
        derived: number;
    };
    /** Error event. */
    'kernel:error': {
        error: Error;
        context?: Record<string, unknown>;
    };
    /** Restore state event. */
    'kernel:restore:state': {
        cycleCount: number;
        concepts: number;
        pendingTasks: number;
    };
    /** Cycle rewound event. */
    'kernel:cycle:rewound': {
        from: number;
        target: number;
        restored: number;
        checkpointed: boolean;
        concepts: number;
        gaps: string[];
    };
}
/** Cognition events. */
export interface CognitionEventMap {
    /** Contradiction detected. */
    'cognition:contradiction': {
        source: 'metta' | 'nal';
        term: Term;
        mettaVote: boolean;
        nalVote: boolean;
        at: number;
    };
    /** Rule applied. */
    'cognition:rule:applied': {
        ruleId: string;
        premises: [Term, Term];
        conclusion: Term;
        truth: Truth;
        duration: number;
        cpuMs?: number;
        lmCalls?: number;
        lmTokens?: number;
        cycle?: number;
    };
    /** Concept created. */
    'cognition:concept:created': {
        term: Term;
        priority: number;
    };
    /** Concept removed. */
    'cognition:concept:removed': {
        term: Term;
        reason: 'forgotten' | 'archived' | 'evicted' | 'retracted';
    };
    /** Derivation accepted. */
    'cognition:derivation:accepted': Omit<import('../schemas/index').DerivationStep, 'timestamp'>;
    /** Derivation record. */
    'cognition:derivation:record': import('../schemas/index').DerivationRecord;
    /** NAR derivation. */
    'cognition:nar:derivation': {
        term: string;
        confidence: number;
        timestamp: number;
    };
    /** Cognitive state change. */
    'cognition:state-change': {
        oldState: 'normal' | 'confused' | 'bored' | 'overloaded' | 'idle';
        newState: 'normal' | 'confused' | 'bored' | 'overloaded' | 'idle';
        action: 'continue' | 'resolve-conflicts' | 'explore' | 'consolidate' | 'suspend';
    };
    /** Explanation event. */
    'cognition:explanation': {
        conclusion: string;
        derivationIds: string[];
        rules: string[];
        steps: number;
        paraphrased: boolean;
        conflict?: boolean;
    };
    /** NAL derived event. */
    'cognition:nal:derived': {
        premises: string[];
        rule: string;
        conclusion: string;
        truth: Truth;
    };
    /** LM validation failed. */
    'cognition:lm:validation-failed': {
        output: string;
        reason: string;
    };
    /** Feedback correction. */
    'cognition:feedback:correction': {
        original: string;
        corrected: string;
    };
}
/** Loop events. */
export interface LoopEventMap {
    /** Iteration started. */
    'loop:iteration_start': {
        maxIterations: number;
    };
    /** Iteration completed. */
    'loop:iteration_complete': {
        iteration: number;
        durationMs: number;
        success: boolean;
    };
    /** Iteration failed. */
    'loop:iteration_failed': {
        iteration: number;
        error: string;
    };
    /** Selection made. */
    'loop:selection_made': {
        iteration: number;
        taskId: string;
    };
    /** Action executed. */
    'loop:action_executed': {
        iteration: number;
        faculty: string;
        taskId: string;
        oracle?: string;
    };
    /** Judgment complete. */
    'loop:judgment_complete': {
        iteration: number;
        judgmentId: string;
        score: number;
        confidence: number;
    };
    /** Contract checked. */
    'loop:contract_checked': {
        iteration: number;
        result: import('../loop/types').ContractCheckResult;
    };
    /** Repair complete. */
    'loop:repair_complete': {
        iteration: number;
        result: import('../loop/types').LoopRepairResult;
    };
    /** Appraisal complete. */
    'loop:appraisal_complete': {
        iteration: number;
        appraisal: import('../loop/types').LoopAppraisal;
    };
    /** Max iterations reached. */
    'loop:max_iterations_reached': {
        iterations: number;
    };
    /** Timeout. */
    'loop:timeout': {
        iteration: number;
        timeoutMs: number;
    };
}
/** Mining events. */
export interface MiningEventMap {
    /** Schema induced. */
    'mining:schema_induced': {
        pattern: import('../learning/schema-induction').SchemaPattern;
        confidence: number;
        derivationChain: import('../learning/schema-induction').DerivationChainItem[];
    };
    /** Surprise detected. */
    'mining:surprise': {
        score: number;
        threshold: number;
        context: any;
    };
    /** Domain learned. */
    'mining:domain_learned': {
        domain: import('../learning/domain-learners').LearnerDomain;
        patterns: import('../learning/schema-induction').SchemaPattern[];
    };
    /** Pattern found. */
    'mining:pattern_found': {
        pattern: import('../learning/schema-induction').SchemaPattern;
        frequency: number;
    };
}
/** Telemetry events. */
export interface TelemetryEventMap {
    /** Telemetry event. */
    'telemetry:event': import('../faculties/judgment/telemetry').AnyTelemetryEvent;
}
/** Agent events. */
export interface AgentEventMap {
    /** Process started. */
    'agent:process:start': {
        input: string;
        context?: any;
    };
    /** Process completed. */
    'agent:process:complete': {
        result: any;
        durationMs: number;
    };
    /** Agent suspended. */
    'agent:suspend': {
        cycleCount: number;
        lastActivity: number;
    };
    /** Agent resumed. */
    'agent:resume': {
        cycleCount: number;
        lastActivity: number;
    };
}
/** Tool events. */
export interface ToolEventMap {
    /** Tool registered. */
    'tool:register': {
        name: string;
        descriptor: any;
    };
    /** Tool unregistered. */
    'tool:unregister': {
        name: string;
    };
    /** Tool initialized. */
    'tool:init': {
        name: string;
        state: string;
    };
    /** Tool stopped. */
    'tool:stop': {
        name: string;
        state: string;
    };
    /** Tool disposed. */
    'tool:dispose': {
        name: string;
        state: string;
    };
    /** Tool called. */
    'tool:call': {
        type: string;
        name: string;
        args: unknown;
        timestamp: number;
        context?: unknown;
    };
    /** Tool result. */
    'tool:result': {
        type: string;
        name: string;
        args?: any;
        result?: any;
        timestamp: number;
        duration: number;
        context?: any;
    };
    /** Tool error. */
    'tool:error': {
        type: string;
        name: string;
        args?: any;
        result?: any;
        timestamp: number;
        duration: number;
        context?: any;
    };
}
/** Natural Language events. */
export interface NLEventMap {
    /** NL analyzed. */
    'nl:analyzed': {
        input: string;
        analysis: import('../types/events').TaskBatch;
    };
    /** NL translation. */
    'nl:translation': {
        nl: string;
        narsese: string;
        tier: number;
    };
    /** Clarification needed. */
    'nl:clarification-needed': {
        ambiguity: import('../types/events').Ambiguity;
    };
}
/** Autonomy events. */
export interface AutonomyEventMap {
    /** Curiosity triggered. */
    'autonomy:curiosity': {
        policy: 'curiosity';
        trigger: string;
        concept: string;
        question: string;
        cycle: number;
    };
    /** Consolidated. */
    'autonomy:consolidated': {
        policy: 'consolidation';
        trigger: string;
        conceptsBefore: number;
        conceptsAfter: number;
        archived: number;
        forgotten: number;
        checkpointed: boolean;
        cycle: number;
    };
    /** Budget exhausted. */
    'autonomy:budget': {
        reason: string;
        cycle: number;
        cyclesInWindow: number;
        wallClockMs: number;
    };
}
/** LM events. */
export interface LMEventMap {
    /** LM rule applied. */
    'lm:rule:applied': {
        ruleId: string;
        ruleName: string;
        durationMs: number;
        output: string;
        timestamp: number;
    };
    /** LM rule skipped. */
    'lm:rule:skipped': {
        ruleId: string;
        ruleName: string;
        reason: string;
        timestamp: number;
    };
    /** LM rule structured output. */
    'lm:rule:structured': {
        ruleId: string;
        schema: string;
        output: string;
        timestamp: number;
    };
    /** LM rule tool called. */
    'lm:rule:tool:called': {
        ruleId: string;
        tool: string;
        args: Record<string, unknown>;
        timestamp: number;
    };
    /** LM rule tool result. */
    'lm:rule:tool:result': {
        ruleId: string;
        tool: string;
        result: unknown;
        timestamp: number;
    };
    /** LM rule failed. */
    'lm:rule:failed': {
        ruleId: string;
        ruleName: string;
        error: string;
        durationMs: number;
        timestamp: number;
    };
    /** LM rule circuit open. */
    'lm:rule:circuit:open': {
        ruleId: string;
        ruleName: string;
        timestamp: number;
    };
    /** LM rule circuit half-open. */
    'lm:rule:circuit:half-open': {
        ruleId: string;
        ruleName: string;
        timestamp: number;
    };
    /** LM rule circuit closed. */
    'lm:rule:circuit:closed': {
        ruleId: string;
        ruleName: string;
        timestamp: number;
    };
}
/** System events. */
export interface SystemEventMap {
    /** Pipeline turn start. */
    'system:turn:start': {
        input: unknown;
        passCount: number;
    };
    /** Pipeline turn end. */
    'system:turn:end': {
        response: unknown;
        durationMs: number;
    };
    /** Pipeline turn error. */
    'system:turn:error': {
        error: Error;
        stage: string;
        passCount: number;
    };
    /** Pipeline stage start. */
    'system:stage:start': {
        stage: string;
        passCount: number;
    };
    /** Pipeline stage end. */
    'system:stage:end': {
        stage: string;
        durationMs: number;
        passCount: number;
    };
    /** Pipeline stage error. */
    'system:stage:error': {
        stage: string;
        error: Error;
        durationMs: number;
    };
    /** Classify result. */
    'system:classify:result': {
        input: string;
        classification: unknown;
    };
    /** Trigger score. */
    'system:trigger:score': {
        heuristicScore: number;
        lmScore: number;
        total: number;
        activated: boolean;
    };
    /** Reasoning start. */
    'system:reasoning:start': {
        inputType: string;
        steps: number;
    };
    /** Reasoning end. */
    'system:reasoning:end': {
        steps: number;
        newBeliefs: unknown[];
    };
    /** LM start. */
    'system:lm:start': {
        promptLength: number;
        streaming: boolean;
    };
    /** LM chunk. */
    'system:lm:chunk': {
        content: string;
        accumulated: string;
    };
    /** LM end. */
    'system:lm:end': {
        response: string;
        durationMs: number;
    };
    /** LM suggests reasoning. */
    'system:lm:suggests-reasoning': boolean;
    /** LM rule executed. */
    'system:lm-rule:executed': {
        ruleId: string;
        durationMs: number;
        tasksGenerated: number;
    };
    /** LM rule failed. */
    'system:lm-rule:failed': {
        ruleId: string;
        error: string;
        durationMs: number;
    };
    /** LM rule disabled. */
    'system:lm-rule:disabled': {
        ruleId: string;
    };
    /** Directive found. */
    'system:directive:found': {
        directive: unknown;
    };
    /** Directive execute. */
    'system:directive:execute': {
        directive: unknown;
        success: boolean;
        result?: unknown;
        error?: string;
    };
    /** Directive loop requested. */
    'system:directive:loop-requested': {
        type: string;
    };
    /** Loop pass. */
    'system:loop:pass': {
        passCount: number;
        needsLoopBack: boolean;
    };
    /** Conversation message added. */
    'system:conversation:message-added': {
        message: any;
        count: number;
    };
    /** Conversation artifact added. */
    'system:conversation:artifact-added': {
        artifact: any;
        count: number;
    };
    /** Conversation belief pinned. */
    'system:conversation:belief-pinned': {
        belief: string;
        count: number;
    };
    /** Conversation summarized. */
    'system:conversation:summarized': {
        summary: string;
    };
}
/** Combined event map for the main NAR event bus. */
export type NAREventMap = KernelEventMap & CognitionEventMap & LoopEventMap & MiningEventMap & TelemetryEventMap & AgentEventMap & ToolEventMap & NLEventMap & AutonomyEventMap & LMEventMap & SystemEventMap;
/** Extract event payload type from event map. */
export type EventPayload<E extends NAREventMap, K extends keyof E> = E[K];
/** All canonical event names. */
export type CanonicalEventName = keyof NAREventMap;
/** Event catalog for documentation generation. */
export declare const EVENT_CATALOG: Record<CanonicalEventName, {
    channel: ChannelPrefix;
    description: string;
}>;
//# sourceMappingURL=taxonomy.d.ts.map