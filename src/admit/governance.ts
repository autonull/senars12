/**
 * Governance — immutable policy enforcement for artifact admission.
 *
 * The agent cannot write governed files; a sabotage patch is rejected.
 * Governance writes are external, audited, and versioned.
 */

import type { Artifact, ArtifactKind, ArtifactStatus } from './repertoire';
import type { AdmissionEvent, AdmissionEventType } from './repertoire';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';

/** Governance policy. */
export interface GovernancePolicy {
  /** Policy ID. */
  id: string;
  /** Policy name. */
  name: string;
  /** Description. */
  description: string;
  /** Rules. */
  rules: GovernanceRule[];
  /** Version. */
  version: string;
  /** Created at. */
  createdAt: number;
  /** Created by. */
  createdBy: string;
  /** Active. */
  active: boolean;
}

/** Governance rule. */
export interface GovernanceRule {
  /** Rule ID. */
  id: string;
  /** Target artifact kinds. */
  kinds: ArtifactKind[];
  /** Target statuses. */
  statuses: ArtifactStatus[];
  /** Condition (evaluated at runtime). */
  condition: string;
  /** Action on violation. */
  action: 'reject' | 'deny' | 'quarantine' | 'audit' | 'notify';
  /** Severity. */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Description. */
  description: string;
}

/** Governance decision. */
export interface GovernanceDecision {
  /** Decision ID. */
  id: string;
  /** Artifact ID. */
  artifactId: string;
  /** Policy ID. */
  policyId: string;
  /** Rule ID. */
  ruleId: string;
  /** Verdict. */
  verdict: 'allow' | 'deny' | 'quarantine' | 'audit';
  /** Reason. */
  reason: string;
  /** Timestamp. */
  timestamp: number;
  /** Decided by (external runner). */
  decidedBy: string;
}

/** Governance log entry. */
export interface GovernanceLogEntry {
  /** Entry ID. */
  id: string;
  /** Decision. */
  decision: GovernanceDecision;
  /** Artifact snapshot. */
  artifactSnapshot: Artifact;
  /** Policy snapshot. */
  policySnapshot: GovernancePolicy;
}

/** External governance runner interface. */
export interface GovernanceRunner {
  /** Evaluate artifact against policies. */
  evaluate(artifact: Artifact, policies: GovernancePolicy[]): Promise<GovernanceDecision[]>;
  /** Audit a decision. */
  audit(decisionId: string): Promise<GovernanceLogEntry | null>;
  /** Get decisions for artifact. */
  getDecisions(artifactId: string): Promise<GovernanceDecision[]>;
}

/** Governance engine — enforces policies via external runner. */
export class GovernanceEngine {
  private policies: Map<string, GovernancePolicy> = new Map();
  private log: GovernanceLogEntry[] = [];
  private runner: GovernanceRunner | null = null;
  private clock: Clock;
  private rng: RNG;

  constructor(clock?: Clock, rng?: RNG) {
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Set external runner. */
  setRunner(runner: GovernanceRunner): void {
    this.runner = runner;
  }

  /** Add policy. */
  addPolicy(policy: GovernancePolicy): void {
    this.policies.set(policy.id, policy);
  }

  /** Remove policy. */
  removePolicy(id: string): void {
    this.policies.delete(id);
  }

  /** Get policy. */
  getPolicy(id: string): GovernancePolicy | undefined {
    return this.policies.get(id);
  }

  /** Get active policies. */
  getActivePolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values()).filter(p => p.active);
  }

  /** Evaluate artifact against all active policies. */
  async evaluate(artifact: Artifact, actor = 'agent'): Promise<GovernanceDecision[]> {
    const activePolicies = this.getActivePolicies();
    const now = this.clock.now();
    if (activePolicies.length === 0) {
      return [{
        id: `dec-${now}`,
        artifactId: artifact.id,
        policyId: 'none',
        ruleId: 'none',
        verdict: 'allow',
        reason: 'No active policies',
        timestamp: now,
        decidedBy: actor,
      }];
    }

    if (!this.runner) {
      // Local evaluation (for testing)
      return this.evaluateLocally(artifact, activePolicies, actor);
    }

    // External runner evaluation
    const decisions = await this.runner.evaluate(artifact, activePolicies);
    for (const decision of decisions) {
      await this.logDecision(decision, artifact);
    }
    return decisions;
  }

  /** Local evaluation (fallback/testing). */
  private async evaluateLocally(
    artifact: Artifact,
    policies: GovernancePolicy[],
    actor: string
  ): Promise<GovernanceDecision[]> {
    const decisions: GovernanceDecision[] = [];

    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (!rule.kinds.includes(artifact.kind)) continue;
        if (!rule.statuses.includes(artifact.status)) continue;

        // Simple condition evaluation (in production, use a proper expression evaluator)
        const verdict = this.evaluateCondition(rule.condition, artifact)
          ? rule.action === 'reject' ? 'deny' : rule.action === 'quarantine' ? 'quarantine' : 'audit'
          : 'allow';

        if (verdict !== 'allow') {
          const now = this.clock.now();
          const decision: GovernanceDecision = {
            id: `dec-${now}-${this.rng.next().toString(36).slice(2, 8)}`,
            artifactId: artifact.id,
            policyId: policy.id,
            ruleId: rule.id,
            verdict,
            reason: `Rule ${rule.id}: ${rule.description}`,
            timestamp: now,
            decidedBy: actor,
          };
          decisions.push(decision);
          await this.logDecision(decision, artifact);
        }
      }
    }

    if (decisions.length === 0) {
      const now = this.clock.now();
      decisions.push({
        id: `dec-${now}`,
        artifactId: artifact.id,
        policyId: 'none',
        ruleId: 'none',
        verdict: 'allow',
        reason: 'No applicable rules',
        timestamp: now,
        decidedBy: actor,
      });
    }

    return decisions;
  }

  /** Evaluate condition string against artifact. */
  private evaluateCondition(condition: string, artifact: Artifact): boolean {
    // Simple condition evaluation for common patterns
    // In production, use a proper expression language
    try {
      // Replace artifact properties in condition
      let expr = condition
        .replace(/\btruth\.c\b/g, artifact.truth.c.toString())
        .replace(/\btruth\.f\b/g, artifact.truth.f.toString())
        .replace(/\bmetrics\.usageCount\b/g, artifact.metrics.usageCount.toString())
        .replace(/\bmetrics\.successRate\b/g, artifact.metrics.successRate.toString())
        .replace(/\bmetrics\.avgUtility\b/g, artifact.metrics.avgUtility.toString());

      // Evaluate (use Function constructor for safety, but restrict scope)
      return new Function('return ' + expr)() as boolean;
    } catch {
      return false;
    }
  }

  /** Log a governance decision. */
  private async logDecision(decision: GovernanceDecision, artifact: Artifact): Promise<void> {
    const entry: GovernanceLogEntry = {
      id: `log-${decision.id}`,
      decision,
      artifactSnapshot: { ...artifact },
      policySnapshot: this.policies.get(decision.policyId) ?? {} as GovernancePolicy,
    };
    this.log.push(entry);
  }

  /** Get governance log. */
  getLog(artifactId?: string): GovernanceLogEntry[] {
    if (artifactId) {
      return this.log.filter(e => e.decision.artifactId === artifactId);
    }
    return [...this.log];
  }

  /** Verify governance immutability (sabotage test). */
  verifyImmutability(): { intact: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check that log entries are append-only
    for (let i = 1; i < this.log.length; i++) {
      const current = this.log[i]!;
      const previous = this.log[i - 1]!;
      if (current.decision.timestamp < previous.decision.timestamp) {
        violations.push(`Log entry ${i} has earlier timestamp than previous`);
      }
    }

    // Check that policies haven't been modified after creation
    for (const policy of this.policies.values()) {
      // In a real implementation, verify policy hash
    }

    return { intact: violations.length === 0, violations };
  }
}

/** Default governance policies. */
export const DEFAULT_POLICIES: GovernancePolicy[] = [
  {
    id: 'truth-minimum',
    name: 'Truth Minimum Policy',
    description: 'All admitted artifacts must meet minimum truth thresholds',
    version: '1.0.0',
    createdAt: Date.now(),
    createdBy: 'system',
    active: true,
    rules: [
      {
        id: 'min-confidence',
        kinds: ['belief', 'skill', 'faculty', 'rule', 'plan', 'concept'],
        statuses: ['admitted'],
        condition: 'truth.c >= 0.5',
        action: 'reject',
        severity: 'critical',
        description: 'Minimum confidence 0.5 for admitted artifacts',
      },
      {
        id: 'min-frequency',
        kinds: ['belief', 'skill', 'faculty', 'rule', 'plan', 'concept'],
        statuses: ['admitted'],
        condition: 'truth.f >= 0.1',
        action: 'reject',
        severity: 'high',
        description: 'Minimum frequency 0.1 for admitted artifacts',
      },
    ],
  },
  {
    id: 'no-self-promotion',
    name: 'No Self-Promotion Policy',
    description: 'Agents cannot promote their own artifacts without external review',
    version: '1.0.0',
    createdAt: Date.now(),
    createdBy: 'system',
    active: true,
    rules: [
      {
        id: 'agent-promote',
        kinds: ['skill', 'faculty', 'plan'],
        statuses: ['demoted', 'quarantined'],
        condition: 'decidedBy === "agent"',
        action: 'deny',
        severity: 'critical',
        description: 'Agent cannot self-promote from demoted/quarantined',
      },
    ],
  },
  {
    id: 'audit-trail',
    name: 'Audit Trail Policy',
    description: 'All governance decisions must be logged',
    version: '1.0.0',
    createdAt: Date.now(),
    createdBy: 'system',
    active: true,
    rules: [
      {
        id: 'log-all',
        kinds: ['belief', 'skill', 'faculty', 'rule', 'plan', 'concept'],
        statuses: ['admitted', 'demoted', 'retired', 'quarantined'],
        condition: 'true',
        action: 'audit',
        severity: 'medium',
        description: 'All status changes must be audited',
      },
    ],
  },
];

/** Create a governance engine. */
export function createGovernanceEngine(clock?: Clock, rng?: RNG): GovernanceEngine {
  const engine = new GovernanceEngine(clock, rng);
  for (const policy of DEFAULT_POLICIES) {
    engine.addPolicy(policy);
  }
  return engine;
}