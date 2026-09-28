/** Connection lifecycle (`.connect`/`.disconnect`/`.connections`) and per-connection auth secrets. */

import { errMsg } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import { flagsOf, tokenize } from './args.js';
import type { BotRuntime } from './context.js';

const HELP = `SeNARS Bot — CLI-first (.help, .quit, or just chat)

Connection:
  .connect irc [server] [port] [nick] [#ch1,#ch2] [--tls|--no-tls] [--password p]
  .connect ws [port] [--greeting msg]
  .connect http [port] [--api-key k] [--cors]
  .connect mcp [stdio|http|sse] [--approval] [--api-key k] [--rate-limit n]
  .disconnect <id> | .connections [id]
Core: .stats .beliefs .concepts .attention .episodes .know .recall .sessions .session .throttle .tier .status .clear
Profile: .profile [field value] | Skills: .skills .skill-enable .skill-disable .skill-add .skill-remove .skill-edit | Memory: .consolidate .memory-stats .memory-export .memory-import .memory-clear
LM: .lm-config .lm-provider .lm-model .lm-rules .lm-rule-enable .lm-rule-disable .routing .routing-set .routing-offline .circuit-breakers .circuit-reset | SystemOne: .systemone .manifold .calibrate .distill .selftune .decide .judge
Diag: .doctor .health .benchmarks .routing-log .spend .gates | .webui [port]|stop | .arcade | .multiagent | .config-show .config-set .config-save .config-reload .config-reset | .auth-list .auth-add .auth-remove
Dialogue: .react .turns .retrospect .retrospectives .lessons .reconsolidate .probes .adaptations .schemas-induce`;

export const connectionCommandsFor = (rt: BotRuntime) => [
  cmd('help', 'Show all commands (categorized)', () => HELP),
  cmd('connect', 'Start a connection: irc|ws|http|mcp', async (args = '') => {
    const { positional, str, has } = flagsOf(args);
    const [kind, ...rest] = positional;
    try {
      if (kind?.toLowerCase() === 'irc') {
        const [server = 'irc.libera.chat', port = '6697', nick = 'senars-bot', chans = '#senars'] = rest;
        const password = str('--password', '');
        return await rt.attach({
          id: `irc-${Date.now()}`,
          type: 'irc',
          config: {
            name: 'IRC',
            server,
            port: Number(port),
            nick,
            channels: chans
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            tls: !has('--no-tls'),
            ...(password ? { password } : {}),
          },
        });
      }
      if (kind === 'ws' || kind === 'websocket') {
        const greeting = str('--greeting', '');
        return await rt.attach({
          id: `ws-${Date.now()}`,
          type: 'websocket',
          config: {
            name: 'WS',
            port: Number(rest[0] ?? '8765'),
            ...(greeting ? { greeting } : {}),
          },
        });
      }
      if (kind === 'http') {
        const apiKey = str('--api-key', '');
        return await rt.attach({
          id: `http-${Date.now()}`,
          type: 'http',
          config: {
            name: 'HTTP',
            port: Number(rest[0] ?? '3000'),
            ...(apiKey ? { apiKey } : {}),
            cors: has('--cors'),
          },
        });
      }
      if (kind === 'mcp') {
        const apiKey = str('--api-key', '');
        const rateLimit = str('--rate-limit', '');
        return await rt.attach({
          id: `mcp-${Date.now()}`,
          type: 'mcp',
          config: {
            name: 'MCP',
            transport: rest[0] ?? 'stdio',
            ...(has('--approval') ? { approval: true } : {}),
            ...(apiKey ? { apiKey } : {}),
            ...(rateLimit ? { rateLimit: Number(rateLimit) } : {}),
          },
        });
      }
      return 'Usage: .connect irc|ws|http|mcp [...]';
    } catch (e) {
      return `connect failed: ${errMsg(e)}`;
    }
  }),
  cmd('disconnect', 'Disconnect and remove a connection', async (args = '') => {
    const [raw] = tokenize(args);
    if (!raw) return 'Usage: .disconnect <connection-id|irc|ws|http|mcp>';
    const key = raw.toLowerCase();
    try {
      const id =
        rt.cm.getConnection(raw)?.id ??
        [...rt.cm.getConnections()].find(
          ([, c]) => c.type === key || c.type.replace('websocket', 'ws') === key
        )?.[0];
      if (!id) return `Unknown connection: ${key}`;
      await rt.cm.removeConnection(id);
      return `Disconnected ${id}`;
    } catch (e) {
      return `disconnect failed: ${errMsg(e)}`;
    }
  }),
  cmd('connections', 'List connections or show one in detail', (args = '') => {
    const [id] = tokenize(args);
    if (id) {
      const c = rt.cm.getConnection(id);
      if (!c) return `Unknown connection: ${id}`;
      const s = c.getStatus();
      return `${c.id} (${c.type}): ${s.state} msgs=${s.messageCount} errs=${s.errorCount}`;
    }
    const all = rt.cm.getConnections();
    if (all.size === 0) return 'No active connections (CLI-only mode)';
    return [...all].map(([cid, c]) => `  ${cid} (${c.type}): ${c.getStatus().state}`).join('\n');
  }),
  cmd('auth-list', 'List connections with auth secrets', () =>
    rt.secretIds.size
      ? [...rt.secretIds].map((id) => `  ${id}: secret set`).join('\n')
      : '(no auth secrets set)'
  ),
  cmd('auth-add', 'Set auth secret for a connection', (args = '') => {
    const [id, secret] = tokenize(args);
    if (!id || !secret) return 'Usage: .auth-add <connection-id> <secret>';
    rt.auth.setSecret(id, secret);
    rt.secretIds.add(id);
    return `Secret set for ${id}`;
  }),
  cmd('auth-remove', 'Remove auth secret', (args = '') => {
    const id = args.trim();
    if (!id) return 'Usage: .auth-remove <connection-id>';
    rt.auth.removeSecret(id);
    rt.secretIds.delete(id);
    return `Secret removed for ${id}`;
  }),
];
