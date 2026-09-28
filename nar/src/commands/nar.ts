import type { CommandDefinition } from '@senars/core/command-types';
import { formatNarseseTruth } from '@senars/util';
import { filterByTerm } from '../memory/term-filter.js';
import { termParser } from '../terms';
import { NAR_UNCONFIGURED, narOf } from './utils.js';

export const narCommands: CommandDefinition[] = [
  {
    name: '/believe',
    aliases: ['.believe'],
    description: 'Add a belief to NAR (Narsese)',
    usage: '/believe <narsese>',
    execute: async (args, ctx) => {
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
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
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
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
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
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
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
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
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
      const raw = args.join(' ');
      if (!raw) return 'Usage: /concept <term>';
      const term = termParser.parse(raw);
      const concept = nar.getConcept(term);
      if (!concept) return `Concept not found: ${raw}`;
      const beliefs = concept.getBeliefs?.() ?? [];
      return `Concept: ${raw}\nBeliefs: ${beliefs.length}`;
    },
  },
  {
    name: '/truth',
    aliases: ['.truth'],
    description: 'Get truth value of a term',
    usage: '/truth <term>',
    execute: async (args, ctx) => {
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
      const raw = args.join(' ');
      if (!raw) return 'Usage: /truth <term>';
      const truth = filterByTerm(nar.getBeliefs(), raw, 1)[0]?.truth;
      if (!truth) return `No truth value for: ${raw}`;
      return `${raw} ${formatNarseseTruth(truth)}`;
    },
  },
];
