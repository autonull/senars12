import type { EpisodicMemory } from '@senars/nar';
import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { PolicyEngine } from '../PolicyEngine.js';
import type { LLMCortex } from '../cortex/LLMCortex.js';
/**
 * Agent reasoning cycle phases, extracted from Agent.cycle for modularity.
 * Behavior is identical to the original inline implementation.
 */
import type { CognitiveStimulus, Context, Derivation, ToolResult } from '../engine/Engine.js';
import type { Engine } from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type { MemoryService } from '../memory/MemoryService.js';
import type { ToolRegistry } from '../motor/ToolRegistry.js';

export interface CycleHost {
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine>;
  readonly policy: PolicyEngine;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;
  readonly episodicMemory?: EpisodicMemory;
  readonly commandParser?: (text: string) => { command: string; args: string[]; raw: string }[];
  emit(event: CognitiveEvent): void;
  getLastResponse(): string;
  setLastResponse(value: string): void;
}

const perceive = (host: CycleHost, stimulus: CognitiveStimulus): void => {
  host.emit({
    engine: 'metta',
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
    engine: 'metta',
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
    const narrative = await host.cortex.synthesize({ stimulus, context, derivations });
    narrativeText = narrative.text;
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
  host.setLastResponse('');

  perceive(host, stimulus);
  const { cid, context } = await recall(host, stimulus);

  const derivations = await reason(host, stimulus, context);
  const narrativeText = await narrate(host, stimulus, context, derivations);

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
};
