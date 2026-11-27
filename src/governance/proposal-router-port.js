/**
 * ProposalRouter port — the subset of ProposalRouter that SelfMetaGameImpl needs.
 * Extracted to break SelfMetaGame.ts <-> governance/pipeline.ts cycle.
 */
/** Default no-op implementation for when governance is not wired. */
export class NoopProposalRouter {
    route() {
        return { route: 'human-approval', applied: false, reason: 'Governance not configured' };
    }
    getAwaitingValidation() { return []; }
    getAwaitingApproval() { return []; }
}
