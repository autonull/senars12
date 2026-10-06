import type { CommandDefinition } from '@senars/util';
import type { NAR } from '../nar.js';
import type { ReasoningAboutReasoning } from '../self/ReasoningAboutReasoning.js';
import { requiring } from './utils.js';

interface ExtendedNAR extends NAR {
  _reasoningAboutReasoning?: ReasoningAboutReasoning;
}

function resolveRar(ctx: unknown): ReasoningAboutReasoning | undefined {
  return (ctx as { nar?: ExtendedNAR })?.nar?._reasoningAboutReasoning;
}

export const selfCommands: CommandDefinition[] = [
  {
    name: '/self',
    aliases: ['.self'],
    description: 'Show self-reasoning state',
    usage: '/self',
    execute: requiring('Self-reasoning', resolveRar, async (rar) => {
      return `Self state: ${JSON.stringify(rar.getReasoningState(), null, 2)}`;
    }),
  },
  {
    name: '/self-reflect',
    aliases: ['.self-reflect'],
    description: 'Trigger a self-reflection cycle',
    usage: '/self-reflect',
    execute: requiring('Self-reasoning', resolveRar, async (rar) => {
      const result = await rar.performMetaCognitiveReasoning();
      if (!result.success) return `Reflection failed${result.error ? `: ${result.error}` : ''}`;
      const tasks = result.tasksProcessed ?? 0;
      return `Reflection complete: ${tasks} meta-task(s) processed at ${new Date(result.timestamp ?? Date.now()).toISOString()}`;
    }),
  },
  {
    name: '/self-metrics',
    aliases: ['.self-metrics'],
    description: 'Show self-reasoning metrics',
    usage: '/self-metrics',
    execute: requiring('Self-reasoning', resolveRar, async (rar) => {
      const analysis = await rar.getSystemAnalysis();
      return `Metrics: ${JSON.stringify(analysis, null, 2)}`;
    }),
  },
  {
    name: '/self-history',
    aliases: ['.self-history'],
    description: 'Show self-reasoning trace',
    usage: '/self-history',
    execute: requiring('Self-reasoning', resolveRar, async (rar) => {
      const trace = rar.getReasoningTrace();
      if (Array.isArray(trace) && trace.length === 0) return 'No reasoning trace';
      return trace.map((h: unknown, i: number) => `[${i + 1}] ${JSON.stringify(h)}`).join('\n');
    }),
  },
];
