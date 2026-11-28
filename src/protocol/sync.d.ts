/**
 * Synchronization, viewport, telemetry, focus, cognitive events schemas
 */
import { z } from 'zod';
export declare const SyncRequest: z.ZodObject<{
    lastSeqId: z.ZodNullable<z.ZodNumber>;
    type: z.ZodLiteral<"sync.request">;
}, z.core.$strip>;
export declare const CognitiveEventsMsg: z.ZodObject<{
    events: z.ZodArray<z.ZodAny>;
    type: z.ZodLiteral<"cognitive.events">;
}, z.core.$strip>;
export declare const StateSnapshot: z.ZodObject<{
    seqId: z.ZodNumber;
    data: z.ZodObject<{
        graph: z.ZodObject<{
            nodes: z.ZodArray<z.ZodAny>;
            edges: z.ZodArray<z.ZodAny>;
        }, z.core.$strip>;
        workingMemory: z.ZodArray<z.ZodAny>;
        config: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<{
                dropdown: "dropdown";
                slider: "slider";
                text: "text";
                toggle: "toggle";
            }>;
            label: z.ZodString;
            value: z.ZodAny;
            options: z.ZodOptional<z.ZodArray<z.ZodString>>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            step: z.ZodOptional<z.ZodNumber>;
            description: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodEnum<{
                advanced: "advanced";
                llm: "llm";
                nars: "nars";
                system: "system";
            }>>;
            validation: z.ZodOptional<z.ZodObject<{
                pattern: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"state.snapshot">;
}, z.core.$strip>;
export declare const CognitiveMetrics: z.ZodObject<{
    activeConcepts: z.ZodNumber;
    totalConcepts: z.ZodNumber;
    derivationsPerSec: z.ZodNumber;
    contradictionCount: z.ZodNumber;
    workingMemorySize: z.ZodNumber;
    goalUrgencyDistribution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$strip>;
export declare const TelemetryMsg: z.ZodObject<{
    metrics: z.ZodObject<{
        reasoning_hz: z.ZodNumber;
        tokens_per_sec: z.ZodNumber;
        memory_mb: z.ZodNumber;
        ws_latency_ms: z.ZodNumber;
    }, z.core.$strip>;
    cognitive: z.ZodOptional<z.ZodObject<{
        activeConcepts: z.ZodNumber;
        totalConcepts: z.ZodNumber;
        derivationsPerSec: z.ZodNumber;
        contradictionCount: z.ZodNumber;
        workingMemorySize: z.ZodNumber;
        goalUrgencyDistribution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"telemetry">;
}, z.core.$strip>;
/** The metric dimension names a telemetry frame carries — the key space `fieldCatalog` covers. */
export type TelemetryMetrics = z.infer<typeof TelemetryMsg>['metrics'];
export type CognitiveMetricsData = z.infer<typeof CognitiveMetrics>;
export declare const LensSet: z.ZodObject<{
    lens: z.ZodString;
    type: z.ZodLiteral<"lens.set">;
}, z.core.$strip>;
export declare const FocusSet: z.ZodObject<{
    term: z.ZodString;
    type: z.ZodLiteral<"focus.set">;
}, z.core.$strip>;
export declare const CycleStateMsg: z.ZodObject<{
    state: z.ZodEnum<{
        paused: "paused";
        running: "running";
        stepping: "stepping";
    }>;
    cycleCount: z.ZodOptional<z.ZodNumber>;
    phase: z.ZodOptional<z.ZodString>;
    activeTasks: z.ZodOptional<z.ZodNumber>;
    budget: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    type: z.ZodLiteral<"cycle.state">;
}, z.core.$strip>;
/**
 * Client→server kernel control (CORE.19 C2.2). The UI drives the same control
 * plane `NAR.step/pause/resume` expose, rather than a UI-package loop.
 */
export declare const CycleStepMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.step">;
}, z.core.$strip>;
export declare const CyclePauseMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.pause">;
}, z.core.$strip>;
export declare const CycleResumeMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.resume">;
}, z.core.$strip>;
export declare const CycleRewindMsg: z.ZodObject<{
    cycles: z.ZodOptional<z.ZodNumber>;
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.rewind">;
}, z.core.$strip>;
//# sourceMappingURL=sync.d.ts.map