import { decisionSpan } from '../otel/index.js';
import {
  bagPressure,
  gateDecisionsTotal,
  gateVetoesTotal,
  handoversTotal,
  schemaPromotionsTotal,
} from '../metrics/prometheus.js';

/**
 * O1/O4: one call per gate verdict — Prometheus counter + fire-and-forget span.
 *
 * `correlationId` rides the span only: as a Prometheus label it would mint a
 * series per utterance, and a counter nobody can join to the events that explain
 * it is the thing §2 of TODO33 set out to fix.
 */
export function recordGateDecision(
  gate: 'perception' | 'action' | 'budget' | 'reward',
  operation: string,
  granted: boolean,
  vetoReason?: string,
  correlationId?: string
): void {
  const decision = granted ? 'granted' : 'denied';
  gateDecisionsTotal.inc({ gate, decision });
  decisionSpan(`gate.${gate}.${operation}`, {
    'gate.type': gate,
    'gate.operation': operation,
    'gate.granted': granted,
    ...(vetoReason ? { 'gate.veto_reason': vetoReason } : {}),
    ...(correlationId ? { 'correlation.id': correlationId } : {}),
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
