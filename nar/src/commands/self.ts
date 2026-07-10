import type { CommandDefinition } from '@senars/core/command-types';
import type { NAR } from '../nar.js';
import type { ReasoningAboutReasoning } from '../self';

interface ExtendedNAR extends NAR {
  _reasoningAboutReasoning?: ReasoningAboutReasoning;
}

export const selfCommands: CommandDefinition[] = [
  {
    name: '/self',
    aliases: ['.self'],
    description: 'Show self-reasoning state',
    usage: '/self',
    execute: async (_args, ctx) => {
      const nar = (ctx as any).nar as ExtendedNAR | undefined;
      if (!nar) return 'NAR not configured';
      const rar = nar._reasoningAboutReasoning;
      if (!rar) return 'Self-reasoning not configured';
      const state = rar.getState();
      return `Self state: ${JSON.stringify(state, null, 2)}`;
    },
  },
  {
    name: '/self-reflect',
    aliases: ['.self-reflect'],
    description: 'Trigger a self-reflection cycle',
    usage: '/self-reflect',
    execute: async (_args, ctx) => {
      const nar = (ctx as any).nar as ExtendedNAR | undefined;
      if (!nar) return 'NAR not configured';
      const rar = nar._reasoningAboutReasoning;
      if (!rar) return 'Self-reasoning not configured';
      const result = await rar.reflect();
      return `Reflection: ${result ? result.summary : 'no insights'}`;
    },
  },
  {
    name: '/self-metrics',
    aliases: ['.self-metrics'],
    description: 'Show self-reasoning metrics',
    usage: '/self-metrics',
    execute: async (_args, ctx) => {
      const nar = (ctx as any).nar as ExtendedNAR | undefined;
      if (!nar) return 'NAR not configured';
      const rar = nar._reasoningAboutReasoning;
      if (!rar) return 'Self-reasoning not configured';
      const metrics = rar.getMetrics();
      return `Metrics: ${JSON.stringify(metrics, null, 2)}`;
    },
  },
  {
    name: '/self-history',
    aliases: ['.self-history'],
    description: 'Show self-reasoning history',
    usage: '/self-history',
    execute: async (_args, ctx) => {
      const nar = (ctx as any).nar as ExtendedNAR | undefined;
      if (!nar) return 'NAR not configured';
      const rar = nar._reasoningAboutReasoning;
      if (!rar) return 'Self-reasoning not configured';
      const history = rar.getHistory();
      return history.map((h: any) => `[${h.timestamp}] ${h.summary}`).join('\n');
    },
  },
];
