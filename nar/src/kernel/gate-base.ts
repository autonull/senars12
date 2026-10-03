import type { CognitiveEvent } from '@senars/core/schemas/cognitive-events';
import { validateCognitiveEvent } from '@senars/core/schemas';
import { makeId } from '@senars/util';
import { gateLog } from './event-ring.js';
import { recordGateDecision } from '../telemetry/index.js';

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

  /**
   * Unified decision funnel: generates correlationId, invokes the decision
   * function, records the gate decision, and returns the result. Subclasses
   * implement `decide` with their specific logic.
   */
  protected decideAndRecord<TInput, TOutput>(
    gateName: 'perception' | 'action' | 'reward' | 'budget',
    operation: string,
    input: TInput,
    decide: (input: TInput, correlationId: string) => TOutput,
    getCorrelationId: (input: TInput) => string | undefined
  ): TOutput {
    const correlationId = this.correlationOf(getCorrelationId(input));
    const output = decide(input, correlationId);
    const admitted = this.extractAdmitted(output);
    const reason = this.extractReason(output);
    recordGateDecision(gateName, operation, admitted, reason, correlationId);
    return output;
  }

  /** Extract the admitted/granted/accepted flag from gate output. Override if output shape differs. */
  protected extractAdmitted(output: unknown): boolean {
    if (output && typeof output === 'object') {
      const o = output as Record<string, unknown>;
      return Boolean(o.admitted ?? o.granted ?? o.accepted);
    }
    return false;
  }

  /** Extract the rejection/termination/veto reason from gate output. Override if output shape differs. */
  protected extractReason(output: unknown): string | undefined {
    if (output && typeof output === 'object') {
      const o = output as Record<string, unknown>;
      return (o.rejectionReason ?? o.terminationReason ?? o.vetoReason) as string | undefined;
    }
    return undefined;
  }

  getEventLog(): ReadonlyArray<TEvent> {
    return this.eventLog.toArray();
  }

  clearEventLog(): void {
    this.eventLog.clear();
  }
}
