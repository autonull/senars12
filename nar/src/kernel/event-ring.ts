/**
 * D11 (TODO17b): bounded event logs for kernel gates — drop-oldest rings.
 * Everything that grows has a bound; kernel logs cap at 1000 events.
 */
import type { CognitiveEvent, PolicyViolationEvent } from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

export const GATE_LOG_CAPACITY = 1000;

export function pushBounded<T>(log: T[], event: T, capacity = GATE_LOG_CAPACITY): void {
  log.push(event);
  if (log.length > capacity) log.splice(0, log.length - capacity);
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
  log: CognitiveEvent[],
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
  pushBounded(log, event);
  return event;
}
