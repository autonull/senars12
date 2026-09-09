import type { CognitiveEvent } from '@senars/util';
import type { TickContext } from './tick.js';

export function toCognitiveEvents(ctx: TickContext): CognitiveEvent[] {
  const base = { engine: 'nar' as const, timestamp: Date.now(), correlationId: ctx.tickId };
  const out: CognitiveEvent[] = [];
  for (const task of ctx.state.perceptions)
    out.push({ ...base, type: 'belief.added', payload: { term: String(task.term), truth: { frequency: task.truth.f, confidence: task.truth.c } } });
  for (const event of ctx.events) {
    const [tool, result] = event.detail?.split(':') ?? [];
    if (event.stage === 'act' && tool && result)
      out.push(result === 'ok'
        ? { ...base, type: 'tool.response', payload: { requestId: ctx.tickId, toolName: tool, durationMs: 0 } }
        : { ...base, type: 'tool.response', payload: { requestId: ctx.tickId, toolName: tool, error: result, durationMs: 0 } });
    else if (event.stage === 'negotiate' && event.detail?.startsWith('veto:'))
      out.push({ ...base, type: 'conflict:detected', payload: { term: event.detail, conflictWith: 'reflex-proposal' } });
  }
  out.push({ ...base, type: 'cycle', cycle: 1, derived: ctx.state.derivations.length, payload: { cycle: 1, derived: ctx.state.derivations.length } });
  return out;
}
