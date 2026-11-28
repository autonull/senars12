import { type JudgmentResolvedEvent } from '@senars/schemas/cognitive-events';
import { recordJudgmentMetric } from '../../metrics/prometheus';
import type { BandDecision } from './policy';
import type { JudgmentProposition, JudgmentQuery } from './types';
export interface TelemetrySinks {
    emitEvent?: (event: JudgmentResolvedEvent) => void;
    recordMetric?: typeof recordJudgmentMetric;
    setSpanAttributes?: (attributes: Record<string, string | number | boolean>) => void;
}
export declare function createTelemetryEmitter(sinks?: TelemetrySinks): (proposition: JudgmentProposition, _query: JudgmentQuery, provenance?: {
    inputDigest?: string;
    calibrationDigest?: string;
    decisionBand?: BandDecision;
}) => void;
export declare function createNarTelemetrySinks(systemEventBus: {
    emit: (type: string, event: any) => void;
}): TelemetrySinks;
export declare function createGateTelemetrySinks(eventLog: {
    push(event: unknown): unknown;
}): TelemetrySinks;
//# sourceMappingURL=telemetry.d.ts.map