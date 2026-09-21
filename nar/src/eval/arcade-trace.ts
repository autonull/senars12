import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * G5 — arcade OTel spans. Each game tick emits an `arcade.tick` span with
 * arm/game attributes and decision events (veto, handover), turning the demo
 * into a distributed trace of cognition watchable in any OTel UI. Without a
 * registered tracer provider the spans are API no-ops — zero overhead.
 */
export interface ArcadeTickSpan {
  finish(data: {
    action?: string;
    latencyMs: number;
    reward: number;
    terminal: boolean;
    handover: boolean;
    decision?: { action: string | null; vetoedBy: string | null; source: string };
  }): void;
}

export function startArcadeTickSpan(arm: string, game: string, cycle: number): ArcadeTickSpan {
  const span = trace
    .getTracer('senars.arcade')
    .startSpan('arcade.tick', {
      kind: SpanKind.INTERNAL,
      attributes: { 'arcade.arm': arm, 'arcade.game': game, 'arcade.cycle': cycle },
      startTime: Date.now(),
    });
  return {
    finish({ action, latencyMs, reward, terminal, handover, decision }) {
      span.setAttribute('arcade.action', action ?? '');
      span.setAttribute('arcade.latency_ms', Math.round(latencyMs));
      span.setAttribute('arcade.reward', reward);
      if (terminal) span.setAttribute('arcade.terminal', true);
      if (handover) {
        span.setAttribute('arcade.handover', true);
        span.addEvent('handover');
      }
      if (decision) {
        span.setAttribute('arcade.decision_source', decision.source);
        if (decision.vetoedBy) span.addEvent('veto', { 'veto.by': decision.vetoedBy });
      }
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    },
  };
}
