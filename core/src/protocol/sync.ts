/**
 * Synchronization, viewport, telemetry, focus, cognitive events schemas
 */
import { z } from 'zod';
import { ConfigField } from './config.js';
import { msg } from './envelope.js';
import { Lens } from './graph-view.js';
import type { CognitiveEvent } from '../schemas/cognitive-events.js';

export const SyncRequest = msg('sync.request', { lastSeqId: z.number().nullable() });

export const CognitiveEventsMsg = msg('cognitive.events', {
  events: z.array(z.any()), // CognitiveEventSchema - using z.any() to avoid circular deps
});
export const StateSnapshot = msg('state.snapshot', {
  seqId: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    workingMemory: z.array(z.any()),
    config: z.record(z.string(), ConfigField),
  }),
});

export const CognitiveMetrics = z.object({
  activeConcepts: z.number(),
  totalConcepts: z.number(),
  derivationsPerSec: z.number(),
  contradictionCount: z.number(),
  workingMemorySize: z.number(),
  goalUrgencyDistribution: z.record(z.string(), z.number()).optional(),
});

export const TelemetryMsg = msg('telemetry', {
  metrics: z.object({
    reasoning_hz: z.number(),
    tokens_per_sec: z.number(),
    memory_mb: z.number(),
    ws_latency_ms: z.number(),
  }),
  cognitive: CognitiveMetrics.optional(),
});

/** The metric dimension names a telemetry frame carries — the key space `fieldCatalog` covers. */
export type TelemetryMetrics = z.infer<typeof TelemetryMsg>['metrics'];
export type CognitiveMetricsData = z.infer<typeof CognitiveMetrics>;

export const LensSet = msg('lens.set', { lens: Lens });
export const FocusSet = msg('focus.set', { term: z.string() });

export const CycleStateMsg = msg('cycle.state', {
  state: z.enum(['running', 'paused', 'stepping']),
  cycleCount: z.number().optional(),
  /** The stage the kernel is in after the cycle (CORE.19 C2.1). */
  phase: z.string().optional(),
  /** Pending tasks the manager holds after the cycle. */
  activeTasks: z.number().optional(),
  /** Control-budget spend by scopeId. */
  budget: z.record(z.string(), z.number()).optional(),
});

/**
 * Client→server kernel control (CORE.19 C2.2). The UI drives the same control
 * plane `NAR.step/pause/resume` expose, rather than a UI-package loop.
 */
export const CycleStepMsg = msg('cycle.step', { seqId: z.number().optional() });
export const CyclePauseMsg = msg('cycle.pause', { seqId: z.number().optional() });
export const CycleResumeMsg = msg('cycle.resume', { seqId: z.number().optional() });
export const CycleRewindMsg = msg('cycle.rewind', {
  /** The cycle count to rewind toward; the boundary actually restored is reported back. */
  cycles: z.number().int().nonnegative().optional(),
  seqId: z.number().optional(),
});
