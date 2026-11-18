/**
 * Curriculum Generator — creates learning curricula from certificates.
 *
 * Curriculum positives have proofs, negatives have countermodels;
 * no human annotation required.
 */

import type { Artifact, ArtifactKind } from './repertoire.js';
import type { EvaluationCertificate } from '../worlds/scorecard.js';
import type { Term } from '../kernel/terms/term.js';
import type { TruthValue } from '../kernel/truth.js';

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
  /** Source: 'proof' | 'countermodel' | 'certificate' | 'exploration'. */
  source: 'proof' | 'countermodel' | 'certificate' | 'exploration';
  /** Source certificate ID (if applicable). */
  certificateId?: string;
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
}

/** Default curriculum config. */
export const defaultCurriculumConfig: CurriculumConfig = {
  maxItems: 100,
  difficultyProgression: 'adaptive',
  includeCountermodels: true,
  certificateWeight: 0.7,
  explorationWeight: 0.3,
};

/** Curriculum generator. */
export class CurriculumGenerator {
  private config: CurriculumConfig;
  private certificates: Map<string, EvaluationCertificate> = new Map();
  private artifacts: Artifact[] = [];

  constructor(config: CurriculumConfig = defaultCurriculumConfig) {
    this.config = config;
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

  /** Generate curriculum from certificates and artifacts. */
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

    // 4. Sort by difficulty
    items.sort((a, b) => a.difficulty - b.difficulty);

    // 5. Assign prerequisites
    this.assignPrerequisites(items);

    // 6. Limit items
    const limitedItems = items.slice(0, this.config.maxItems);

    return {
      id,
      name,
      items: limitedItems,
      metadata: {
        generatedAt: Date.now(),
        certificateCount: this.certificates.size,
        artifactCount: this.artifacts.length,
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
export function createCurriculumGenerator(config?: CurriculumConfig): CurriculumGenerator {
  return new CurriculumGenerator(config);
}