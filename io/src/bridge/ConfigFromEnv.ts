/**
 * Canonical environment → transport-connection-config reader.
 * Single source of truth: every `ENABLE_*` gate and transport address in the
 * process resolves here, accepting `SENARS_*`-prefixed aliases and optional
 * config-file overrides.
 */

import { envBool, envCsv, envFirst, envInt, envStrOr } from '@senars/util/config';
import type { ConnectionConfig } from '../types.js';

export interface TransportEnvOverrides {
  readonly irc?: {
    readonly server?: string;
    readonly port?: number;
    readonly nick?: string;
    readonly channels?: readonly string[];
    readonly useTLS?: boolean;
  };
}

const DEFAULTS = {
  irc: { server: 'irc.libera.chat', port: 6697, nick: 'senars-bot', channel: '#senars' },
  wsPort: 8765,
  httpPort: 3000,
  mcpTransport: 'stdio',
} as const;

export function createConnectionConfigsFromEnv(
  overrides: TransportEnvOverrides = {}
): ConnectionConfig[] {
  const configs: ConnectionConfig[] = [];
  const irc = overrides.irc;
  const ircPassword = envFirst('SENARS_IRC_AUTH_SECRET');

  if (envBool('ENABLE_IRC')) {
    configs.push({
      type: 'irc',
      id: 'irc-main',
      enabled: true,
      config: {
        name: 'IRC Main',
        server: envStrOr(irc?.server ?? DEFAULTS.irc.server, 'IRC_SERVER', 'SENARS_IRC_SERVER'),
        port: irc?.port ?? envInt('SENARS_IRC_PORT', Number(envInt('IRC_PORT', DEFAULTS.irc.port))),
        tls: irc?.useTLS ?? true,
        nick: envStrOr(irc?.nick ?? DEFAULTS.irc.nick, 'IRC_NICK', 'SENARS_IRC_NICK'),
        channels: irc?.channels?.length
          ? [...irc.channels]
          : envCsv([DEFAULTS.irc.channel], 'IRC_CHANNELS', 'SENARS_IRC_CHANNELS'),
        ...(ircPassword ? { password: ircPassword } : {}),
      },
    });
  }

  if (envBool('ENABLE_WS')) {
    configs.push({
      type: 'websocket',
      id: 'ws-main',
      enabled: true,
      config: {
        name: 'WS Main',
        port: envInt('WS_PORT', envInt('SENARS_WS_PORT', DEFAULTS.wsPort)),
      },
    });
  }

  if (envBool('ENABLE_HTTP')) {
    configs.push({
      type: 'http',
      id: 'http-main',
      enabled: true,
      config: {
        name: 'HTTP Main',
        port: envInt('HTTP_PORT', envInt('SENARS_HTTP_PORT', DEFAULTS.httpPort)),
      },
    });
  }

  if (envBool('ENABLE_MCP')) {
    configs.push({
      type: 'mcp',
      id: 'mcp-main',
      enabled: true,
      config: {
        name: 'MCP Main',
        transport: envStrOr(DEFAULTS.mcpTransport, 'MCP_TRANSPORT', 'SENARS_MCP_TRANSPORT'),
      },
    });
  }

  return configs;
}
