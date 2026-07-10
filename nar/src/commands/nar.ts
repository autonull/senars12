import type { CommandDefinition } from '@senars/core/command-types';
import { mentionsSymbol } from '../terms';

// Copy of exact original src/io/commands/nar.ts content
export const narCommands: CommandDefinition[] = [
  {
    name: '/believe',
    aliases: ['.believe'],
    description: 'Add a belief to NAR (Narsese)',
    usage: '/believe <narsese>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const narsese = args.join(' ');
      if (!narsese) return 'Usage: /believe <narsese>';
      await nar.input(narsese);
      return `Believed: ${narsese}`;
    },
  },
  {
    name: '/ask',
    aliases: ['.ask'],
    description: 'Ask a question to NAR (Narsese)',
    usage: '/ask <narsese>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const narsese = args.join(' ');
      if (!narsese) return 'Usage: /ask <narsese>';
      await nar.input(`${narsese}?`);
      return `Asked: ${narsese}?`;
    },
  },
  {
    name: '/goal',
    aliases: ['.goal'],
    description: 'Set a goal in NAR (Narsese)',
    usage: '/goal <narsese>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const narsese = args.join(' ');
      if (!narsese) return 'Usage: /goal <narsese>';
      await nar.input(`${narsese}!`);
      return `Goal set: ${narsese}!`;
    },
  },
  {
    name: '/derive',
    aliases: ['.derive'],
    description: 'Run N cycles of inference',
    usage: '/derive [n]',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const steps = args[0] ? Number.parseInt(args[0]) : 5;
      const derived = await nar.run(steps);
      return `Derived ${derived} belief(s) in ${steps} step(s)`;
    },
  },
  {
    name: '/concept',
    aliases: ['.concept'],
    description: 'Show concept details',
    usage: '/concept <term>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const term = args.join(' ');
      if (!term) return 'Usage: /concept <term>';
      const concept = nar.getConcept(term);
      if (!concept) return `Concept not found: ${term}`;
      const beliefs = concept.getBeliefs?.() ?? [];
      return `Concept: ${term}\nBeliefs: ${beliefs.length}`;
    },
  },
  {
    name: '/truth',
    aliases: ['.truth'],
    description: 'Get truth value of a term',
    usage: '/truth <term>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const term = args.join(' ');
      if (!term) return 'Usage: /truth <term>';
      const truth = nar.getTruth(term);
      if (!truth) return `No truth value for: ${term}`;
      return `${term} ${truth}`;
    },
  },
];
