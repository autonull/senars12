import type {CommandDefinition} from './registry.js';
import {requireNar} from './utils.js';

export const rlfpCommands: CommandDefinition[] = [
{
	name: '/prefer',
	aliases: ['.prefer'],
	description: 'Record preference (preferred > rejected)',
	usage: '/prefer <preferred> <rejected>',
	execute: async (args, ctx) => {
		if (args.length < 2) return 'Usage: /prefer <preferred> <rejected>';
		const nar = requireNar(ctx);
		if (!nar.ok) return nar.message;
		const [preferred, rejected] = args;
		const rlfp = nar.nar.getRLFP();
		if (!rlfp) return 'RLFP not enabled';
		if (typeof rlfp.addPreference === 'function') rlfp.addPreference(preferred!, rejected!);
		return `Preference recorded: ${preferred} > ${rejected}`;
	}
},
{
	name: '/reward',
	aliases: ['.reward'],
	description: 'Show reward status',
	usage: '/reward',
	execute: async (_args, ctx) => {
		const nar = requireNar(ctx);
		if (!nar.ok) return nar.message;
		const rlfp = nar.nar.getRLFP();
		return rlfp ? `RLFP Reward Status:\nPreferences: ${rlfp.preferences?.length ?? 0}` : 'RLFP not enabled';
	}
},
{
	name: '/policy',
	aliases: ['.policy'],
	description: 'Show policy optimizer strategies',
	usage: '/policy',
	execute: async (_args, ctx) => {
		const nar = requireNar(ctx);
		if (!nar.ok) return nar.message;
		const rlfp = nar.nar.getRLFP();
		if (!rlfp) return 'RLFP not enabled';
		return 'Policy optimizer strategies:\n- Default: preference-based learning\n- Status: Active\n(Note: Detailed policy info pending implementation)';
	}
}
];
