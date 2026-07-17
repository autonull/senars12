import type { CommandDefinition } from './registry.js';
import type { ConnectionManager } from '../connection-manager.js';

export const connectionCommands: CommandDefinition[] = [
  {
    name: '/connections',
    aliases: ['.connections'],
    description: 'Show all connections',
    usage: '/connections',
    execute: async (_args, ctx) => {
      const m = ctx.manager as ConnectionManager | undefined;
      if (!m) return 'Connection manager not configured';
      const connections = m.getConnections();
      if (connections.size === 0) return 'No active connections';
      return Array.from(
        connections,
        ([id, conn]) => `  ${id} (${conn.type}): ${conn.getStatus().state}`
      ).join('\n');
    },
  },
  {
    name: '/connect',
    aliases: ['.connect'],
    description: 'Create and connect a new connection',
    usage: '/connect <id> <type> [config...]',
    execute: async (args, ctx) => {
      if (args.length < 2) return 'Usage: /connect <id> <type> [config...]';
      const m = ctx.manager as ConnectionManager | undefined;
      if (!m) return 'Connection manager not configured';
      const [id, type, ...configParts] = args;
      const config = Object.fromEntries(
        configParts.map((p) => p.split('=')).filter(([k, v]) => k && v)
      );
      await m.addConnection(
        { id: id!, type: type!, enabled: true, config },
        {
          emit: () => {},
          logger: {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            child: () =>
              ({
                debug: () => {},
                info: () => {},
                warn: () => {},
                error: () => {},
                child: () => ({}) as never,
              }) as never,
          },
        }
      );
      return `Connection ${id} (${type}) created and connected`;
    },
  },
  {
    name: '/disconnect',
    aliases: ['.disconnect'],
    description: 'Disconnect and remove a connection',
    usage: '/disconnect <id>',
    execute: async (args, ctx) => {
      if (args.length < 1) return 'Usage: /disconnect <id>';
      const m = ctx.manager as ConnectionManager | undefined;
      if (!m) return 'Connection manager not configured';
      await m.removeConnection(args[0]!);
      return `Connection ${args[0]} removed`;
    },
  },
  {
    name: '/enable',
    aliases: ['.enable'],
    description: 'Resume a disabled connection',
    usage: '/enable <id>',
    execute: async (args, ctx) => {
      if (args.length < 1) return 'Usage: /enable <id>';
      const m = ctx.manager as ConnectionManager | undefined;
      if (!m) return 'Connection manager not configured';
      await m.enableConnection(args[0]!);
      return `Connection ${args[0]} enabled`;
    },
  },
  {
    name: '/disable',
    aliases: ['.disable'],
    description: 'Suspend a connection',
    usage: '/disable <id>',
    execute: async (args, ctx) => {
      if (args.length < 1) return 'Usage: /disable <id>';
      const m = ctx.manager as ConnectionManager | undefined;
      if (!m) return 'Connection manager not configured';
      await m.disableConnection(args[0]!);
      return `Connection ${args[0]} disabled`;
    },
  },
  {
    name: '/reconnect',
    aliases: ['.reconnect'],
    description: 'Force reconnect a connection',
    usage: '/reconnect <id>',
    execute: async (args, ctx) => {
      if (args.length < 1) return 'Usage: /reconnect <id>';
      const m = ctx.manager as ConnectionManager | undefined;
      if (!m) return 'Connection manager not configured';
      await m.reconnectConnection(args[0]!);
      return `Connection ${args[0]} reconnected`;
    },
  },
];
