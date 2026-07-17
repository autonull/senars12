import type { CognitiveEvent, EngineOrigin } from '@senars/util/types/cognitive';
import type { NAREventMap } from '../types/events.js';

function now(): number {
  return Date.now();
}

function corrId(): string {
  return `${now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Handler = (data: unknown, engine: EngineOrigin) => CognitiveEvent | null;

const handlers = new Map<keyof NAREventMap, Handler>([
  [
    'cycle:start',
    (data, engine) => {
      const d = data as NAREventMap['cycle:start'];
      return {
        type: 'cycle',
        engine,
        timestamp: now(),
        correlationId: corrId(),
        cycle: d.cycle,
        derived: 0,
        payload: { cycle: d.cycle, derived: 0 },
      };
    },
  ],
  [
    'rule:applied',
    (data, engine) => {
      const d = data as NAREventMap['rule:applied'];
      return {
        type: 'derivation.made',
        engine,
        timestamp: now(),
        correlationId: corrId(),
        payload: {
          rule: d.ruleId,
          premises: d.premises.map(String),
          conclusion: String(d.conclusion),
        },
      };
    },
  ],
  [
    'concept:created',
    (data, engine) => {
      const d = data as NAREventMap['concept:created'];
      return {
        type: 'concept.activated',
        engine,
        timestamp: now(),
        correlationId: corrId(),
        payload: { term: String(d.term), priority: d.priority },
      };
    },
  ],
  [
    'concept:removed',
    (data, engine) => {
      const d = data as NAREventMap['concept:removed'];
      return {
        type: 'belief.retracted',
        engine,
        timestamp: now(),
        correlationId: corrId(),
        payload: { term: String(d.term) },
      };
    },
  ],
  [
    'cognitive:state-change',
    (data, engine) => {
      const d = data as NAREventMap['cognitive:state-change'];
      return {
        type: 'drive.changed',
        engine,
        timestamp: now(),
        correlationId: corrId(),
        payload: { drive: `cognitive:${d.action}`, urgency: 0.5 },
      };
    },
  ],
  [
    'tool:call',
    (data, engine) => {
      const d = data as NAREventMap['tool:call'];
      return {
        type: 'tool.request',
        engine,
        timestamp: d.timestamp,
        correlationId: corrId(),
        payload: { toolName: d.name, args: d.args as Record<string, unknown> },
      };
    },
  ],
  [
    'tool:result',
    (data, engine) => {
      const d = data as NAREventMap['tool:result'];
      return {
        type: 'tool.response',
        engine,
        timestamp: d.timestamp,
        correlationId: corrId(),
        payload: {
          requestId: `${d.type}:${d.name}`,
          toolName: d.name,
          result: d.result,
          durationMs: d.duration,
        },
      };
    },
  ],
  [
    'tool:error',
    (data, engine) => {
      const d = data as NAREventMap['tool:error'];
      return {
        type: 'tool.response',
        engine,
        timestamp: d.timestamp,
        correlationId: corrId(),
        payload: {
          requestId: `${d.type}:${d.name}`,
          toolName: d.name,
          error: String(d.result),
          durationMs: d.duration,
        },
      };
    },
  ],
  [
    'lm:start',
    (_data, engine) => ({
      type: 'skill.executed',
      engine,
      timestamp: now(),
      correlationId: corrId(),
      payload: { skill: 'lm.generate', args: [], result: '', durationMs: 0 },
    }),
  ],
]);

export function narEventToCognitive(
  event: keyof NAREventMap,
  data: NAREventMap[keyof NAREventMap],
  engine: EngineOrigin = 'nar'
): CognitiveEvent | null {
  const handler = handlers.get(event);
  if (!handler) return null;
  return handler(data, engine);
}

/** All NAR event keys that have a CognitiveEvent mapping. */
export const MAPPED_NAR_EVENTS: Array<keyof NAREventMap> = [...handlers.keys()];
