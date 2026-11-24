/**
 * NAR Metrics Integration — hooks into NAR components to emit metrics.
 */

import { withSpan } from '../../otel';
import {
  recordNarCycle,
  recordMemoryStats,
  recordKernelGateDecision,
  recordRlEpisode,
  recordCodecOperation,
  recordLmCall,
  recordEvent,
  recordEventProcessed,
} from './instruments';
import type { KernelGate } from '../../kernel/gate-base';
import type { CognitiveEvent } from '../../schemas/cognitive-events';

/** Wrap NAR cycle execution with metrics. */
export function withNarCycleMetrics<T>(fn: () => T): T {
  const start = performance.now();
  const activeTasks = 0; // Would be populated from actual NAR state
  try {
    const result = fn();
    const duration = (performance.now() - start) / 1000;
    recordNarCycle(duration, activeTasks);
    return result;
  } catch (error) {
    const duration = (performance.now() - start) / 1000;
    recordNarCycle(duration, activeTasks);
    throw error;
  }
}

/** Wrap kernel gate decision with metrics. */
export function withKernelGateMetrics<T>(
  gateName: string,
  fn: (gate: KernelGate) => T
): T {
  const start = performance.now();
  try {
    // This would need actual gate instance
    const result = fn({} as KernelGate);
    const duration = (performance.now() - start) / 1000;
    recordKernelGateDecision(gateName, true, duration);
    return result;
  } catch (error) {
    const duration = (performance.now() - start) / 1000;
    recordKernelGateDecision(gateName, false, duration);
    throw error;
  }
}

/** Record memory metrics from memory stats. */
export function recordMemoryMetrics(stats: {
  conceptCount: number;
  taskCount: number;
  pressure: number;
  utilization: number;
}): void {
  recordMemoryStats(stats.conceptCount, stats.taskCount, stats.pressure, stats.utilization);
}

/** Record RL episode metrics. */
export function recordRlMetrics(episode: {
  reward: number;
  win: boolean;
  brierScore?: number;
  regret?: number;
}): void {
  recordRlEpisode(episode.reward, episode.win, episode.brierScore, episode.regret);
}

/** Record codec metrics. */
export function recordCodecMetrics(operation: 'encode' | 'decode', format: string, durationMs: number): void {
  recordCodecOperation(operation, format, durationMs / 1000);
}

/** Record LM call metrics. */
export function recordLmMetrics(model: string, inputTokens: number, outputTokens: number, durationMs: number): void {
  recordLmCall(model, inputTokens, outputTokens, durationMs / 1000);
}

/** Record cognitive event emission. */
export function recordCognitiveEventEmission(event: CognitiveEvent): void {
  const channel = event.engine ?? 'unknown';
  const eventName = event.type;
  recordEvent(channel, eventName);
}

/** Record cognitive event processing. */
export function recordCognitiveEventProcessed(event: CognitiveEvent): void {
  const channel = event.engine ?? 'unknown';
  const eventName = event.type;
  recordEventProcessed(channel, eventName);
}

/** Create a metrics collection span. */
export function createMetricsSpan(name: string, attributes: Record<string, unknown> = {}) {
  const startTime = performance.now();
  return {
    name,
    attributes,
    startTime,
    end: (status: 'ok' | 'error' = 'ok', error?: Error) => {
      const duration = performance.now() - startTime;
      // Could record span duration histogram here
      return { duration, status, error };
    },
  };
}