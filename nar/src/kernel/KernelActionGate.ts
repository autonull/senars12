import type {
  ActionGateInput,
  ActionGateOutput,
  AutonomyMode,
  AutonomyModeChangedEvent,
  PolicyViolationEvent,
} from '@senars/kernel/schemas';
import { AutonomyModeChangedEventSchema, validateCognitiveEvent } from '@senars/kernel/schemas';
import { SenarsError } from '@senars/util/errors';
import { v4 as uuidv4 } from 'uuid';
import { pushBounded } from './event-ring.js';
import { recordGateDecision } from '../telemetry/index.js';

const MODE_ORDER: AutonomyMode[] = [
  'observe-only',
  'propose-only',
  'sandbox-execute',
  'low-risk-auto-merge',
  'human-approved-production',
];

const LEGAL_TRANSITIONS: Record<AutonomyMode, AutonomyMode[]> = {
  'observe-only': ['propose-only'],
  'propose-only': ['observe-only', 'sandbox-execute'],
  'sandbox-execute': ['propose-only', 'low-risk-auto-merge'],
  'low-risk-auto-merge': ['sandbox-execute', 'human-approved-production'],
  'human-approved-production': ['low-risk-auto-merge'],
};

export type AutonomyAuthority = 'system' | 'human' | 'external-governance';

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

export class KernelActionGate {
  private eventLog: PolicyViolationEvent[] = [];
  private autonomyLog: AutonomyModeChangedEvent[] = [];
  private autonomyMode: AutonomyMode;
  private allowedOperations: ReadonlySet<string>;
  private nalDerivations: Map<string, { conclusion: string; veto: boolean }> = new Map();
  /** Per-scope autonomy modes + allowlists (game:<scopeId>:<action> operations). Additive. */
  private scopeModes: Map<string, AutonomyMode> = new Map();
  private scopeOperations: Map<string, Set<string>> = new Map();

  constructor(config?: Partial<KernelActionGateConfig>) {
    this.autonomyMode = config?.autonomyMode ?? DEFAULT_AUTONOMY_MODE;
    this.allowedOperations = config?.allowedOperations ?? DEFAULT_ALLOWED_OPS;
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
    correlationId = uuidv4()
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
    const event: AutonomyModeChangedEvent = AutonomyModeChangedEventSchema.parse({
      type: 'autonomy.mode.changed',
      engine: 'kernel',
      timestamp: Date.now(),
      correlationId,
      payload: { previousMode: prev, newMode, authorizedBy },
    });
    pushBounded(this.autonomyLog, event);
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
    let ops = this.scopeOperations.get(scopeId);
    if (!ops) {
      ops = new Set();
      this.scopeOperations.set(scopeId, ops);
    }
    ops.add(operation);
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

  private authorizeScoped(
    scopeId: string,
    action: string,
    _correlationId: string
  ): ActionGateOutput {
    const mode = this.scopeModes.get(scopeId);
    if (mode === undefined)
      return {
        authorized: false,
        vetoReason: `Unknown scope ${scopeId}`,
        requiredApprovals: ['human-approval'],
      };
    if (mode === 'observe-only' || mode === 'propose-only')
      return {
        authorized: false,
        vetoReason: `Scope ${scopeId} autonomy mode ${mode} does not permit execution`,
        requiredApprovals: ['human-approval'],
      };
    if (!this.scopeOperations.get(scopeId)?.has(action))
      return {
        authorized: false,
        vetoReason: `Operation '${action}' not permitted in scope ${scopeId}`,
        requiredApprovals: ['human-approval'],
      };
    return { authorized: true, toolCallId: uuidv4() };
  }

  registerNALDerivation(derivationId: string, conclusion: string, veto: boolean = false): void {
    this.nalDerivations.set(derivationId, { conclusion, veto });
  }

  authorize(input: ActionGateInput): ActionGateOutput {
    const out = this.decideAuthorization(input);
    recordGateDecision('action', input.operation, out.authorized, out.vetoReason);
    return out;
  }

  private decideAuthorization(input: ActionGateInput): ActionGateOutput {
    const correlationId = input.correlationId ?? uuidv4();

    // Scoped (game) operations authorize against their own scope — the global
    // autonomy mode and allowlist are never consulted nor mutated (A3).
    const scoped = KernelActionGate.parseScopedOperation(input.operation);
    if (scoped) return this.authorizeScoped(scoped.scopeId, scoped.action, correlationId);

    if (this.autonomyMode === 'observe-only' || this.autonomyMode === 'propose-only') {
      const event: PolicyViolationEvent = {
        type: 'policy.violation',
        engine: 'kernel',
        timestamp: Date.now(),
        correlationId,
        payload: {
          policyId: 'autonomy-mode',
          violationType: 'unauthorized-tool',
          detail: `Action not permitted in ${this.autonomyMode} mode`,
          severity: 'block',
        },
      };
      validateCognitiveEvent(event);
      pushBounded(this.eventLog, event);

      return {
        authorized: false,
        vetoReason: `Autonomy mode ${this.autonomyMode} does not permit tool execution`,
        requiredApprovals: ['human-approval'],
      };
    }

    if (input.nalDerivationId && this.nalDerivations.has(input.nalDerivationId)) {
      const derivation = this.nalDerivations.get(input.nalDerivationId)!;
      if (derivation.veto) {
        const event: PolicyViolationEvent = {
          type: 'policy.violation',
          engine: 'kernel',
          timestamp: Date.now(),
          correlationId,
          payload: {
            policyId: 'nal-veto',
            violationType: 'unauthorized-tool',
            detail: `NAL derivation ${input.nalDerivationId} vetoes action: ${derivation.conclusion}`,
            severity: 'block',
          },
        };
        validateCognitiveEvent(event);
        pushBounded(this.eventLog, event);

        return {
          authorized: false,
          vetoReason: `NAL veto: ${derivation.conclusion}`,
        };
      }
    }

    if (!this.allowedOperations.has(input.operation)) {
      const event: PolicyViolationEvent = {
        type: 'policy.violation',
        engine: 'kernel',
        timestamp: Date.now(),
        correlationId,
        payload: {
          policyId: 'allowed-operations',
          violationType: 'unauthorized-tool',
          detail: `Operation '${input.operation}' not in allowed operations list`,
          severity: 'block',
        },
      };
      validateCognitiveEvent(event);
      pushBounded(this.eventLog, event);

      return {
        authorized: false,
        vetoReason: `Operation '${input.operation}' not permitted`,
        requiredApprovals: ['human-approval'],
      };
    }

    const toolCallId = uuidv4();
    return {
      authorized: true,
      toolCallId,
    };
  }

  addAllowedOperation(operation: string): void {
    const newSet = new Set(this.allowedOperations);
    newSet.add(operation);
    this.allowedOperations = newSet;
  }

  removeAllowedOperation(operation: string): void {
    const newSet = new Set(this.allowedOperations);
    newSet.delete(operation);
    this.allowedOperations = newSet;
  }

  getEventLog(): ReadonlyArray<PolicyViolationEvent> {
    return this.eventLog;
  }

  clearEventLog(): void {
    this.eventLog = [];
    this.autonomyLog = [];
  }
}
