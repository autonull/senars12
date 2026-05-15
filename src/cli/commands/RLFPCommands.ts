import type {CommandDefinition} from './index.js';
import {box} from '../display.js';

export const RLFPCommands: CommandDefinition[] = [
    {
        name: '.prefer',
        description: 'Record preference (preferred > rejected)',
        usage: '.prefer <preferred> <rejected>',
        handler: (ctx, args) => {
            if (args.length < 2) {
                ctx.logger.info('Usage: .prefer <prefered> <rejected>');
                return;
            }

            const rlfp = ctx.getRLFP();
            if (!rlfp) {
                ctx.logger.info('RLFP not enabled');
                return;
            }

            const [preferred, rejected] = [args[0]!, args[1]!];
            rlfp.addPreference?.(preferred, rejected);
            ctx.logger.info(`✓ Preference recorded: ${preferred} > ${rejected}`);
        }
    },
    {
        name: '.reward',
        description: 'Show reward status',
        usage: '.reward',
        handler: (ctx) => {
            const rlfp = ctx.getRLFP();
            if (!rlfp) {
                ctx.logger.info('RLFP not enabled');
                return;
            }

            ctx.logger.info('\n' + box('RLFP Reward Status', [
                `Preferences: ${rlfp.preferences?.length ?? 0}`
            ]) + '\n');
        }
    },
    {
        name: '.rlfp-stats',
        description: 'Show RLFP statistics',
        usage: '.rlfp-stats',
        handler: (ctx) => {
            const rlfp = ctx.getRLFP();
            if (!rlfp) {
                ctx.logger.info('RLFP not enabled');
                return;
            }

            ctx.logger.info('\n' + box('RLFP Statistics', [
                `Preferences: ${String(rlfp.preferences?.length ?? 0)}`,
                `Trajectories: ${String(rlfp.trajectoryCount ?? 0)}`,
                `Last Optimization: ${rlfp.lastOptimizeTime ? new Date(rlfp.lastOptimizeTime).toLocaleTimeString() : 'Never'}`
            ]) + '\n');
        }
    }
];