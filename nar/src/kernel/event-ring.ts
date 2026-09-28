/**
 * D11 (TODO17b): bounded event logs for kernel gates — drop-oldest rings.
 * Everything that grows has a bound; kernel logs cap at 1000 events.
 */
import { pushCapped } from '@senars/util';
import type { CognitiveEvent, PolicyViolationEvent } from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

export const GATE_LOG_CAPACITY = 1000;

export function pushBounded<T>(log: T[], event: T, capacity = GATE_LOG_CAPACITY): void {
  pushCapped(log, event, capacity);
}

/** Anything the gate logs append to — an array or a `BoundedEventLog`. */
export interface BoundedSink<T> {
  push(event: T): void;
}

/** Bounded append-only gate log: drop-oldest ring plus the read/clear accessors every gate shares. */
export class BoundedEventLog<T> {
  readonly #events: T[] = [];

  constructor(readonly capacity: number = GATE_LOG_CAPACITY) {}

  push(event: T): void {
    pushCapped(this.#events, event, this.capacity);
  }

  toArray(): ReadonlyArray<T> {
    return [...this.#events];
  }

  clear(): void {
    this.#events.length = 0;
  }
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
