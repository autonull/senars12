import type { CognitiveEvent } from '@senars/core/schemas/cognitive-events';
import { validateCognitiveEvent } from '@senars/core/schemas';
import { makeId } from '@senars/util';
import { gateLog } from './event-ring.js';

/**
 * Shared skeleton for the four kernel gates: one bounded event ring, one
 * correlation-id mint, and the log accessors every gate exposes.
 */
export abstract class KernelGate<TEvent extends CognitiveEvent = CognitiveEvent> {
  readonly eventLog = gateLog<TEvent>();

  protected correlationOf(correlationId?: string): string {
    return correlationId ?? makeId();
  }

  /** Validate then append to the gate's bounded log — every gate event goes through one funnel. */
  protected emitEvent(event: CognitiveEvent): void {
    validateCognitiveEvent(event);
    this.eventLog.push(event as TEvent);
  }

  getEventLog(): ReadonlyArray<TEvent> {
    return this.eventLog.toArray();
  }

  clearEventLog(): void {
    this.eventLog.clear();
  }
}
