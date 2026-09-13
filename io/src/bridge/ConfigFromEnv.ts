export function createConnectionConfigsFromEnv(): Array<{
  type: string;
  id: string;
  [key: string]: unknown;
}> {
  const configs: Array<{ type: string; id: string; [key: string]: unknown }> = [];

  if (process.env.ENABLE_IRC !== 'false') {
    configs.push({
      type: 'irc',
      id: 'irc-main',
      enabled: true,
      config: {
        name: 'IRC Main',
        server: process.env.IRC_SERVER ?? 'irc.libera.chat',
        port: Number(process.env.IRC_PORT) || 6697,
        tls: true,
        nick: process.env.IRC_NICK ?? 'senars-bot',
        channels: (process.env.IRC_CHANNELS ?? '#senars').split(','),
      },
    });
  }

  if (process.env.ENABLE_WS !== 'false') {
    configs.push({
      type: 'websocket',
      id: 'ws-main',
      enabled: true,
      config: {
        name: 'WS Main',
        port: Number(process.env.WS_PORT) || 8765,
      },
    });
  }

  if (process.env.ENABLE_HTTP === 'true') {
    configs.push({
      type: 'http',
      id: 'http-main',
      enabled: true,
      config: {
        name: 'HTTP Main',
        port: Number(process.env.HTTP_PORT) || 3000,
      },
    });
  }

  if (process.env.ENABLE_MCP === 'true') {
    configs.push({
      type: 'mcp',
      id: 'mcp-main',
      enabled: true,
      config: {
        name: 'MCP Main',
        transport: process.env.MCP_TRANSPORT ?? 'stdio',
      },
    });
  }

  return configs;
}
