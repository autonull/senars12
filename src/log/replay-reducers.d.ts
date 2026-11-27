/**
 * Replay Reducers — pure replay reducers for cognitive state.
 *
 * Provides pure reducer functions for reconstructing cognitive state from event logs.
 * Used by both LogStore-based replay and legacy file-based replay.
 */
import type { AutonomyMode, CognitiveEvent, TaskAdmittedEvent } from '@senars/schemas';
import type { BeliefTruth } from '../types/truth';
export declare function replayTaskAdmissions(events: CognitiveEvent[]): Array<TaskAdmittedEvent['payload']>;
/**
 * The snapshot's shape version. **v2 (A9)** added `proposals`, so a v1 snapshot
 * read by this build is missing a field the replay contract now guarantees. The
 * number is the shape's own, not the proposal schema's: an incompatible
 * *proposal* version fails inside `replayProposalStream` with a
 * `ProposalReplayError`, which is a louder and more specific failure than a
 * snapshot field quietly reading `undefined`.
 */
export declare const SNAPSHOT_VERSION = 2;
export interface CognitiveStateSnapshot {
    version: number;
    tasks: Array<{
        term: string;
        taskType: string;
        truth?: BeliefTruth;
    }>;
    beliefs: Record<string, BeliefTruth>;
    revisions: Record<string, Array<{
        oldTruth: BeliefTruth;
        newTruth: BeliefTruth;
    }>>;
    derivations: Array<{
        derivationId: string;
        ruleId: string;
        conclusion: string;
        truth: BeliefTruth;
    }>;
    priorities: Record<string, number>;
    violations: Array<{
        policyId: string;
        violationType: string;
        severity: string;
    }>;
    budgets: Array<{
        budgetType: string;
        terminationReason: string;
    }>;
    autonomyMode: AutonomyMode | null;
    /**
     * TODO29.a A9: the proposal seam's fold, in the *same* reducer rather than a
     * second one. A proposal is an untrusted write attempt and the log already is
     * the record of write attempts, so a parallel fixture format would be a second
     * representation of state that could disagree with the first.
     */
    proposals: {
        /** The committed revision the log ends at. Zero for an event-free log. */
        revision: number;
        admissions: Array<{
            proposalId: string;
            kind: 'content' | 'rule';
            baseRevision: number;
            resultingRevision: number;
            producer?: string;
        }>;
        rejections: Array<{
            proposalId: string;
            kind: 'content' | 'rule';
            reason: string;
            observedRevision: number;
        }>;
    };
}
export declare function replayCognitiveState(events: CognitiveEvent[]): CognitiveStateSnapshot;
//# sourceMappingURL=replay-reducers.d.ts.map