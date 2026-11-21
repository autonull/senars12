/**
 * Rungs — admission ladder with progressive requirements.
 *
 * Rung 0: Candidate (proposed)
 * Rung 1: Validated (passes gates)
 * Rung 2: Admitted (in repertoire)
 * Rung 3: Active (in use)
 * Rung 4: Review (periodic assessment)
 * Rung 5: Demoted/Retired
 */

import type { Artifact, ArtifactKind, ArtifactStatus } from './repertoire.js';
import type { GateResult } from './lifecycle.js';
import type { Clock, TimestampMs } from '../kernel/env.js';
import { createDefaultClock } from '../kernel/env.js';

/** Admission rung. */
export const RUNGS = [
  'candidate',
  'validated',
  'admitted',
  'active',
  'review',
  'demoted',
  'retired',
] as const;

export type Rung = (typeof RUNGS)[number];

/** Rung requirements. */
export interface RungRequirements {
  /** Rung level. */
  rung: Rung;
  /** Minimum truth confidence. */
  minConfidence: number;
  /** Minimum truth frequency. */
  minFrequency: number;
  /** Required gates. */
  requiredGates: string[];
  /** Minimum usage count. */
  minUsage: number;
  /** Minimum success rate. */
  minSuccessRate: number;
  /** Maximum age (ms). */
  maxAge?: number;
  /** Requires external verification. */
  requiresExternal: boolean;
}

/** Default rung requirements. */
export const defaultRungRequirements: RungRequirements[] = [
  {
    rung: 'candidate',
    minConfidence: 0.0,
    minFrequency: 0.0,
    requiredGates: [],
    minUsage: 0,
    minSuccessRate: 0.0,
    requiresExternal: false,
  },
  {
    rung: 'validated',
    minConfidence: 0.5,
    minFrequency: 0.1,
    requiredGates: ['truthThreshold', 'noContradiction'],
    minUsage: 0,
    minSuccessRate: 0.0,
    requiresExternal: false,
  },
  {
    rung: 'admitted',
    minConfidence: 0.6,
    minFrequency: 0.2,
    requiredGates: ['truthThreshold', 'noContradiction', 'dependencyCheck'],
    minUsage: 0,
    minSuccessRate: 0.0,
    requiresExternal: false,
  },
  {
    rung: 'active',
    minConfidence: 0.7,
    minFrequency: 0.3,
    requiredGates: ['performanceReview'],
    minUsage: 10,
    minSuccessRate: 0.7,
    requiresExternal: false,
  },
  {
    rung: 'review',
    minConfidence: 0.6,
    minFrequency: 0.2,
    requiredGates: ['performanceReview'],
    minUsage: 50,
    minSuccessRate: 0.6,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    requiresExternal: true,
  },
  {
    rung: 'demoted',
    minConfidence: 0.0,
    minFrequency: 0.0,
    requiredGates: [],
    minUsage: 0,
    minSuccessRate: 0.0,
    requiresExternal: false,
  },
  {
    rung: 'retired',
    minConfidence: 0.0,
    minFrequency: 0.0,
    requiredGates: [],
    minUsage: 0,
    minSuccessRate: 0.0,
    requiresExternal: false,
  },
];

/** Map status to rung. */
export function statusToRung(status: ArtifactStatus): Rung {
  switch (status) {
    case 'candidate': return 'candidate';
    case 'admitted': return 'admitted';
    case 'demoted': return 'demoted';
    case 'retired': return 'retired';
    case 'quarantined': return 'review';
  }
}

/** Map rung to status. */
export function rungToStatus(rung: Rung): ArtifactStatus {
  switch (rung) {
    case 'candidate': return 'candidate';
    case 'validated': return 'candidate'; // Still candidate until admitted
    case 'admitted': return 'admitted';
    case 'active': return 'admitted';
    case 'review': return 'admitted';
    case 'demoted': return 'demoted';
    case 'retired': return 'retired';
  }
}

/** Check if artifact meets rung requirements. */
export function meetsRungRequirements(
  artifact: Artifact,
  rung: Rung,
  gateResults: GateResult[] = [],
  requirements: RungRequirements[] = defaultRungRequirements,
  clock?: Clock
): { met: boolean; failures: string[] } {
  const req = requirements.find(r => r.rung === rung);
  if (!req) {
    return { met: false, failures: [`Unknown rung: ${rung}`] };
  }

  const failures: string[] = [];
  const now = (clock ?? createDefaultClock()).now();

  // Truth checks
  if (artifact.truth.c < req.minConfidence) {
    failures.push(`Confidence ${artifact.truth.c} < ${req.minConfidence}`);
  }
  if (artifact.truth.f < req.minFrequency) {
    failures.push(`Frequency ${artifact.truth.f} < ${req.minFrequency}`);
  }

  // Gate checks
  for (const gateName of req.requiredGates) {
    const result = gateResults.find(g => g.gate === gateName);
    if (!result || result.verdict !== 'pass') {
      failures.push(`Required gate failed: ${gateName}`);
    }
  }

  // Usage checks
  if (artifact.metrics.usageCount < req.minUsage) {
    failures.push(`Usage ${artifact.metrics.usageCount} < ${req.minUsage}`);
  }
  if (artifact.metrics.successRate < req.minSuccessRate) {
    failures.push(`Success rate ${artifact.metrics.successRate} < ${req.minSuccessRate}`);
  }

  // Age check
  if (req.maxAge) {
    const age = now - artifact.createdAt;
    if (age > req.maxAge) {
      failures.push(`Age ${age}ms > ${req.maxAge}ms`);
    }
  }

  return { met: failures.length === 0, failures };
}

/** Determine next rung for artifact. */
export function getNextRung(
  artifact: Artifact,
  gateResults: GateResult[] = [],
  requirements: RungRequirements[] = defaultRungRequirements
): Rung | null {
  const currentRung = statusToRung(artifact.status);
  const currentIndex = RUNGS.indexOf(currentRung);

  // Try to advance to next rung only
  const nextIndex = currentIndex + 1;
  if (nextIndex < RUNGS.length) {
    const rung = RUNGS[nextIndex]!;
    const { met } = meetsRungRequirements(artifact, rung, gateResults, requirements);
    if (met) {
      return rung;
    }
  }

  // Check if should demote
  if (currentRung === 'admitted' || currentRung === 'active') {
    const { met } = meetsRungRequirements(artifact, 'demoted', gateResults, requirements);
    if (!met) { // demoted has no requirements, so this checks if it should be demoted
      // Actually check if it fails admitted requirements
      const { met: admittedMet } = meetsRungRequirements(artifact, 'admitted', gateResults, requirements);
      if (!admittedMet) {
        return 'demoted';
      }
    }
  }

  return null; // No change
}

/** Rung transition validator. */
export function validateTransition(
  from: Rung,
  to: Rung,
  artifact: Artifact,
  gateResults: GateResult[],
  requirements: RungRequirements[] = defaultRungRequirements
): { valid: boolean; reason: string } {
  const fromIndex = RUNGS.indexOf(from);
  const toIndex = RUNGS.indexOf(to);

  if (toIndex <= fromIndex) {
    // Demotion/retirement always allowed
    return { valid: true, reason: 'Demotion or retirement' };
  }

  if (toIndex > fromIndex + 1) {
    return { valid: false, reason: `Cannot skip rungs: ${from} -> ${to}` };
  }

  // Check requirements for target rung
  const { met, failures } = meetsRungRequirements(artifact, to, gateResults, requirements);
  if (!met) {
    return { valid: false, reason: `Requirements not met: ${failures.join(', ')}` };
  }

  return { valid: true, reason: 'Transition valid' };
}

/** Create default rung requirements. */
export function createRungRequirements(): RungRequirements[] {
  return [...defaultRungRequirements];
}