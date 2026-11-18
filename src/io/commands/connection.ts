import { silentLogger } from '@senars/util';
import type { ConnectionManager } from '../connection-manager.js';
import type { CommandDefinition } from './registry.js';

const NO_MANAGER = 'Connection manager not configured';

/** The command context's manager, or the one complaint every command makes. */
const managerOf = (ctx: { manager?: unknown }): ConnectionManager | undefined =>
  ctx.manager as ConnectionManager | undefined;

/**
 * A `/verb <id>` command over one existing connection.
 *
 * `/disconnect`, `/enable`, `/disable` and `/reconnect` were four field-for-field
 * copies — the manager lookup, the missing argument checked twice (once on the
 * count and once on the value, guarding the same `args[0]`), and a sentence that
 * differed only in its past-tense word. So the pair that decides *whether* the
 * verb runs was written eight times and the part that decides *what* it does was
 * written once.
 */
const byId = (
  name: string,
  description: string,
  done: string,
  act: (manager: ConnectionManager, id: string) => Promise<unknown>
): CommandDefinition => ({
  name,
  aliases: [`.${name.slice(1)}`],
  description,
  usage: `${name} <id>`,
  execute: async (args, ctx) => {
    const manager = managerOf(ctx);
    if (!manager) return NO_MANAGER;
    const id = args[0];
    if (!id) return `Usage: ${name} <id>`;
    await act(manager, id);
    return `Connection ${id} ${done}`;
  },
});

export const connectionCommands: CommandDefinition[] = [
  {
    name: '/connections',
    aliases: ['.connections'],
    description: 'Show all connections',
    usage: '/connections',
    execute: async (_args, ctx) => {
      const m = managerOf(ctx);
      if (!m) return NO_MANAGER;
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
      const m = managerOf(ctx);
      if (!m) return NO_MANAGER;
      const [id, type, ...configParts] = args;
      if (!id || !type) return 'Usage: /connect <id> <type> [config...]';
      const config = Object.fromEntries(
        configParts.map((p) => p.split('=')).filter(([k, v]) => k && v)
      );
      await m.addConnection(
        { id, type, enabled: true, config },
        { emit: () => {}, logger: silentLogger() }
      );
      return `Connection ${id} (${type}) created and connected`;
    },
  },
  byId('/disconnect', 'Disconnect and remove a connection', 'removed', (m, id) =>
    m.removeConnection(id)
  ),
  byId('/enable', 'Resume a disabled connection', 'enabled', (m, id) => m.enableConnection(id)),
  byId('/disable', 'Suspend a connection', 'disabled', (m, id) => m.disableConnection(id)),
  byId('/reconnect', 'Force reconnect a connection', 'reconnected', (m, id) =>
    m.reconnectConnection(id)
  ),
];
