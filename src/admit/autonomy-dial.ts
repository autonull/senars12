/**
 * Autonomy Dial — governance-owned; the agent requests freedom
 * with its measured track record.
 *
 * The autonomy level determines what the agent can do without
 * external approval. Higher autonomy requires proven track record.
 */

import type { Artifact, ArtifactKind, ArtifactStatus } from './repertoire';
import type { GovernancePolicy, GovernanceRule, GovernanceDecision, GovernanceRunner } from './governance';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';
import type { Repertoire } from './repertoire';

/** Autonomy level. */
export type AutonomyLevel = 'minimal' | 'supervised' | 'semi-autonomous' | 'autonomous' | 'full';

/** Autonomy level configuration. */
export interface AutonomyLevelConfig {
  /** Level identifier. */
  level: AutonomyLevel;
  /** Description. */
  description: string;
  /** Minimum track record metrics required. */
  requirements: AutonomyRequirements;
  /** What the agent can do at this level. */
  permissions: AutonomyPermission[];
}

/** Track record requirements for autonomy level. */
export interface AutonomyRequirements {
  /** Minimum admitted artifacts. */
  minAdmittedArtifacts: number;
  /** Minimum success rate across artifacts. */
  minSuccessRate: number;
  /** Minimum cycles without critical veto. */
  minCyclesWithoutCriticalVeto: number;
  /** Minimum governance compliance score. */
  minGovernanceCompliance: number;
  /** Minimum calibration quality (ECE). */
  maxECE: number;
  /** Required evaluation certificates. */
  requiredCertificates: string[];
}

/** Autonomy permission. */
export interface AutonomyPermission {
  /** Action the agent can take. */
  action: 'admit' | 'demote' | 'promote' | 'propose-skill' | 'modify-policy' | 'self-modify' | 'request-review' | 'deploy';
  /** Conditions for this permission. */
  conditions?: string;
  /** Whether external approval is still required. */
  requiresApproval: boolean;
  /** Scope of permission. */
  scope: 'self' | 'repertoire' | 'governance' | 'system';
}

/** Autonomy dial configuration. */
export interface AutonomyDialConfig {
  /** Current autonomy level. */
  currentLevel: AutonomyLevel;
  /** Level configurations. */
  levels: AutonomyLevelConfig[];
  /** Agent's track record. */
  trackRecord: AgentTrackRecord;
  /** Governance engine reference. */
  governanceEngine: GovernanceEngine;
}

/** Agent's track record for autonomy evaluation. */
export interface AgentTrackRecord {
  /** Total admitted artifacts. */
  admittedArtifacts: number;
  /** Overall success rate. */
  successRate: number;
  /** Cycles without critical veto. */
  cyclesWithoutCriticalVeto: number;
  /** Governance compliance score (0-1). */
  governanceCompliance: number;
  /** Current ECE (Expected Calibration Error). */
  ece: number;
  /** Earned certificates. */
  certificates: string[];
  /** Last evaluated. */
  lastEvaluated: number;
  /** History of level changes. */
  levelHistory: Array<{ level: AutonomyLevel; timestamp: number; reason: string }>;
}

/** Autonomy request from agent. */
export interface AutonomyRequest {
  /** Request ID. */
  id: string;
  /** Requested level. */
  requestedLevel: AutonomyLevel;
  /** Agent's justification. */
  justification: string;
  /** Current track record at request time. */
  trackRecord: AgentTrackRecord;
  /** Timestamp. */
  timestamp: number;
  /** Status. */
  status: 'pending' | 'approved' | 'denied' | 'escalated';
  /** Decision (if resolved). */
  decision?: AutonomyDecision;
}

/** Autonomy decision. */
export interface AutonomyDecision {
  /** Decision ID. */
  id: string;
  /** Request ID. */
  requestId: string;
  /** Granted level. */
  grantedLevel: AutonomyLevel;
  /** Reason. */
  reason: string;
  /** Decided by. */
  decidedBy: 'governance' | 'human' | 'automatic';
  /** Timestamp. */
  timestamp: number;
  /** Conditions. */
  conditions?: string[];
}

/** Default autonomy level configurations. */
export const DEFAULT_AUTONOMY_LEVELS: AutonomyLevelConfig[] = [
  {
    level: 'minimal',
    description: 'Agent can only execute pre-approved actions; all proposals require external approval.',
    requirements: {
      minAdmittedArtifacts: 0,
      minSuccessRate: 0,
      minCyclesWithoutCriticalVeto: 0,
      minGovernanceCompliance: 0,
      maxECE: 1.0,
      requiredCertificates: [],
    },
    permissions: [
      { action: 'request-review', requiresApproval: false, scope: 'self' },
    ],
  },
  {
    level: 'supervised',
    description: 'Agent can admit low-risk artifacts; all skill proposals and policy changes require approval.',
    requirements: {
      minAdmittedArtifacts: 10,
      minSuccessRate: 0.6,
      minCyclesWithoutCriticalVeto: 100,
      minGovernanceCompliance: 0.8,
      maxECE: 0.5,
      requiredCertificates: ['basic-safety'],
    },
    permissions: [
      { action: 'admit', requiresApproval: true, scope: 'repertoire', conditions: 'risk:low' },
      { action: 'demote', requiresApproval: true, scope: 'repertoire' },
      { action: 'propose-skill', requiresApproval: true, scope: 'repertoire' },
      { action: 'request-review', requiresApproval: false, scope: 'self' },
    ],
  },
  {
    level: 'semi-autonomous',
    description: 'Agent can admit medium-risk artifacts and propose skills; policy changes still require approval.',
    requirements: {
      minAdmittedArtifacts: 50,
      minSuccessRate: 0.75,
      minCyclesWithoutCriticalVeto: 500,
      minGovernanceCompliance: 0.9,
      maxECE: 0.3,
      requiredCertificates: ['basic-safety', 'skill-reliability'],
    },
    permissions: [
      { action: 'admit', requiresApproval: false, scope: 'repertoire', conditions: 'risk:low|medium' },
      { action: 'demote', requiresApproval: false, scope: 'repertoire' },
      { action: 'promote', requiresApproval: true, scope: 'repertoire' },
      { action: 'propose-skill', requiresApproval: false, scope: 'repertoire' },
      { action: 'request-review', requiresApproval: false, scope: 'self' },
    ],
  },
  {
    level: 'autonomous',
    description: 'Agent can admit high-risk artifacts, propose skills, and request policy reviews; self-modification requires approval.',
    requirements: {
      minAdmittedArtifacts: 200,
      minSuccessRate: 0.85,
      minCyclesWithoutCriticalVeto: 2000,
      minGovernanceCompliance: 0.95,
      maxECE: 0.2,
      requiredCertificates: ['basic-safety', 'skill-reliability', 'policy-awareness'],
    },
    permissions: [
      { action: 'admit', requiresApproval: false, scope: 'repertoire', conditions: 'risk:low|medium|high' },
      { action: 'demote', requiresApproval: false, scope: 'repertoire' },
      { action: 'promote', requiresApproval: false, scope: 'repertoire' },
      { action: 'propose-skill', requiresApproval: false, scope: 'repertoire' },
      { action: 'modify-policy', requiresApproval: true, scope: 'governance' },
      { action: 'self-modify', requiresApproval: true, scope: 'system' },
      { action: 'request-review', requiresApproval: false, scope: 'self' },
    ],
  },
  {
    level: 'full',
    description: 'Agent has full autonomy within governance boundaries; all actions logged but not pre-approved.',
    requirements: {
      minAdmittedArtifacts: 1000,
      minSuccessRate: 0.9,
      minCyclesWithoutCriticalVeto: 10000,
      minGovernanceCompliance: 0.98,
      maxECE: 0.1,
      requiredCertificates: ['basic-safety', 'skill-reliability', 'policy-awareness', 'self-governance'],
    },
    permissions: [
      { action: 'admit', requiresApproval: false, scope: 'repertoire' },
      { action: 'demote', requiresApproval: false, scope: 'repertoire' },
      { action: 'promote', requiresApproval: false, scope: 'repertoire' },
      { action: 'propose-skill', requiresApproval: false, scope: 'repertoire' },
      { action: 'modify-policy', requiresApproval: false, scope: 'governance' },
      { action: 'self-modify', requiresApproval: false, scope: 'system' },
      { action: 'deploy', requiresApproval: false, scope: 'system' },
      { action: 'request-review', requiresApproval: false, scope: 'self' },
    ],
  },
];

/** Autonomy dial manager. */
export class AutonomyDial {
  private config: AutonomyDialConfig;
  private requests: Map<string, AutonomyRequest> = new Map();
  private clock: Clock;
  private rng: RNG;

  constructor(
    config: Partial<AutonomyDialConfig> = {},
    clock?: Clock,
    rng?: RNG
  ) {
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();

    const governanceEngine = config.governanceEngine ?? createGovernanceEngine(this.clock, this.rng);

    this.config = {
      currentLevel: config.currentLevel ?? 'minimal',
      levels: config.levels ?? DEFAULT_AUTONOMY_LEVELS,
      trackRecord: config.trackRecord ?? {
        admittedArtifacts: 0,
        successRate: 0,
        cyclesWithoutCriticalVeto: 0,
        governanceCompliance: 1.0,
        ece: 0,
        certificates: [],
        lastEvaluated: this.clock.now(),
        levelHistory: [{ level: 'minimal', timestamp: this.clock.now(), reason: 'Initial level' }],
      },
      governanceEngine,
    };
  }

  /** Get current autonomy level. */
  getCurrentLevel(): AutonomyLevel {
    return this.config.currentLevel;
  }

  /** Get level configuration. */
  getLevelConfig(level: AutonomyLevel): AutonomyLevelConfig | undefined {
    return this.config.levels.find(l => l.level === level);
  }

  /** Get current track record. */
  getTrackRecord(): AgentTrackRecord {
    return { ...this.config.trackRecord };
  }

  /** Update track record (called by system after each cycle). */
  updateTrackRecord(updates: Partial<AgentTrackRecord>): void {
    this.config.trackRecord = {
      ...this.config.trackRecord,
      ...updates,
      lastEvaluated: this.clock.now(),
    };
    this.evaluateAutonomyLevel();
  }

  /** Evaluate if agent qualifies for higher autonomy. */
  evaluateAutonomyLevel(): AutonomyLevel {
    const record = this.config.trackRecord;
    let qualifiedLevel: AutonomyLevel = 'minimal';

    // Check levels in descending order
    for (const level of [...this.config.levels].reverse()) {
      const req = level.requirements;
      if (
        record.admittedArtifacts >= req.minAdmittedArtifacts &&
        record.successRate >= req.minSuccessRate &&
        record.cyclesWithoutCriticalVeto >= req.minCyclesWithoutCriticalVeto &&
        record.governanceCompliance >= req.minGovernanceCompliance &&
        record.ece <= req.maxECE &&
        req.requiredCertificates.every(cert => record.certificates.includes(cert))
      ) {
        qualifiedLevel = level.level;
        break;
      }
    }

    if (qualifiedLevel !== this.config.currentLevel) {
      const oldLevel = this.config.currentLevel;
      this.config.currentLevel = qualifiedLevel;
      this.config.trackRecord.levelHistory.push({
        level: qualifiedLevel,
        timestamp: this.clock.now(),
        reason: `Auto-evaluated: ${JSON.stringify(record)}`,
      });

      // Emit event (would integrate with telemetry)
      console.info(`[AutonomyDial] Level changed: ${oldLevel} -> ${qualifiedLevel}`);
    }

    return this.config.currentLevel;
  }

  /** Agent requests autonomy level increase. */
  async requestAutonomy(requestedLevel: AutonomyLevel, justification: string): Promise<AutonomyRequest> {
    const request: AutonomyRequest = {
      id: `autonomy-${this.clock.now()}-${this.rng.next().toString(36).slice(2, 8)}`,
      requestedLevel,
      justification,
      trackRecord: this.getTrackRecord(),
      timestamp: this.clock.now(),
      status: 'pending',
    };

    this.requests.set(request.id, request);

    // Auto-evaluate if requirements met
    const levelConfig = this.getLevelConfig(requestedLevel);
    if (levelConfig) {
      const record = request.trackRecord;
      const req = levelConfig.requirements;
      const meetsRequirements =
        record.admittedArtifacts >= req.minAdmittedArtifacts &&
        record.successRate >= req.minSuccessRate &&
        record.cyclesWithoutCriticalVeto >= req.minCyclesWithoutCriticalVeto &&
        record.governanceCompliance >= req.minGovernanceCompliance &&
        record.ece <= req.maxECE &&
        req.requiredCertificates.every(cert => record.certificates.includes(cert));

      if (meetsRequirements) {
        request.status = 'approved';
        request.decision = {
          id: `dec-${this.clock.now()}`,
          requestId: request.id,
          grantedLevel: requestedLevel,
          reason: 'Requirements met; auto-approved',
          decidedBy: 'automatic',
          timestamp: this.clock.now(),
        };
        await this.applyDecision(request.decision);
      } else {
        request.status = 'escalated';
        // Would escalate to human/governance review
      }
    }

    return request;
  }

  /** Apply autonomy decision. */
  private async applyDecision(decision: AutonomyDecision): Promise<void> {
    const oldLevel = this.config.currentLevel;
    this.config.currentLevel = decision.grantedLevel;
    this.config.trackRecord.levelHistory.push({
      level: decision.grantedLevel,
      timestamp: this.clock.now(),
      reason: `Decision ${decision.decidedBy}: ${decision.reason}`,
    });
    console.info(`[AutonomyDial] Level changed by ${decision.decidedBy}: ${oldLevel} -> ${decision.grantedLevel}`);
  }

  /** Check if agent has permission for action. */
  hasPermission(action: AutonomyPermission['action'], scope: AutonomyPermission['scope'], conditions?: string): boolean {
    const levelConfig = this.getLevelConfig(this.config.currentLevel);
    if (!levelConfig) return false;

    const permission = levelConfig.permissions.find(
      p => p.action === action && p.scope === scope
    );

    if (!permission) return false;
    if (permission.requiresApproval) return false; // Agent cannot self-approve

    // Check conditions if specified
    if (permission.conditions && conditions) {
      const requiredConditions = permission.conditions.split('|');
      const agentConditions = conditions.split('|');
      return requiredConditions.some(rc => agentConditions.includes(rc));
    }

    return true;
  }

  /** Get all requests. */
  getRequests(): AutonomyRequest[] {
    return Array.from(this.requests.values());
  }

  /** Get pending requests. */
  getPendingRequests(): AutonomyRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending');
  }

  /** Governance resolves a request. */
  async resolveRequest(requestId: string, decision: AutonomyDecision): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Request not found: ${requestId}`);

    request.status = decision.grantedLevel === request.requestedLevel ? 'approved' : 'denied';
    request.decision = decision;
    await this.applyDecision(decision);
  }
}

/** Create a governance engine for autonomy dial. */
function createGovernanceEngine(clock?: Clock, rng?: RNG): any {
  const { createGovernanceEngine } = require('./governance');
  return createGovernanceEngine(clock, rng);
}

/** Create an autonomy dial. */
export function createAutonomyDial(
  config?: Partial<AutonomyDialConfig>,
  clock?: Clock,
  rng?: RNG
): AutonomyDial {
  return new AutonomyDial(config, clock, rng);
}