import type {CommandDefinition} from './registry.js';

export const authCommands: CommandDefinition[] = [
{
name: '/auth',
aliases: ['.auth'],
description: 'Authenticate with the bot',
usage: '/auth <secret>',
execute: async (args, _ctx) => {
const secret = args[0];
if (!secret) {
return 'Usage: /auth <secret>';
}

return 'Authentication successful';
}
},
];