import type { AutonomyMode, CognitiveEvent, TaskAdmittedEvent } from '@senars/core/derivation-schemas';
import { CognitiveEventSchema } from '@senars/core/derivation-schemas';
import { appendJsonl, readJsonl } from '../utils/jsonl.js';
import type { GateRegistry } from './GateRegistry.js';

export function persistGateLogs(registry: GateRegistry, path: string): { appended: number } {
  const logs = registry.getAllEventLogs();
  const events: CognitiveEvent[] = [
    ...logs.perception,
    ...logs.action,
    ...logs.autonomy,
    ...logs.reward,
    ...logs.budget,
  ].sort((a, b) => a.timestamp - b.timestamp);
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

export const SNAPSHOT_VERSION = 1;

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
    }
  }
  return state;
}
