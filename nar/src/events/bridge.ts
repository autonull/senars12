import { generateId } from '@senars/util';
import type { CognitiveEvent, EngineOrigin } from '@senars/util/types/cognitive';
import type { NAREventMap } from '../types/events.js';

type Handler = (data: unknown, engine: EngineOrigin) => CognitiveEvent | null;

const handlers = new Map<keyof NAREventMap, Handler>([
  [
    'cycle:start',
    (data, engine) => {
      const d = data as NAREventMap['cycle:start'];
      return {
        type: 'cycle',
        engine,
        timestamp: Date.now(),
        correlationId: generateId('corr'),
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
        timestamp: Date.now(),
        correlationId: generateId('corr'),
        payload: {
          rule: d.ruleId,
          premises: d.premises.map(String),
          conclusion: String(d.conclusion),
          cpuMs: d.cpuMs,
          lmCalls: d.lmCalls,
          lmTokens: d.lmTokens,
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
        timestamp: Date.now(),
        correlationId: generateId('corr'),
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
        timestamp: Date.now(),
        correlationId: generateId('corr'),
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
        timestamp: Date.now(),
        correlationId: generateId('corr'),
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
        correlationId: generateId('corr'),
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
        correlationId: generateId('corr'),
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
        correlationId: generateId('corr'),
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
      timestamp: Date.now(),
      correlationId: generateId('corr'),
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
