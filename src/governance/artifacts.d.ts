/**
 * Governance-Owned Artifacts & Mission Overlays
 *
 * Governance-owned artifacts are unwritable by the agent *by construction* —
 * the type system enforces this. Mission overlays admit scoped, expiring
 * weight deltas with provenance.
 */
import { z } from 'zod';
import { FunctionRegistry } from '../util/registry';
/** Artifact kinds that can be governance-owned. */
export declare const GOVERNANCE_ARTIFACT_KINDS: readonly ['policy', 'approval-logic', 'sandbox-config', 'reward-functions', 'autonomy-mode', 'kernel-gates', 'capability-registry', 'risk-thresholds'];
export type GovernanceArtifactKind = (typeof GOVERNANCE_ARTIFACT_KINDS)[number];
/** A governance-owned artifact — cannot be written by the agent directly. */
export declare const GovernanceArtifactSchema: z.ZodObject<{
    artifactId: z.ZodUUID;
    kind: z.ZodEnum<{
        "approval-logic": "approval-logic";
        "autonomy-mode": "autonomy-mode";
        "capability-registry": "capability-registry";
        "kernel-gates": "kernel-gates";
        policy: "policy";
        "reward-functions": "reward-functions";
        "risk-thresholds": "risk-thresholds";
        "sandbox-config": "sandbox-config";
    }>;
    content: z.ZodUnknown;
    version: z.ZodNumber;
    createdAt: z.ZodNumber;
    createdBy: z.ZodEnum<{
        bootstrap: "bootstrap";
        "governance-runner": "governance-runner";
        "human-governor": "human-governor";
    }>;
    immutableByAgent: z.ZodLiteral<true>;
    contentHash: z.ZodString;
    derivationChain: z.ZodOptional<z.ZodArray<z.ZodUUID>>;
}, z.core.$strip>;
export type GovernanceArtifact = z.infer<typeof GovernanceArtifactSchema>;
/** Artifact registry — only governance can register/modify. */
export declare class GovernanceArtifactRegistry extends FunctionRegistry<string, GovernanceArtifact> {
    constructor();
    /** Register a new artifact (governance only). */
    register(artifact: GovernanceArtifact): void;
    /** Get an artifact by ID. */
    get(artifactId: string): GovernanceArtifact | undefined;
    /** Get all artifacts of a kind. */
    getByKind(kind: GovernanceArtifactKind): GovernanceArtifact[];
    /** Update an artifact (governance only — creates new version). */
    update(artifactId: string, content: unknown, updatedBy: GovernanceArtifact['createdBy'], derivationChain?: readonly string[]): GovernanceArtifact;
    /** List all artifacts. */
    list(): GovernanceArtifact[];
    private hashContent;
}
/** Global governance artifact registry. */
export declare const governanceArtifactRegistry: GovernanceArtifactRegistry;
/** Mission overlay — scoped, expiring weight delta with provenance. */
export declare const MissionOverlaySchema: z.ZodObject<{
    overlayId: z.ZodUUID;
    missionId: z.ZodUUID;
    target: z.ZodString;
    delta: z.ZodNumber;
    provenance: z.ZodObject<{
        source: z.ZodEnum<{
            "external-governance": "external-governance";
            "human-mission": "human-mission";
            "learned-policy": "learned-policy";
            "self-meta-game": "self-meta-game";
        }>;
        derivationIds: z.ZodOptional<z.ZodArray<z.ZodUUID>>;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
    scope: z.ZodOptional<z.ZodObject<{
        focusIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        componentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    expiresAt: z.ZodNumber;
    active: z.ZodBoolean;
    createdAt: z.ZodNumber;
}, z.core.$strip>;
export type MissionOverlay = z.infer<typeof MissionOverlaySchema>;
/** Mission overlay registry — manages scoped, expiring weight deltas. */
export declare class MissionOverlayRegistry extends FunctionRegistry<string, MissionOverlay> {
    constructor();
    /** Register a new mission overlay. */
    register(overlay: MissionOverlay): void;
    /** Get an overlay by ID. */
    get(overlayId: string): MissionOverlay | undefined;
    /** Get all active overlays for a mission. */
    getActiveForMission(missionId: string): MissionOverlay[];
    /** Get all overlays affecting a target. */
    getForTarget(target: string): MissionOverlay[];
    /** Get the total delta for a target (sum of active overlays). */
    getTotalDelta(target: string, context?: {
        focusId?: string;
        componentId?: string;
    }): number;
    /** Deactivate expired overlays. */
    pruneExpired(): number;
    /** Deactivate an overlay by ID. */
    deactivate(overlayId: string): boolean;
    /** List all overlays. */
    list(): MissionOverlay[];
}
/** Global mission overlay registry. */
export declare const missionOverlayRegistry: MissionOverlayRegistry;
/** Create a mission overlay with standard defaults. */
export declare const createMissionOverlay: (missionId: string, target: string, delta: number, provenance: MissionOverlay['provenance'], expiresInMs?: number, // 1 hour default
scope?: MissionOverlay['scope']) => MissionOverlay;
//# sourceMappingURL=artifacts.d.ts.map