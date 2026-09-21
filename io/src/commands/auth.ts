import type { CommandDefinition } from './registry.js';
import type { AuthManager } from '../auth.js';

/**
 * D19 (TODO17b): /auth actually binds the sender via the AuthManager —
 * no hard-coded success without the work.
 */
export const createAuthCommands = (auth: AuthManager): CommandDefinition[] => [
  {
    name: '/auth',
    aliases: ['.auth'],
    description: 'Authenticate with the bot',
    usage: '/auth <secret>',
    execute: async (args, ctx) => {
      const secret = args[0];
      if (!secret) return 'Usage: /auth <secret>';
      const connectionId = ctx.connection.id;
      const senderId = ctx.connection.id;
      if (auth.checkAuth(connectionId, senderId, `.auth ${secret}`) === 'auth_bound') {
        auth.bindUser(connectionId, senderId);
        return 'Authentication successful';
      }
      return 'Authentication failed: invalid secret';
    },
  },
];