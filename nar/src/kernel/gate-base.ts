import type { CognitiveEvent, PolicyViolationEvent } from '@senars/core/schemas/cognitive-events';
import type { GateName, GateOutcome } from '@senars/core/schemas/gate-io';
import { mintCognitiveEvent, validateCognitiveEvent } from '@senars/core/schemas';
import { makeId } from '@senars/util';
import { gateLog, type PolicyViolationInput } from './event-ring.js';
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

  /** Validate then append to the gate's bounded log — every gate event goes through one funnel. */
  protected emitEvent(event: CognitiveEvent): void {
    validateCognitiveEvent(event);
    this.eventLog.push(event as TEvent);
  }

  /**
   * Mint and record a `policy.violation`. On the base rather than beside the
   * ring so a gate states *that* it violated a policy and this class owns how
   * the event is built and validated — the three gates that denied a request
   * each spelled those two steps themselves.
   */
  protected recordPolicyViolation(input: PolicyViolationInput): PolicyViolationEvent {
    const event = mintCognitiveEvent('policy.violation', {
      engine: 'kernel',
      correlationId: input.correlationId,
      payload: {
        policyId: input.policyId,
        violationType: input.violationType,
        detail: input.detail,
        severity: input.severity ?? 'block',
      },
    });
    this.emitEvent(event);
    return event;
  }

  /**
   * Unified decision funnel: supplies a correlation id, invokes the decision
   * function, meters it as one outcome, and returns the gate's own output
   * unchanged. Subclasses implement `decide` with their specific logic.
   *
   * `decide` is handed `correlation` as a thunk, not a string, because most gates only
   * need an id on the refusal branch and a budget charge is one candidate rule. The
   * thunk memoizes, so a decision that asks and the span that records it share one id.
   */
  protected decideAndRecord<TInput, TOutput>(
    gateName: GateName,
    operation: string,
    input: TInput,
    decide: (input: TInput, correlation: () => string) => TOutput,
    getCorrelationId: (input: TInput) => string | undefined
  ): TOutput {
    let correlationId = getCorrelationId(input);
    const correlation = (): string => (correlationId ??= makeId());
    const output = decide(input, correlation);
    recordGateDecision(gateName, operation, this.outcomeOf(output), correlation);
    return output;
  }

  getEventLog(): ReadonlyArray<TEvent> {
    return this.eventLog.toArray();
  }

  clearEventLog(): void {
    this.eventLog.clear();
  }
}
