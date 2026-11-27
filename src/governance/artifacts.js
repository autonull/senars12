/**
 * Governance-Owned Artifacts & Mission Overlays
 *
 * Governance-owned artifacts are unwritable by the agent *by construction* —
 * the type system enforces this. Mission overlays admit scoped, expiring
 * weight deltas with provenance.
 */
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { uuid, timestamp, positiveInt, unitInterval } from '../config';
import { FunctionRegistry } from '../util/registry';
import { SenarsError } from '../errors/senars-error';
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
];
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
/** Artifact registry — only governance can register/modify. */
export class GovernanceArtifactRegistry extends FunctionRegistry {
    constructor() {
        super((artifact) => artifact.artifactId);
    }
    /** Register a new artifact (governance only). */
    register(artifact) {
        if (!artifact.immutableByAgent) {
            throw new SenarsError('Governance artifacts must be immutable by agent', 'POLICY_VIOLATION');
        }
        super.register(artifact);
    }
    /** Get an artifact by ID. */
    get(artifactId) {
        return super.get(artifactId);
    }
    /** Get all artifacts of a kind. */
    getByKind(kind) {
        return this.getAll().filter((a) => a.kind === kind);
    }
    /** Update an artifact (governance only — creates new version). */
    update(artifactId, content, updatedBy, derivationChain) {
        const existing = this.get(artifactId);
        if (!existing) {
            throw new SenarsError(`Artifact ${artifactId} not found`, 'OPERATION_ERROR', { artifactId });
        }
        const updated = {
            ...existing,
            content,
            version: existing.version + 1,
            createdAt: Date.now(),
            createdBy: updatedBy,
            contentHash: this.hashContent(content),
            derivationChain: derivationChain ? [...existing.derivationChain ?? [], ...derivationChain] : existing.derivationChain,
        };
        // Need to delete and re-register to update in FunctionRegistry
        this.delete(artifactId);
        super.register(updated);
        return updated;
    }
    /** List all artifacts. */
    list() {
        return this.getAll();
    }
    hashContent(content) {
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
        confidence: unitInterval,
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
/** Mission overlay registry — manages scoped, expiring weight deltas. */
export class MissionOverlayRegistry extends FunctionRegistry {
    constructor() {
        super((overlay) => overlay.overlayId);
    }
    /** Register a new mission overlay. */
    register(overlay) {
        super.register(overlay);
    }
    /** Get an overlay by ID. */
    get(overlayId) {
        return super.get(overlayId);
    }
    /** Get all active overlays for a mission. */
    getActiveForMission(missionId) {
        const now = Date.now();
        return this.getAll().filter((o) => o.missionId === missionId && o.active && o.expiresAt > now);
    }
    /** Get all overlays affecting a target. */
    getForTarget(target) {
        const now = Date.now();
        return this.getAll().filter((o) => o.target === target && o.active && o.expiresAt > now);
    }
    /** Get the total delta for a target (sum of active overlays). */
    getTotalDelta(target, context) {
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
    pruneExpired() {
        const now = Date.now();
        let pruned = 0;
        for (const overlay of this.getAll()) {
            if (overlay.expiresAt <= now && overlay.active) {
                // Update the overlay in place by re-registering
                this.delete(overlay.overlayId);
                this.register({ ...overlay, active: false });
                pruned++;
            }
        }
        return pruned;
    }
    /** Deactivate an overlay by ID. */
    deactivate(overlayId) {
        const overlay = this.get(overlayId);
        if (!overlay)
            return false;
        this.delete(overlayId);
        this.register({ ...overlay, active: false });
        return true;
    }
    /** List all overlays. */
    list() {
        return this.getAll();
    }
}
/** Global mission overlay registry. */
export const missionOverlayRegistry = new MissionOverlayRegistry();
/** Create a mission overlay with standard defaults. */
export const createMissionOverlay = (missionId, target, delta, provenance, expiresInMs = 3600_000, // 1 hour default
scope) => ({
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
