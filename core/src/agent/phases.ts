import type { ChatStreamEvent } from '../ChatService.js';
/**
 * Agent reasoning cycle as a `MacroPhase` middleware pipeline (REFACTOR.todo1
 * Phase A): `DEFAULT_MACRO_PIPELINE` reproduces the original `runCycleStream`
 * step sequence exactly; narration streams through the phase chain via
 * `MacroContext.stream`.
 */
import type { CognitiveStimulus, Context, Derivation, ToolResult } from '../engine/Engine.js';
import {
  type CycleHost,
  createMacroContext,
  dispatchMacro,
  type MacroContext,
  type MacroPhase,
  motorTools,
} from './pipeline.js';

export type { CycleHost, MacroContext, MacroPhase } from './pipeline.js';
export { createCapturePhase, createReflectPhase } from './pipeline.js';

const EMPTY_CONTEXT: Context = { working: [], episodic: [], semantic: [] };

const gateVerdict = (
  v: boolean | { grounded: boolean; score?: number }
): { grounded: boolean; score?: number } => (typeof v === 'boolean' ? { grounded: v } : v);

const reportEgressRejection = (host: CycleHost, correlationId: string, score?: number): void => {
  host.emit({
    engine: 'nar',
    type: 'egress.gate.rejected',
    timestamp: Date.now(),
    correlationId,
    payload: { gate: 'groundedness', score },
  });
};

const perceive = (host: CycleHost, stimulus: CognitiveStimulus): void => {
  host.emit({
    engine: 'nar',
    type: 'input.user',
    timestamp: Date.now(),
    correlationId: stimulus.correlationId,
    payload: { text: stimulus.text, source: 'cycle' },
  });
};

const recall = async (
  host: CycleHost,
  stimulus: CognitiveStimulus
): Promise<{ cid: { id?: string }; context: Context }> => {
  const cid = await host.log.append({
    engine: 'nar',
    type: 'input.user',
    payload: { text: stimulus.text, source: stimulus.source },
    correlationId: stimulus.correlationId,
    causationId: '',
  });

  const working = host.memory.recent(50);
  const episodic = await host.memory.queryEpisodic();
  const semantic = await host.memory.querySemantic(stimulus.text);
  const context: Context = { working, episodic, semantic };
  return { cid, context };
};

const reason = async (
  host: CycleHost,
  stimulus: CognitiveStimulus,
  context: Context
): Promise<Derivation[]> => {
  const derivations: Derivation[] = [];
  for (const engine of host.engines.values()) {
    try {
      const result = await engine.reason(stimulus, context);
      derivations.push(...result);
    } catch {
      // engine unavailable, continue
    }
  }
  return derivations;
};

/** Fail-safe template verbalization when the egress gate rejects or abstains. */
const verbalizeDerivations = (derivations: Derivation[]): string =>
  derivations.length > 0
    ? `Derivations: ${derivations.map((d) => d.term).join('; ')}`
    : 'No grounded derivations available.';

const narrateStreaming = async (ctx: MacroContext): Promise<void> => {
  const { host, stimulus, state, stream, opts } = ctx;
  const tier = opts?.tier ?? host.narrateTier;
  const cortex = host.cortex;
  if (cortex) {
    const s =
      typeof cortex.synthesizeStream === 'function'
        ? cortex.synthesizeStream(
            {
              stimulus,
              context: state.context ?? EMPTY_CONTEXT,
              derivations: state.derivations,
              tools: motorTools(host),
              tier,
            },
            opts?.signal
          )
        : (async function* () {
            const res = await cortex.synthesize({
              stimulus,
              context: state.context ?? EMPTY_CONTEXT,
              derivations: state.derivations,
              tools: motorTools(host),
              tier,
            });
            yield { kind: 'text-delta', text: res.text } as ChatStreamEvent;
          })();
    for await (const evt of s) {
      stream.push(evt);
      if (evt.kind === 'text-delta' && evt.text) state.narrativeText += evt.text;
    }
    if (!state.narrativeText) state.narrativeText = host.getLastResponse();
    else if (host.groundednessGate) {
      const verdict = gateVerdict(await host.groundednessGate(state.narrativeText));
      state.egress = verdict;
      if (!verdict.grounded) {
        reportEgressRejection(host, stimulus.correlationId, verdict.score);
        stream.push({
          kind: 'text-delta',
          text: `[egress gate rejected narration${verdict.score !== undefined ? ` (score ${verdict.score.toFixed(2)})` : ''} — falling back to grounded verbalization]`,
        } as ChatStreamEvent);
        state.narrativeText = verbalizeDerivations(state.derivations);
      }
    } else {
      host.memory.append({
        type: 'narrative',
        payload: state.narrativeText,
        correlationId: stimulus.correlationId,
      });
    }
  } else {
    for (const d of state.derivations) {
      host.memory.append({
        type: 'derivation',
        payload: d,
        correlationId: stimulus.correlationId,
      });
    }
  }
};

const consolidateMemory = async (ctx: MacroContext): Promise<void> => {
  const { host, stimulus, state } = ctx;
  if (host.episodicMemory && state.narrativeText) {
    await host.episodicMemory.log('response', state.narrativeText, {
      correlationId: stimulus.correlationId,
    });
  }
  if (host.episodicMemory && stimulus.source === 'chat') {
    await host.episodicMemory.log('input', stimulus.text, {
      correlationId: stimulus.correlationId,
    });
  }
};

const act = async (ctx: MacroContext): Promise<Array<{ command: string; result: ToolResult }>> => {
  const { host, stimulus, state } = ctx;
  const toolResults: Array<{ command: string; result: ToolResult }> = [];
  if (host.commandParser && state.narrativeText) {
    const commands = host.commandParser(state.narrativeText);
    for (const cmd of commands) {
      if (cmd.command === 'send') {
        host.setLastResponse(cmd.args[0] ?? '');
        continue;
      }

      const policyCheck = host.policy.checkCommand(cmd.command);
      if (!policyCheck.allowed) {
        const result: ToolResult = {
          success: false,
          content: null,
          error: policyCheck.reason ?? 'Blocked by policy',
        };
        toolResults.push({ command: cmd.command, result });
        continue;
      }

      const toolArgs: Record<string, unknown> = {
        args: cmd.args,
        raw: cmd.raw,
        command: cmd.command,
      };
      const result = await host.motor.execute(cmd.command, toolArgs, stimulus.correlationId);
      toolResults.push({ command: cmd.command, result });
      await host.log.append({
        engine: 'nar',
        type: 'tool.request',
        payload: { toolName: cmd.command, args: { args: cmd.args }, timeoutMs: 30000 },
        correlationId: stimulus.correlationId,
        causationId: state.cid?.id ?? '',
      });
      for (const engine of host.engines.values()) {
        try {
          engine.absorb?.(result);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return toolResults;
};

const record = async (ctx: MacroContext): Promise<void> => {
  const { host, stimulus, state } = ctx;
  await host.memory.consolidate(state.cid?.id ?? '');
  for (const tr of state.toolResults) {
    host.memory.append({
      type: 'tool_result',
      payload: tr,
      correlationId: stimulus.correlationId,
    });
  }

  // Phase A (REFACTOR.todo2): drain the learning bags (decay + pressure-gated
  // induction/exemplar maintenance) each cycle — best-effort, never blocks.
  if (host.consolidateLearning && host.consolidation?.enabled !== false) {
    try {
      await host.consolidateLearning({ budget: host.consolidation?.budget });
    } catch {
      /* consolidation is best-effort; never blocks the cycle */
    }
  }

  if (host.traceGrader && state.narrativeText) {
    try {
      await host.traceGrader({
        narration: state.narrativeText,
        toolCalls: state.toolResults.map((tr) => ({
          command: tr.command,
          success: tr.result.success,
        })),
        correlationId: stimulus.correlationId,
        egress: state.egress,
      });
    } catch {
      /* grading is best-effort; never blocks the cycle */
    }
  }
};

const announce = (ctx: MacroContext): void => {
  const { host, stimulus, state } = ctx;
  for (const d of state.derivations) {
    host.emit({
      engine: 'nar',
      type: 'derivation.made',
      timestamp: Date.now(),
      correlationId: stimulus.correlationId,
      payload: { rule: '', premises: [], conclusion: d.term },
    });
  }
  for (const tr of state.toolResults) {
    host.emit({
      engine: 'nar',
      type: 'skill.executed',
      timestamp: Date.now(),
      correlationId: stimulus.correlationId,
      payload: {
        skill: tr.command,
        args: [],
        result: tr.result.success ? 'success' : (tr.result.error ?? 'error'),
        durationMs: 0,
      },
    });
  }
};

const perceivePhase: MacroPhase = async (ctx, next) => {
  perceive(ctx.host, ctx.stimulus);
  await next();
};

const recallPhase: MacroPhase = async (ctx, next) => {
  const { cid, context } = await recall(ctx.host, ctx.stimulus);
  ctx.state.cid = cid;
  ctx.state.context = context;
  await next();
};

const reasonPhase: MacroPhase = async (ctx, next) => {
  ctx.state.derivations = await reason(ctx.host, ctx.stimulus, ctx.state.context ?? EMPTY_CONTEXT);
  await next();
};

const narratePhase: MacroPhase = async (ctx, next) => {
  await narrateStreaming(ctx);
  await next();
};

const consolidatePhase: MacroPhase = async (ctx, next) => {
  await consolidateMemory(ctx);
  await next();
};

const actPhase: MacroPhase = async (ctx, next) => {
  ctx.state.toolResults = await act(ctx);
  await next();
};

const recordPhase: MacroPhase = async (ctx, next) => {
  await record(ctx);
  await next();
};

const announcePhase: MacroPhase = async (ctx, next) => {
  announce(ctx);
  await next();
};

export const DEFAULT_MACRO_PIPELINE: MacroPhase[] = [
  perceivePhase,
  recallPhase,
  reasonPhase,
  narratePhase,
  consolidatePhase,
  actPhase,
  recordPhase,
  announcePhase,
];

export const runCycle = async (
  host: CycleHost,
  stimulus: CognitiveStimulus,
  phases: readonly MacroPhase[] = host.macroPipeline ?? DEFAULT_MACRO_PIPELINE
): Promise<string> => {
  const stream = runCycleStream(host, stimulus, { pipeline: phases });
  let next = await stream.next();
  while (!next.done) next = await stream.next();
  return next.value;
};

export async function* runCycleStream(
  host: CycleHost,
  stimulus: CognitiveStimulus,
  opts?: {
    signal?: AbortSignal;
    tier?: 'quality' | 'fast' | 'structured';
    pipeline?: readonly MacroPhase[];
  }
): AsyncGenerator<ChatStreamEvent, string> {
  host.setLastResponse('');
  const ctx = createMacroContext(host, stimulus, opts);
  const running = (async () => {
    try {
      await dispatchMacro(opts?.pipeline ?? host.macroPipeline ?? DEFAULT_MACRO_PIPELINE, ctx);
    } finally {
      ctx.stream.close();
    }
  })();
  yield* ctx.stream.drain();
  await running;
  return host.getLastResponse() || ctx.state.narrativeText;
}
