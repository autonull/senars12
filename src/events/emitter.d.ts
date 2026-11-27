/**
 * Unified Event Emitter — typed event emission and subscription.
 *
 * Replaces ad-hoc event emission patterns across the codebase.
 */
import { type Logger } from '../util/logger';
import { type NAREventMap } from './taxonomy';
/** Event receiver function. */
export type EventReceiver<T> = (event: T) => void;
/** Event unsubscribe function. */
export type EventUnsubscribe = () => void;
/**
 * Unified typed event emitter.
 *
 * Provides type-safe event emission and subscription for the canonical event taxonomy.
 */
export declare class EventEmitter<T extends Record<string, any> = NAREventMap> {
    #private;
    private bags;
    private readonly logger;
    private readonly clock;
    constructor(logger?: Logger, clock?: () => number);
    /** Subscribe to an event. */
    on<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe;
    /** Subscribe once. */
    once<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe;
    /** Unsubscribe. */
    off<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): void;
    /** Emit an event with automatic timestamp and correlation ID. */
    emit<K extends keyof T>(eventName: K & string, payload: T[K], options?: {
        correlationId?: string;
        iteration?: number;
    }): void;
    /** Emit a raw event (for migration compatibility). */
    emitRaw<K extends keyof T>(eventName: K & string, event: T[K] & {
        type?: string;
        timestamp?: number;
        correlationId?: string;
        iteration?: number;
    }): void;
    /** Get listener count for an event. */
    listenerCount(eventName: string): number;
    /** Clear all listeners. */
    clear(): void;
    /** Get all event names with listeners. */
    eventNames(): string[];
}
export declare function getGlobalEmitter(): EventEmitter<NAREventMap>;
export declare function setGlobalEmitter(emitter: EventEmitter<NAREventMap>): void;
/** Convenience function to emit on global bus. */
export declare function emitGlobal<K extends keyof NAREventMap>(eventName: K & string, payload: NAREventMap[K], options?: {
    correlationId?: string;
    iteration?: number;
}): void;
/** Convenience function to subscribe on global bus. */
export declare function onGlobal<K extends keyof NAREventMap>(eventName: K & string, fn: EventReceiver<NAREventMap[K]>): EventUnsubscribe;
/** Helper to create canonical event names. */
export declare const events: {
    readonly kernel: {
        readonly budgetSliceCreated: () => string;
        readonly budgetSliceConsumed: () => string;
        readonly budgetSliceExhausted: () => string;
        readonly budgetSliceMerged: () => string;
        readonly cognitive: () => string;
        readonly memoryPressure: () => string;
        readonly memoryConsolidated: () => string;
        readonly lmCall: () => string;
        readonly lmError: () => string;
        readonly cycleState: () => string;
        readonly error: () => string;
        readonly restoreState: () => string;
        readonly cycleRewound: () => string;
    };
    readonly cognition: {
        readonly contradiction: () => string;
        readonly ruleApplied: () => string;
        readonly conceptCreated: () => string;
        readonly conceptRemoved: () => string;
        readonly derivationAccepted: () => string;
        readonly derivationRecord: () => string;
        readonly narDerivation: () => string;
        readonly stateChange: () => string;
        readonly explanation: () => string;
        readonly nalDerived: () => string;
        readonly lmValidationFailed: () => string;
        readonly feedbackCorrection: () => string;
    };
    readonly loop: {
        readonly iterationStart: () => string;
        readonly iterationComplete: () => string;
        readonly iterationFailed: () => string;
        readonly selectionMade: () => string;
        readonly actionExecuted: () => string;
        readonly judgmentComplete: () => string;
        readonly contractChecked: () => string;
        readonly repairComplete: () => string;
        readonly appraisalComplete: () => string;
        readonly maxIterationsReached: () => string;
        readonly timeout: () => string;
    };
    readonly mining: {
        readonly schemaInduced: () => string;
        readonly surprise: () => string;
        readonly domainLearned: () => string;
        readonly patternFound: () => string;
    };
    readonly telemetry: {
        readonly event: () => string;
    };
    readonly agent: {
        readonly processStart: () => string;
        readonly processComplete: () => string;
        readonly suspend: () => string;
        readonly resume: () => string;
    };
    readonly tool: {
        readonly register: () => string;
        readonly unregister: () => string;
        readonly init: () => string;
        readonly stop: () => string;
        readonly dispose: () => string;
        readonly call: () => string;
        readonly result: () => string;
        readonly error: () => string;
    };
    readonly nl: {
        readonly analyzed: () => string;
        readonly translation: () => string;
        readonly clarificationNeeded: () => string;
    };
    readonly autonomy: {
        readonly curiosity: () => string;
        readonly consolidated: () => string;
        readonly budget: () => string;
    };
    readonly lm: {
        readonly ruleApplied: () => string;
        readonly ruleSkipped: () => string;
        readonly ruleStructured: () => string;
        readonly ruleToolCalled: () => string;
        readonly ruleToolResult: () => string;
        readonly ruleFailed: () => string;
        readonly ruleCircuitOpen: () => string;
        readonly ruleCircuitHalfOpen: () => string;
        readonly ruleCircuitClosed: () => string;
    };
    readonly system: {
        readonly turnStart: () => string;
        readonly turnEnd: () => string;
        readonly turnError: () => string;
        readonly stageStart: () => string;
        readonly stageEnd: () => string;
        readonly stageError: () => string;
        readonly classifyResult: () => string;
        readonly triggerScore: () => string;
        readonly reasoningStart: () => string;
        readonly reasoningEnd: () => string;
        readonly lmStart: () => string;
        readonly lmChunk: () => string;
        readonly lmEnd: () => string;
        readonly lmSuggestsReasoning: () => string;
        readonly lmRuleExecuted: () => string;
        readonly lmRuleFailed: () => string;
        readonly lmRuleDisabled: () => string;
        readonly directiveFound: () => string;
        readonly directiveExecute: () => string;
        readonly directiveLoopRequested: () => string;
        readonly loopPass: () => string;
        readonly conversationMessageAdded: () => string;
        readonly conversationArtifactAdded: () => string;
        readonly conversationBeliefPinned: () => string;
        readonly conversationSummarized: () => string;
    };
};
//# sourceMappingURL=emitter.d.ts.map