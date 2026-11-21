/**
 * Governance Spine — the unified integration of autonomy, governance, decision, and capability.
 *
 * This is the single spine that replaces the separate modules. All four semantic
 * domains are unified behind one coherent API with the risk–verdict gate as the
 * central enforcement point.
 */

import type { AutonomyMode, AutonomyAuthority } from '../schemas/governance.js';
import type { CapabilityRisk } from '../util/capability-risk';
import type { Verdict } from '../logic/verdict.js';
import { riskClassOf, evaluateGate, evaluateGateFromRisk, GateResult } from './risk-verdict.js';
import { governanceArtifactRegistry, type GovernanceArtifact, type GovernanceArtifactKind } from './artifacts.js';
import { missionOverlayRegistry, type MissionOverlay } from './artifacts.js';

/** The governance spine — single entry point for all governance decisions. */
export class GovernanceSpine {
  private autonomyMode: AutonomyMode = 'observe-only';
  private autonomyAuthority: AutonomyAuthority = 'system';

  constructor(
    private readonly artifactRegistry = governanceArtifactRegistry,
    private readonly overlayRegistry = missionOverlayRegistry
  ) {}

  /** Get current autonomy mode. */
  getAutonomyMode(): AutonomyMode {
    return this.autonomyMode;
  }

  /** Get current autonomy authority. */
  getAutonomyAuthority(): AutonomyAuthority {
    return this.autonomyAuthority;
  }

  /**
   * Change autonomy mode — requires governance authority.
   * This is the single place where mode changes are recorded.
   */
  setAutonomyMode(mode: AutonomyMode, authority: AutonomyAuthority, reason: string): void {
    if (authority !== 'system' && authority !== 'human' && authority !== 'external-governance') {
      throw new Error(`Invalid authority for mode change: ${authority}`);
    }
    const oldMode = this.autonomyMode;
    this.autonomyMode = mode;
    this.autonomyAuthority = authority;
    // Record as governance event (would go to event log)
    this.recordEvent({
      type: 'autonomy.mode.changed',
      from: oldMode,
      to: mode,
      authority,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Evaluate whether an operation may proceed.
   * This is the central enforcement point — all operations pass through here.
   */
  evaluateOperation(
    operation: {
      id: string;
      risk: CapabilityRisk;
      verdict: Verdict;
      requiresGovernanceArtifact?: GovernanceArtifactKind;
    }
  ): GateResult {
    // Check if operation requires a governance artifact
    if (operation.requiresGovernanceArtifact) {
      const artifact = this.artifactRegistry.getByKind(operation.requiresGovernanceArtifact)[0];
      if (!artifact) {
        return {
          decision: 'refuse',
          reason: `Required governance artifact ${operation.requiresGovernanceArtifact} not found`,
          requiresExplanation: true,
          escalationPath: 'governance/artifact-missing',
        };
      }
    }

    // Evaluate risk–verdict gate
    const gateResult = evaluateGateFromRisk(operation.risk, operation.verdict);

    // Apply autonomy mode constraints
    if (!this.permitsExecution(gateResult.decision)) {
      return {
        ...gateResult,
        decision: 'escalate',
        reason: `${gateResult.reason} — autonomy mode ${this.autonomyMode} prohibits this action`,
        requiresExplanation: true,
        escalationPath: 'governance/autonomy-mode',
      };
    }

    return gateResult;
  }

  /** Check if autonomy mode permits a gate decision. */
  private permitsExecution(decision: GateResult['decision']): boolean {
    // observe-only and propose-only never permit execution
    if (this.autonomyMode === 'observe-only' || this.autonomyMode === 'propose-only') {
      return decision === 'allow' && false; // never execute
    }
    // sandbox-execute only permits monitored execution
    if (this.autonomyMode === 'sandbox-execute') {
      return decision === 'allow' || decision === 'allow-monitored';
    }
    // low-risk-auto-merge permits allow and allow-monitored
    if (this.autonomyMode === 'low-risk-auto-merge') {
      return decision === 'allow' || decision === 'allow-monitored';
    }
    // human-approved-production requires human review for everything
    if (this.autonomyMode === 'human-approved-production') {
      return false;
    }
    return false;
  }

  /** Get governance artifact registry. */
  getArtifactRegistry() {
    return this.artifactRegistry;
  }

  /** Get mission overlay registry. */
  getOverlayRegistry() {
    return this.overlayRegistry;
  }

  /** Create a mission overlay. */
  async createMissionOverlay(
    missionId: string,
    target: string,
    delta: number,
    provenance: MissionOverlay['provenance'],
    expiresInMs?: number,
    scope?: MissionOverlay['scope']
  ): Promise<MissionOverlay> {
    const { createMissionOverlay } = await import('./artifacts.js');
    const overlay = createMissionOverlay(missionId, target, delta, provenance, expiresInMs, scope);
    this.overlayRegistry.register(overlay);
    return overlay;
  }

  /** Get total overlay delta for a target. */
  getOverlayDelta(target: string, context?: { focusId?: string; componentId?: string }): number {
    return this.overlayRegistry.getTotalDelta(target, context);
  }

  /** Prune expired overlays. */
  pruneOverlays(): number {
    return this.overlayRegistry.pruneExpired();
  }

  /** Record a governance event (would be wired to event log). */
  private recordEvent(event: unknown): void {
    // In practice, this would append to the event log
    // For now, we just ensure the spine can be constructed
  }
}

/** Global governance spine instance. */
export const governanceSpine = new GovernanceSpine();

/**
 * Convenience function to evaluate an operation through the spine.
 */
export const evaluateThroughSpine = (
  operation: Parameters<GovernanceSpine['evaluateOperation']>[0]
): GateResult => governanceSpine.evaluateOperation(operation);

/**
 * Convenience function to get the current autonomy mode.
 */
export const getCurrentAutonomyMode = (): AutonomyMode => governanceSpine.getAutonomyMode();

/**
 * Convenience function to create a mission overlay through the spine.
 */
export const createOverlayThroughSpine = async (
  missionId: string,
  target: string,
  delta: number,
  provenance: MissionOverlay['provenance'],
  expiresInMs?: number,
  scope?: MissionOverlay['scope']
): Promise<MissionOverlay> => governanceSpine.createMissionOverlay(missionId, target, delta, provenance, expiresInMs, scope);

/**
 * Convenience function to get overlay delta through the spine.
 */
export const getOverlayDeltaThroughSpine = (
  target: string,
  context?: { focusId?: string; componentId?: string }
): number => governanceSpine.getOverlayDelta(target, context);