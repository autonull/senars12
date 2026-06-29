import type {CommandDefinition} from './registry.js';
import {requireManager, singleArgCmd} from './utils.js';

export const connectionCommands: CommandDefinition[] = [
    {
        name: '/connections',
        aliases: ['.connections'],
        description: 'Show all connections',
        usage: '/connections',
        execute: async (_args, ctx) => {
            const m = requireManager(ctx);
            if (!m.ok) return m.message;
            const connections = m.manager.getConnections();
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
            const m = requireManager(ctx);
            if (!m.ok) return m.message;
            const [id, type, ...configParts] = args;
            const config = Object.fromEntries(
                configParts.map((p) => p.split('=')).filter(([k, v]) => k && v)
            );
            await m.manager.addConnection(
                {id: id!, type: type!, enabled: true, config},
                {
                    nar: ctx.nar,
                    emit: () => {
                    },
                    logger: {
                        debug: () => {
                        },
                        info: () => {
                        },
                        warn: () => {
                        },
                        error: () => {
                        },
                        child: () =>
                            ({
                                debug: () => {
                                },
                                info: () => {
                                },
                                warn: () => {
                                },
                                error: () => {
                                },
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
        execute: singleArgCmd('/disconnect <id>', async (id, ctx) => {
            const m = requireManager(ctx);
            if (!m.ok) return m.message;
            await m.manager.removeConnection(id);
            return `Connection ${id} removed`;
        }),
    },
    {
        name: '/enable',
        aliases: ['.enable'],
        description: 'Resume a disabled connection',
        usage: '/enable <id>',
        execute: singleArgCmd('/enable <id>', async (id, ctx) => {
            const m = requireManager(ctx);
            if (!m.ok) return m.message;
            await m.manager.enableConnection(id);
            return `Connection ${id} enabled`;
        }),
    },
    {
        name: '/disable',
        aliases: ['.disable'],
        description: 'Suspend a connection',
        usage: '/disable <id>',
        execute: singleArgCmd('/disable <id>', async (id, ctx) => {
            const m = requireManager(ctx);
            if (!m.ok) return m.message;
            await m.manager.disableConnection(id);
            return `Connection ${id} disabled`;
        }),
    },
    {
        name: '/reconnect',
        aliases: ['.reconnect'],
        description: 'Force reconnect a connection',
        usage: '/reconnect <id>',
        execute: singleArgCmd('/reconnect <id>', async (id, ctx) => {
            const m = requireManager(ctx);
            if (!m.ok) return m.message;
            await m.manager.reconnectConnection(id);
            return `Connection ${id} reconnected`;
        }),
    },
];
