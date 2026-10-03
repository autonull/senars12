import { generateId } from '@senars/util';
import type { CognitiveEvent } from '@senars/core/schemas';
import type { NAREventMap } from '../types/events.js';

/**
 * Every NAR event becomes an `engine: 'nar'` cognitive event. The origin is the
 * nar discriminant, not a parameter: `kernel` and `proposer` events are minted
 * at their own construction sites, and threading an origin through here could
 * only ever have produced a `'kernel'` event the nar type does not admit.
 */
type Handler = (data: unknown) => CognitiveEvent | null;

const handlers = new Map<keyof NAREventMap, Handler>([
  [
    'cycle:start',
    (data) => {
      const d = data as NAREventMap['cycle:start'];
      return {
        type: 'cycle',
        engine: 'nar',
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
    (data) => {
      const d = data as NAREventMap['rule:applied'];
      return {
        type: 'derivation.made',
        engine: 'nar',
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
    (data) => {
      const d = data as NAREventMap['concept:created'];
      return {
        type: 'concept.activated',
        engine: 'nar',
        timestamp: Date.now(),
        correlationId: generateId('corr'),
        payload: { term: String(d.term), priority: d.priority },
      };
    },
  ],
  [
    'concept:removed',
    (data) => {
      const d = data as NAREventMap['concept:removed'];
      return {
        type: 'belief.retracted',
        engine: 'nar',
        timestamp: Date.now(),
        correlationId: generateId('corr'),
        payload: { term: String(d.term) },
      };
    },
  ],
  [
    'cognitive:state-change',
    (data) => {
      const d = data as NAREventMap['cognitive:state-change'];
      return {
        type: 'drive.changed',
        engine: 'nar',
        timestamp: Date.now(),
        correlationId: generateId('corr'),
        payload: { drive: `cognitive:${d.action}`, urgency: 0.5 },
      };
    },
  ],
  [
    'tool:call',
    (data) => {
      const d = data as NAREventMap['tool:call'];
      return {
        type: 'tool.request',
        engine: 'nar',
        timestamp: d.timestamp,
        correlationId: generateId('corr'),
        payload: { toolName: d.name, args: d.args as Record<string, unknown> },
      };
    },
  ],
  [
    'tool:result',
    (data) => {
      const d = data as NAREventMap['tool:result'];
      return {
        type: 'tool.response',
        engine: 'nar',
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
    (data) => {
      const d = data as NAREventMap['tool:error'];
      return {
        type: 'tool.response',
        engine: 'nar',
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
    (_data) => ({
      type: 'skill.executed',
      engine: 'nar',
      timestamp: Date.now(),
      correlationId: generateId('corr'),
      payload: { skill: 'lm.generate', args: [], result: '', durationMs: 0 },
    }),
  ],
]);

export function narEventToCognitive(
  event: keyof NAREventMap,
  data: NAREventMap[keyof NAREventMap]
): CognitiveEvent | null {
  const handler = handlers.get(event);
  if (!handler) return null;
  return handler(data);
}

/** All NAR event keys that have a CognitiveEvent mapping. */
export const MAPPED_NAR_EVENTS: Array<keyof NAREventMap> = [...handlers.keys()];
