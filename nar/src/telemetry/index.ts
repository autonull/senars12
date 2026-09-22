import { decisionSpan } from '../otel/index.js';
import {
  bagPressure,
  gateDecisionsTotal,
  gateVetoesTotal,
  handoversTotal,
  schemaPromotionsTotal,
} from '../metrics/prometheus.js';

/** O1/O4: one call per gate verdict — Prometheus counter + fire-and-forget span. */
export function recordGateDecision(
  gate: 'perception' | 'action' | 'budget' | 'reward',
  operation: string,
  granted: boolean,
  vetoReason?: string
): void {
  const decision = granted ? 'granted' : 'denied';
  gateDecisionsTotal.inc({ gate, decision });
  decisionSpan(`gate.${gate}.${operation}`, {
    'gate.type': gate,
    'gate.operation': operation,
    'gate.granted': granted,
    ...(vetoReason ? { 'gate.veto_reason': vetoReason } : {}),
  });
  if (!granted && vetoReason) gateVetoesTotal.inc({ gate, reason: vetoReason });
}

export function recordSchemaPromotion(scope: string, count: number): void {
  schemaPromotionsTotal.inc({ scope }, count);
}

export function recordHandover(): void {
  handoversTotal.inc();
}

export function recordBagPressure(bag: string, pressure: number): void {
  bagPressure.set({ bag }, pressure);
}
