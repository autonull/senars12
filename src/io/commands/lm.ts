import type {CommandDefinition} from './registry.js';
import {requireNar} from './utils.js';

export const lmCommands: CommandDefinition[] = [
    {
        name: '/lm-status',
        aliases: ['.lm-status'],
        description: 'Show language model status',
        usage: '/lm-status',
        execute: async (_args, ctx) => {
            const nar = requireNar(ctx);
            if (!nar.ok) return nar.message;
            const lm = nar.nar.getLMClient();
            return lm ? `LM Status:\nProvider: ${lm.provider ?? 'unknown'}\nModel: ${lm.model ?? 'unknown'}\nAvailable: ${lm.available ? 'Yes' : 'No'}` : 'LM client not configured';
        }
    },
    {
        name: '/lm-switch',
        aliases: ['.lm-switch'],
        description: 'Switch language model',
        usage: '/lm-switch <model>',
        execute: async (args, ctx) => {
            const model = args[0];
            if (!model) return 'Usage: /lm-switch <model>';
            const nar = requireNar(ctx);
            if (!nar.ok) return nar.message;
            const lm = nar.nar.getLMClient();
            if (!lm) return 'LM client not configured';
            if (typeof lm.setModel === 'function') {
                lm.setModel(model);
                return `Switched to model: ${model}`;
            }
            return 'Model switching not supported by this LM client';
        }
    }
];
