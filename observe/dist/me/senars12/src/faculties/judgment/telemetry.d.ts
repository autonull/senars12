/**
 * Judgment Telemetry — structured logging for the judgment cascade.
 */
import type { JudgmentContext, JudgmentResult, JudgmentCandidate, JudgmentStage } from './cascade';
import type { Clock, IDGenerator } from '../../kernel/env';
/** Telemetry event types. */
export declare const TELEMETRY_EVENT_TYPES: readonly ['judgment.start', 'judgment.stage', 'judgment.candidate', 'judgment.selected', 'judgment.calibrated', 'judgment.fallback', 'judgment.complete', 'judgment.outcome', 'calibration.update', 'demotion.triggered', 'judge.weight-change', 'judge.model-trained'];
export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];
/** Base telemetry event. */
export interface TelemetryEvent {
    /** Event type. */
    type: TelemetryEventType;
    /** Timestamp in ms. */
    timestamp: number;
    /** Unique event ID. */
    eventId: string;
    /** Correlation ID for tracing. */
    correlationId: string;
}
/** Judgment start event. */
export interface JudgmentStartEvent extends TelemetryEvent {
    type: 'judgment.start';
    payload: {
        situation: string;
        numGoals: number;
        numBeliefs: number;
        budget: number;
        urgency: number;
        riskTolerance: number;
    };
}
/** Judgment stage event. */
export interface JudgmentStageEvent extends TelemetryEvent {
    type: 'judgment.stage';
    payload: {
        stage: JudgmentStage;
        inputCandidates: number;
        outputCandidates: number;
        durationMs: number;
        error?: string;
    };
}
/** Candidate generated event. */
export interface CandidateEvent extends TelemetryEvent {
    type: 'judgment.candidate';
    payload: {
        candidateId: string;
        sourceFaculty: string;
        confidence: number;
        evidenceCount: number;
        stage: JudgmentStage;
    };
}
/** Candidate selected event. */
export interface SelectedEvent extends TelemetryEvent {
    type: 'judgment.selected';
    payload: {
        candidateId: string;
        confidence: number;
        sourceFaculty: string;
        rank: number;
        totalCandidates: number;
    };
}
/** Calibration applied event. */
export interface CalibratedEvent extends TelemetryEvent {
    type: 'judgment.calibrated';
    payload: {
        candidateId: string;
        preConfidence: number;
        postConfidence: number;
        method: string;
        factor: number;
    };
}
/** Fallback used event. */
export interface FallbackEvent extends TelemetryEvent {
    type: 'judgment.fallback';
    payload: {
        reason: string;
        fallbackCandidateId?: string;
    };
}
/** Judgment complete event. */
export interface JudgmentCompleteEvent extends TelemetryEvent {
    type: 'judgment.complete';
    payload: {
        selected: boolean;
        finalConfidence: number;
        totalCandidates: number;
        totalDurationMs: number;
        fallbackUsed: boolean;
        timings: Record<JudgmentStage, number>;
    };
}
/** Outcome recorded event. */
export interface OutcomeEvent extends TelemetryEvent {
    type: 'judgment.outcome';
    payload: {
        candidateId: string;
        predictedConfidence: number;
        actualOutcome: number;
        outcomeScore: number;
    };
}
/** Calibration update event. */
export interface CalibrationUpdateEvent extends TelemetryEvent {
    type: 'calibration.update';
    payload: {
        method: string;
        temperature?: number;
        ece: number;
        mce: number;
        dataPoints: number;
    };
}
/** Demotion triggered event. */
export interface DemotionEvent extends TelemetryEvent {
    type: 'demotion.triggered';
    payload: {
        ece: number;
        threshold: number;
        demotionFactor: number;
    };
}
/** Judge weight change event. */
export interface JudgeWeightChangeEvent extends TelemetryEvent {
    type: 'judge.weight-change';
    payload: {
        modelType: string;
        weightDelta: number;
        trainingExamples: number;
        epoch: number;
        loss: number;
    };
}
/** Judge model trained event. */
export interface JudgeModelTrainedEvent extends TelemetryEvent {
    type: 'judge.model-trained';
    payload: {
        modelType: string;
        version: string;
        trainingExamples: number;
        lastTrained: number;
        metrics?: {
            accuracy: number;
            auc: number;
            calibrationError: number;
            brierScore: number;
        };
    };
}
/** Union of all telemetry events. */
export type AnyTelemetryEvent = JudgmentStartEvent | JudgmentStageEvent | CandidateEvent | SelectedEvent | CalibratedEvent | FallbackEvent | JudgmentCompleteEvent | OutcomeEvent | CalibrationUpdateEvent | DemotionEvent | JudgeWeightChangeEvent | JudgeModelTrainedEvent;
/** Telemetry sink interface. */
export interface TelemetrySink {
    /** Write an event. */
    write(event: AnyTelemetryEvent): Promise<void>;
    /** Flush pending events. */
    flush(): Promise<void>;
    /** Close the sink. */
    close(): Promise<void>;
}
/** Console telemetry sink. */
export declare class ConsoleTelemetrySink implements TelemetrySink {
    private flushMs;
    private buffer;
    private flushInterval;
    constructor(flushMs?: number);
    write(event: AnyTelemetryEvent): Promise<void>;
    flush(): Promise<void>;
    close(): Promise<void>;
}
/** File telemetry sink. */
export declare class FileTelemetrySink implements TelemetrySink {
    private dir;
    private flushMs;
    private maxFileSize;
    private buffer;
    private flushInterval;
    private fileHandle;
    private currentDate;
    constructor(dir: string, flushMs?: number, maxFileSize?: number);
    private ensureFile;
    write(event: AnyTelemetryEvent): Promise<void>;
    flush(): Promise<void>;
    close(): Promise<void>;
}
/** In-memory telemetry sink (for testing). */
export declare class MemoryTelemetrySink implements TelemetrySink {
    private events;
    private maxEvents;
    constructor(maxEvents?: number);
    write(event: AnyTelemetryEvent): Promise<void>;
    flush(): Promise<void>;
    close(): Promise<void>;
    /** Get all events. */
    getEvents(): AnyTelemetryEvent[];
    /** Get events by type. */
    getEventsByType(type: TelemetryEventType): AnyTelemetryEvent[];
    /** Clear events. */
    clear(): void;
}
/** Telemetry collector — manages sinks and emits events. */
export declare class TelemetryCollector {
    private sinks;
    private correlationId;
    private enabled;
    private readonly clock;
    private readonly ids;
    constructor(correlationId?: string, options?: {
        clock?: Clock;
        ids?: IDGenerator;
    });
    /** Add a sink. */
    addSink(sink: TelemetrySink): void;
    /** Remove a sink. */
    removeSink(sink: TelemetrySink): void;
    /** Enable/disable telemetry. */
    setEnabled(enabled: boolean): void;
    /** Emit an event. */
    emit(event: Omit<AnyTelemetryEvent, 'timestamp' | 'eventId' | 'correlationId'>): Promise<void>;
    /** Convenience methods for each event type. */
    judgmentStart(context: JudgmentContext): Promise<void>;
    judgmentStage(stage: JudgmentStage, inputCandidates: number, outputCandidates: number, durationMs: number, error?: string): Promise<void>;
    candidate(candidate: JudgmentCandidate, stage: JudgmentStage): Promise<void>;
    selected(candidate: JudgmentCandidate, rank: number, totalCandidates: number): Promise<void>;
    calibrated(candidateId: string, preConfidence: number, postConfidence: number, method: string, factor: number): Promise<void>;
    fallback(reason: string, fallbackCandidateId?: string): Promise<void>;
    complete(result: JudgmentResult): Promise<void>;
    outcome(candidateId: string, predictedConfidence: number, actualOutcome: number, outcomeScore: number): Promise<void>;
    calibrationUpdate(method: string, params: Record<string, number>, ece: number, mce: number, dataPoints: number): Promise<void>;
    demotion(ece: number, threshold: number, demotionFactor: number): Promise<void>;
    judgeWeightChange(modelType: string, weightDelta: number, trainingExamples: number, epoch: number, loss: number): Promise<void>;
    judgeModelTrained(modelType: string, version: string, trainingExamples: number, lastTrained: number, metrics?: {
        accuracy: number;
        auc: number;
        calibrationError: number;
        brierScore: number;
    }): Promise<void>;
    judgeDemoted(judgeType: string, ece: number, cycle: number): Promise<void>;
    parityEvaluated(path: string, status: {
        brierScore: number;
        ece: number;
        parityAchieved: boolean;
    }): Promise<void>;
    consolidationComplete(pathsConsolidated: number): Promise<void>;
    /** Flush all sinks. */
    flush(): Promise<void>;
    /** Close all sinks. */
    close(): Promise<void>;
}
/** Create a telemetry collector with default sinks. */
export declare function createTelemetryCollector(correlationId?: string): TelemetryCollector;
/** Global telemetry collector. */
export declare const telemetryCollector: TelemetryCollector;
//# sourceMappingURL=telemetry.d.ts.map