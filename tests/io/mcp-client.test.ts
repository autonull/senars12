import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPConnection } from '@senars/io';
import { describe, expect, it } from 'vitest';

describe('MCPConnection (in-memory transport)', () => {
  it('connects, lists tools, and calls tools through the linked pair', async () => {
    const server = new McpServer({ name: 'test-server', version: '0.0.1' });
    server.registerTool('echo', { description: 'echo', inputSchema: {} }, async () => ({
      content: [{ type: 'text', text: 'pong' }],
    }));
    const pair = InMemoryTransport.createLinkedPair();
    await server.connect(pair[1]);

    const conn = new MCPConnection(
      {
        id: 'mcp1',
        type: 'mcp',
        config: { name: 'TestMCP', transport: 'in-memory', inMemoryPair: pair },
      } as never,
      { emit: () => undefined } as never
    );
    await conn.connect();
    expect(conn.state).toBe('connected');

    const tools = await conn.getTools();
    expect(tools.map((t) => t.name)).toContain('echo');

    const result = await conn.callTool('echo', {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toBe('pong');

    const sent = await conn.send('echo', '{}');
    expect(sent).toBeUndefined();

    await conn.disconnect('done');
    expect(conn.state).toBe('disconnected');
    await server.close();
  });

  it('returns an error result when calling a tool while disconnected', async () => {
    const conn = new MCPConnection(
      {
        id: 'mcp2',
        type: 'mcp',
        config: {
          name: 'TestMCP',
          transport: 'in-memory',
          inMemoryPair: InMemoryTransport.createLinkedPair(),
        },
      } as never,
      { emit: () => undefined } as never
    );
    const res = await conn.callTool('echo', {});
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain('not connected');
  });
});
