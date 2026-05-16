import type {CommandDefinition} from './registry.js';

export const rlfpCommands: CommandDefinition[] = [
    {
        name: '.prefer',
        description: 'Record preference (preferred > rejected)',
        usage: '.prefer <preferred> <rejected>',
        execute: async (args, ctx) => {
            if (args.length < 2) return 'Usage: .prefer <preferred> <rejected>';
            const [preferred, rejected] = args;
            const rlfp = ctx.nar.getRLFP();
            if (!rlfp) return 'RLFP not enabled';
            if (typeof rlfp.addPreference === 'function') rlfp.addPreference(preferred!, rejected!);
            return `Preference recorded: ${preferred} > ${rejected}`;
        }
    },
    {
        name: '.reward',
        description: 'Show reward status',
        usage: '.reward',
        execute: async (_args, ctx) => {
            const rlfp = ctx.nar.getRLFP();
            return rlfp ? `RLFP Reward Status:\nPreferences: ${rlfp.preferences?.length ?? 0}` : 'RLFP not enabled';
        }
    }
];
