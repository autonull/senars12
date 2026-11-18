import type { GateName, GateOutcome } from '@senars/core/schemas/gate-io';
import { decisionSpan, tracingEnabled } from '../otel/index.js';
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
 *
 * It arrives as a thunk because a budget charge is one candidate rule, and minting
 * an id and an attributes literal per charge to hand a tracer nobody installed was
 * ~10k discarded ids per cycle. The thunk is memoized, so when a collector *is*
 * attached the span still carries the id the refusal event carries.
 */
export function recordGateDecision(
  gate: GateName,
  operation: string,
  { granted, reason }: GateOutcome,
  correlation?: string | (() => string)
): void {
  gateDecisionsTotal.inc({ gate, decision: granted ? 'granted' : 'denied' });
  if (tracingEnabled()) {
    const correlationId = typeof correlation === 'function' ? correlation() : correlation;
    decisionSpan(`gate.${gate}.${operation}`, {
      'gate.type': gate,
      'gate.operation': operation,
      'gate.granted': granted,
      ...(reason ? { 'gate.veto_reason': reason } : {}),
      ...(correlationId ? { 'correlation.id': correlationId } : {}),
    });
  }
  if (!granted && reason) gateVetoesTotal.inc({ gate, reason });
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
