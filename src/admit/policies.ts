/**
 * Policies — faculty, profile, and oracle policies for Rung 3.
 *
 * Policies govern admission, promotion, and operation of artifacts.
 * A/B trial and auto-rollback are implemented here.
 */

import type { Artifact, ArtifactKind, ArtifactStatus } from './repertoire.js';
import type { GateResult } from './lifecycle.js';
import type { Clock, RNG, TimestampMs } from '../kernel/env.js';
import { createDefaultClock, createDefaultRNG } from '../kernel/env.js';

/** Policy scope. */
export const POLICY_SCOPES = [
  'admission',
  'promotion',
  'operation',
  'retirement',
] as const;

export type PolicyScope = (typeof POLICY_SCOPES)[number];

/** Policy action. */
export const POLICY_ACTIONS = [
  'allow',
  'deny',
  'quarantine',
  'require-review',
  'rollback',
  'a-b-trial',
] as const;

export type PolicyAction = (typeof POLICY_ACTIONS)[number];

/** Faculty policy. */
export interface FacultyPolicy {
  /** Policy ID. */
  id: string;
  /** Faculty kind. */
  kind: 'inference' | 'abduction' | 'induction' | 'analogy' | 'revision' | 'planning' | 'evaluation' | 'communication' | 'governance' | 'grounding';
  /** Scope. */
  scope: PolicyScope;
  /** Action on violation. */
  action: PolicyAction;
  /** Condition (expression). */
  condition: string;
  /** Priority (higher = more important). */
  priority: number;
  /** Description. */
  description: string;
  /** A/B trial config. */
  abTrial?: ABTrialConfig;
  /** Auto-rollback config. */
  autoRollback?: AutoRollbackConfig;
}

/** Profile policy. */
export interface ProfilePolicy {
  /** Policy ID. */
  id: string;
  /** Profile name. */
  profile: 'logic' | 'coprocessor' | 'agent' | 'device' | string;
  /** Scope. */
  scope: PolicyScope;
  /** Action on violation. */
  action: PolicyAction;
  /** Condition. */
  condition: string;
  /** Priority. */
  priority: number;
  /** Description. */
  description: string;
  /** Required artifacts. */
  requiredArtifacts?: string[];
  /** Forbidden artifacts. */
  forbiddenArtifacts?: string[];
}

/** Oracle policy. */
export interface OraclePolicy {
  /** Policy ID. */
  id: string;
  /** Oracle ID. */
  oracleId: string;
  /** Scope. */
  scope: PolicyScope;
  /** Action on violation. */
  action: PolicyAction;
  /** Condition. */
  condition: string;
  /** Priority. */
  priority: number;
  /** Description. */
  description: string;
  /** Max cost. */
  maxCost?: number;
  /** Required capabilities. */
  requiredCapabilities?: string[];
}

/** A/B trial configuration. */
export interface ABTrialConfig {
  /** Trial ID. */
  trialId: string;
  /** Control artifact ID. */
  controlId: string;
  /** Treatment artifact ID. */
  treatmentId: string;
  /** Split ratio (0-1). */
  split: number;
  /** Minimum samples. */
  minSamples: number;
  /** Metric to compare. */
  metric: 'successRate' | 'avgUtility' | 'confidenceTrend';
  /** Significance threshold. */
  significance: number;
  /** Max duration (ms). */
  maxDuration: number;
}

/** Auto-rollback configuration. */
export interface AutoRollbackConfig {
  /** Enable auto-rollback. */
  enabled: boolean;
  /** Trigger condition. */
  trigger: string;
  /** Max rollback depth. */
  maxDepth: number;
  /** Notify on rollback. */
  notify: boolean;
}

/** Trial state. */
export interface TrialState {
  /** Trial ID. */
  trialId: string;
  /** Control artifact. */
  controlId: string;
  /** Treatment artifact. */
  treatmentId: string;
  /** Control samples. */
  controlSamples: number;
  /** Treatment samples. */
  treatmentSamples: number;
  /** Control metric sum. */
  controlMetricSum: number;
  /** Treatment metric sum. */
  treatmentMetricSum: number;
  /** Started at. */
  startedAt: TimestampMs;
  /** Status. */
  status: 'running' | 'completed' | 'stopped';
  /** Winner. */
  winner?: 'control' | 'treatment' | 'inconclusive';
}

/** Policy evaluation result. */
export interface PolicyEvaluation {
  /** Policy ID. */
  policyId: string;
  /** Artifact ID. */
  artifactId: string;
  /** Action. */
  action: PolicyAction;
  /** Reason. */
  reason: string;
  /** Evidence. */
  evidence: Record<string, unknown>;
  /** Trial state (if A/B trial). */
  trialState?: TrialState;
  /** Rollback info (if auto-rollback). */
  rollbackInfo?: { rolledBack: boolean; depth: number; reason: string };
}

/** Policy engine. */
export class PolicyEngine {
  private facultyPolicies: Map<string, FacultyPolicy> = new Map();
  private profilePolicies: Map<string, ProfilePolicy> = new Map();
  private oraclePolicies: Map<string, OraclePolicy> = new Map();
  private trials: Map<string, TrialState> = new Map();
  private clock: Clock;
  private rng: RNG;

  constructor(clock?: Clock, rng?: RNG) {
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Register a faculty policy. */
  registerFacultyPolicy(policy: FacultyPolicy): void {
    this.facultyPolicies.set(policy.id, policy);
  }

  /** Register a profile policy. */
  registerProfilePolicy(policy: ProfilePolicy): void {
    this.profilePolicies.set(policy.id, policy);
  }

  /** Register an oracle policy. */
  registerOraclePolicy(policy: OraclePolicy): void {
    this.oraclePolicies.set(policy.id, policy);
  }

  /** Get all policies for scope. */
  getPoliciesForScope(scope: PolicyScope): Array<FacultyPolicy | ProfilePolicy | OraclePolicy> {
    const policies: Array<FacultyPolicy | ProfilePolicy | OraclePolicy> = [];
    for (const p of this.facultyPolicies.values()) if (p.scope === scope) policies.push(p);
    for (const p of this.profilePolicies.values()) if (p.scope === scope) policies.push(p);
    for (const p of this.oraclePolicies.values()) if (p.scope === scope) policies.push(p);
    return policies.sort((a, b) => b.priority - a.priority);
  }

  /** Evaluate artifact against policies. */
  async evaluate(
    artifact: Artifact,
    scope: PolicyScope,
    context: { repertoire: Artifact[]; external: Record<string, unknown> }
  ): Promise<PolicyEvaluation[]> {
    const policies = this.getPoliciesForScope(scope);
    const evaluations: PolicyEvaluation[] = [];

    for (const policy of policies) {
      const evaluation = await this.evaluatePolicy(policy, artifact, context);
      if (evaluation) evaluations.push(evaluation);
    }

    return evaluations;
  }

  /** Type guard for FacultyPolicy. */
  private isFacultyPolicy(policy: FacultyPolicy | ProfilePolicy | OraclePolicy): policy is FacultyPolicy {
    return 'kind' in policy && 'abTrial' in policy;
  }

  /** Type guard for ProfilePolicy. */
  private isProfilePolicy(policy: FacultyPolicy | ProfilePolicy | OraclePolicy): policy is ProfilePolicy {
    return 'profile' in policy;
  }

  /** Type guard for OraclePolicy. */
  private isOraclePolicy(policy: FacultyPolicy | ProfilePolicy | OraclePolicy): policy is OraclePolicy {
    return 'oracleId' in policy;
  }

  /** Evaluate a single policy. */
  private async evaluatePolicy(
    policy: FacultyPolicy | ProfilePolicy | OraclePolicy,
    artifact: Artifact,
    context: { repertoire: Artifact[]; external: Record<string, unknown> }
  ): Promise<PolicyEvaluation | null> {
    try {
      const matches = this.evaluateCondition(policy.condition, artifact, context);
      if (!matches) return null;

      const policyId = policy.id;
      const artifactId = artifact.id;

      // Handle A/B trial (FacultyPolicy only)
      if (this.isFacultyPolicy(policy) && policy.abTrial && policy.action === 'a-b-trial') {
        return this.handleABTrial(policy, artifact, context);
      }

      // Handle auto-rollback (FacultyPolicy only)
      if (this.isFacultyPolicy(policy) && policy.autoRollback && policy.autoRollback.enabled) {
        const rollbackResult = this.checkAutoRollback(policy, artifact, context);
        if (rollbackResult.rolledBack) {
          return {
            policyId,
            artifactId,
            action: 'rollback',
            reason: rollbackResult.reason,
            evidence: { trigger: policy.autoRollback.trigger },
            rollbackInfo: rollbackResult,
          };
        }
      }

      return {
        policyId,
        artifactId,
        action: policy.action,
        reason: `Policy ${policyId} triggered`,
        evidence: { condition: policy.condition },
      };
    } catch {
      return null;
    }
  }

  /** Evaluate condition expression. */
  private evaluateCondition(
    condition: string,
    artifact: Artifact,
    context: { repertoire: Artifact[]; external: Record<string, unknown> }
  ): boolean {
    try {
      let expr = condition
        .replace(/\btruth\.c\b/g, artifact.truth.c.toString())
        .replace(/\btruth\.f\b/g, artifact.truth.f.toString())
        .replace(/\bmetrics\.usageCount\b/g, artifact.metrics.usageCount.toString())
        .replace(/\bmetrics\.successRate\b/g, artifact.metrics.successRate.toString())
        .replace(/\bmetrics\.avgUtility\b/g, artifact.metrics.avgUtility.toString())
        .replace(/\bmetrics\.confidenceTrend\b/g, artifact.metrics.confidenceTrend.toString())
        .replace(/\bartifact\.kind\b/g, `"${artifact.kind}"`)
        .replace(/\bartifact\.status\b/g, `"${artifact.status}"`);

      // Replace external variables
      for (const [key, value] of Object.entries(context.external)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
      }

      // Replace repertoire queries
      expr = expr.replace(/\brepertoire\.count\(['"]([^'"]+)['"]\)\b/g, (_, kind) => {
        return String(context.repertoire.filter(a => a.kind === kind).length);
      });
      expr = expr.replace(/\brepertoire\.admitted\.count\(['"]([^'"]+)['"]\)\b/g, (_, kind) => {
        return String(context.repertoire.filter(a => a.kind === kind && a.status === 'admitted').length);
      });

      return new Function('return ' + expr)() as boolean;
    } catch {
      return false;
    }
  }

  /** Handle A/B trial. */
  private handleABTrial(
    policy: FacultyPolicy,
    artifact: Artifact,
    context: { repertoire: Artifact[]; external: Record<string, unknown> }
  ): PolicyEvaluation {
    const trialConfig = policy.abTrial!;
    const trialId = trialConfig.trialId;
    let trial = this.trials.get(trialId);

    const now = this.clock.now();

    if (!trial) {
      trial = {
        trialId,
        controlId: trialConfig.controlId,
        treatmentId: trialConfig.treatmentId,
        controlSamples: 0,
        treatmentSamples: 0,
        controlMetricSum: 0,
        treatmentMetricSum: 0,
        startedAt: now,
        status: 'running',
      };
      this.trials.set(trialId, trial);
    }

    // Determine if this is control or treatment
    const isControl = artifact.id === trialConfig.controlId;
    const isTreatment = artifact.id === trialConfig.treatmentId;

    if (!isControl && !isTreatment) {
      return {
        policyId: policy.id,
        artifactId: artifact.id,
        action: 'allow',
        reason: 'Not part of trial',
        evidence: {},
      };
    }

    // Get metric value
    let metricValue = 0;
    switch (trialConfig.metric) {
      case 'successRate':
        metricValue = artifact.metrics.successRate;
        break;
      case 'avgUtility':
        metricValue = artifact.metrics.avgUtility;
        break;
      case 'confidenceTrend': {
        metricValue = artifact.metrics.confidenceTrend;
        break;
      }
    }

    if (isControl) {
      trial.controlSamples++;
      trial.controlMetricSum += metricValue;
    } else {
      trial.treatmentSamples++;
      trial.treatmentMetricSum += metricValue;
    }

    // Check if trial should conclude
    const minSamples = trialConfig.minSamples;
    const controlAvg = trial.controlSamples > 0 ? trial.controlMetricSum / trial.controlSamples : 0;
    const treatmentAvg = trial.treatmentSamples > 0 ? trial.treatmentMetricSum / trial.treatmentSamples : 0;

    let winner: 'control' | 'treatment' | 'inconclusive' = 'inconclusive';
    let shouldConclude = false;

    if (trial.controlSamples >= minSamples && trial.treatmentSamples >= minSamples) {
      const diff = Math.abs(treatmentAvg - controlAvg);
      if (diff >= trialConfig.significance) {
        winner = treatmentAvg > controlAvg ? 'treatment' : 'control';
        shouldConclude = true;
      }
    }

    if (now - trial.startedAt >= trialConfig.maxDuration) {
      shouldConclude = true;
      if (winner === 'inconclusive') {
        winner = treatmentAvg > controlAvg ? 'treatment' : 'control';
      }
    }

    if (shouldConclude) {
      trial.status = 'completed';
      trial.winner = winner;
    }

    return {
      policyId: policy.id,
      artifactId: artifact.id,
      action: winner === 'treatment' ? 'allow' : 'deny',
      reason: `A/B trial ${trialId}: ${winner}`,
      evidence: {
        trialId,
        controlSamples: trial.controlSamples,
        treatmentSamples: trial.treatmentSamples,
        controlAvg,
        treatmentAvg,
        winner,
      },
      trialState: { ...trial },
    };
  }

  /** Check auto-rollback condition. */
  private checkAutoRollback(
    policy: FacultyPolicy | ProfilePolicy | OraclePolicy,
    artifact: Artifact,
    context: { repertoire: Artifact[]; external: Record<string, unknown> }
  ): { rolledBack: boolean; depth: number; reason: string } {
    const config = (policy as FacultyPolicy).autoRollback;
    if (!config || !config.enabled) return { rolledBack: false, depth: 0, reason: '' };

    try {
      const triggerMatches = this.evaluateCondition(config.trigger, artifact, context);
      if (triggerMatches) {
        return { rolledBack: true, depth: config.maxDepth, reason: `Auto-rollback triggered: ${config.trigger}` };
      }
    } catch {
      // Ignore evaluation errors
    }
    return { rolledBack: false, depth: 0, reason: '' };
  }

  /** Get trial state. */
  getTrial(trialId: string): TrialState | undefined {
    return this.trials.get(trialId);
  }

  /** Get all trials. */
  getAllTrials(): TrialState[] {
    return Array.from(this.trials.values());
  }

  /** Stop a trial. */
  stopTrial(trialId: string): boolean {
    const trial = this.trials.get(trialId);
    if (trial && trial.status === 'running') {
      trial.status = 'stopped';
      return true;
    }
    return false;
  }
}

/** Create a policy engine. */
export function createPolicyEngine(clock?: Clock, rng?: RNG): PolicyEngine {
  return new PolicyEngine(clock, rng);
}

/** Default faculty policies. */
export const DEFAULT_FACULTY_POLICIES: FacultyPolicy[] = [
  {
    id: 'inference-truth-threshold',
    kind: 'inference',
    scope: 'admission',
    action: 'deny',
    condition: 'truth.c < 0.6 || truth.f < 0.2',
    priority: 100,
    description: 'Inference faculty requires higher truth thresholds',
  },
  {
    id: 'planning-irreversible-review',
    kind: 'planning',
    scope: 'operation',
    action: 'require-review',
    condition: 'repertoire.count("plan") > 10',
    priority: 90,
    description: 'Planning artifacts require review when many exist',
  },
  {
    id: 'governance-quarantine-contradiction',
    kind: 'governance',
    scope: 'admission',
    action: 'quarantine',
    condition: 'repertoire.admitted.count("rule") > 0 && truth.f < 0.3',
    priority: 95,
    description: 'Governance quarantines low-frequency rules',
    autoRollback: {
      enabled: true,
      trigger: 'metrics.successRate < 0.3',
      maxDepth: 3,
      notify: true,
    },
  },
];

/** Default profile policies. */
export const DEFAULT_PROFILE_POLICIES: ProfilePolicy[] = [
  {
    id: 'logic-profile-requires-verifier',
    profile: 'logic',
    scope: 'admission',
    action: 'require-review',
    condition: '!repertoire.admitted.count("rule")',
    priority: 80,
    description: 'Logic profile requires at least one admitted rule',
    requiredArtifacts: ['verifier-rule'],
  },
  {
    id: 'device-profile-no-lm',
    profile: 'device',
    scope: 'admission',
    action: 'deny',
    condition: 'artifact.kind === "faculty" && external.hasLM === true',
    priority: 100,
    description: 'Device profile forbids LM-dependent faculties',
  },
  {
    id: 'agent-profile-max-skills',
    profile: 'agent',
    scope: 'operation',
    action: 'quarantine',
    condition: 'repertoire.admitted.count("skill") > 50',
    priority: 70,
    description: 'Agent profile limits active skills',
  },
];

/** Default oracle policies. */
export const DEFAULT_ORACLE_POLICIES: OraclePolicy[] = [
  {
    id: 'lm-oracle-cost-limit',
    oracleId: 'lm',
    scope: 'operation',
    action: 'deny',
    condition: 'external.estimatedCost > 1000',
    priority: 90,
    description: 'LM oracle calls limited by cost',
    maxCost: 1000,
  },
  {
    id: 'embedding-oracle-dimension-check',
    oracleId: 'embedding',
    scope: 'admission',
    action: 'require-review',
    condition: 'external.dimension !== 384',
    priority: 80,
    description: 'Embedding oracle requires 384-dim vectors',
    requiredCapabilities: ['embedding-384'],
  },
];