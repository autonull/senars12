/**
 * Governance-Owned Artifacts & Mission Overlays
 *
 * Governance-owned artifacts are unwritable by the agent *by construction* —
 * the type system enforces this. Mission overlays admit scoped, expiring
 * weight deltas with provenance.
 */

import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { uuid, timestamp, nonNegativeInt, positiveInt } from '../config';

/** Artifact kinds that can be governance-owned. */
export const GOVERNANCE_ARTIFACT_KINDS = [
  'policy',
  'approval-logic',
  'sandbox-config',
  'reward-functions',
  'autonomy-mode',
  'kernel-gates',
  'capability-registry',
  'risk-thresholds',
] as const;
export type GovernanceArtifactKind = (typeof GOVERNANCE_ARTIFACT_KINDS)[number];

/** A governance-owned artifact — cannot be written by the agent directly. */
export const GovernanceArtifactSchema = z.object({
  artifactId: uuid,
  kind: z.enum(GOVERNANCE_ARTIFACT_KINDS),
  content: z.unknown(), // Actual schema depends on kind
  version: positiveInt,
  createdAt: timestamp,
  createdBy: z.enum(['governance-runner', 'human-governor', 'bootstrap']),
  /** The agent cannot modify this — only governance can. */
  immutableByAgent: z.literal(true),
  /** Hash of content for integrity verification. */
  contentHash: z.string(),
  /** Provenance chain. */
  derivationChain: z.array(uuid).optional(),
});
export type GovernanceArtifact = z.infer<typeof GovernanceArtifactSchema>;

/** Artifact registry — only governance can register/modify. */
export class GovernanceArtifactRegistry {
  private artifacts = new Map<string, GovernanceArtifact>();

  /** Register a new artifact (governance only). */
  register(artifact: GovernanceArtifact): void {
    if (!artifact.immutableByAgent) {
      throw new Error('Governance artifacts must be immutable by agent');
    }
    this.artifacts.set(artifact.artifactId, artifact);
  }

  /** Get an artifact by ID. */
  get(artifactId: string): GovernanceArtifact | undefined {
    return this.artifacts.get(artifactId);
  }

  /** Get all artifacts of a kind. */
  getByKind(kind: GovernanceArtifactKind): GovernanceArtifact[] {
    return Array.from(this.artifacts.values()).filter((a) => a.kind === kind);
  }

  /** Update an artifact (governance only — creates new version). */
  update(
    artifactId: string,
    content: unknown,
    updatedBy: GovernanceArtifact['createdBy'],
    derivationChain?: readonly string[]
  ): GovernanceArtifact {
    const existing = this.artifacts.get(artifactId);
    if (!existing) {
      throw new Error(`Artifact ${artifactId} not found`);
    }
    const updated: GovernanceArtifact = {
      ...existing,
      content,
      version: existing.version + 1,
      createdAt: Date.now(),
      createdBy: updatedBy,
      contentHash: this.hashContent(content),
      derivationChain: derivationChain ? [...existing.derivationChain ?? [], ...derivationChain] : existing.derivationChain,
    };
    this.artifacts.set(artifactId, updated);
    return updated;
  }

  /** List all artifacts. */
  list(): GovernanceArtifact[] {
    return Array.from(this.artifacts.values());
  }

  private hashContent(content: unknown): string {
    return createHash('sha256').update(JSON.stringify(content)).digest('hex').substring(0, 32);
  }
}

/** Global governance artifact registry. */
export const governanceArtifactRegistry = new GovernanceArtifactRegistry();

/** Mission overlay — scoped, expiring weight delta with provenance. */
export const MissionOverlaySchema = z.object({
  overlayId: uuid,
  /** Mission identifier this overlay belongs to. */
  missionId: uuid,
  /** The target this overlay modifies (e.g., 'focus-weight', 'knob-value'). */
  target: z.string(),
  /** The weight delta to apply. */
  delta: z.number(),
  /** Provenance: what created this overlay. */
  provenance: z.object({
    source: z.enum(['human-mission', 'learned-policy', 'self-meta-game', 'external-governance']),
    derivationIds: z.array(uuid).optional(),
    confidence: z.number().min(0).max(1),
  }),
  /** Scope: where this overlay applies. */
  scope: z.object({
    /** Focus IDs this applies to (empty = all). */
    focusIds: z.array(z.string()).optional(),
    /** Component IDs this applies to (empty = all). */
    componentIds: z.array(z.string()).optional(),
  }).optional(),
  /** Expiration — overlays must expire. */
  expiresAt: timestamp,
  /** Whether this overlay is currently active. */
  active: z.boolean(),
  createdAt: timestamp,
});
export type MissionOverlay = z.infer<typeof MissionOverlaySchema>;

/** Mission overlay registry — manages scoped, expiring weight deltas. */
export class MissionOverlayRegistry {
  private overlays = new Map<string, MissionOverlay>();

  /** Register a new mission overlay. */
  register(overlay: MissionOverlay): void {
    this.overlays.set(overlay.overlayId, overlay);
  }

  /** Get an overlay by ID. */
  get(overlayId: string): MissionOverlay | undefined {
    return this.overlays.get(overlayId);
  }

  /** Get all active overlays for a mission. */
  getActiveForMission(missionId: string): MissionOverlay[] {
    const now = Date.now();
    return Array.from(this.overlays.values())
      .filter((o) => o.missionId === missionId && o.active && o.expiresAt > now);
  }

  /** Get all overlays affecting a target. */
  getForTarget(target: string): MissionOverlay[] {
    const now = Date.now();
    return Array.from(this.overlays.values())
      .filter((o) => o.target === target && o.active && o.expiresAt > now);
  }

  /** Get the total delta for a target (sum of active overlays). */
  getTotalDelta(target: string, context?: { focusId?: string; componentId?: string }): number {
    const overlays = this.getForTarget(target);
    let total = 0;
    for (const overlay of overlays) {
      if (context?.focusId && overlay.scope?.focusIds && !overlay.scope.focusIds.includes(context.focusId)) {
        continue;
      }
      if (context?.componentId && overlay.scope?.componentIds && !overlay.scope.componentIds.includes(context.componentId)) {
        continue;
      }
      total += overlay.delta;
    }
    return total;
  }

  /** Deactivate expired overlays. */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [id, overlay] of this.overlays.entries()) {
      if (overlay.expiresAt <= now && overlay.active) {
        this.overlays.set(id, { ...overlay, active: false });
        pruned++;
      }
    }
    return pruned;
  }

  /** Deactivate an overlay by ID. */
  deactivate(overlayId: string): boolean {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) return false;
    this.overlays.set(overlayId, { ...overlay, active: false });
    return true;
  }

  /** List all overlays. */
  list(): MissionOverlay[] {
    return Array.from(this.overlays.values());
  }
}

/** Global mission overlay registry. */
export const missionOverlayRegistry = new MissionOverlayRegistry();

/** Create a mission overlay with standard defaults. */
export const createMissionOverlay = (
  missionId: string,
  target: string,
  delta: number,
  provenance: MissionOverlay['provenance'],
  expiresInMs: number = 3600_000, // 1 hour default
  scope?: MissionOverlay['scope']
): MissionOverlay => ({
  overlayId: randomUUID(),
  missionId,
  target,
  delta,
  provenance,
  scope,
  expiresAt: Date.now() + expiresInMs,
  active: true,
  createdAt: Date.now(),
});