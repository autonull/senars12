import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { getTracer } from '../otel/index';
export function startArcadeTickSpan(arm, game, cycle) {
    const span = getTracer('senars.arcade').startSpan('arcade.tick', {
        kind: SpanKind.INTERNAL,
        attributes: { 'arcade.arm': arm, 'arcade.game': game, 'arcade.cycle': cycle },
        startTime: Date.now(),
    });
    return {
        finish({ action, latencyMs, reward, terminal, handover, decision }) {
            span.setAttribute('arcade.action', action ?? '');
            span.setAttribute('arcade.latency_ms', Math.round(latencyMs));
            span.setAttribute('arcade.reward', reward);
            if (terminal)
                span.setAttribute('arcade.terminal', true);
            if (handover) {
                span.setAttribute('arcade.handover', true);
                span.addEvent('handover');
            }
            if (decision) {
                span.setAttribute('arcade.decision_source', decision.source);
                if (decision.vetoedBy)
                    span.addEvent('veto', { 'veto.by': decision.vetoedBy });
            }
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
        },
    };
}
