/**
 * Loop-to-Log Adapter — wires loop events to the append-only log.
 *
 * This adapter translates loop events into cognitive events and appends them
 * to the log store for deterministic replay and auditability.
 */

import type { LogStore } from '../log/store.js';
import type { LogEntry } from '../log/events.js';
import type { CognitiveEvent } from '../generated/schemas.js';
import type { LoopEvent, LoopEventType } from './types.js';
import type { Env } from '../kernel/env.js';

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
  private toCognitiveEvent(event: LoopEvent, type: CognitiveEvent['type']): Omit<CognitiveEvent, 'id' | 'timestamp'> {
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
            term: event.data.term as any,
            truth: event.data.truth as any,
            weight: event.data.weight as number ?? 1,
            source: 'loop',
          },
        };

      case 'derivation.accepted':
        return {
          ...base,
          payload: {
            derivationId: `deriv-${event.iteration}-${event.type}`,
            premises: event.data.premises as any[] ?? [],
            conclusion: event.data.conclusion as any,
            truth: event.data.truth as any,
            rule: event.data.rule as string ?? 'loop',
          },
        };

      case 'derivation.record':
        return {
          ...base,
          payload: {
            derivationId: `deriv-${event.iteration}-${event.type}`,
            step: event.data.step as any,
            inferenceType: event.data.inferenceType as string ?? 'loop',
          },
        };

      case 'judgment.resolved':
        return {
          ...base,
          payload: {
            judgmentId: event.data.judgmentId as string ?? `judgment-${event.iteration}`,
            taskId: event.data.taskId as string ?? `task-${event.iteration}`,
            score: event.data.score as number ?? 0,
            confidence: event.data.confidence as number ?? 0,
            verdict: event.data.verdict as 'allow' | 'deny' | 'defer' ?? 'allow',
          },
        };

      case 'gate.passed':
        return {
          ...base,
          payload: {
            gate: event.data.gate as string ?? 'loop',
            artifactId: event.data.artifactId as string ?? `artifact-${event.iteration}`,
            evidence: event.data.evidence as Record<string, unknown> ?? {},
          },
        };

      case 'gate.failed':
        return {
          ...base,
          payload: {
            gate: event.data.gate as string ?? 'loop',
            artifactId: event.data.artifactId as string ?? `artifact-${event.iteration}`,
            reason: event.data.reason as string ?? 'Loop iteration failed',
            evidence: event.data.evidence as Record<string, unknown> ?? {},
          },
        };

      case 'budget.exhausted':
        return {
          ...base,
          payload: {
            scope: event.data.scope as string ?? 'loop',
            consumed: event.data.consumed as number ?? 0,
            limit: event.data.limit as number ?? 1000,
          },
        };

      default:
        return {
          ...base,
          payload: event.data as any,
        };
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