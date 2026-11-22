/**
 * Judgment Telemetry — structured logging for the judgment cascade.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { JudgmentContext, JudgmentResult, JudgmentCandidate, JudgmentStage } from './cascade';
import type { CalibrationResult } from './calibration';
import type { Clock, IDGenerator, TimestampMs } from '../../kernel/env';

/** Telemetry event types. */
export const TELEMETRY_EVENT_TYPES = [
  'judgment.start',
  'judgment.stage',
  'judgment.candidate',
  'judgment.selected',
  'judgment.calibrated',
  'judgment.fallback',
  'judgment.complete',
  'judgment.outcome',
  'calibration.update',
  'demotion.triggered',
  'judge.weight-change',
  'judge.model-trained',
] as const;

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
    actualOutcome: number; // 0 or 1
    outcomeScore: number; // 0-1 continuous
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
export type AnyTelemetryEvent =
  | JudgmentStartEvent
  | JudgmentStageEvent
  | CandidateEvent
  | SelectedEvent
  | CalibratedEvent
  | FallbackEvent
  | JudgmentCompleteEvent
  | OutcomeEvent
  | CalibrationUpdateEvent
  | DemotionEvent
  | JudgeWeightChangeEvent
  | JudgeModelTrainedEvent;

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
export class ConsoleTelemetrySink implements TelemetrySink {
  private buffer: AnyTelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private flushMs = 1000) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }

  async write(event: AnyTelemetryEvent): Promise<void> {
    this.buffer.push(event);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const events = this.buffer.splice(0);
    for (const event of events) {
      console.log(JSON.stringify(event));
    }
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }
}

/** File telemetry sink. */
export class FileTelemetrySink implements TelemetrySink {
  private buffer: AnyTelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private fileHandle: any = null;
  private currentDate = '';

  constructor(
    private dir: string,
    private flushMs = 5000,
    private maxFileSize = 100 * 1024 * 1024 // 100MB
  ) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }

  private async ensureFile(): Promise<void> {
    const date = new Date().toISOString().split('T')[0]!;

    if (date !== this.currentDate || !this.fileHandle) {
      if (this.fileHandle) {
        await this.fileHandle.close();
      }
      await fs.mkdir(this.dir, { recursive: true });
      const path = join(this.dir, `telemetry-${date}.jsonl`);
      this.fileHandle = await fs.open(path, 'a');
      this.currentDate = date;
    }
  }

  async write(event: AnyTelemetryEvent): Promise<void> {
    this.buffer.push(event);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    await this.ensureFile();

    const events = this.buffer.splice(0);
    const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
    await this.fileHandle.write(lines);
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }
}

/** In-memory telemetry sink (for testing). */
export class MemoryTelemetrySink implements TelemetrySink {
  private events: AnyTelemetryEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents = 10000) {
    this.maxEvents = maxEvents;
  }

  async write(event: AnyTelemetryEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  async flush(): Promise<void> {
    // No-op for memory sink
  }

  async close(): Promise<void> {
    // No-op
  }

  /** Get all events. */
  getEvents(): AnyTelemetryEvent[] {
    return [...this.events];
  }

  /** Get events by type. */
  getEventsByType(type: TelemetryEventType): AnyTelemetryEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /** Clear events. */
  clear(): void {
    this.events = [];
  }
}

/** Telemetry collector — manages sinks and emits events. */
export class TelemetryCollector {
  private sinks: TelemetrySink[] = [];
  private correlationId: string;
  private enabled = true;
  private readonly clock: Clock;
  private readonly ids: IDGenerator;

  constructor(
    correlationId?: string,
    options: { clock?: Clock; ids?: IDGenerator } = {}
  ) {
    this.clock = options.clock ?? { now: () => Date.now() as TimestampMs, setTime: () => {}, advance: () => {} };
    this.ids = options.ids ?? { uuid: () => crypto.randomUUID(), short: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    this.correlationId = correlationId ?? this.ids.uuid();
  }

  /** Add a sink. */
  addSink(sink: TelemetrySink): void {
    this.sinks.push(sink);
  }

  /** Remove a sink. */
  removeSink(sink: TelemetrySink): void {
    const idx = this.sinks.indexOf(sink);
    if (idx >= 0) this.sinks.splice(idx, 1);
  }

  /** Enable/disable telemetry. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Emit an event. */
  async emit(event: Omit<AnyTelemetryEvent, 'timestamp' | 'eventId' | 'correlationId'>): Promise<void> {
    if (!this.enabled) return;

    const fullEvent = {
      ...event,
      timestamp: this.clock.now(),
      eventId: this.ids.uuid(),
      correlationId: this.correlationId,
    } as AnyTelemetryEvent;

    await Promise.all(this.sinks.map(s => s.write(fullEvent).catch(console.error)));
  }

  /** Convenience methods for each event type. */
  async judgmentStart(context: JudgmentContext): Promise<void> {
    await this.emit({
      type: 'judgment.start',
      payload: {
        situation: context.situation.toString(),
        numGoals: context.goals.length,
        numBeliefs: context.beliefs.length,
        budget: context.budget,
        urgency: context.urgency,
        riskTolerance: context.riskTolerance,
      },
    });
  }

  async judgmentStage(
    stage: JudgmentStage,
    inputCandidates: number,
    outputCandidates: number,
    durationMs: number,
    error?: string
  ): Promise<void> {
    await this.emit({
      type: 'judgment.stage',
      payload: { stage, inputCandidates, outputCandidates, durationMs, error },
    });
  }

  async candidate(candidate: JudgmentCandidate, stage: JudgmentStage): Promise<void> {
    await this.emit({
      type: 'judgment.candidate',
      payload: {
        candidateId: candidate.id,
        sourceFaculty: candidate.sourceFaculty,
        confidence: candidate.confidence,
        evidenceCount: candidate.evidence.length,
        stage,
      },
    });
  }

  async selected(candidate: JudgmentCandidate, rank: number, totalCandidates: number): Promise<void> {
    await this.emit({
      type: 'judgment.selected',
      payload: {
        candidateId: candidate.id,
        confidence: candidate.confidence,
        sourceFaculty: candidate.sourceFaculty,
        rank,
        totalCandidates,
      },
    });
  }

  async calibrated(
    candidateId: string,
    preConfidence: number,
    postConfidence: number,
    method: string,
    factor: number
  ): Promise<void> {
    await this.emit({
      type: 'judgment.calibrated',
      payload: { candidateId, preConfidence, postConfidence, method, factor },
    });
  }

  async fallback(reason: string, fallbackCandidateId?: string): Promise<void> {
    await this.emit({
      type: 'judgment.fallback',
      payload: { reason, fallbackCandidateId },
    });
  }

  async complete(result: JudgmentResult): Promise<void> {
    await this.emit({
      type: 'judgment.complete',
      payload: {
        selected: result.selected !== null,
        finalConfidence: result.confidence,
        totalCandidates: result.candidates.length,
        totalDurationMs: Object.values(result.timings).reduce((a, b) => a + b, 0),
        fallbackUsed: result.fallbackUsed,
        timings: result.timings,
      },
    });
  }

  async outcome(candidateId: string, predictedConfidence: number, actualOutcome: number, outcomeScore: number): Promise<void> {
    await this.emit({
      type: 'judgment.outcome',
      payload: { candidateId, predictedConfidence, actualOutcome, outcomeScore },
    });
  }

  async calibrationUpdate(method: string, params: Record<string, number>, ece: number, mce: number, dataPoints: number): Promise<void> {
    await this.emit({
      type: 'calibration.update',
      payload: { method, ...params, ece, mce, dataPoints },
    });
  }

  async demotion(ece: number, threshold: number, demotionFactor: number): Promise<void> {
    await this.emit({
      type: 'demotion.triggered',
      payload: { ece, threshold, demotionFactor },
    });
  }

  async judgeWeightChange(
    modelType: string,
    weightDelta: number,
    trainingExamples: number,
    epoch: number,
    loss: number
  ): Promise<void> {
    await this.emit({
      type: 'judge.weight-change',
      payload: { modelType, weightDelta, trainingExamples, epoch, loss },
    });
  }

  async judgeModelTrained(
    modelType: string,
    version: string,
    trainingExamples: number,
    lastTrained: number,
    metrics?: { accuracy: number; auc: number; calibrationError: number; brierScore: number }
  ): Promise<void> {
    await this.emit({
      type: 'judge.model-trained',
      payload: { modelType, version, trainingExamples, lastTrained, metrics },
    });
  }

  async judgeDemoted(judgeType: string, ece: number, cycle: number): Promise<void> {
    await this.emit({
      type: 'judge.weight-change',
      payload: { modelType: judgeType, weightDelta: ece, trainingExamples: 0, epoch: cycle, loss: ece },
    });
  }

  /** Flush all sinks. */
  async flush(): Promise<void> {
    await Promise.all(this.sinks.map(s => s.flush()));
  }

  /** Close all sinks. */
  async close(): Promise<void> {
    await Promise.all(this.sinks.map(s => s.close()));
  }
}

/** Create a telemetry collector with default sinks. */
export function createTelemetryCollector(correlationId?: string): TelemetryCollector {
  const collector = new TelemetryCollector(correlationId);
  collector.addSink(new ConsoleTelemetrySink());
  return collector;
}

/** Global telemetry collector. */
export const telemetryCollector = createTelemetryCollector();