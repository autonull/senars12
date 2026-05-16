/**
 * Input tracing for debugging infinite loops and performance issues
 */

export type TraceEventType =
    | 'input_start'
    | 'input_parse'
    | 'input_term_created'
    | 'input_memory_add'
    | 'input_task_add'
    | 'input_complete'
    | 'input_error'
    | 'loop_detected'
    | 'timeout'
    | string;

export interface TraceEvent {
    type: TraceEventType;
    timestamp: number;
    label: string;
    data?: Record<string, unknown>;
    duration?: number;
}

export interface LoopDetectionConfig {
    maxIterationsPerPhase?: number;
    timeoutMs?: number;
    enableStackTracking?: boolean;
}

const DEFAULT_CONFIG: Required<LoopDetectionConfig> = {
    maxIterationsPerPhase: 10000,
    timeoutMs: 10000,
    enableStackTracking: true
};

export class InputTracer {
    private events: TraceEvent[] = [];
    private phaseIterations = new Map<string, number>();
    private readonly config: Required<LoopDetectionConfig>;
    private startTime = 0;
    private currentPhase = 'idle';

    constructor(config: LoopDetectionConfig = {}) {
        this.config = {...DEFAULT_CONFIG, ...config};
    }

    start(phase: string): void {
        this.startTime = Date.now();
        this.currentPhase = phase;
        this.events.push({
            type: 'input_start',
            timestamp: this.startTime,
            label: phase
        });
    }

    event(type: TraceEventType, label: string, data?: Record<string, unknown>): void {
        const now = Date.now();

        // Check for infinite loop in current phase
        if (this.currentPhase !== 'idle') {
            const key = `${this.currentPhase}:${type}`;
            const count = (this.phaseIterations.get(key) ?? 0) + 1;
            this.phaseIterations.set(key, count);

            if (count > this.config.maxIterationsPerPhase) {
                this.events.push({
                    type: 'loop_detected',
                    timestamp: now,
                    label: `Excessive iterations in ${key}`,
                    data: {
                        phase: this.currentPhase,
                        eventType: type,
                        count,
                        threshold: this.config.maxIterationsPerPhase
                    }
                });
                throw new LoopDetectionError(
                    `Infinite loop detected: ${label} executed ${count} times in phase "${this.currentPhase}"`,
                    {phase: this.currentPhase, type, count}
                );
            }
        }

        const elapsed = this.startTime ? now - this.startTime : 0;
        if (elapsed > this.config.timeoutMs) {
            this.events.push({
                type: 'timeout',
                timestamp: now,
                label: `Operation exceeded ${this.config.timeoutMs}ms timeout`,
                data: {elapsed, phase: this.currentPhase, ...data}
            });
            throw new TimeoutError(
                `Operation timed out after ${elapsed}ms in phase "${this.currentPhase}"`,
                {elapsed, phase: this.currentPhase}
            );
        }

        this.events.push({
            type,
            timestamp: now,
            label,
            data,
            duration: elapsed
        });
    }

    getEvents(): TraceEvent[] {
        return [...this.events];
    }

    getLastEvent(): TraceEvent | undefined {
        return this.events[this.events.length - 1];
    }

    getEventsByType(type: TraceEventType): TraceEvent[] {
        return this.events.filter(e => e.type === type);
    }

    clear(): void {
        this.events = [];
        this.phaseIterations.clear();
    }

    getSummary(): {
        totalEvents: number;
        duration: number;
        phases: string[];
        eventCounts: Record<TraceEventType, number>;
    } {
        const first = this.events[0];
        const last = this.events[this.events.length - 1];
        const duration = first && last ? last.timestamp - first.timestamp : 0;
        const phases = [...new Set(this.events.map(e => e.data?.phase as string).filter(Boolean))];
        const eventCounts = {} as Record<TraceEventType, number>;

        for (const event of this.events) {
            eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
        }

        return {
            totalEvents: this.events.length,
            duration,
            phases,
            eventCounts
        };
    }

    formatTrace(): string {
        const lines: string[] = [];
        const summary = this.getSummary();

        lines.push(`=== Input Trace Summary ===`);
        lines.push(`Duration: ${summary.duration}ms`);
        lines.push(`Total Events: ${summary.totalEvents}`);
        if (summary.phases.length > 0) {
            lines.push(`Phases: ${summary.phases.join(', ')}`);
        }
        lines.push('');
        lines.push('Event Counts:');
        for (const [type, count] of Object.entries(summary.eventCounts)) {
            lines.push(`  ${type}: ${count}`);
        }
        lines.push('');
        lines.push('Event Timeline:');

        let lastTimestamp = 0;
        for (const event of this.events) {
            const delta = lastTimestamp ? `+${event.timestamp - lastTimestamp}ms` : '0ms';
            const dataStr = event.data ? ` ${JSON.stringify(event.data)}` : '';
            lines.push(`  [${delta}] ${event.type}: ${event.label}${dataStr}`);
            lastTimestamp = event.timestamp;
        }

        return lines.join('\n');
    }
}

export class LoopDetectionError extends Error {
    constructor(
        message: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'LoopDetectionError';
    }
}

export class TimeoutError extends Error {
    constructor(
        message: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'TimeoutError';
    }
}

// Global tracer instance for use across the codebase
let globalTracer: InputTracer | undefined;

export function getGlobalTracer(): InputTracer {
    if (!globalTracer) {
        globalTracer = new InputTracer();
    }
    return globalTracer;
}

export function resetGlobalTracer(): void {
    globalTracer = undefined;
}