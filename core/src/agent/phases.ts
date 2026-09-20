import type { EpisodicMemory } from '@senars/util';
import type { ChatStreamEvent } from '../ChatService.js';
import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { LLMCortex } from '../cortex/LLMCortex.js'; /**
 * Agent reasoning cycle phases, extracted from Agent.cycle for modularity.
 * Behavior is identical to the original inline implementation.
 */
import type {
  CognitiveStimulus,
  Context,
  Derivation,
  Engine,
  ToolResult,
} from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type { MemoryService } from '../memory/MemoryService.js';
import type { ToolRegistry } from '../motor/ToolRegistry.js';
import { motorToToolSet } from '../motor/toToolSet.js';
import type { PolicyEngine } from '../PolicyEngine.js';

export interface CycleHost {
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine>;
  readonly policy: PolicyEngine;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;
  readonly episodicMemory?: EpisodicMemory;
  readonly commandParser?: (text: string) => { command: string; args: string[]; raw: string }[];
  /** System One egress gate (§7.4): returns true (or `{grounded, score}`) when the narration is grounded enough to emit. */
  readonly groundednessGate?: (narration: string) => Promise<boolean | { grounded: boolean; score?: number }>;
  /** E4: grades the completed cycle (narration + executed tools) into the distillation dataset. */
  readonly traceGrader?: (trace: {
    narration: string;
    toolCalls: readonly { command: string; success: boolean }[];
    correlationId: string;
  }) => Promise<unknown>;

  emit(event: CognitiveEvent): void;

  getLastResponse(): string;

  setLastResponse(value: string): void;
}

/** I4/X13: egress-gate rejections are observable — never a silent narration swap. */
const gateVerdict = (v: boolean | { grounded: boolean; score?: number }): { grounded: boolean; score?: number } =>
  typeof v === 'boolean' ? { grounded: v } : v;

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
): Promise<{ cid: CognitiveEvent; context: Context }> => {
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

const narrate = async (
  host: CycleHost,
  stimulus: CognitiveStimulus,
  context: Context,
  derivations: Derivation[]
): Promise<string> => {
  let narrativeText = '';
  if (host.cortex) {
    const narrative = await host.cortex.synthesize({
      stimulus,
      context,
      derivations,
      tools: motorToToolSet(host.motor),
    });
    narrativeText = narrative.text;
    if (host.groundednessGate) {
      const verdict = gateVerdict(await host.groundednessGate(narrativeText));
      if (!verdict.grounded) {
        reportEgressRejection(host, stimulus.correlationId, verdict.score);
        narrativeText = verbalizeDerivations(derivations);
      }
    }
    host.memory.append({
      type: 'narrative',
      payload: narrativeText,
      correlationId: stimulus.correlationId,
    });
  } else {
    for (const d of derivations) {
      host.memory.append({
        type: 'derivation',
        payload: d,
        correlationId: stimulus.correlationId,
      });
    }
  }
  return narrativeText;
};

/** Fail-safe template verbalization when the egress gate rejects or abstains. */
const verbalizeDerivations = (derivations: Derivation[]): string =>
  derivations.length > 0
    ? `Derivations: ${derivations.map((d) => d.term).join('; ')}`
    : 'No grounded derivations available.';

const consolidateMemory = async (
  host: CycleHost,
  stimulus: CognitiveStimulus,
  narrativeText: string
): Promise<void> => {
  if (host.episodicMemory && narrativeText) {
    await host.episodicMemory.log('response', narrativeText, {
      correlationId: stimulus.correlationId,
    });
  }
  if (host.episodicMemory && stimulus.source === 'chat') {
    await host.episodicMemory.log('input', stimulus.text, {
      correlationId: stimulus.correlationId,
    });
  }
};

const act = async (
  host: CycleHost,
  stimulus: CognitiveStimulus,
  cidId: string,
  narrativeText: string
): Promise<Array<{ command: string; result: ToolResult }>> => {
  const toolResults: Array<{ command: string; result: ToolResult }> = [];
  if (host.commandParser && narrativeText) {
    const commands = host.commandParser(narrativeText);
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
        causationId: cidId,
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

export const runCycle = async (host: CycleHost, stimulus: CognitiveStimulus): Promise<string> => {
  const stream = runCycleStream(host, stimulus);
  let next = await stream.next();
  while (!next.done) next = await stream.next();
  return next.value;
};

export async function* runCycleStream(
  host: CycleHost,
  stimulus: CognitiveStimulus,
  opts?: { signal?: AbortSignal; tier?: 'quality' | 'fast' | 'structured' }
): AsyncGenerator<ChatStreamEvent, string> {
  host.setLastResponse('');

  perceive(host, stimulus);
  const { cid, context } = await recall(host, stimulus);

  const derivations = await reason(host, stimulus, context);
  let narrativeText = '';
  const cortex = host.cortex;
  if (cortex) {
    const stream =
      typeof cortex.synthesizeStream === 'function'
        ? cortex.synthesizeStream(
            { stimulus, context, derivations, tools: motorToToolSet(host.motor), tier: opts?.tier },
            opts?.signal
          )
        : (async function* () {
            const res = await cortex.synthesize({
              stimulus,
              context,
              derivations,
              tools: motorToToolSet(host.motor),
              tier: opts?.tier,
            });
            yield { kind: 'text-delta', text: res.text } as ChatStreamEvent;
          })();
    for await (const evt of stream) {
      yield evt;
      if (evt.kind === 'text-delta' && evt.text) narrativeText += evt.text;
    }
    if (!narrativeText) narrativeText = host.getLastResponse();
    else if (host.groundednessGate) {
      const verdict = gateVerdict(await host.groundednessGate(narrativeText));
      if (!verdict.grounded) {
        reportEgressRejection(host, stimulus.correlationId, verdict.score);
        yield {
          kind: 'text-delta',
          text: `[egress gate rejected narration${verdict.score !== undefined ? ` (score ${verdict.score.toFixed(2)})` : ''} — falling back to grounded verbalization]`,
        } as ChatStreamEvent;
        narrativeText = verbalizeDerivations(derivations);
      }
    } else {
      host.memory.append({
        type: 'narrative',
        payload: narrativeText,
        correlationId: stimulus.correlationId,
      });
    }
  } else {
    narrativeText = await narrate(host, stimulus, context, derivations);
  }

  await consolidateMemory(host, stimulus, narrativeText);

  const toolResults = await act(host, stimulus, cid.id ?? '', narrativeText);

  await host.memory.consolidate(cid.id ?? '');
  for (const tr of toolResults) {
    host.memory.append({
      type: 'tool_result',
      payload: tr,
      correlationId: stimulus.correlationId,
    });
  }

  if (host.traceGrader && narrativeText) {
    try {
      await host.traceGrader({
        narration: narrativeText,
        toolCalls: toolResults.map((tr) => ({ command: tr.command, success: tr.result.success })),
        correlationId: stimulus.correlationId,
      });
    } catch {
      /* grading is best-effort; never blocks the cycle */
    }
  }

  for (const d of derivations) {
    host.emit({
      engine: 'nar',
      type: 'derivation.made',
      timestamp: Date.now(),
      correlationId: stimulus.correlationId,
      payload: { rule: '', premises: [], conclusion: d.term },
    });
  }
  for (const tr of toolResults) {
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

  return host.getLastResponse() || narrativeText;
}
