/**
 * Replay Reducers — pure replay reducers for cognitive state.
 *
 * Provides pure reducer functions for reconstructing cognitive state from event logs.
 * Used by both LogStore-based replay and legacy file-based replay.
 */
export function replayTaskAdmissions(events) {
    return events
        .filter((e) => e.type === 'task.admitted')
        .map((e) => e.payload);
}
/**
 * The snapshot's shape version. **v2 (A9)** added `proposals`, so a v1 snapshot
 * read by this build is missing a field the replay contract now guarantees. The
 * number is the shape's own, not the proposal schema's: an incompatible
 * *proposal* version fails inside `replayProposalStream` with a
 * `ProposalReplayError`, which is a louder and more specific failure than a
 * snapshot field quietly reading `undefined`.
 */
export const SNAPSHOT_VERSION = 2;
const emptySnapshot = () => ({
    version: SNAPSHOT_VERSION,
    tasks: [],
    beliefs: {},
    revisions: {},
    derivations: [],
    priorities: {},
    violations: [],
    budgets: [],
    autonomyMode: null,
    proposals: { revision: 0, admissions: [], rejections: [] },
});
export function replayCognitiveState(events) {
    const state = emptySnapshot();
    for (const event of events) {
        switch (event.type) {
            case 'task.admitted':
                state.tasks.push({
                    term: event.payload.term,
                    taskType: event.payload.taskType,
                    truth: event.payload.truth,
                });
                break;
            case 'belief.revised': {
                state.beliefs[event.payload.term] = { ...event.payload.newTruth };
                const chain = state.revisions[event.payload.term] ?? [];
                chain.push({
                    oldTruth: { ...event.payload.oldTruth },
                    newTruth: { ...event.payload.newTruth },
                });
                state.revisions[event.payload.term] = chain;
                break;
            }
            case 'derivation.accepted':
                state.derivations.push({
                    derivationId: event.payload.derivationId,
                    ruleId: event.payload.ruleId,
                    conclusion: event.payload.conclusion,
                    truth: { ...event.payload.truth },
                });
                break;
            case 'concept.activated':
                state.priorities[event.payload.term] = event.payload.priority;
                break;
            case 'policy.violation':
                state.violations.push({ ...event.payload });
                break;
            case 'budget.exhausted':
                state.budgets.push({
                    budgetType: event.payload.budgetType,
                    terminationReason: event.payload.terminationReason,
                });
                break;
            case 'autonomy.mode.changed':
                state.autonomyMode = event.payload.newMode;
                break;
            case 'proposal.admitted':
                state.proposals.admissions.push({
                    proposalId: event.payload.proposalId,
                    kind: event.payload.kind,
                    baseRevision: event.payload.baseRevision,
                    resultingRevision: event.payload.resultingRevision,
                    producer: event.payload.producer,
                });
                state.proposals.revision = event.payload.resultingRevision;
                break;
            case 'proposal.rejected':
                state.proposals.rejections.push({
                    proposalId: event.payload.proposalId,
                    kind: event.payload.kind,
                    reason: event.payload.reason,
                    observedRevision: event.payload.observedRevision,
                });
                break;
        }
    }
    return state;
}
