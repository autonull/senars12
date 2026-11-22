/**
 * Learning — integrates mined patterns into repertoire.
 *
 * Converts schemas and surprises into admitted artifacts.
 */

import type { Artifact, ArtifactKind, ArtifactStatus } from '../admit/repertoire';
import type { MinedSchema, SchemaExample } from './schemas';
import type { SurpriseEvent } from './surprise';
import type { Term } from '../kernel/terms/term';
import type { TruthValue } from '../kernel/truth';
import type { Stamp } from '../kernel/types';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';

/** Learning event. */
export interface LearningEvent {
  /** Event ID. */
  id: string;
  /** Source type. */
  source: 'schema' | 'surprise' | 'curriculum' | 'exploration';
  /** Source ID. */
  sourceId: string;
  /** Artifacts created. */
  artifactsCreated: string[];
  /** Artifacts modified. */
  artifactsModified: string[];
  /** Timestamp. */
  timestamp: number;
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** Learning config. */
export interface LearningConfig {
  /** Auto-admit from high-confidence schemas. */
  autoAdmitSchemas: boolean;
  /** Schema confidence threshold for auto-admit. */
  schemaAdmitThreshold: number;
  /** Convert surprises to curriculum items. */
  surprisesToCurriculum: boolean;
  /** Surprise magnitude threshold for curriculum. */
  surpriseCurriculumThreshold: number;
  /** Max artifacts per learning cycle. */
  maxArtifactsPerCycle: number;
  /** Require external verification for new kinds. */
  requireExternalForNewKinds: boolean;
}

/** Default learning config. */
export const defaultLearningConfig: LearningConfig = {
  autoAdmitSchemas: true,
  schemaAdmitThreshold: 0.85,
  surprisesToCurriculum: true,
  surpriseCurriculumThreshold: 0.6,
  maxArtifactsPerCycle: 50,
  requireExternalForNewKinds: true,
};

/** Learner — integrates mining results into repertoire. */
export class Learner {
  private config: LearningConfig;
  private events: LearningEvent[] = [];
  private artifactFactory: ArtifactFactory;
  private clock: Clock;
  private rng: RNG;

  constructor(
    config: LearningConfig = defaultLearningConfig,
    artifactFactory?: ArtifactFactory,
    clock?: Clock,
    rng?: RNG
  ) {
    this.config = config;
    this.artifactFactory = artifactFactory ?? createArtifactFactory(clock, rng);
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Learn from mined schemas. */
  learnFromSchemas(schemas: MinedSchema[]): LearningEvent {
    const artifactsCreated: string[] = [];
    const artifactsModified: string[] = [];

    for (const schema of schemas) {
      if (!this.config.autoAdmitSchemas) continue;
      if (schema.confidence < this.config.schemaAdmitThreshold) continue;
      if (artifactsCreated.length >= this.config.maxArtifactsPerCycle) break;

      const artifact = this.schemaToArtifact(schema);
      if (artifact) {
        artifactsCreated.push(artifact.id);
      }
    }

    const now = this.clock.now();
    const event: LearningEvent = {
      id: `learn-${now}-${this.rng.next().toString(36).slice(2, 8)}`,
      source: 'schema',
      sourceId: schemas.map(s => s.id).join(','),
      artifactsCreated,
      artifactsModified,
      timestamp: now,
      metadata: { schemaCount: schemas.length },
    };

    this.events.push(event);
    return event;
  }

  /** Learn from surprise events. */
  learnFromSurprises(surprises: SurpriseEvent[]): LearningEvent {
    const artifactsCreated: string[] = [];
    const artifactsModified: string[] = [];

    for (const surprise of surprises) {
      if (artifactsCreated.length >= this.config.maxArtifactsPerCycle) break;

      // Convert high-magnitude surprises to curriculum items
      if (this.config.surprisesToCurriculum && surprise.magnitude >= this.config.surpriseCurriculumThreshold) {
        // In a full implementation, this would create curriculum items
        // For now, create a belief artifact representing the surprise
        const artifact = this.surpriseToArtifact(surprise);
        if (artifact) {
          artifactsCreated.push(artifact.id);
        }
      }

      // For contradictions, create countermodel artifacts
      if (surprise.type === 'contradiction') {
        const artifact = this.contradictionToArtifact(surprise);
        if (artifact) {
          artifactsCreated.push(artifact.id);
        }
      }
    }

    const now = this.clock.now();
    const event: LearningEvent = {
      id: `learn-${now}-${this.rng.next().toString(36).slice(2, 8)}`,
      source: 'surprise',
      sourceId: surprises.map(s => s.id).join(','),
      artifactsCreated,
      artifactsModified,
      timestamp: now,
      metadata: { surpriseCount: surprises.length },
    };

    this.events.push(event);
    return event;
  }

  /** Learn from curriculum completion. */
  learnFromCurriculum(
    curriculumItems: { term: Term; truth: TruthValue; kind: ArtifactKind }[]
  ): LearningEvent {
    const artifactsCreated: string[] = [];

    for (const item of curriculumItems) {
      if (artifactsCreated.length >= this.config.maxArtifactsPerCycle) break;

      const artifact = this.artifactFactory.create({
        kind: item.kind,
        term: item.term,
        truth: item.truth,
        tags: ['curriculum'],
        source: 'curriculum',
      });

      artifactsCreated.push(artifact.id);
    }

    const now = this.clock.now();
    const event: LearningEvent = {
      id: `learn-${now}-${this.rng.next().toString(36).slice(2, 8)}`,
      source: 'curriculum',
      sourceId: curriculumItems.map((_, i) => i.toString()).join(','),
      artifactsCreated,
      artifactsModified: [],
      timestamp: now,
      metadata: { itemCount: curriculumItems.length },
    };

    this.events.push(event);
    return event;
  }

  /** Convert schema to artifact. */
  private schemaToArtifact(schema: MinedSchema): Artifact | null {
    if (schema.examples.length === 0) return null;

    // Use first example as representative
    const example = schema.examples[0]!;
    const term = schema.terms[0]!;
    const truth = example.truths[0] ?? { f: schema.confidence, c: schema.confidence };

    return this.artifactFactory.create({
      kind: 'rule',
      term,
      truth,
      tags: ['mined', schema.type, ...Object.keys(schema.metadata)],
      source: 'schema',
      metadata: { schemaId: schema.id, support: schema.support },
    });
  }

  /** Convert surprise to artifact. */
  private surpriseToArtifact(surprise: SurpriseEvent): Artifact | null {
    return this.artifactFactory.create({
      kind: 'belief',
      term: surprise.term,
      truth: surprise.actual,
      tags: ['surprise', surprise.type, surprise.source],
      source: 'surprise',
      metadata: { surpriseId: surprise.id, magnitude: surprise.magnitude },
    });
  }

  /** Convert contradiction to artifact. */
  private contradictionToArtifact(surprise: SurpriseEvent): Artifact | null {
    // Create a belief with negated frequency
    return this.artifactFactory.create({
      kind: 'belief',
      term: surprise.term,
      truth: { f: 1 - surprise.actual.f, c: surprise.actual.c },
      tags: ['countermodel', 'contradiction', surprise.source],
      source: 'surprise',
      metadata: { surpriseId: surprise.id, originalTruth: surprise.actual },
    });
  }

  /** Get learning events. */
  getEvents(): LearningEvent[] {
    return [...this.events];
  }

  /** Get events by source. */
  getEventsBySource(source: LearningEvent['source']): LearningEvent[] {
    return this.events.filter(e => e.source === source);
  }
}

/** Artifact factory for creating artifacts. */
export interface ArtifactFactory {
  create(params: {
    kind: ArtifactKind;
    term: Term;
    truth: TruthValue;
    tags?: string[];
    source?: string;
    metadata?: Record<string, unknown>;
  }): Artifact;
}

/** Create artifact factory. */
export function createArtifactFactory(clock?: Clock, rng?: RNG): ArtifactFactory {
  let counter = 0;
  const clk = clock ?? { now: () => Date.now() as TimestampMs };
  const rand = rng ?? { next: () => Math.random(), nextInt: (max: number) => Math.floor(Math.random() * max), nextBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)), setSeed: () => {}, getSeed: () => 0 };

  return {
    create(params) {
      const id = `artifact-${clk.now()}-${rand.next().toString(36).slice(2, 8)}`;
      const now = clk.now();
      return {
        id,
        kind: params.kind,
        status: 'candidate',
        term: params.term,
        truth: params.truth,
        createdAt: now,
        modifiedAt: now,
        events: [],
        dependencies: [],
        tags: params.tags ?? [],
        metrics: {
          usageCount: 0,
          successRate: 1.0,
          avgUtility: 0,
          lastUsed: now,
          confidenceTrend: 0,
        },
      } as Artifact;
    },
  };
}

/** Create a learner. */
export function createLearner(config?: LearningConfig, factory?: ArtifactFactory, clock?: Clock, rng?: RNG): Learner {
  return new Learner(config, factory, clock, rng);
}