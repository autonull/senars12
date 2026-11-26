/**
 * `senars serve` — Server commands (MCP, HTTP, WebSocket).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { serveMcpModule } from './mcp';
import { serveHttpModule } from './http';
import { serveWsModule } from './ws';

// Register serve subcommands
registerCommand('serve mcp', serveMcpModule);
registerCommand('serve http', serveHttpModule);
registerCommand('serve ws', serveWsModule);

export const serveModule: CommandModule = {
  main: async () => {
    // This shouldn't be called directly; subcommands handle execution
    console.error('Usage: senars serve <mcp|http|ws>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars serve <mcp|http|ws> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  mcp    Start MCP server (stdio, SSE, or Streamable HTTP)',
        '  http   Start HTTP server',
        '  ws     Start WebSocket server',
      ],
    },
  ],
  subcommands: new Map([
    ['mcp', serveMcpModule],
    ['http', serveHttpModule],
    ['ws', serveWsModule],
  ]),
};