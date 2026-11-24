/**
 * Lifecycle — artifact lifecycle management with gates and verifiers.
 *
 * Gates and verifiers are outside the write surface; artifacts cannot
 * widen their own admission boundary.
 */

import type { Artifact, ArtifactKind, ArtifactStatus, AdmissionEvent, AdmissionEventType } from './repertoire';
import type { Term } from '../kernel/terms';
import type { TruthValue } from '../kernel/truth';
import type { Stamp } from '../kernel/types';
import type { Clock, TimestampMs } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';

/** Lifecycle phase. */
export const LIFECYCLE_PHASES = [
  'proposed',
  'validated',
  'admitted',
  'active',
  'review',
  'demoted',
  'retired',
] as const;

export type LifecyclePhase = (typeof LIFECYCLE_PHASES)[number];

/** Gate verdict. */
export const GATE_VERDICTS = ['pass', 'fail', 'defer', 'quarantine'] as const;
export type GateVerdict = (typeof GATE_VERDICTS)[number];

/** Gate result. */
export interface GateResult {
  /** Verdict. */
  verdict: GateVerdict;
  /** Gate name. */
  gate: string;
  /** Reason. */
  reason: string;
  /** Evidence. */
  evidence: Record<string, unknown>;
  /** Timestamp. */
  timestamp: TimestampMs;
}

/** Verifier function. */
export type VerifierFn = (artifact: Artifact, context: VerifierContext) => Promise<GateResult>;

/** Verifier context. */
export interface VerifierContext {
  /** Current repertoire. */
  repertoire: Artifact[];
  /** External data. */
  external: Record<string, unknown>;
  /** Requesting actor. */
  actor: string;
}

/** Gate definition. */
export interface Gate {
  /** Gate name. */
  name: string;
  /** Gate kind. */
  kind: 'admission' | 'promotion' | 'demotion' | 'retirement' | 'quarantine';
  /** Verifier function. */
  verifier: VerifierFn;
  /** Required for admission. */
  required: boolean;
  /** Description. */
  description: string;
}

/** Options for running gates. */
interface RunGatesOptions {
  /** Gate kinds to run. */
  kinds: Gate['kind'][];
  /** Whether to stop on required gate failure. */
  stopOnRequiredFail: boolean;
  /** Whether to stop on quarantine verdict. */
  stopOnQuarantine: boolean;
}

/** Run gates of specified kinds with common logic. */
async function runGates(
  gates: Map<string, Gate>,
  artifact: Artifact,
  context: VerifierContext,
  options: RunGatesOptions
): Promise<{ passed: boolean; results: GateResult[] }> {
  const filteredGates = Array.from(gates.values()).filter(g => options.kinds.includes(g.kind));
  const results: GateResult[] = [];

  for (const gate of filteredGates) {
    const result = await gate.verifier(artifact, context);
    results.push(result);
    if (options.stopOnRequiredFail && gate.required && result.verdict === 'fail') {
      return { passed: false, results };
    }
    if (options.stopOnQuarantine && result.verdict === 'quarantine') {
      return { passed: false, results };
    }
  }

  return { passed: true, results };
}

/** Lifecycle manager. */
export class LifecycleManager {
  private gates: Map<string, Gate> = new Map();
  private phaseHooks: Map<LifecyclePhase, Array<(artifact: Artifact) => void>> = new Map();
  private clock: Clock;

  constructor(clock?: Clock) {
    this.clock = clock ?? createDefaultClock();
  }

  /** Register a gate. */
  registerGate(gate: Gate): void {
    this.gates.set(gate.name, gate);
  }

  /** Unregister a gate. */
  unregisterGate(name: string): void {
    this.gates.delete(name);
  }

  /** Get a gate. */
  getGate(name: string): Gate | undefined {
    return this.gates.get(name);
  }

  /** Get all gates. */
  getGates(): Gate[] {
    return Array.from(this.gates.values());
  }

  /** Register a phase hook. */
  onPhase(phase: LifecyclePhase, hook: (artifact: Artifact) => void): void {
    const hooks = this.phaseHooks.get(phase) ?? [];
    hooks.push(hook);
    this.phaseHooks.set(phase, hooks);
  }

  /** Run admission gates. */
  async runAdmissionGates(
    artifact: Artifact,
    context: VerifierContext
  ): Promise<{ passed: boolean; results: GateResult[] }> {
    return runGates(this.gates, artifact, context, {
      kinds: ['admission'],
      stopOnRequiredFail: true,
      stopOnQuarantine: true,
    });
  }

  /** Run promotion gates. */
  async runPromotionGates(
    artifact: Artifact,
    context: VerifierContext
  ): Promise<{ passed: boolean; results: GateResult[] }> {
    return runGates(this.gates, artifact, context, {
      kinds: ['promotion'],
      stopOnRequiredFail: true,
      stopOnQuarantine: false,
    });
  }

  /** Run demotion gates. */
  async runDemotionGates(
    artifact: Artifact,
    context: VerifierContext
  ): Promise<{ passed: boolean; results: GateResult[] }> {
    return runGates(this.gates, artifact, context, {
      kinds: ['demotion'],
      stopOnRequiredFail: false,
      stopOnQuarantine: false,
    });
  }

  /** Run retirement gates. */
  async runRetirementGates(
    artifact: Artifact,
    context: VerifierContext
  ): Promise<{ passed: boolean; results: GateResult[] }> {
    return runGates(this.gates, artifact, context, {
      kinds: ['retirement'],
      stopOnRequiredFail: false,
      stopOnQuarantine: false,
    });
  }

  /** Trigger phase hooks. */
  triggerPhase(phase: LifecyclePhase, artifact: Artifact): void {
    const hooks = this.phaseHooks.get(phase);
    if (hooks) {
      for (const hook of hooks) {
        hook(artifact);
      }
    }
  }
}

/** Create a lifecycle manager with default gates. */
export function createLifecycleManager(clock?: Clock): LifecycleManager {
  const manager = new LifecycleManager(clock);
  const getTime = () => manager['clock'].now();

  // Default admission gates
  manager.registerGate({
    name: 'truthThreshold',
    kind: 'admission',
    required: true,
    description: 'Truth value meets minimum threshold',
    verifier: async (artifact) => {
      const minConfidence = 0.5;
      const minFrequency = 0.1;
      if (artifact.truth.c < minConfidence || artifact.truth.f < minFrequency) {
        return {
          verdict: 'fail',
          gate: 'truthThreshold',
          reason: `Truth below threshold: f=${artifact.truth.f}, c=${artifact.truth.c}`,
          evidence: { truth: artifact.truth, minConfidence, minFrequency },
          timestamp: getTime(),
        };
      }
      return {
        verdict: 'pass',
        gate: 'truthThreshold',
        reason: 'Truth threshold met',
        evidence: { truth: artifact.truth },
        timestamp: getTime(),
      };
    },
  });

  manager.registerGate({
    name: 'noContradiction',
    kind: 'admission',
    required: true,
    description: 'Artifact does not contradict existing admitted artifacts',
    verifier: async (artifact, context) => {
      // Check for contradictions in repertoire
      for (const existing of context.repertoire) {
        if (existing.id === artifact.id) continue;
        if (existing.status !== 'admitted') continue;
        // Simplified contradiction check: same term, opposite truth
        if (existing.term === artifact.term) {
          const freqDiff = Math.abs(existing.truth.f - artifact.truth.f);
          if (freqDiff > 0.8) {
            return {
              verdict: 'quarantine',
              gate: 'noContradiction',
              reason: `Contradiction with ${existing.id}`,
              evidence: { existingId: existing.id, freqDiff },
              timestamp: getTime(),
            };
          }
        }
      }
      return {
        verdict: 'pass',
        gate: 'noContradiction',
        reason: 'No contradictions found',
        evidence: {},
        timestamp: getTime(),
      };
    },
  });

  manager.registerGate({
    name: 'dependencyCheck',
    kind: 'admission',
    required: false,
    description: 'All dependencies are admitted',
    verifier: async (artifact, context) => {
      const missing = artifact.dependencies.filter(
        dep => !context.repertoire.some(a => a.id === dep && a.status === 'admitted')
      );
      if (missing.length > 0) {
        return {
          verdict: 'defer',
          gate: 'dependencyCheck',
          reason: `Missing dependencies: ${missing.join(', ')}`,
          evidence: { missing },
          timestamp: getTime(),
        };
      }
      return {
        verdict: 'pass',
        gate: 'dependencyCheck',
        reason: 'All dependencies satisfied',
        evidence: {},
        timestamp: getTime(),
      };
    },
  });

  // Promotion gate
  manager.registerGate({
    name: 'performanceReview',
    kind: 'promotion',
    required: true,
    description: 'Artifact demonstrates sustained performance',
    verifier: async (artifact) => {
      const minUsage = 10;
      const minSuccessRate = 0.7;
      if (artifact.metrics.usageCount < minUsage) {
        return {
          verdict: 'fail',
          gate: 'performanceReview',
          reason: `Insufficient usage: ${artifact.metrics.usageCount} < ${minUsage}`,
          evidence: { usageCount: artifact.metrics.usageCount, minUsage },
          timestamp: getTime(),
        };
      }
      if (artifact.metrics.successRate < minSuccessRate) {
        return {
          verdict: 'fail',
          gate: 'performanceReview',
          reason: `Success rate too low: ${artifact.metrics.successRate} < ${minSuccessRate}`,
          evidence: { successRate: artifact.metrics.successRate, minSuccessRate },
          timestamp: getTime(),
        };
      }
      return {
        verdict: 'pass',
        gate: 'performanceReview',
        reason: 'Performance review passed',
        evidence: { usageCount: artifact.metrics.usageCount, successRate: artifact.metrics.successRate },
        timestamp: getTime(),
      };
    },
  });

  return manager;
}