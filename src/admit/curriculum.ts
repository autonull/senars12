/**
 * Curriculum Generator — creates learning curricula from certificates.
 *
 * Curriculum positives have proofs, negatives have countermodels;
 * no human annotation required. RLFP preferences provide a second label source.
 */

import type { Artifact, ArtifactKind } from './repertoire.js';
import type { EvaluationCertificate } from '../worlds/scorecard.js';
import type { Term } from '../kernel/terms/term.js';
import type { TruthValue } from '../kernel/truth.js';
import type { Clock, TimestampMs } from '../kernel/env.js';
import { createDefaultClock } from '../kernel/env.js';
import type { PreferenceData } from '../rlfp/PreferenceCollector.js';
import type { TrajectoryStep } from '../rlfp/ReasoningTrajectoryLogger.js';

/** RLFP preference label. */
export interface RlfpPreferenceLabel {
  /** Preference ID. */
  id: string;
  /** Trajectory A. */
  trajectoryA: TrajectoryStep[];
  /** Trajectory B. */
  trajectoryB: TrajectoryStep[];
  /** Preference: 'A' | 'B' | 'SKIP'. */
  preference: 'A' | 'B' | 'SKIP';
  /** Timestamp. */
  timestamp: number;
  /** Derived label for curriculum. */
  label: 'preferred' | 'rejected' | 'neutral';
  /** Confidence [0, 1]. */
  confidence: number;
}

/** Curriculum item. */
export interface CurriculumItem {
  /** Item ID. */
  id: string;
  /** Target artifact kind. */
  kind: ArtifactKind;
  /** Term to learn. */
  term: Term;
  /** Expected truth. */
  expectedTruth: TruthValue;
  /** Source: 'proof' | 'countermodel' | 'certificate' | 'exploration' | 'rlfp-preference'. */
  source: 'proof' | 'countermodel' | 'certificate' | 'exploration' | 'rlfp-preference';
  /** Source certificate ID (if applicable). */
  certificateId?: string;
  /** Source RLFP preference ID (if applicable). */
  preferenceId?: string;
  /** Difficulty [0, 1]. */
  difficulty: number;
  /** Prerequisites (item IDs). */
  prerequisites: string[];
  /** Tags. */
  tags: string[];
}

/** Curriculum. */
export interface Curriculum {
  /** Curriculum ID. */
  id: string;
  /** Name. */
  name: string;
  /** Items in order. */
  items: CurriculumItem[];
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** Curriculum generation config. */
export interface CurriculumConfig {
  /** Max items per curriculum. */
  maxItems: number;
  /** Difficulty progression. */
  difficultyProgression: 'linear' | 'exponential' | 'adaptive';
  /** Include countermodels. */
  includeCountermodels: boolean;
  /** Certificate weight. */
  certificateWeight: number;
  /** Exploration weight. */
  explorationWeight: number;
  /** RLFP preference weight. */
  rlfpWeight: number;
  /** Include RLFP preferences. */
  includeRlfp: boolean;
}

/** Default curriculum config. */
export const defaultCurriculumConfig: CurriculumConfig = {
  maxItems: 100,
  difficultyProgression: 'adaptive',
  includeCountermodels: true,
  certificateWeight: 0.5,
  explorationWeight: 0.2,
  rlfpWeight: 0.3,
  includeRlfp: true,
};

/** Curriculum generator. */
export class CurriculumGenerator {
  private config: CurriculumConfig;
  private certificates: Map<string, EvaluationCertificate> = new Map();
  private artifacts: Artifact[] = [];
  private rlfpPreferences: RlfpPreferenceLabel[] = [];
  private clock: Clock;

  constructor(config: CurriculumConfig = defaultCurriculumConfig, clock?: Clock) {
    this.config = config;
    this.clock = clock ?? createDefaultClock();
  }

  /** Update config. */
  setConfig(config: Partial<CurriculumConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Add certificate for curriculum generation. */
  addCertificate(cert: EvaluationCertificate): void {
    this.certificates.set(cert.id, cert);
  }

  /** Add artifacts for curriculum generation. */
  addArtifacts(artifacts: Artifact[]): void {
    this.artifacts = artifacts;
  }

  /** Add RLFP preferences for curriculum generation. */
  addRlfpPreferences(preferences: RlfpPreferenceLabel[]): void {
    this.rlfpPreferences = preferences;
  }

  /** Add RLFP preference from raw preference data. */
  addRlfpPreference(preference: PreferenceData): void {
    const label = this.deriveLabelFromPreference(preference);
    this.rlfpPreferences.push({
      id: `pref-${preference.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      trajectoryA: preference.trajectoryA,
      trajectoryB: preference.trajectoryB,
      preference: preference.preference,
      timestamp: preference.timestamp,
      label,
      confidence: this.computePreferenceConfidence(preference),
    });
  }

  /** Derive curriculum label from preference. */
  private deriveLabelFromPreference(preference: PreferenceData): 'preferred' | 'rejected' | 'neutral' {
    if (preference.preference === 'A') return 'preferred';
    if (preference.preference === 'B') return 'rejected';
    return 'neutral';
  }

  /** Compute confidence from preference. */
  private computePreferenceConfidence(preference: PreferenceData): number {
    if (preference.preference === 'SKIP') return 0;
    // Confidence based on trajectory difference
    const scoreA = this.scoreTrajectory(preference.trajectoryA);
    const scoreB = this.scoreTrajectory(preference.trajectoryB);
    const diff = Math.abs(scoreA - scoreB);
    return Math.min(1, diff / 10); // Normalize
  }

  /** Score a trajectory for confidence computation. */
  private scoreTrajectory(trajectory: TrajectoryStep[]): number {
    let score = 0;
    for (const step of trajectory) {
      if (step.type === 'tool_call') score += 0.2;
      if (step.type === 'lm_response') score += 0.3;
      if (step.type === 'error') score -= 0.5;
    }
    return score;
  }

  /** Generate curriculum from certificates, artifacts, and RLFP preferences. */
  generateCurriculum(id: string, name: string): Curriculum {
    const items: CurriculumItem[] = [];

    // 1. Generate from certificates (proofs)
    for (const cert of this.certificates.values()) {
      if (!cert.passed) continue;
      for (const threshold of cert.thresholds) {
        if (!threshold.passed) continue;
        items.push(this.createItemFromCertificate(cert, threshold));
      }
    }

    // 2. Generate from artifacts (positive examples)
    for (const artifact of this.artifacts) {
      if (artifact.status === 'admitted' && artifact.metrics.successRate > 0.8) {
        items.push(this.createItemFromArtifact(artifact, 'proof'));
      }
    }

    // 3. Generate countermodels (negative examples)
    if (this.config.includeCountermodels) {
      for (const artifact of this.artifacts) {
        if (artifact.status === 'demoted' || artifact.status === 'quarantined') {
          items.push(this.createItemFromArtifact(artifact, 'countermodel'));
        }
      }
    }

    // 4. Generate from RLFP preferences (second label source)
    if (this.config.includeRlfp) {
      for (const pref of this.rlfpPreferences) {
        if (pref.label !== 'neutral' && pref.confidence > 0.3) {
          items.push(this.createItemFromRlfpPreference(pref));
        }
      }
    }

    // 5. Sort by difficulty
    items.sort((a, b) => a.difficulty - b.difficulty);

    // 6. Assign prerequisites
    this.assignPrerequisites(items);

    // 7. Limit items
    const limitedItems = items.slice(0, this.config.maxItems);

    return {
      id,
      name,
      items: limitedItems,
      metadata: {
        generatedAt: this.clock.now(),
        certificateCount: this.certificates.size,
        artifactCount: this.artifacts.length,
        rlfpPreferenceCount: this.rlfpPreferences.length,
        config: this.config,
      },
    };
  }

  /** Create curriculum item from certificate. */
  private createItemFromCertificate(
    cert: EvaluationCertificate,
    threshold: { metric: string; actual: number }
  ): CurriculumItem {
    const difficulty = Math.min(1, Math.max(0, 1 - threshold.actual));
    return {
      id: `cur-${cert.id}-${threshold.metric}`,
      kind: 'belief',
      term: { op: 'CONSTANT' as any, value: threshold.metric } as Term,
      expectedTruth: { f: threshold.actual, c: 0.9 },
      source: 'certificate',
      certificateId: cert.id,
      difficulty,
      prerequisites: [],
      tags: ['certificate', threshold.metric],
    };
  }

  /** Create curriculum item from artifact. */
  private createItemFromArtifact(
    artifact: Artifact,
    source: 'proof' | 'countermodel'
  ): CurriculumItem {
    const difficulty = source === 'proof'
      ? Math.min(1, Math.max(0, 1 - artifact.metrics.successRate))
      : Math.min(1, Math.max(0, artifact.metrics.successRate));

    return {
      id: `cur-${artifact.id}`,
      kind: artifact.kind,
      term: artifact.term,
      expectedTruth: source === 'proof'
        ? { f: artifact.truth.f, c: Math.min(1, artifact.truth.c + 0.1) }
        : { f: 1 - artifact.truth.f, c: artifact.truth.c },
      source,
      difficulty,
      prerequisites: [],
      tags: [source, artifact.kind, ...artifact.tags],
    };
  }

  /** Create curriculum item from RLFP preference. */
  private createItemFromRlfpPreference(pref: RlfpPreferenceLabel): CurriculumItem {
    const difficulty = pref.label === 'preferred' ? 0.3 : 0.7;
    const expectedTruth = pref.label === 'preferred'
      ? { f: 0.8, c: pref.confidence }
      : { f: 0.2, c: pref.confidence };

    return {
      id: `cur-${pref.id}`,
      kind: 'skill',
      term: { op: 'CONSTANT' as any, value: `rlfp-${pref.label}` } as Term,
      expectedTruth,
      source: 'rlfp-preference',
      preferenceId: pref.id,
      difficulty,
      prerequisites: [],
      tags: ['rlfp', pref.label, `confidence-${pref.confidence.toFixed(2)}`],
    };
  }

  /** Assign prerequisites based on dependencies and difficulty. */
  private assignPrerequisites(items: CurriculumItem[]): void {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      // Add prerequisites from easier items with same kind
      const sameKind = items
        .filter((_, j) => j < i && items[j]!.kind === item.kind)
        .slice(-3); // Up to 3 prerequisites
      item.prerequisites = sameKind.map(s => s.id);
    }
  }

  /** Export curriculum as JSON. */
  exportCurriculum(curriculum: Curriculum): string {
    return JSON.stringify(curriculum, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2);
  }

  /** Import curriculum from JSON. */
  importCurriculum(json: string): Curriculum {
    return JSON.parse(json);
  }
}

/** Create a curriculum generator. */
export function createCurriculumGenerator(config?: CurriculumConfig, clock?: Clock): CurriculumGenerator {
  return new CurriculumGenerator(config, clock);
}