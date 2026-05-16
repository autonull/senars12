import type {CommandContext, CommandDefinition} from './registry.js';

export const connectionCommands: CommandDefinition[] = [
    {
        name: '.connections',
        description: 'Show all connections',
        usage: '.connections',
        execute: async (_args, ctx) => {
            const connections = ctx.manager.getConnections();
            if (connections.size === 0) {
                return 'No active connections';
            }
            const lines: string[] = ['Active Connections:'];
            for (const [id, conn] of connections) {
                const status = conn.getStatus();
                lines.push(`  ${id} (${conn.type}): ${status.state}`);
            }
            return lines.join('\n');
        }
    },
    {
        name: '.connect',
        description: 'Create and connect a new connection',
        usage: '.connect <id> <type> [config...]',
  execute: async (args, ctx) => {
    if (args.length < 2) {
      return 'Usage: .connect <id> <type> [config...]';
    }
    const [id, type, ...configParts] = args;
    if (!id || !type) {
      return 'Usage: .connect <id> <type> [config...]';
    }
    const config: Record<string, unknown> = {};
    for (const pair of configParts) {
      const [key, value] = pair.split('=');
      if (key && value) {
        config[key] = value;
      }
    }
    const connectionConfig = {id, type, enabled: true, config};
    await ctx.manager.addConnection(connectionConfig, {nar: ctx.nar, emit: () => {}});
    return `Connection ${id} (${type}) created and connected`;
  }
    },
    {
        name: '.disconnect',
        description: 'Disconnect and remove a connection',
        usage: '.disconnect <id>',
  execute: async (args, ctx) => {
    if (args.length < 1) {
      return 'Usage: .disconnect <id>';
    }
    const [id] = args;
    if (!id) {
      return 'Usage: .disconnect <id>';
    }
    await ctx.manager.removeConnection(id);
    return `Connection ${id} removed`;
  }
    },
    {
        name: '.enable',
        description: 'Resume a disabled connection',
        usage: '.enable <id>',
  execute: async (args, ctx) => {
    if (args.length < 1) {
      return 'Usage: .enable <id>';
    }
    const [id] = args;
    if (!id) {
      return 'Usage: .enable <id>';
    }
    await ctx.manager.enableConnection(id);
    return `Connection ${id} enabled`;
  }
    },
    {
        name: '.disable',
        description: 'Suspend a connection',
        usage: '.disable <id>',
  execute: async (args, ctx) => {
    if (args.length < 1) {
      return 'Usage: .disable <id>';
    }
    const [id] = args;
    if (!id) {
      return 'Usage: .disable <id>';
    }
    await ctx.manager.disableConnection(id);
    return `Connection ${id} disabled`;
  }
    },
    {
        name: '.reconnect',
        description: 'Force reconnect a connection',
        usage: '.reconnect <id>',
  execute: async (args, ctx) => {
    if (args.length < 1) {
      return 'Usage: .reconnect <id>';
    }
    const [id] = args;
    if (!id) {
      return 'Usage: .reconnect <id>';
    }
    await ctx.manager.reconnectConnection(id);
    return `Connection ${id} reconnected`;
  }
    }
];