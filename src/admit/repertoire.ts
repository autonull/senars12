/**
 * Repertoire — artifact lifecycle for beliefs, skills, faculties, and rules.
 *
 * The repertoire is the single source of truth for all admitted artifacts.
 * Every admit/demote/retire is an event; rollback is one event.
 */

import type { Term } from '../kernel/terms/term.js';
import type { TruthValue } from '../kernel/truth.js';
import type { Stamp } from '../kernel/types.js';

/** Artifact kinds. */
export const ARTIFACT_KINDS = [
  'belief',
  'skill',
  'faculty',
  'rule',
  'plan',
  'concept',
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Artifact status. */
export const ARTIFACT_STATUS = [
  'candidate',
  'admitted',
  'demoted',
  'retired',
  'quarantined',
] as const;

export type ArtifactStatus = (typeof ARTIFACT_STATUS)[number];

/** Admission event. */
export const ADMISSION_EVENTS = [
  'admit',
  'demote',
  'retire',
  'rollback',
  'quarantine',
  'promote',
] as const;

export type AdmissionEventType = (typeof ADMISSION_EVENTS)[number];

/** Admission event record. */
export interface AdmissionEvent {
  /** Event type. */
  type: AdmissionEventType;
  /** Artifact ID. */
  artifactId: string;
  /** Timestamp. */
  timestamp: number;
  /** Reason. */
  reason: string;
  /** Actor (agent/external). */
  actor: string;
  /** Previous status. */
  previousStatus: ArtifactStatus;
  /** New status. */
  newStatus: ArtifactStatus;
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** Artifact in the repertoire. */
export interface Artifact {
  /** Unique artifact ID. */
  id: string;
  /** Artifact kind. */
  kind: ArtifactKind;
  /** Current status. */
  status: ArtifactStatus;
  /** Term representation. */
  term: Term;
  /** Truth value. */
  truth: TruthValue;
  /** Stamp for provenance. */
  stamp?: Stamp;
  /** Creation timestamp. */
  createdAt: number;
  /** Last modified timestamp. */
  modifiedAt: number;
  /** Admission events history. */
  events: AdmissionEvent[];
  /** Dependencies (artifact IDs). */
  dependencies: string[];
  /** Tags for categorization. */
  tags: string[];
  /** Metrics. */
  metrics: ArtifactMetrics;
}

/** Artifact metrics. */
export interface ArtifactMetrics {
  /** Usage count. */
  usageCount: number;
  /** Success rate. */
  successRate: number;
  /** Average utility. */
  avgUtility: number;
  /** Last used timestamp. */
  lastUsed: number;
  /** Confidence trend. */
  confidenceTrend: number;
}

/** Repertoire configuration. */
export interface RepertoireConfig {
  /** Maximum artifacts per kind. */
  maxPerKind: Partial<Record<ArtifactKind, number>>;
  /** Auto-demote threshold (success rate). */
  demoteThreshold: number;
  /** Auto-retire threshold (usage). */
  retireThreshold: number;
  /** Quarantine on contradiction. */
  quarantineOnContradiction: boolean;
  /** Rollback enabled. */
  rollbackEnabled: boolean;
}

/** Default repertoire config. */
export const defaultRepertoireConfig: RepertoireConfig = {
  maxPerKind: {
    belief: 10000,
    skill: 1000,
    faculty: 100,
    rule: 5000,
    plan: 500,
    concept: 5000,
  },
  demoteThreshold: 0.3,
  retireThreshold: 100,
  quarantineOnContradiction: true,
  rollbackEnabled: true,
};

/** Repertoire — the artifact registry. */
export class Repertoire {
  private artifacts: Map<string, Artifact> = new Map();
  private byKind: Map<ArtifactKind, Set<string>> = new Map();
  private byStatus: Map<ArtifactStatus, Set<string>> = new Map();
  private events: AdmissionEvent[] = [];
  private config: RepertoireConfig;

  constructor(config: RepertoireConfig = defaultRepertoireConfig) {
    this.config = config;
    for (const kind of ARTIFACT_KINDS) {
      this.byKind.set(kind, new Set());
    }
    for (const status of ARTIFACT_STATUS) {
      this.byStatus.set(status, new Set());
    }
  }

  /** Get current config. */
  getConfig(): RepertoireConfig {
    return { ...this.config };
  }

  /** Update config. */
  setConfig(config: Partial<RepertoireConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Admit a new artifact. */
  admit(
    id: string,
    kind: ArtifactKind,
    term: Term,
    truth: TruthValue,
    stamp: Stamp | undefined,
    tags: string[] = [],
    dependencies: string[] = [],
    actor = 'system'
  ): Artifact {
    // Check capacity
    const kindSet = this.byKind.get(kind)!;
    const maxPerKind = this.config.maxPerKind[kind] ?? 1000;
    if (kindSet.size >= maxPerKind) {
      throw new Error(`Capacity exceeded for kind: ${kind}`);
    }

    const now = Date.now();
    const artifact: Artifact = {
      id,
      kind,
      status: 'admitted',
      term,
      truth,
      stamp,
      createdAt: now,
      modifiedAt: now,
      events: [],
      dependencies,
      tags,
      metrics: {
        usageCount: 0,
        successRate: 1.0,
        avgUtility: 0,
        lastUsed: now,
        confidenceTrend: 0,
      },
    };

    // Record admission event
    const event: AdmissionEvent = {
      type: 'admit',
      artifactId: id,
      timestamp: now,
      reason: 'Initial admission',
      actor,
      previousStatus: 'candidate',
      newStatus: 'admitted',
      metadata: { kind, tags },
    };

    artifact.events.push(event);
    this.events.push(event);

    // Index
    this.artifacts.set(id, artifact);
    kindSet.add(id);
    this.byStatus.get('admitted')!.add(id);

    return artifact;
  }

  /** Demote an artifact. */
  demote(id: string, reason: string, actor = 'system'): Artifact | null {
    const artifact = this.artifacts.get(id);
    if (!artifact || artifact.status !== 'admitted') {
      return null;
    }

    const now = Date.now();
    const event: AdmissionEvent = {
      type: 'demote',
      artifactId: id,
      timestamp: now,
      reason,
      actor,
      previousStatus: artifact.status,
      newStatus: 'demoted',
      metadata: {},
    };

    artifact.status = 'demoted';
    artifact.modifiedAt = now;
    artifact.events.push(event);
    this.events.push(event);

    this.byStatus.get('admitted')!.delete(id);
    this.byStatus.get('demoted')!.add(id);

    return artifact;
  }

  /** Retire an artifact. */
  retire(id: string, reason: string, actor = 'system'): Artifact | null {
    const artifact = this.artifacts.get(id);
    if (!artifact || artifact.status === 'retired') {
      return null;
    }

    const now = Date.now();
    const event: AdmissionEvent = {
      type: 'retire',
      artifactId: id,
      timestamp: now,
      reason,
      actor,
      previousStatus: artifact.status,
      newStatus: 'retired',
      metadata: {},
    };

    artifact.status = 'retired';
    artifact.modifiedAt = now;
    artifact.events.push(event);
    this.events.push(event);

    this.byStatus.get(artifact.status)!.delete(id);
    this.byStatus.get('retired')!.add(id);

    return artifact;
  }

  /** Rollback last admission event. */
  rollback(id: string, actor = 'system'): Artifact | null {
    if (!this.config.rollbackEnabled) {
      throw new Error('Rollback disabled');
    }

    const artifact = this.artifacts.get(id);
    if (!artifact || artifact.events.length === 0) {
      return null;
    }

    const lastEvent = artifact.events[artifact.events.length - 1]!;
    if (lastEvent.type === 'admit') {
      // Full removal
      return this.remove(id, actor);
    }

    // Revert to previous status
    const now = Date.now();
    const event: AdmissionEvent = {
      type: 'rollback',
      artifactId: id,
      timestamp: now,
      reason: `Rollback: ${lastEvent.reason}`,
      actor,
      previousStatus: artifact.status,
      newStatus: lastEvent.previousStatus,
      metadata: { rolledBackEvent: lastEvent.type },
    };

    artifact.status = lastEvent.previousStatus;
    artifact.modifiedAt = now;
    artifact.events.push(event);
    this.events.push(event);

    this.byStatus.get(lastEvent.newStatus)!.delete(id);
    this.byStatus.get(lastEvent.previousStatus)!.add(id);

    return artifact;
  }

  /** Remove artifact completely. */
  remove(id: string, actor = 'system'): Artifact | null {
    const artifact = this.artifacts.get(id);
    if (!artifact) {
      return null;
    }

    const now = Date.now();
    const event: AdmissionEvent = {
      type: 'retire',
      artifactId: id,
      timestamp: now,
      reason: 'Removed',
      actor,
      previousStatus: artifact.status,
      newStatus: 'retired',
      metadata: { removed: true },
    };

    this.events.push(event);
    this.artifacts.delete(id);
    this.byKind.get(artifact.kind)!.delete(id);
    this.byStatus.get(artifact.status)!.delete(id);

    return artifact;
  }

  /** Quarantine an artifact. */
  quarantine(id: string, reason: string, actor = 'system'): Artifact | null {
    const artifact = this.artifacts.get(id);
    if (!artifact || artifact.status === 'quarantined') {
      return null;
    }

    const now = Date.now();
    const event: AdmissionEvent = {
      type: 'quarantine',
      artifactId: id,
      timestamp: now,
      reason,
      actor,
      previousStatus: artifact.status,
      newStatus: 'quarantined',
      metadata: {},
    };

    artifact.status = 'quarantined';
    artifact.modifiedAt = now;
    artifact.events.push(event);
    this.events.push(event);

    this.byStatus.get(artifact.status)!.delete(id);
    this.byStatus.get('quarantined')!.add(id);

    return artifact;
  }

  /** Promote from demoted/quarantined to admitted. */
  promote(id: string, reason: string, actor = 'system'): Artifact | null {
    const artifact = this.artifacts.get(id);
    if (!artifact || (artifact.status !== 'demoted' && artifact.status !== 'quarantined')) {
      return null;
    }

    const now = Date.now();
    const event: AdmissionEvent = {
      type: 'promote',
      artifactId: id,
      timestamp: now,
      reason,
      actor,
      previousStatus: artifact.status,
      newStatus: 'admitted',
      metadata: {},
    };

    artifact.status = 'admitted';
    artifact.modifiedAt = now;
    artifact.events.push(event);
    this.events.push(event);

    this.byStatus.get(artifact.status)!.delete(id);
    this.byStatus.get('admitted')!.add(id);

    return artifact;
  }

  /** Get artifact by ID. */
  get(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  /** Check if artifact exists. */
  has(id: string): boolean {
    return this.artifacts.has(id);
  }

  /** Get artifacts by kind. */
  getByKind(kind: ArtifactKind): Artifact[] {
    const ids = this.byKind.get(kind);
    if (!ids) return [];
    return Array.from(ids).map(id => this.artifacts.get(id)!).filter(Boolean);
  }

  /** Get artifacts by status. */
  getByStatus(status: ArtifactStatus): Artifact[] {
    const ids = this.byStatus.get(status);
    if (!ids) return [];
    return Array.from(ids).map(id => this.artifacts.get(id)!).filter(Boolean);
  }

  /** Get all artifacts. */
  getAll(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  /** Get admission events. */
  getEvents(artifactId?: string): AdmissionEvent[] {
    if (artifactId) {
      return this.events.filter(e => e.artifactId === artifactId);
    }
    return [...this.events];
  }

  /** Record usage. */
  recordUsage(id: string, success: boolean, utility: number): void {
    const artifact = this.artifacts.get(id);
    if (!artifact) return;

    artifact.metrics.usageCount++;
    artifact.metrics.lastUsed = Date.now();
    artifact.metrics.avgUtility =
      (artifact.metrics.avgUtility * (artifact.metrics.usageCount - 1) + utility) /
      artifact.metrics.usageCount;
    artifact.metrics.successRate =
      (artifact.metrics.successRate * (artifact.metrics.usageCount - 1) + (success ? 1 : 0)) /
      artifact.metrics.usageCount;
    artifact.metrics.confidenceTrend = artifact.truth.c - artifact.metrics.successRate;
  }

  /** Auto-maintenance: demote/retire based on thresholds. */
  maintain(): { demoted: string[]; retired: string[] } {
    const demoted: string[] = [];
    const retired: string[] = [];

    for (const artifact of this.artifacts.values()) {
      if (artifact.status !== 'admitted') continue;

      // Demote if success rate too low
      if (artifact.metrics.successRate < this.config.demoteThreshold) {
        this.demote(artifact.id, `Success rate ${artifact.metrics.successRate} below threshold ${this.config.demoteThreshold}`);
        demoted.push(artifact.id);
      }

      // Retire if usage too low
      if (artifact.metrics.usageCount < this.config.retireThreshold) {
        this.retire(artifact.id, `Usage count ${artifact.metrics.usageCount} below threshold ${this.config.retireThreshold}`);
        retired.push(artifact.id);
      }
    }

    return { demoted, retired };
  }

  /** Get statistics. */
  getStats(): RepertoireStats {
    const stats: RepertoireStats = {
      total: this.artifacts.size,
      byKind: {} as Record<ArtifactKind, number>,
      byStatus: {} as Record<ArtifactStatus, number>,
      events: this.events.length,
    };

    for (const kind of ARTIFACT_KINDS) {
      stats.byKind[kind] = this.byKind.get(kind)?.size ?? 0;
    }
    for (const status of ARTIFACT_STATUS) {
      stats.byStatus[status] = this.byStatus.get(status)?.size ?? 0;
    }

    return stats;
  }
}

/** Repertoire statistics. */
export interface RepertoireStats {
  total: number;
  byKind: Record<ArtifactKind, number>;
  byStatus: Record<ArtifactStatus, number>;
  events: number;
}

/** Create a repertoire instance. */
export function createRepertoire(config?: RepertoireConfig): Repertoire {
  return new Repertoire(config);
}