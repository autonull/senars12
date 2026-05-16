import type {CommandContext, CommandDefinition} from './registry.js';

export const rlfpCommands: CommandDefinition[] = [
    {
        name: '.prefer',
        description: 'Record preference (preferred > rejected)',
        usage: '.prefer ',
  execute: async (args, ctx) => {
    if (args.length < 2) {
      return 'Usage: .prefer ';
    }
    const [preferred, rejected] = [args[0], args[1]];
    const narAny = ctx.nar as any;
    const rlfp = narAny.getRLFP?.();
    if (!rlfp) {
      return 'RLFP not enabled';
    }
    if (typeof rlfp.addPreference === 'function') {
      rlfp.addPreference(preferred, rejected);
    }
    return `Preference recorded: ${preferred} > ${rejected}`;
  }
    },
    {
        name: '.reward',
        description: 'Show reward status',
        usage: '.reward',
  execute: async (_args, ctx) => {
    const narAny = ctx.nar as any;
    const rlfp = narAny.getRLFP?.();
    if (!rlfp) {
      return 'RLFP not enabled';
    }
    return `RLFP Reward Status:\nPreferences: ${rlfp.preferences?.length ?? 0}`;
  }
    }
];