import type {CommandDefinition} from './registry.js';

export const configCommands: CommandDefinition[] = [
    {
        name: '.config',
        description: 'Show current configuration',
        usage: '.config [key]',
        execute: async (args, ctx) => {
            const key = args[0];
            if (key) {
                return `Config: ${key} = ${(ctx.nar as any)._config?.[key] ?? 'not found'}`;
            }
            return 'Use .config <key> to get a value';
        }
    },
    {
        name: '.config.set',
        description: 'Set configuration value',
        usage: '.config.set <key> <value>',
        execute: async (args) => {
            if (args.length < 2) return 'Usage: .config.set <key> <value>';
            return 'Config mutation not yet implemented';
        }
    },
    {
        name: '.config.reset',
        description: 'Reset configuration to default',
        usage: '.config.reset [key]',
        execute: async () => {
            return 'Config reset not yet implemented';
        }
    },
];