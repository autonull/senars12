import type {CommandDefinition} from './registry.js';

export const configCommands: CommandDefinition[] = [
    {
        name: '/config',
        aliases: ['.config'],
        description: 'Show current configuration',
        usage: '/config [key]',
        execute: async (args, ctx) => {
            const key = args[0];
            if (key) {
                return `Config: ${key} = ${(ctx.nar as any)._config?.[key] ?? 'not found'}`;
            }
            return 'Use /config <key> to get a value';
        }
    },
{
name: '/config.set',
aliases: ['.config.set'],
description: 'Set configuration value',
usage: '/config.set <key> <value>',
execute: async (args, ctx) => {
if (args.length < 2) return 'Usage: /config.set <key> <value>';
const key = args[0]!;
const value = args.slice(1).join(' ');
(ctx.nar as any)._config = {...(ctx.nar as any)._config, [key]: value};
return `Set ${key} = ${value}`;
}
},
{
name: '/config.reset',
aliases: ['.config.reset'],
description: 'Reset configuration to default',
usage: '/config.reset [key]',
execute: async (args, ctx) => {
if (args.length === 0) {
(ctx.nar as any)._config = {};
return 'Configuration reset to defaults';
}
const key = args[0]!;
if ((ctx.nar as any)._config?.[key]) {
delete (ctx.nar as any)._config[key];
return `Reset ${key} to default`;
}
return `Key ${key} not found in config`;
}
},
];