/**
 * Judgment Telemetry — structured logging for the judgment cascade.
 */
import { promises as fs } from 'fs';
import { join } from 'path';
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
];
/** Console telemetry sink. */
export class ConsoleTelemetrySink {
    flushMs;
    buffer = [];
    flushInterval = null;
    constructor(flushMs = 1000) {
        this.flushMs = flushMs;
        this.flushInterval = setInterval(() => this.flush(), flushMs);
    }
    async write(event) {
        this.buffer.push(event);
    }
    async flush() {
        if (this.buffer.length === 0)
            return;
        const events = this.buffer.splice(0);
        for (const event of events) {
            console.log(JSON.stringify(event));
        }
    }
    async close() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flush();
    }
}
/** File telemetry sink. */
export class FileTelemetrySink {
    dir;
    flushMs;
    maxFileSize;
    buffer = [];
    flushInterval = null;
    fileHandle = null;
    currentDate = '';
    constructor(dir, flushMs = 5000, maxFileSize = 100 * 1024 * 1024 // 100MB
    ) {
        this.dir = dir;
        this.flushMs = flushMs;
        this.maxFileSize = maxFileSize;
        this.flushInterval = setInterval(() => this.flush(), flushMs);
    }
    async ensureFile() {
        const date = new Date().toISOString().split('T')[0];
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
    async write(event) {
        this.buffer.push(event);
    }
    async flush() {
        if (this.buffer.length === 0)
            return;
        await this.ensureFile();
        const events = this.buffer.splice(0);
        const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
        await this.fileHandle.write(lines);
    }
    async close() {
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
export class MemoryTelemetrySink {
    events = [];
    maxEvents;
    constructor(maxEvents = 10000) {
        this.maxEvents = maxEvents;
    }
    async write(event) {
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
    }
    async flush() {
        // No-op for memory sink
    }
    async close() {
        // No-op
    }
    /** Get all events. */
    getEvents() {
        return [...this.events];
    }
    /** Get events by type. */
    getEventsByType(type) {
        return this.events.filter(e => e.type === type);
    }
    /** Clear events. */
    clear() {
        this.events = [];
    }
}
/** Telemetry collector — manages sinks and emits events. */
export class TelemetryCollector {
    sinks = [];
    correlationId;
    enabled = true;
    clock;
    ids;
    constructor(correlationId, options = {}) {
        this.clock = options.clock ?? { now: () => Date.now(), setTime: () => { }, advance: () => { } };
        this.ids = options.ids ?? { uuid: () => crypto.randomUUID(), short: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
        this.correlationId = correlationId ?? this.ids.uuid();
    }
    /** Add a sink. */
    addSink(sink) {
        this.sinks.push(sink);
    }
    /** Remove a sink. */
    removeSink(sink) {
        const idx = this.sinks.indexOf(sink);
        if (idx >= 0)
            this.sinks.splice(idx, 1);
    }
    /** Enable/disable telemetry. */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /** Emit an event. */
    async emit(event) {
        if (!this.enabled)
            return;
        const fullEvent = {
            ...event,
            timestamp: this.clock.now(),
            eventId: this.ids.uuid(),
            correlationId: this.correlationId,
        };
        await Promise.all(this.sinks.map(s => s.write(fullEvent).catch(console.error)));
    }
    /** Convenience methods for each event type. */
    async judgmentStart(context) {
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
    async judgmentStage(stage, inputCandidates, outputCandidates, durationMs, error) {
        await this.emit({
            type: 'judgment.stage',
            payload: { stage, inputCandidates, outputCandidates, durationMs, error },
        });
    }
    async candidate(candidate, stage) {
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
    async selected(candidate, rank, totalCandidates) {
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
    async calibrated(candidateId, preConfidence, postConfidence, method, factor) {
        await this.emit({
            type: 'judgment.calibrated',
            payload: { candidateId, preConfidence, postConfidence, method, factor },
        });
    }
    async fallback(reason, fallbackCandidateId) {
        await this.emit({
            type: 'judgment.fallback',
            payload: { reason, fallbackCandidateId },
        });
    }
    async complete(result) {
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
    async outcome(candidateId, predictedConfidence, actualOutcome, outcomeScore) {
        await this.emit({
            type: 'judgment.outcome',
            payload: { candidateId, predictedConfidence, actualOutcome, outcomeScore },
        });
    }
    async calibrationUpdate(method, params, ece, mce, dataPoints) {
        await this.emit({
            type: 'calibration.update',
            payload: { method, ...params, ece, mce, dataPoints },
        });
    }
    async demotion(ece, threshold, demotionFactor) {
        await this.emit({
            type: 'demotion.triggered',
            payload: { ece, threshold, demotionFactor },
        });
    }
    async judgeWeightChange(modelType, weightDelta, trainingExamples, epoch, loss) {
        await this.emit({
            type: 'judge.weight-change',
            payload: { modelType, weightDelta, trainingExamples, epoch, loss },
        });
    }
    async judgeModelTrained(modelType, version, trainingExamples, lastTrained, metrics) {
        await this.emit({
            type: 'judge.model-trained',
            payload: { modelType, version, trainingExamples, lastTrained, metrics },
        });
    }
    async judgeDemoted(judgeType, ece, cycle) {
        await this.emit({
            type: 'judge.weight-change',
            payload: { modelType: judgeType, weightDelta: ece, trainingExamples: 0, epoch: cycle, loss: ece },
        });
    }
    async parityEvaluated(path, status) {
        await this.emit({
            type: 'judgment.complete',
            payload: {
                selected: status.parityAchieved,
                finalConfidence: 1 - status.brierScore,
                totalCandidates: 1,
                totalDurationMs: 0,
                fallbackUsed: !status.parityAchieved,
                timings: { candidates: 0, symbolic_veto: 0, evidence_support: 0, lm_rubric: 0, learned_judge: 0, calibrate: 0 },
            },
        });
    }
    async consolidationComplete(pathsConsolidated) {
        await this.emit({
            type: 'judgment.complete',
            payload: {
                selected: true,
                finalConfidence: 1,
                totalCandidates: pathsConsolidated,
                totalDurationMs: 0,
                fallbackUsed: false,
                timings: { candidates: 0, symbolic_veto: 0, evidence_support: 0, lm_rubric: 0, learned_judge: 0, calibrate: 0 },
            },
        });
    }
    /** Flush all sinks. */
    async flush() {
        await Promise.all(this.sinks.map(s => s.flush()));
    }
    /** Close all sinks. */
    async close() {
        await Promise.all(this.sinks.map(s => s.close()));
    }
}
/** Create a telemetry collector with default sinks. */
export function createTelemetryCollector(correlationId) {
    const collector = new TelemetryCollector(correlationId);
    collector.addSink(new ConsoleTelemetrySink());
    return collector;
}
/** Global telemetry collector. */
export const telemetryCollector = createTelemetryCollector();
