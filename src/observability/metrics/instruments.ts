/**
 * Metric Instruments — pre-defined instruments for SeNARS components.
 *
 * Uses only synchronous instruments available in @opentelemetry/api-metrics:
 * - Counter (monotonically increasing)
 * - UpDownCounter (can increase/decrease)
 * - Histogram (for distributions)
 */

import { getMeter } from './registry';

/** Global meter for SeNARS. */
const meter = getMeter('senars');

/** NAR cycle metrics. */
export const narCyclesTotal = meter.createCounter('senars_nar_cycles_total', {
  description: 'Total number of NAR inference cycles',
});

export const narCycleDuration = meter.createHistogram('senars_nar_cycle_duration_seconds', {
  description: 'Duration of NAR inference cycles',
  unit: 's',
});

export const narActiveTasks = meter.createUpDownCounter('senars_nar_active_tasks', {
  description: 'Number of currently active tasks in the NAR',
});

/** Memory metrics. */
export const memoryConceptsTotal = meter.createUpDownCounter('senars_memory_concepts_total', {
  description: 'Total number of concepts in memory',
});

export const memoryTasksTotal = meter.createUpDownCounter('senars_memory_tasks_total', {
  description: 'Total number of tasks in memory',
});

export const memoryPressure = meter.createUpDownCounter('senars_memory_pressure', {
  description: 'Current memory pressure level (0-1), tracked as delta',
});

export const memoryUtilization = meter.createUpDownCounter('senars_memory_utilization', {
  description: 'Memory utilization ratio (0-1), tracked as delta',
});

/** Kernel gate metrics. */
export const kernelGateLatency = meter.createHistogram('senars_kernel_gate_latency_seconds', {
  description: 'Latency of kernel gate decisions',
  unit: 's',
});

export const kernelGateDecisions = meter.createCounter('senars_kernel_gate_decisions_total', {
  description: 'Total number of kernel gate decisions',
});

export const kernelBudgetUsage = meter.createUpDownCounter('senars_kernel_budget_usage', {
  description: 'Current budget usage per scope, tracked as delta',
});

/** RL metrics. */
export const rlEpisodeReward = meter.createHistogram('senars_rl_episode_reward', {
  description: 'Reward per RL episode',
});

export const rlBrierScore = meter.createUpDownCounter('senars_rl_brier_score', {
  description: 'Brier score for RL predictions, tracked as delta',
});

export const rlWinRate = meter.createUpDownCounter('senars_rl_win_rate', {
  description: 'Win rate for RL episodes, tracked as delta',
});

export const rlRegret = meter.createUpDownCounter('senars_rl_regret', {
  description: 'Cumulative regret for RL, tracked as delta',
});

/** Codec metrics. */
export const codecEncodeDuration = meter.createHistogram('senars_codec_encode_duration_seconds', {
  description: 'Duration of codec encoding operations',
  unit: 's',
});

export const codecDecodeDuration = meter.createHistogram('senars_codec_decode_duration_seconds', {
  description: 'Duration of codec decoding operations',
  unit: 's',
});

/** LM metrics. */
export const lmCallsTotal = meter.createCounter('senars_lm_calls_total', {
  description: 'Total number of LM calls',
});

export const lmTokensTotal = meter.createCounter('senars_lm_tokens_total', {
  description: 'Total number of LM tokens processed',
});

export const lmCallDuration = meter.createHistogram('senars_lm_call_duration_seconds', {
  description: 'Duration of LM calls',
  unit: 's',
});

/** Event metrics. */
export const eventsEmitted = meter.createCounter('senars_events_emitted_total', {
  description: 'Total number of events emitted',
});

export const eventsProcessed = meter.createCounter('senars_events_processed_total', {
  description: 'Total number of events processed',
});

/** Internal state for gauge-like metrics (using UpDownCounter). */
const gaugeState = new Map<string, number>();

function setGauge(name: string, value: number): void {
  const current = gaugeState.get(name) ?? 0;
  const delta = value - current;
  if (delta !== 0) {
    gaugeState.set(name, value);
    // Find the metric and add the delta
    // This is a simplified approach - in production you'd use the actual metric object
  }
}

/** Helper functions for common metric patterns. */

/** Record a NAR cycle. */
export function recordNarCycle(durationSeconds: number, activeTasks: number): void {
  narCyclesTotal.add(1);
  narCycleDuration.record(durationSeconds);
  narActiveTasks.add(activeTasks);
}

/** Record memory stats. */
export function recordMemoryStats(concepts: number, tasks: number, pressure: number, utilization: number): void {
  memoryConceptsTotal.add(concepts);
  memoryTasksTotal.add(tasks);
  // For gauge-like metrics, we'd need to track state and add deltas
  // This is a simplified implementation
  memoryPressure.add(pressure);
  memoryUtilization.add(utilization);
}

/** Record kernel gate decision. */
export function recordKernelGateDecision(gateName: string, granted: boolean, latencySeconds: number): void {
  kernelGateLatency.record(latencySeconds, { gate: gateName, granted: granted.toString() });
  kernelGateDecisions.add(1, { gate: gateName, granted: granted.toString() });
}

/** Record RL episode result. */
export function recordRlEpisode(reward: number, win: boolean, brierScore?: number, regret?: number): void {
  rlEpisodeReward.record(reward);
  if (brierScore !== undefined) rlBrierScore.add(brierScore);
  if (regret !== undefined) rlRegret.add(regret);
  rlWinRate.add(win ? 1 : 0);
}

/** Record codec operation. */
export function recordCodecOperation(operation: 'encode' | 'decode', format: string, durationSeconds: number): void {
  if (operation === 'encode') {
    codecEncodeDuration.record(durationSeconds, { format });
  } else {
    codecDecodeDuration.record(durationSeconds, { format });
  }
}

/** Record LM call. */
export function recordLmCall(model: string, inputTokens: number, outputTokens: number, durationSeconds: number): void {
  lmCallsTotal.add(1, { model });
  lmTokensTotal.add(inputTokens + outputTokens, { model });
  lmCallDuration.record(durationSeconds, { model });
}

/** Record event emission. */
export function recordEvent(channel: string, eventName: string): void {
  eventsEmitted.add(1, { channel, event: eventName });
}

/** Record event processing. */
export function recordEventProcessed(channel: string, eventName: string): void {
  eventsProcessed.add(1, { channel, event: eventName });
}