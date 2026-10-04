import type {
  ActionGateInput,
  ActionGateOutput,
  AutonomyAuthority,
  AutonomyMode,
  AutonomyModeChangedEvent,
  GateOutcome,
  PolicyViolationEvent,
} from '@senars/core/schemas';
import {
  AutonomyModeChangedEventSchema,
  AutonomyModeSchema,
  mintCognitiveEvent,
  permitsExecution,
} from '@senars/core/schemas';
import { addToSet, BoundedMap, makeId, pushCapped } from '@senars/util';
import { SenarsError } from '@senars/util/errors';
import { GATE_LOG_CAPACITY, recordPolicyViolation } from './event-ring.js';
import { KernelGate, projectOutcome } from './gate-base.js';

const MODE_ORDER = AutonomyModeSchema.options;

const LEGAL_TRANSITIONS: Record<AutonomyMode, AutonomyMode[]> = {
  'observe-only': ['propose-only'],
  'propose-only': ['observe-only', 'sandbox-execute'],
  'sandbox-execute': ['propose-only', 'low-risk-auto-merge'],
  'low-risk-auto-merge': ['sandbox-execute', 'human-approved-production'],
  'human-approved-production': ['low-risk-auto-merge'],
};

/**
 * Typed NAL-veto error for callers that convert a gate veto result
 * (`authorized: false` + `vetoReason`) into an exception. The gate itself
 * reports vetoes via its typed result and a `policy.violation` event, never
 * by throwing.
 */
export class NALVetoError extends SenarsError {
  public readonly vetoReason: string;
  public readonly correlationId: string;

  constructor(vetoReason: string, correlationId: string) {
    super(`NAL veto: ${vetoReason}`, 'GATE_DENIED', { gate: 'action', vetoReason, correlationId });
    this.name = 'NALVetoError';
    this.vetoReason = vetoReason;
    this.correlationId = correlationId;
  }
}

export interface KernelActionGateConfig {
  autonomyMode: AutonomyMode;
  allowedOperations: ReadonlySet<string>;
}

const DEFAULT_AUTONOMY_MODE: AutonomyMode = 'observe-only';
const DEFAULT_ALLOWED_OPS = new Set<string>();

export class KernelActionGate extends KernelGate<PolicyViolationEvent> {
  private autonomyLog: AutonomyModeChangedEvent[] = [];
  private autonomyMode: AutonomyMode;
  private allowedOperations: Set<string>;
  /**
   * NAL conclusions keyed by derivation id. Bounded at kernel-log capacity for
   * the same reason `autonomyLog` and `eventLog` are: derivation ids arrive on
   * every reasoning step and nothing retires them, so an unbounded map grew for
   * the lifetime of the process. A veto beyond the cap falls off, and the action
   * then faces the allow-list alone — the same post-expiry posture a dropped
   * gate-log entry leaves behind.
   */
  private nalDerivations: BoundedMap<string, { conclusion: string; veto: boolean }>;
  /** Per-scope autonomy modes + allowlists (game:<scopeId>:<action> operations). Additive. */
  private scopeModes: Map<string, AutonomyMode> = new Map();
  private scopeOperations: Map<string, Set<string>> = new Map();

  protected override outcomeOf(output: unknown): GateOutcome {
    return projectOutcome<ActionGateOutput>(output, (o) => o.authorized, (o) => o.vetoReason);
  }

  constructor(config?: Partial<KernelActionGateConfig>) {
    super();
    this.autonomyMode = config?.autonomyMode ?? DEFAULT_AUTONOMY_MODE;
    this.allowedOperations = new Set(config?.allowedOperations ?? DEFAULT_ALLOWED_OPS);
    this.nalDerivations = new BoundedMap({ maxSize: GATE_LOG_CAPACITY });
  }

  setAutonomyMode(mode: AutonomyMode): void {
    this.autonomyMode = mode;
  }

  getAutonomyMode(): AutonomyMode {
    return this.autonomyMode;
  }

  requestModeChange(
    newMode: AutonomyMode,
    authorizedBy: AutonomyAuthority,
    correlationId = makeId()
  ): { changed: boolean; reason?: string } {
    const prev = this.autonomyMode;
    if (prev === newMode) return { changed: true };
    if (!LEGAL_TRANSITIONS[prev].includes(newMode))
      return { changed: false, reason: `Illegal transition ${prev} -> ${newMode}` };
    const upgrading = MODE_ORDER.indexOf(newMode) > MODE_ORDER.indexOf(prev);
    const beyondSandbox = MODE_ORDER.indexOf(newMode) > MODE_ORDER.indexOf('sandbox-execute');
    if (upgrading && beyondSandbox && authorizedBy === 'system')
      return {
        changed: false,
        reason: 'Escalation beyond sandbox-execute requires human or external-governance approval',
      };
    this.autonomyMode = newMode;
    const event = AutonomyModeChangedEventSchema.parse(
      mintCognitiveEvent('autonomy.mode.changed', {
        engine: 'kernel',
        correlationId,
        payload: { previousMode: prev, newMode, authorizedBy },
      })
    );
    pushCapped(this.autonomyLog, event, GATE_LOG_CAPACITY);
    return { changed: true };
  }

  getAutonomyLog(): ReadonlyArray<AutonomyModeChangedEvent> {
    return this.autonomyLog;
  }

  /** Set autonomy mode for a named scope without touching the global mode (A3). */
  setScopeAutonomy(scopeId: string, mode: AutonomyMode): void {
    this.scopeModes.set(scopeId, mode);
  }

  /** Scope autonomy mode (undefined when the scope is unknown to this gate). */
  getScopeAutonomy(scopeId: string): AutonomyMode | undefined {
    return this.scopeModes.get(scopeId);
  }

  addScopedOperation(scopeId: string, operation: string): void {
    addToSet(this.scopeOperations, scopeId, operation);
  }

  removeScope(scopeId: string): void {
    this.scopeModes.delete(scopeId);
    this.scopeOperations.delete(scopeId);
  }

  /** Parse 'game:<scopeId>:<action>' → {scopeId, action}; undefined when not namespaced. */
  static parseScopedOperation(operation: string): { scopeId: string; action: string } | undefined {
    if (!operation.startsWith('game:')) return undefined;
    const rest = operation.slice('game:'.length);
    const sep = rest.indexOf(':');
    if (sep <= 0) return undefined;
    return { scopeId: rest.slice(0, sep), action: rest.slice(sep + 1) };
  }

  private authorizeScoped(scopeId: string, action: string): ActionGateOutput {
    const mode = this.scopeModes.get(scopeId);
    if (mode === undefined)
      return {
        authorized: false,
        vetoReason: `Unknown scope ${scopeId}`,
        requiredApprovals: ['human-approval'],
      };
    if (!permitsExecution(mode))
      return {
        authorized: false,
        vetoReason: `Autonomy mode ${mode} does not permit execution (scope ${scopeId})`,
        requiredApprovals: ['human-approval'],
      };
    if (!this.scopeOperations.get(scopeId)?.has(action))
      return {
        authorized: false,
        vetoReason: `Operation '${action}' not permitted in scope ${scopeId}`,
        requiredApprovals: ['human-approval'],
      };
    return { authorized: true, toolCallId: makeId() };
  }

  registerNALDerivation(derivationId: string, conclusion: string, veto: boolean = false): void {
    this.nalDerivations.set(derivationId, { conclusion, veto });
  }

  authorize(input: ActionGateInput): ActionGateOutput {
    return this.decideAndRecord(
      'action',
      input.operation,
      input,
      (inp, correlationId) => this.decideAuthorization(inp, correlationId),
      (inp) => inp.correlationId
    );
  }

  private decideAuthorization(input: ActionGateInput, correlationId: string): ActionGateOutput {
    const scoped = KernelActionGate.parseScopedOperation(input.operation);
    if (scoped) return this.authorizeScoped(scoped.scopeId, scoped.action);
    if (!permitsExecution(this.autonomyMode)) {
      recordPolicyViolation(this.eventLog, {
        policyId: 'autonomy-mode',
        violationType: 'unauthorized-tool',
        detail: `Action not permitted in ${this.autonomyMode} mode`,
        correlationId: this.correlationOf(correlationId),
      });
      return {
        authorized: false,
        vetoReason: `Autonomy mode ${this.autonomyMode} does not permit tool execution`,
        requiredApprovals: ['human-approval'],
      };
    }

    const derivation = input.nalDerivationId
      ? this.nalDerivations.get(input.nalDerivationId)
      : undefined;
    if (derivation?.veto) {
      recordPolicyViolation(this.eventLog, {
        policyId: 'nal-veto',
        violationType: 'unauthorized-tool',
        detail: `NAL derivation ${input.nalDerivationId} vetoes action: ${derivation.conclusion}`,
        correlationId: this.correlationOf(input.correlationId),
      });
      return {
        authorized: false,
        vetoReason: `NAL veto: ${derivation.conclusion}`,
      };
    }

    if (!this.allowedOperations.has(input.operation)) {
      recordPolicyViolation(this.eventLog, {
        policyId: 'allowed-operations',
        violationType: 'unauthorized-tool',
        detail: `Operation '${input.operation}' not in allowed operations list`,
        correlationId: this.correlationOf(input.correlationId),
      });
      return {
        authorized: false,
        vetoReason: `Operation '${input.operation}' not permitted`,
        requiredApprovals: ['human-approval'],
      };
    }

    const toolCallId = makeId();
    return {
      authorized: true,
      toolCallId,
    };
  }

  addAllowedOperation(operation: string): void {
    this.allowedOperations.add(operation);
  }

  removeAllowedOperation(operation: string): void {
    this.allowedOperations.delete(operation);
  }

  override clearEventLog(): void {
    super.clearEventLog();
    this.autonomyLog = [];
  }
}
