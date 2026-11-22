/**
 * Loop-to-Log Adapter — wires loop events to the append-only log.
 *
 * This adapter translates loop events into cognitive events and appends them
 * to the log store for deterministic replay and auditability.
 */

import type { LogStore } from '../log/store';
import type { LogEntry } from '../log/events';
import type { CognitiveEvent } from '../generated/schemas';
import type { LoopEvent, LoopEventType } from './types';
import type { Env } from '../kernel/env';

/** Map loop event types to cognitive event types. */
const LOOP_TO_COGNITIVE_EVENT: Record<LoopEventType, CognitiveEvent['type']> = {
  iteration_start: 'task.admitted',
  iteration_complete: 'derivation.accepted',
  iteration_failed: 'gate.failed',
  selection_made: 'derivation.accepted',
  action_executed: 'derivation.record',
  judgment_complete: 'judgment.resolved',
  contract_checked: 'gate.passed',
  repair_complete: 'derivation.record',
  appraisal_complete: 'derivation.accepted',
  max_iterations_reached: 'budget.exhausted',
  timeout: 'budget.exhausted',
};

/** Adapter for wiring loop events to the log. */
export class LoopLogAdapter {
  private logStore: LogStore;
  private env: Env;
  private correlationId: string;

  constructor(logStore: LogStore, env: Env, correlationId: string) {
    this.logStore = logStore;
    this.env = env;
    this.correlationId = correlationId;
  }

  /** Handle a loop event by converting and appending to log. */
  async handleEvent(event: LoopEvent): Promise<LogEntry | null> {
    const cognitiveType = LOOP_TO_COGNITIVE_EVENT[event.type];
    if (!cognitiveType) return null;

    const cognitiveEvent = this.toCognitiveEvent(event, cognitiveType);
    const seq = await this.logStore.append(cognitiveEvent, {
      ts: event.timestamp,
    });

    return this.logStore.read(seq);
  }

  /** Convert loop event to cognitive event. */
  private toCognitiveEvent(event: LoopEvent, type: CognitiveEvent['type']): CognitiveEvent {
    const base = {
      type,
      engine: 'nar' as const,
      timestamp: event.timestamp,
      correlationId: event.correlationId || this.correlationId,
      causationId: undefined,
    };

    // Map event data to cognitive event payload based on type
    switch (type) {
      case 'task.admitted':
        return {
          ...base,
          payload: {
            taskId: event.data.taskId as string ?? `task-${event.iteration}`,
            term: String(event.data.term ?? ''),
            taskType: event.data.taskType ?? 'belief',
            truth: event.data.truth,
            source: event.data.source ?? 'loop',
            budget: event.data.budget ?? { cycles: 100, depth: 10, memory: 1000, llm: 10 },
          },
        } as CognitiveEvent;

      case 'derivation.accepted':
        return {
          ...base,
          payload: {
            derivationId: `deriv-${event.iteration}-${event.type}`,
            ruleId: event.data.rule ?? 'loop',
            ruleCategory: event.data.ruleCategory,
            premises: (event.data.premises as any[] ?? []).map(String),
            conclusion: String(event.data.conclusion ?? ''),
            truth: event.data.truth ?? { frequency: 0.5, confidence: 0.5 },
            premiseTruths: event.data.premiseTruths,
            truthFn: event.data.truthFn,
            evidenceLineage: event.data.evidenceLineage ?? [],
            independenceCheck: event.data.independenceCheck ?? 'unknown',
            cycle: event.iteration,
            correlationId: event.correlationId,
          },
        } as CognitiveEvent;

      case 'derivation.record':
        return {
          ...base,
          payload: {
            derivationId: `deriv-${event.iteration}-${event.type}`,
            step: event.data.step,
            inferenceType: event.data.inferenceType ?? 'loop',
          },
        } as CognitiveEvent;

      case 'judgment.resolved':
        return {
          ...base,
          payload: {
            queryId: event.data.judgmentId as string ?? `judgment-${event.iteration}`,
            shape: event.data.shape ?? 'propositional',
            axis: event.data.axis ?? 'truth',
            premiseTerms: event.data.premiseTerms ?? [],
            conclusionTerm: event.data.conclusionTerm ?? '',
            verdict: event.data.verdict ?? 'allow',
            confidence: event.data.confidence ?? 0,
            model: event.data.model,
            ruleMatches: event.data.ruleMatches ?? [],
            theorySnapshot: event.data.theorySnapshot,
            consistencyProof: event.data.consistencyProof,
          },
        } as CognitiveEvent;

      case 'gate.passed':
        return {
          ...base,
          payload: {
            gate: event.data.gate ?? 'loop',
            artifactId: event.data.artifactId ?? `artifact-${event.iteration}`,
            evidence: event.data.evidence ?? {},
          },
        } as CognitiveEvent;

      case 'gate.failed':
        return {
          ...base,
          payload: {
            gate: event.data.gate ?? 'loop',
            artifactId: event.data.artifactId ?? `artifact-${event.iteration}`,
            reason: event.data.reason ?? 'Loop iteration failed',
            evidence: event.data.evidence ?? {},
          },
        } as CognitiveEvent;

      case 'budget.exhausted':
        return {
          ...base,
          payload: {
            budgetType: event.data.budgetType ?? 'cycles',
            remaining: event.data.remaining ?? 0,
            limit: event.data.limit ?? 1000,
            terminationReason: event.data.terminationReason ?? 'exhausted',
          },
        } as CognitiveEvent;

      default:
        return {
          ...base,
          payload: event.data as any,
        } as CognitiveEvent;
    }
  }
}

/** Create a loop log adapter. */
export function createLoopLogAdapter(logStore: LogStore, env: Env, correlationId: string): LoopLogAdapter {
  return new LoopLogAdapter(logStore, env, correlationId);
}

/** Wire loop events to log store. */
export function wireLoopToLog(
  loop: { onEvent: (type: LoopEventType, listener: (event: LoopEvent) => void) => () => void },
  adapter: LoopLogAdapter
): () => void {
  const unsubscribers: (() => void)[] = [];

  const eventTypes: LoopEventType[] = [
    'iteration_start',
    'iteration_complete',
    'iteration_failed',
    'selection_made',
    'action_executed',
    'judgment_complete',
    'contract_checked',
    'repair_complete',
    'appraisal_complete',
    'max_iterations_reached',
    'timeout',
  ];

  for (const type of eventTypes) {
    unsubscribers.push(
      loop.onEvent(type, (event) => {
        adapter.handleEvent(event).catch(console.error);
      })
    );
  }

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}