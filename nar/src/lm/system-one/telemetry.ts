import { trace } from '@opentelemetry/api';
import type { JudgmentResolvedEvent } from '@senars/kernel/schemas';
import { recordJudgmentMetric } from '../../metrics/prometheus.js';
import type { JudgmentProposition, JudgmentQuery } from './types.js';

export interface TelemetrySinks {
  emitEvent?: (event: JudgmentResolvedEvent) => void;
  recordMetric?: typeof recordJudgmentMetric;
  setSpanAttributes?: (attributes: Record<string, string | number | boolean>) => void;
}

function buildSpanAttributes(
  proposition: JudgmentProposition
): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {
    'dispatch.tier_taken': proposition.tier,
    'dispatch.backend_id': proposition.backendId,
    'dispatch.latency_ms': proposition.latencyMs,
    'dispatch.axis': proposition.axis,
    'dispatch.abstained': proposition.abstained,
    'dispatch.stamp_type': proposition.abstained ? 'provisional' : 'standard',
    'dispatch.cost_tokens': proposition.cost.tokensIn + proposition.cost.tokensOut,
    'dispatch.cost_memory': proposition.cost.memoryMb,
  };
  if (proposition.kind === 'classify' && proposition.entropy !== undefined) {
    attrs['dispatch.entropy'] = proposition.entropy;
  }
  return attrs;
}

export function createTelemetryEmitter(sinks: TelemetrySinks = {}) {
  const { emitEvent, recordMetric, setSpanAttributes } = sinks;

  return function emitJudgmentResolved(
    proposition: JudgmentProposition,
    _query: JudgmentQuery
  ): void {
    try {
      if (emitEvent) {
        const event: JudgmentResolvedEvent = {
          type: 'judgment.resolved',
          engine: 'proposer',
          timestamp: Date.now(),
          correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
          payload: {
            queryId: proposition.queryId,
            shape: proposition.kind,
            axis: proposition.axis,
            backendId: proposition.backendId,
            tier: proposition.tier,
            latencyMs: proposition.latencyMs,
            entropy: proposition.kind === 'classify' ? proposition.entropy : undefined,
            abstained: proposition.abstained,
            stampType: proposition.abstained ? 'provisional' : 'standard',
            calibrationVersion: proposition.calibration.version,
            cost: proposition.cost,
          },
        };
        emitEvent(event);
      }

      if (recordMetric) {
        recordMetric(
          proposition.axis,
          proposition.kind,
          proposition.tier,
          proposition.abstained,
          proposition.latencyMs
        );
      }

      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        const attrs = buildSpanAttributes(proposition);
        for (const [key, value] of Object.entries(attrs)) {
          activeSpan.setAttribute(key, value);
        }
      } else if (setSpanAttributes) {
        setSpanAttributes(buildSpanAttributes(proposition));
      }
    } catch (_e) {
      // Silent failure for telemetry - never throw from observability
    }
  };
}

export function createNarTelemetrySinks(systemEventBus: {
  emit: (type: string, event: any) => void;
}): TelemetrySinks {
  return {
    emitEvent: (event) => systemEventBus.emit('judgment.resolved', event),
    recordMetric: recordJudgmentMetric,
    setSpanAttributes: undefined,
  };
}

export function createGateTelemetrySinks(eventLog: {
  push(event: unknown): unknown;
}): TelemetrySinks {
  return {
    emitEvent: (event) => eventLog.push(event),
    recordMetric: recordJudgmentMetric,
    setSpanAttributes: undefined,
  };
}
