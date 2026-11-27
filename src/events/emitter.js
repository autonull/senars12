/**
 * Unified Event Emitter — typed event emission and subscription.
 *
 * Replaces ad-hoc event emission patterns across the codebase.
 */
import { defaultLogger } from '../util/logger';
import { getOrInsert } from '../util/collections';
import { eventName, EventChannel } from './taxonomy';
/** Listener bag for a single event type. */
class ListenerBag {
    listeners = new Set();
    logger;
    constructor(logger = defaultLogger) {
        this.logger = logger;
    }
    on(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    once(fn) {
        const wrapper = (event) => {
            fn(event);
            this.listeners.delete(wrapper);
        };
        this.listeners.add(wrapper);
        return () => this.listeners.delete(wrapper);
    }
    off(fn) {
        this.listeners.delete(fn);
    }
    emit(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (error) {
                this.logger.error('Event listener error', error instanceof Error ? error : undefined);
            }
        }
    }
    get size() {
        return this.listeners.size;
    }
    clear() {
        this.listeners.clear();
    }
}
/**
 * Unified typed event emitter.
 *
 * Provides type-safe event emission and subscription for the canonical event taxonomy.
 */
export class EventEmitter {
    bags = new Map();
    logger;
    clock;
    constructor(logger = defaultLogger, clock = () => Date.now()) {
        this.logger = logger;
        this.clock = clock;
    }
    /** Subscribe to an event. */
    on(eventName, fn) {
        return this.#bag(eventName).on(fn);
    }
    /** Subscribe once. */
    once(eventName, fn) {
        return this.#bag(eventName).once(fn);
    }
    /** Unsubscribe. */
    off(eventName, fn) {
        const bag = this.bags.get(eventName);
        if (!bag)
            return;
        bag.off(fn);
        if (bag.size === 0)
            this.bags.delete(eventName);
    }
    /** Emit an event with automatic timestamp and correlation ID. */
    emit(eventName, payload, options) {
        const bag = this.bags.get(eventName);
        if (!bag)
            return;
        const baseEvent = {
            type: eventName,
            timestamp: this.clock(),
            correlationId: options?.correlationId ?? '',
            iteration: options?.iteration,
            ...payload,
        };
        bag.emit(baseEvent);
    }
    /** Emit a raw event (for migration compatibility). */
    emitRaw(eventName, event) {
        const bag = this.bags.get(eventName);
        if (!bag)
            return;
        bag.emit(event);
    }
    /** Get listener count for an event. */
    listenerCount(eventName) {
        return this.bags.get(eventName)?.size ?? 0;
    }
    /** Clear all listeners. */
    clear() {
        this.bags.clear();
    }
    /** Get all event names with listeners. */
    eventNames() {
        return Array.from(this.bags.keys());
    }
    #bag(name) {
        return getOrInsert(this.bags, name, () => new ListenerBag(this.logger));
    }
}
/** Global event bus instance (for migration compatibility). */
let _globalEmitter = null;
export function getGlobalEmitter() {
    if (!_globalEmitter) {
        _globalEmitter = new EventEmitter();
    }
    return _globalEmitter;
}
export function setGlobalEmitter(emitter) {
    _globalEmitter = emitter;
}
/** Convenience function to emit on global bus. */
export function emitGlobal(eventName, payload, options) {
    getGlobalEmitter().emit(eventName, payload, options);
}
/** Convenience function to subscribe on global bus. */
export function onGlobal(eventName, fn) {
    return getGlobalEmitter().on(eventName, fn);
}
/** Helper to create canonical event names. */
export const events = {
    kernel: {
        budgetSliceCreated: () => eventName(EventChannel.kernel, 'budget:slice:created'),
        budgetSliceConsumed: () => eventName(EventChannel.kernel, 'budget:slice:consumed'),
        budgetSliceExhausted: () => eventName(EventChannel.kernel, 'budget:slice:exhausted'),
        budgetSliceMerged: () => eventName(EventChannel.kernel, 'budget:slice:merged'),
        cognitive: () => eventName(EventChannel.kernel, 'cognitive'),
        memoryPressure: () => eventName(EventChannel.kernel, 'memory:pressure'),
        memoryConsolidated: () => eventName(EventChannel.kernel, 'memory:consolidated'),
        lmCall: () => eventName(EventChannel.kernel, 'lm:call'),
        lmError: () => eventName(EventChannel.kernel, 'lm:error'),
        cycleState: () => eventName(EventChannel.kernel, 'cycle:state'),
        error: () => eventName(EventChannel.kernel, 'error'),
        restoreState: () => eventName(EventChannel.kernel, 'restore:state'),
        cycleRewound: () => eventName(EventChannel.kernel, 'cycle:rewound'),
    },
    cognition: {
        contradiction: () => eventName(EventChannel.cognition, 'contradiction'),
        ruleApplied: () => eventName(EventChannel.cognition, 'rule:applied'),
        conceptCreated: () => eventName(EventChannel.cognition, 'concept:created'),
        conceptRemoved: () => eventName(EventChannel.cognition, 'concept:removed'),
        derivationAccepted: () => eventName(EventChannel.cognition, 'derivation:accepted'),
        derivationRecord: () => eventName(EventChannel.cognition, 'derivation:record'),
        narDerivation: () => eventName(EventChannel.cognition, 'nar:derivation'),
        stateChange: () => eventName(EventChannel.cognition, 'state-change'),
        explanation: () => eventName(EventChannel.cognition, 'explanation'),
        nalDerived: () => eventName(EventChannel.cognition, 'nal:derived'),
        lmValidationFailed: () => eventName(EventChannel.cognition, 'lm:validation-failed'),
        feedbackCorrection: () => eventName(EventChannel.cognition, 'feedback:correction'),
    },
    loop: {
        iterationStart: () => eventName(EventChannel.loop, 'iteration_start'),
        iterationComplete: () => eventName(EventChannel.loop, 'iteration_complete'),
        iterationFailed: () => eventName(EventChannel.loop, 'iteration_failed'),
        selectionMade: () => eventName(EventChannel.loop, 'selection_made'),
        actionExecuted: () => eventName(EventChannel.loop, 'action_executed'),
        judgmentComplete: () => eventName(EventChannel.loop, 'judgment_complete'),
        contractChecked: () => eventName(EventChannel.loop, 'contract_checked'),
        repairComplete: () => eventName(EventChannel.loop, 'repair_complete'),
        appraisalComplete: () => eventName(EventChannel.loop, 'appraisal_complete'),
        maxIterationsReached: () => eventName(EventChannel.loop, 'max_iterations_reached'),
        timeout: () => eventName(EventChannel.loop, 'timeout'),
    },
    mining: {
        schemaInduced: () => eventName(EventChannel.mining, 'schema_induced'),
        surprise: () => eventName(EventChannel.mining, 'surprise'),
        domainLearned: () => eventName(EventChannel.mining, 'domain_learned'),
        patternFound: () => eventName(EventChannel.mining, 'pattern_found'),
    },
    telemetry: {
        event: () => eventName(EventChannel.telemetry, 'event'),
    },
    agent: {
        processStart: () => eventName(EventChannel.agent, 'process:start'),
        processComplete: () => eventName(EventChannel.agent, 'process:complete'),
        suspend: () => eventName(EventChannel.agent, 'suspend'),
        resume: () => eventName(EventChannel.agent, 'resume'),
    },
    tool: {
        register: () => eventName(EventChannel.tool, 'register'),
        unregister: () => eventName(EventChannel.tool, 'unregister'),
        init: () => eventName(EventChannel.tool, 'init'),
        stop: () => eventName(EventChannel.tool, 'stop'),
        dispose: () => eventName(EventChannel.tool, 'dispose'),
        call: () => eventName(EventChannel.tool, 'call'),
        result: () => eventName(EventChannel.tool, 'result'),
        error: () => eventName(EventChannel.tool, 'error'),
    },
    nl: {
        analyzed: () => eventName(EventChannel.nl, 'analyzed'),
        translation: () => eventName(EventChannel.nl, 'translation'),
        clarificationNeeded: () => eventName(EventChannel.nl, 'clarification-needed'),
    },
    autonomy: {
        curiosity: () => eventName(EventChannel.autonomy, 'curiosity'),
        consolidated: () => eventName(EventChannel.autonomy, 'consolidated'),
        budget: () => eventName(EventChannel.autonomy, 'budget'),
    },
    lm: {
        ruleApplied: () => eventName(EventChannel.lm, 'rule:applied'),
        ruleSkipped: () => eventName(EventChannel.lm, 'rule:skipped'),
        ruleStructured: () => eventName(EventChannel.lm, 'rule:structured'),
        ruleToolCalled: () => eventName(EventChannel.lm, 'rule:tool:called'),
        ruleToolResult: () => eventName(EventChannel.lm, 'rule:tool:result'),
        ruleFailed: () => eventName(EventChannel.lm, 'rule:failed'),
        ruleCircuitOpen: () => eventName(EventChannel.lm, 'rule:circuit:open'),
        ruleCircuitHalfOpen: () => eventName(EventChannel.lm, 'rule:circuit:half-open'),
        ruleCircuitClosed: () => eventName(EventChannel.lm, 'rule:circuit:closed'),
    },
    system: {
        turnStart: () => eventName(EventChannel.system, 'turn:start'),
        turnEnd: () => eventName(EventChannel.system, 'turn:end'),
        turnError: () => eventName(EventChannel.system, 'turn:error'),
        stageStart: () => eventName(EventChannel.system, 'stage:start'),
        stageEnd: () => eventName(EventChannel.system, 'stage:end'),
        stageError: () => eventName(EventChannel.system, 'stage:error'),
        classifyResult: () => eventName(EventChannel.system, 'classify:result'),
        triggerScore: () => eventName(EventChannel.system, 'trigger:score'),
        reasoningStart: () => eventName(EventChannel.system, 'reasoning:start'),
        reasoningEnd: () => eventName(EventChannel.system, 'reasoning:end'),
        lmStart: () => eventName(EventChannel.system, 'lm:start'),
        lmChunk: () => eventName(EventChannel.system, 'lm:chunk'),
        lmEnd: () => eventName(EventChannel.system, 'lm:end'),
        lmSuggestsReasoning: () => eventName(EventChannel.system, 'lm:suggests-reasoning'),
        lmRuleExecuted: () => eventName(EventChannel.system, 'lm-rule:executed'),
        lmRuleFailed: () => eventName(EventChannel.system, 'lm-rule:failed'),
        lmRuleDisabled: () => eventName(EventChannel.system, 'lm-rule:disabled'),
        directiveFound: () => eventName(EventChannel.system, 'directive:found'),
        directiveExecute: () => eventName(EventChannel.system, 'directive:execute'),
        directiveLoopRequested: () => eventName(EventChannel.system, 'directive:loop-requested'),
        loopPass: () => eventName(EventChannel.system, 'loop:pass'),
        conversationMessageAdded: () => eventName(EventChannel.system, 'conversation:message-added'),
        conversationArtifactAdded: () => eventName(EventChannel.system, 'conversation:artifact-added'),
        conversationBeliefPinned: () => eventName(EventChannel.system, 'conversation:belief-pinned'),
        conversationSummarized: () => eventName(EventChannel.system, 'conversation:summarized'),
    },
};
