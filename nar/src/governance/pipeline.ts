import { v4 as uuidv4 } from 'uuid';
import type { AutonomyMode, GovernanceDecision, GovernanceEvent, PatchProposal, RiskAssessment, SelfImprovementProposal } from '@senars/kernel/schemas';
import { knobSchema } from '../rlfp/knobs.js';

const GUARDRAIL_FRAGMENTS = [
    'ApprovalManager', 'PolicyEngine',
    'nar/src/kernel/', 'nar/src/gates/',
    'nar/src/capability/', 'capability/wasi',
    'nar/src/rlfp/RewardModel', 'nar/src/rlfp/PolicyOptimizer', 'rlfp/',
    'kernel/src/schemas', 'util/src/types/cognitive', 'nar/src/config/budget',
];

const CRITICAL_COMPONENTS = [
    'approval-logic',
    'sandbox-config',
    'reward-functions',
    'autonomy-mode',
    'kernel-gates',
] as const;

export class PatchRiskClassifier {
    classify(patch: PatchProposal): RiskAssessment {
        const factors: RiskAssessment['factors'] = [];
        let score = 0;
        for (const file of patch.affectedFiles) {
            if (GUARDRAIL_FRAGMENTS.some(f => file.includes(f))) {
                factors.push({ factor: 'critical-path', file, severity: 'HIGH' });
                score += 50;
            }
        }
        for (const component of patch.affectedComponents) {
            if (CRITICAL_COMPONENTS.includes(component as typeof CRITICAL_COMPONENTS[number])) {
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

export type ProposalRoute = 'auto-apply' | 'sandbox-validate' | 'human-approval';

export interface ProposalActuators {
    applyFocusWeight?: (focusId: string, weight: number) => void;
    applyKnob?: (knob: string, value: number) => void;
}

export interface ValidationVerdict {
    approved: boolean;
    reason: string;
}

export class SandboxValidator {
    validate(proposal: SelfImprovementProposal): ValidationVerdict {
        if (proposal.kind !== 'knob-tune') return { approved: false, reason: `No automated checks for ${proposal.kind}; requires human review` };
        const { knob, value } = proposal.payload;
        const spec = knobSchema.find((k) => k.name === knob);
        if (!spec) return { approved: false, reason: `Unknown knob '${String(knob)}'` };
        if (typeof value !== 'number' || Number.isNaN(value)) return { approved: false, reason: `Non-numeric value for '${spec.name}'` };
        if (value < spec.min || value > spec.max) return { approved: false, reason: `'${spec.name}'=${value} outside [${spec.min}, ${spec.max}]` };
        return { approved: true, reason: `'${spec.name}'=${value} within [${spec.min}, ${spec.max}]` };
    }
}

export class ProposalRouter {
    private awaitingValidation: SelfImprovementProposal[] = [];
    private awaitingApproval: SelfImprovementProposal[] = [];

    route(proposal: SelfImprovementProposal, mode: AutonomyMode, actuators: ProposalActuators = {}, validator?: SandboxValidator): { route: ProposalRoute; applied: boolean; reason: string } {
        if (proposal.riskTier === 'high') {
            this.awaitingApproval.push(proposal);
            return { route: 'human-approval', applied: false, reason: `High-risk ${proposal.kind} requires human/external approval` };
        }
        if (proposal.riskTier === 'medium') {
            const verdict = validator?.validate(proposal);
            const executable = mode !== 'observe-only' && mode !== 'propose-only';
            if (verdict?.approved && executable && proposal.kind === 'knob-tune' && actuators.applyKnob
                && typeof proposal.payload['knob'] === 'string' && typeof proposal.payload['value'] === 'number') {
                actuators.applyKnob(proposal.payload['knob'] as string, proposal.payload['value'] as number);
                return { route: 'auto-apply', applied: true, reason: `Sandbox-validated: ${verdict.reason}` };
            }
            this.awaitingValidation.push(proposal);
            return { route: 'sandbox-validate', applied: false, reason: verdict ? `Held: ${verdict.reason}` : `Medium-risk ${proposal.kind} requires sandbox validation` };
        }
        if (mode === 'observe-only' || mode === 'propose-only') {
            this.awaitingApproval.push(proposal);
            return { route: 'human-approval', applied: false, reason: `Mode ${mode} prohibits auto-apply` };
        }
        const { kind, payload } = proposal;
        if (kind === 'focus-weight' && actuators.applyFocusWeight && typeof payload['focusId'] === 'string' && typeof payload['weight'] === 'number') {
            actuators.applyFocusWeight(payload['focusId'] as string, payload['weight'] as number);
            return { route: 'auto-apply', applied: true, reason: 'Low-risk focus-weight auto-applied' };
        }
        if (kind === 'strategy-switch' && mode !== 'sandbox-execute') {
            return { route: 'auto-apply', applied: false, reason: 'No actuator registered for strategy-switch; held as approved-pending' };
        }
        this.awaitingApproval.push(proposal);
        return { route: 'human-approval', applied: false, reason: `No actuator for low-risk ${kind}; queued for review` };
    }

    getAwaitingValidation(): ReadonlyArray<SelfImprovementProposal> {
        return this.awaitingValidation;
    }

    getAwaitingApproval(): ReadonlyArray<SelfImprovementProposal> {
        return this.awaitingApproval;
    }
}

export class GovernancePolicyEngine {
    decide(risk: RiskAssessment, mode: AutonomyMode): GovernanceDecision {
        if (risk.risk === 'HIGH') return { action: 'REQUIRE_HUMAN_REVIEW', reason: 'HIGH risk requires human review', reviewers: 2 };
        switch (mode) {
            case 'observe-only':
            case 'propose-only':
            case 'sandbox-execute':
                return { action: 'REQUIRE_HUMAN_REVIEW', reason: `Mode ${mode} prohibits auto-merge`, reviewers: 1 };
            case 'low-risk-auto-merge':
                return risk.risk === 'LOW'
                    ? { action: 'AUTO_MERGE', reason: 'LOW risk + auto-merge mode' }
                    : { action: 'CREATE_PR', reason: 'MEDIUM risk requires review', reviewers: 1 };
            case 'human-approved-production':
                return { action: 'REQUIRE_HUMAN_REVIEW', reason: 'Production mode requires human approval', reviewers: 1 };
        }
    }

    record(proposal: PatchProposal, assessment: RiskAssessment, decision: GovernanceDecision, mode: AutonomyMode): GovernanceEvent {
        return {
            eventId: uuidv4(),
            proposalId: proposal.proposalId,
            decision: decision.action === 'AUTO_MERGE' ? 'AUTO_MERGED' : decision.action === 'CREATE_PR' ? 'PR_CREATED' : 'HUMAN_REVIEW_REQUIRED',
            riskLevel: assessment.risk,
            autonomyMode: mode,
            decidedAt: Date.now(),
            decidedBy: 'governance-runner',
        };
    }
}
