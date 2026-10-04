import type { CognitiveEvent } from '@senars/core/schemas/cognitive-events';
import type { GateName, GateOutcome } from '@senars/core/schemas/gate-io';
import { validateCognitiveEvent } from '@senars/core/schemas';
import { makeId } from '@senars/util';
import { gateLog } from './event-ring.js';
import { recordGateDecision } from '../telemetry/index.js';

/**
 * Read one gate's own output as the single outcome vocabulary. Each gate names
 * its grant flag and refusal reason for its own domain — `admitted` /
 * `rejectionReason`, `authorized` / `vetoReason`, `granted` / `terminationReason`
 * — because those names are part of that gate's wire contract. The base class
 * needs only the *decision*, so each gate projects its output once, here, with
 * the accessors checked against the declared type rather than guessed at runtime.
 */
export const projectOutcome = <TOutput>(
  output: unknown,
  granted: (output: TOutput) => boolean,
  reason: (output: TOutput) => string | undefined
): GateOutcome => {
  const typed = output as TOutput;
  return { granted: granted(typed), reason: reason(typed) };
};

/**
 * Shared skeleton for the four kernel gates: one bounded event ring, one
 * correlation-id mint, the one decision funnel, and the log accessors every gate
 * exposes.
 */
export abstract class KernelGate<TEvent extends CognitiveEvent = CognitiveEvent> {
  readonly eventLog = gateLog<TEvent>();

  /**
   * How this gate's output reads as a grant or a refusal. Required rather than
   * defaulted: a default that inspected the output for familiar field names
   * reported `granted: false` for any shape it did not recognise, so a gate that
   * forgot to override it would meter a denial that never happened.
   */
  protected abstract outcomeOf(output: unknown): GateOutcome;

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
   * function, meters it as one outcome, and returns the gate's own output
   * unchanged. Subclasses implement `decide` with their specific logic.
   */
  protected decideAndRecord<TInput, TOutput>(
    gateName: GateName,
    operation: string,
    input: TInput,
    decide: (input: TInput, correlationId: string) => TOutput,
    getCorrelationId: (input: TInput) => string | undefined
  ): TOutput {
    const correlationId = this.correlationOf(getCorrelationId(input));
    const output = decide(input, correlationId);
    recordGateDecision(gateName, operation, this.outcomeOf(output), correlationId);
    return output;
  }

  getEventLog(): ReadonlyArray<TEvent> {
    return this.eventLog.toArray();
  }

  clearEventLog(): void {
    this.eventLog.clear();
  }
}
