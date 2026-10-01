import type { AutonomyMode, CognitiveEvent, TaskAdmittedEvent } from '@senars/core/schemas';
import { CognitiveEventSchema } from '@senars/core/schemas';
import { appendJsonl, readJsonl, sortBy } from '@senars/util';
import type { GateRegistry } from './GateRegistry.js';

export function persistGateLogs(registry: GateRegistry, path: string): { appended: number } {
  const logs = registry.getAllEventLogs();
  const events = sortBy(
    [...logs.perception, ...logs.action, ...logs.autonomy, ...logs.reward, ...logs.budget],
    (e) => e.timestamp
  );
  return { appended: appendJsonl(path, events) };
}

export function loadGateEvents(path: string): { events: CognitiveEvent[]; invalid: number } {
  const { rows, invalid } = readJsonl(path, (value) => {
    const parsed = CognitiveEventSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  return { events: rows, invalid };
}

export function replayTaskAdmissions(
  events: CognitiveEvent[]
): Array<TaskAdmittedEvent['payload']> {
  return events
    .filter((e) => e.type === 'task.admitted')
    .map((e) => (e as TaskAdmittedEvent).payload);
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

export interface CognitiveStateSnapshot {
  version: number;
  tasks: Array<{
    term: string;
    taskType: string;
    truth?: { frequency: number; confidence: number };
  }>;
  beliefs: Record<string, { frequency: number; confidence: number }>;
  revisions: Record<
    string,
    Array<{
      oldTruth: { frequency: number; confidence: number };
      newTruth: { frequency: number; confidence: number };
    }>
  >;
  derivations: Array<{
    derivationId: string;
    ruleId: string;
    conclusion: string;
    truth: { frequency: number; confidence: number };
  }>;
  priorities: Record<string, number>;
  violations: Array<{ policyId: string; violationType: string; severity: string }>;
  budgets: Array<{ budgetType: string; terminationReason: string }>;
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

const emptySnapshot = (): CognitiveStateSnapshot => ({
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

export function replayCognitiveState(events: CognitiveEvent[]): CognitiveStateSnapshot {
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
