import { type CognitiveEvent, mintCognitiveEvent as mint } from '@senars/core/schemas';
import type { NAREventMap } from '../types/events.js';

/**
 * Every NAR event becomes an `engine: 'nar'` cognitive event. The origin is the
 * nar discriminant, not a parameter: `kernel` and `proposer` events are minted
 * at their own construction sites, and threading an origin through here could
 * only ever have produced a `'kernel'` event the nar type does not admit.
 *
 * Each handler below is a one-line `mintCognitiveEvent` — the payload is checked
 * against the schema's own variant, and the timestamp and correlation id are
 * stamped by the mint rather than restated per handler. A tool event keeps the
 * timestamp it was raised at, because that is the latency being measured.
 */
type Handler = (data: unknown) => CognitiveEvent | null;

const handlers = new Map<keyof NAREventMap, Handler>([
  [
    'cycle:start',
    (data) => {
      const d = data as NAREventMap['cycle:start'];
      return mint('cycle', {
        engine: 'nar',
        cycle: d.cycle,
        derived: 0,
        payload: { cycle: d.cycle, derived: 0 },
      });
    },
  ],
  [
    'rule:applied',
    (data) => {
      const d = data as NAREventMap['rule:applied'];
      return mint('derivation.made', {
        engine: 'nar',
        payload: {
          rule: d.ruleId,
          premises: d.premises.map(String),
          conclusion: String(d.conclusion),
          cpuMs: d.cpuMs,
          lmCalls: d.lmCalls,
          lmTokens: d.lmTokens,
        },
      });
    },
  ],
  [
    'concept:created',
    (data) => {
      const d = data as NAREventMap['concept:created'];
      return mint('concept.activated', {
        engine: 'nar',
        payload: { term: String(d.term), priority: d.priority },
      });
    },
  ],
  [
    'concept:removed',
    (data) => {
      const d = data as NAREventMap['concept:removed'];
      return mint('belief.retracted', {
        engine: 'nar',
        payload: { term: String(d.term) },
      });
    },
  ],
  [
    'cognitive:state-change',
    (data) => {
      const d = data as NAREventMap['cognitive:state-change'];
      return mint('drive.changed', {
        engine: 'nar',
        payload: { drive: `cognitive:${d.action}`, urgency: 0.5 },
      });
    },
  ],
  [
    'tool:call',
    (data) => {
      const d = data as NAREventMap['tool:call'];
      return mint('tool.request', {
        engine: 'nar',
        timestamp: d.timestamp,
        payload: { toolName: d.name, args: d.args as Record<string, unknown> },
      });
    },
  ],
  [
    'tool:result',
    (data) => {
      const d = data as NAREventMap['tool:result'];
      return mint('tool.response', {
        engine: 'nar',
        timestamp: d.timestamp,
        payload: {
          requestId: `${d.type}:${d.name}`,
          toolName: d.name,
          result: d.result,
          durationMs: d.duration,
        },
      });
    },
  ],
  [
    'tool:error',
    (data) => {
      const d = data as NAREventMap['tool:error'];
      return mint('tool.response', {
        engine: 'nar',
        timestamp: d.timestamp,
        payload: {
          requestId: `${d.type}:${d.name}`,
          toolName: d.name,
          error: String(d.result),
          durationMs: d.duration,
        },
      });
    },
  ],
  [
    'lm:start',
    (_data) =>
      mint('skill.executed', {
        engine: 'nar',
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
