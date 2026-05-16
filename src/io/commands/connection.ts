import type {CommandDefinition} from './registry.js';
import {singleArgCmd} from './utils.js';

export const connectionCommands: CommandDefinition[] = [
    {
        name: '.connections',
        description: 'Show all connections',
        usage: '.connections',
        execute: async (_args, ctx) => {
            const connections = ctx.manager.getConnections();
            if (connections.size === 0) return 'No active connections';
            return Array.from(connections, ([id, conn]) => `  ${id} (${conn.type}): ${conn.getStatus().state}`).join('\n');
        }
    },
    {
        name: '.connect',
        description: 'Create and connect a new connection',
        usage: '.connect <id> <type> [config...]',
        execute: async (args, ctx) => {
            if (args.length < 2) return 'Usage: .connect <id> <type> [config...]';
            const [id, type, ...configParts] = args;
            const config = Object.fromEntries(configParts.map(p => p.split('=')).filter(([k, v]) => k && v));
            await ctx.manager.addConnection({id: id!, type: type!, enabled: true, config}, {
                nar: ctx.nar, emit: () => {
                }
            });
            return `Connection ${id} (${type}) created and connected`;
        }
    },
    {
        name: '.disconnect',
        description: 'Disconnect and remove a connection',
        usage: '.disconnect <id>',
        execute: singleArgCmd('.disconnect <id>', async (id, ctx) => {
            await ctx.manager.removeConnection(id);
            return `Connection ${id} removed`;
        })
    },
    {
        name: '.enable',
        description: 'Resume a disabled connection',
        usage: '.enable <id>',
        execute: singleArgCmd('.enable <id>', async (id, ctx) => {
            await ctx.manager.enableConnection(id);
            return `Connection ${id} enabled`;
        })
    },
    {
        name: '.disable',
        description: 'Suspend a connection',
        usage: '.disable <id>',
        execute: singleArgCmd('.disable <id>', async (id, ctx) => {
            await ctx.manager.disableConnection(id);
            return `Connection ${id} disabled`;
        })
    },
    {
        name: '.reconnect',
        description: 'Force reconnect a connection',
        usage: '.reconnect <id>',
        execute: singleArgCmd('.reconnect <id>', async (id, ctx) => {
            await ctx.manager.reconnectConnection(id);
            return `Connection ${id} reconnected`;
        })
    }
];
