import type {CommandDefinition} from './registry.js';

export const authCommands: CommandDefinition[] = [
    {
        name: '.auth',
        description: 'Authenticate with the bot',
        usage: '.auth <secret>',
        execute: async (_args, _ctx) => {
            return 'Use .auth <secret> to authenticate';
        }
    },
];