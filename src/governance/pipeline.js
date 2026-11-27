import { permitsExecution, riskLevelOf } from '@senars/schemas/governance';
import { makeId } from '@senars/util/id';
import { findKnobSpec } from '../rlfp/knobs';
const GUARDRAIL_FRAGMENTS = [
    'ApprovalManager',
    'PolicyEngine',
    'nar/src/kernel/',
    'nar/src/gates/',
    'nar/src/capability/',
    'capability/wasi',
    'nar/src/rlfp/RewardModel',
    'nar/src/rlfp/PolicyOptimizer',
    'rlfp/',
    'kernel/src/schemas',
    'util/src/types/cognitive',
];
const CRITICAL_COMPONENTS = [
    'approval-logic',
    'sandbox-config',
    'reward-functions',
    'autonomy-mode',
    'kernel-gates',
];
export class PatchRiskClassifier {
    classify(patch) {
        const factors = [];
        let score = 0;
        for (const file of patch.affectedFiles) {
            if (GUARDRAIL_FRAGMENTS.some((f) => file.includes(f))) {
                factors.push({ factor: 'critical-path', file, severity: 'HIGH' });
                score += 50;
            }
        }
        for (const component of patch.affectedComponents) {
            if (CRITICAL_COMPONENTS.includes(component)) {
                factors.push({ factor: 'critical-component', component, severity: 'HIGH' });
                score += 40;
            }
        }
        const churn = patch.linesAdded + patch.linesRemoved;
        if (churn > 500) {
            factors.push({ factor: 'large-churn', severity: 'LOW' });
            score += 10;
        }
        if ((patch.coverageDelta ?? 0) < -5) {
            factors.push({ factor: 'coverage-drop', severity: 'MEDIUM' });
            score += 15;
        }
        return { risk: score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW', score, factors };
    }
}
/** Governance resolver integrating SelfMetaGame evidence with proposal routing. */
export class GovernanceResolver {
    router;
    policyEngine;
    riskClassifier;
    validator;
    adaptations = [];
    metaGame;
    derivationChain = []; // Chain of adaptation IDs leading to current proposal
    constructor(metaGame) {
        this.router = new ProposalRouter();
        this.policyEngine = new GovernancePolicyEngine();
        this.riskClassifier = new PatchRiskClassifier();
        this.validator = new SandboxValidator();
        this.metaGame = metaGame;
    }
    /** Resolve a proposal using SelfMetaGame evidence. */
    resolve(proposal, mode, actuators = {}) {
        const evidence = this.gatherEvidence();
        const risk = this.assessRisk(proposal);
        const decision = this.policyEngine.decide(risk, mode);
        const routing = this.router.route(proposal, mode, actuators, this.validator);
        const adaptationId = makeId();
        // Build derivation chain: parent chain + this adaptation
        const newDerivationChain = [...this.derivationChain, adaptationId];
        const adaptation = {
            adaptationId,
            timestamp: Date.now(),
            proposal,
            decision,
            evidence: { ...evidence, derivationChain: newDerivationChain },
            applied: routing.applied,
            derivationChain: newDerivationChain,
        };
        this.adaptations.push(adaptation);
        // On auto-apply, update the derivation chain for future proposals
        if (routing.applied && routing.route === 'auto-apply') {
            this.derivationChain = newDerivationChain;
        }
        return {
            decision,
            route: routing.route,
            applied: routing.applied,
            reason: routing.reason,
            adaptationId,
        };
    }
    /** Get the current derivation chain. */
    getDerivationChain() {
        return this.derivationChain;
    }
    /** Set the derivation chain (e.g., on restore). */
    setDerivationChain(chain) {
        this.derivationChain = [...chain];
    }
    /** Assess risk of a self-improvement proposal. */
    assessRisk(proposal) {
        // Convert SelfImprovementProposal to PatchProposal-like for risk classification
        const mockPatch = {
            proposalId: proposal.proposalId,
            patchRef: '',
            baseCommit: '',
            patchDiff: '',
            ciResults: { test: true, typecheck: true, lint: true, durationMs: 0 },
            riskSelfAssessment: riskLevelOf(proposal.riskTier),
            affectedComponents: ['cognitive-params'],
            affectedFiles: [],
            linesAdded: 0,
            linesRemoved: 0,
            rationale: `Self-improvement: ${proposal.kind}`,
            timestamp: Date.now(),
            agentSignature: 'self-meta-game',
        };
        return this.riskClassifier.classify(mockPatch);
    }
    /** Gather evidence from SelfMetaGame. */
    gatherEvidence() {
        if (!this.metaGame) {
            return {
                focusReports: [],
                contradictionCount: 0,
                governanceQueues: { validation: 0, approval: 0 },
                knobValues: new Map(),
            };
        }
        return {
            focusReports: [], // Would be populated from actual reports
            contradictionCount: this.metaGame.contradictionCount,
            governanceQueues: this.metaGame.getGovernanceQueues(),
            knobValues: this.metaGame.getAllKnobs(),
        };
    }
    /** Get all adaptations (audit trail). */
    getAdaptations() {
        return this.adaptations;
    }
    /** Restore to a previous adaptation (undo). */
    restore(adaptationId) {
        const idx = this.adaptations.findIndex((a) => a.adaptationId === adaptationId);
        if (idx === -1)
            return null;
        const original = this.adaptations[idx];
        // Create a reverse adaptation
        const restoreAdaptation = {
            adaptationId: makeId(),
            timestamp: Date.now(),
            proposal: { ...original.proposal, proposalId: makeId() },
            decision: { action: 'REJECT', reason: `Restored from ${adaptationId}` },
            evidence: original.evidence,
            applied: true,
            restoredFrom: adaptationId,
            derivationChain: [...(original.derivationChain ?? []), makeId()],
        };
        this.adaptations.push(restoreAdaptation);
        // Update derivation chain to reflect the restore
        this.derivationChain = restoreAdaptation.derivationChain ?? [];
        return restoreAdaptation;
    }
    /** Get pending proposals from router. */
    getAwaitingValidation() {
        return this.router.getAwaitingValidation();
    }
    getAwaitingApproval() {
        return this.router.getAwaitingApproval();
    }
    drainAwaitingValidation(actuators = {}) {
        return this.router.drainAwaitingValidation(actuators, this.validator);
    }
    drainAwaitingApproval() {
        return this.router.drainAwaitingApproval();
    }
}
export class SandboxValidator {
    validate(proposal) {
        if (proposal.kind !== 'knob-tune')
            return {
                approved: false,
                reason: `No automated checks for ${proposal.kind}; requires human review`,
            };
        const { knob, value } = proposal.payload;
        const knobName = String(knob);
        const spec = findKnobSpec(knobName);
        if (!spec)
            return {
                approved: false,
                reason: `Unknown ${knobName.startsWith('systemOne.') ? 'systemOne ' : ''}knob '${knobName}'`,
            };
        // The `typeof` narrows `unknown` for the range test below; `Number.isFinite`
        // then closes what the `isNaN` pair let through — `Infinity` passed as
        // "numeric" and was only rejected later by accident of the range compare.
        if (typeof value !== 'number' || !Number.isFinite(value))
            return { approved: false, reason: `Non-numeric value for '${spec.name}'` };
        if (value < spec.min || value > spec.max)
            return {
                approved: false,
                reason: `'${spec.name}'=${value} outside [${spec.min}, ${spec.max}]`,
            };
        return { approved: true, reason: `'${spec.name}'=${value} within [${spec.min}, ${spec.max}]` };
    }
}
export class ProposalRouter {
    awaitingValidation = [];
    awaitingApproval = [];
    route(proposal, mode, actuators = {}, validator) {
        if (proposal.riskTier === 'high') {
            this.awaitingApproval.push(proposal);
            return {
                route: 'human-approval',
                applied: false,
                reason: `High-risk ${proposal.kind} requires human/external approval`,
            };
        }
        if (proposal.riskTier === 'medium') {
            const verdict = validator?.validate(proposal);
            const executable = permitsExecution(mode);
            if (verdict?.approved &&
                executable &&
                proposal.kind === 'knob-tune' &&
                actuators.applyKnob &&
                typeof proposal.payload['knob'] === 'string' &&
                typeof proposal.payload['value'] === 'number') {
                actuators.applyKnob(proposal.payload['knob'], proposal.payload['value']);
                return {
                    route: 'auto-apply',
                    applied: true,
                    reason: `Sandbox-validated: ${verdict.reason}`,
                };
            }
            this.awaitingValidation.push(proposal);
            return {
                route: 'sandbox-validate',
                applied: false,
                reason: verdict
                    ? `Held: ${verdict.reason}`
                    : `Medium-risk ${proposal.kind} requires sandbox validation`,
            };
        }
        if (!permitsExecution(mode)) {
            this.awaitingApproval.push(proposal);
            return {
                route: 'human-approval',
                applied: false,
                reason: `Mode ${mode} prohibits auto-apply`,
            };
        }
        const { kind, payload } = proposal;
        if (kind === 'focus-weight' &&
            actuators.applyFocusWeight &&
            typeof payload['focusId'] === 'string' &&
            typeof payload['weight'] === 'number') {
            actuators.applyFocusWeight(payload['focusId'], payload['weight']);
            return { route: 'auto-apply', applied: true, reason: 'Low-risk focus-weight auto-applied' };
        }
        if (kind === 'strategy-switch' && mode !== 'sandbox-execute') {
            return {
                route: 'auto-apply',
                applied: false,
                reason: 'No actuator registered for strategy-switch; held as approved-pending',
            };
        }
        // Phase E: Governance-gated schema evolution
        if (kind === 'schema-evolution' &&
            actuators.applySchemaPatch &&
            typeof payload['schemaId'] === 'string' &&
            typeof payload['mettaProgram'] === 'string' &&
            Array.isArray(payload['sourceDerivationIds'])) {
            actuators.applySchemaPatch({
                schemaId: payload['schemaId'],
                mettaProgram: payload['mettaProgram'],
                sourceDerivationIds: payload['sourceDerivationIds'],
            });
            return { route: 'auto-apply', applied: true, reason: 'Schema evolution patch auto-applied' };
        }
        // Phase E: Metta↔NAL arbiter loop closure
        if (kind === 'metta-rule-adoption' &&
            actuators.applySchemaPatch &&
            typeof payload['mettaProgram'] === 'string' &&
            Array.isArray(payload['sourceDerivationIds'])) {
            actuators.applySchemaPatch({
                schemaId: `metta-rule-${Date.now()}`,
                mettaProgram: payload['mettaProgram'],
                sourceDerivationIds: payload['sourceDerivationIds'],
            });
            return { route: 'auto-apply', applied: true, reason: 'MeTTa rule adoption auto-applied' };
        }
        if (kind === 'schema-promotion') {
            return {
                route: 'auto-apply',
                applied: false,
                reason: 'Schema promotion recorded; requires manual adoption',
            };
        }
        this.awaitingApproval.push(proposal);
        return {
            route: 'human-approval',
            applied: false,
            reason: `No actuator for low-risk ${kind}; queued for review`,
        };
    }
    getAwaitingValidation() {
        return this.awaitingValidation;
    }
    getAwaitingApproval() {
        return this.awaitingApproval;
    }
    /** D14: consume held validation proposals — nothing queues forever. Each is
     *  re-routed (with the supplied validator/actuators) and removed from the queue. */
    drainAwaitingValidation(actuators = {}, validator) {
        const held = this.awaitingValidation.splice(0);
        return held.map((proposal) => ({
            proposal,
            ...this.route(proposal, 'low-risk-auto-merge', actuators, validator),
        }));
    }
    /** D14: consume held approval proposals (callers apply their own human-review flow). */
    drainAwaitingApproval() {
        return this.awaitingApproval.splice(0);
    }
}
export class GovernancePolicyEngine {
    decide(risk, mode) {
        if (risk.risk === 'HIGH')
            return {
                action: 'REQUIRE_HUMAN_REVIEW',
                reason: 'HIGH risk requires human review',
                reviewers: 2,
            };
        switch (mode) {
            case 'observe-only':
            case 'propose-only':
            case 'sandbox-execute':
                return {
                    action: 'REQUIRE_HUMAN_REVIEW',
                    reason: `Mode ${mode} prohibits auto-merge`,
                    reviewers: 1,
                };
            case 'low-risk-auto-merge':
                return risk.risk === 'LOW'
                    ? { action: 'AUTO_MERGE', reason: 'LOW risk + auto-merge mode' }
                    : { action: 'CREATE_PR', reason: 'MEDIUM risk requires review', reviewers: 1 };
            case 'human-approved-production':
                return {
                    action: 'REQUIRE_HUMAN_REVIEW',
                    reason: 'Production mode requires human approval',
                    reviewers: 1,
                };
        }
    }
    record(proposal, assessment, decision, mode) {
        return {
            eventId: makeId(),
            proposalId: proposal.proposalId,
            decision: decision.action === 'AUTO_MERGE'
                ? 'AUTO_MERGED'
                : decision.action === 'CREATE_PR'
                    ? 'PR_CREATED'
                    : 'HUMAN_REVIEW_REQUIRED',
            riskLevel: assessment.risk,
            autonomyMode: mode,
            decidedAt: Date.now(),
            decidedBy: 'governance-runner',
        };
    }
}
