import { trace } from '@opentelemetry/api';
import { mintCognitiveEvent, } from '@senars/schemas/cognitive-events';
import { makeId } from '@senars/util/id';
import { recordJudgmentMetric } from '../../metrics/prometheus';
function buildSpanAttributes(proposition) {
    const attrs = {
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
export function createTelemetryEmitter(sinks = {}) {
    const { emitEvent, recordMetric, setSpanAttributes } = sinks;
    return function emitJudgmentResolved(proposition, _query, provenance) {
        try {
            if (emitEvent) {
                const event = mintCognitiveEvent('judgment.resolved', {
                    engine: 'proposer',
                    correlationId: makeId(),
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
                        modelDigest: proposition.modelDigest,
                        calibrationDigest: provenance?.calibrationDigest,
                        inputDigest: provenance?.inputDigest,
                        decisionBand: provenance?.decisionBand,
                        cost: proposition.cost,
                    },
                });
                emitEvent(event);
            }
            if (recordMetric) {
                recordMetric(proposition.axis, proposition.kind, proposition.tier, proposition.abstained, proposition.latencyMs);
            }
            const activeSpan = trace.getActiveSpan();
            if (activeSpan) {
                const attrs = buildSpanAttributes(proposition);
                for (const [key, value] of Object.entries(attrs)) {
                    activeSpan.setAttribute(key, value);
                }
            }
            else if (setSpanAttributes) {
                setSpanAttributes(buildSpanAttributes(proposition));
            }
        }
        catch (_e) {
            // Silent failure for telemetry - never throw from observability
        }
    };
}
export function createNarTelemetrySinks(systemEventBus) {
    return {
        emitEvent: (event) => systemEventBus.emit('judgment.resolved', event),
        recordMetric: recordJudgmentMetric,
        setSpanAttributes: undefined,
    };
}
export function createGateTelemetrySinks(eventLog) {
    return {
        emitEvent: (event) => eventLog.push(event),
        recordMetric: recordJudgmentMetric,
        setSpanAttributes: undefined,
    };
}
