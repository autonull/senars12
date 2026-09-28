/**
 * D11 (TODO17b): bounded event logs for kernel gates — drop-oldest rings.
 * Everything that grows has a bound; kernel logs cap at 1000 events.
 */
import { BoundedRing } from '@senars/util';
import type { CognitiveEvent, PolicyViolationEvent } from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

export const GATE_LOG_CAPACITY = 1000;

/** Anything the gate logs append to — an array or a `BoundedRing`. */
export interface BoundedSink<T> {
  push(event: T): void;
}

export interface PolicyViolationInput {
  readonly policyId: string;
  readonly violationType: PolicyViolationEvent['payload']['violationType'];
  readonly detail: string;
  readonly correlationId: string;
  readonly severity?: PolicyViolationEvent['payload']['severity'];
}

/** Validate and append a `policy.violation` to a gate's bounded log. Single construction site. */
export function recordPolicyViolation(
  log: BoundedSink<CognitiveEvent>,
  { policyId, violationType, detail, correlationId, severity = 'block' }: PolicyViolationInput
): PolicyViolationEvent {
  const event: PolicyViolationEvent = {
    type: 'policy.violation',
    engine: 'kernel',
    timestamp: Date.now(),
    correlationId,
    payload: { policyId, violationType, detail, severity },
  };
  validateCognitiveEvent(event);
  log.push(event);
  return event;
}

/** Bounded append-only gate log: the shared drop-oldest ring at kernel capacity. */
export const gateLog = <T>(): BoundedRing<T> => new BoundedRing<T>(GATE_LOG_CAPACITY);
