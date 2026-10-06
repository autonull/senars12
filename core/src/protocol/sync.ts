/**
 * Synchronization, viewport, telemetry, focus schemas
 */
import { z } from 'zod';
import { ConfigField } from './config.js';
import { msg } from './envelope.js';
import { Lens } from './graph-view.js';

export const SyncRequest = msg('sync.request', { lastSeqId: z.number().nullable() });
export const StateSnapshot = msg('state.snapshot', {
  seqId: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    workingMemory: z.array(z.any()),
    config: z.record(z.string(), ConfigField),
  }),
});

export const ViewportSet = msg('viewport.set', { x: z.number(), y: z.number(), zoom: z.number() });

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

export const LensSet = msg('lens.set', { lens: Lens });
export const FocusSet = msg('focus.set', { term: z.string() });
