/**
 * CORE.19 C7.3 — MCP resources report real state, not `[]`/zeros.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createNAR } from '@senars/nar';
import type { ExtendedAgent } from '@senars/nar/agent';
import { afterEach, describe, expect, it } from 'vitest';
import { registerMCPResources } from '../../src/bin/lib/mcp/mcp-resources.js';

const connect = async (server: McpServer): Promise<Client> => {
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
};

const readJson = async (client: Client, uri: string): Promise<unknown> => {
  const result = await client.readResource({ uri });
  return JSON.parse(result.contents[0]!.text as string);
};

describe('CORE.19 C7.3 — MCP resources report real state', () => {
  const disposables: Array<{ stop(): Promise<void>; dispose(): Promise<void> }> = [];
  afterEach(async () => {
    for (const nar of disposables.splice(0)) {
      await nar.stop();
      await nar.dispose();
    }
  });

  it('reflects a seeded agent in beliefs, state, episodes, sessions and quality', async () => {
    const nar = createNAR({ enableSelf: true, persistState: false });
    disposables.push(nar);
    await nar.start();
    await nar.believe('(cat-->animal).');
    await nar.run(3);

    const agent = {
      getEpisodicMemory: async () => ({
        getEpisodes: async () => [{ type: 'dialogue' }, { type: 'observation' }],
      }),
    } as unknown as ExtendedAgent;
    const sessions = {
      list: () => [{ key: 'default', createdAt: 1, lastSeenAt: 2, history: [{}] }],
    };

    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerMCPResources(server, { nar, agent, sessions });
    const client = await connect(server);

    const state = (await readJson(client, 'nar://state')) as {
      beliefs: unknown[];
      persisted: unknown;
    };
    expect(state.beliefs.length).toBeGreaterThan(0);
    expect('persisted' in state).toBe(true);

    const episodes = (await readJson(client, 'nar://episodes')) as { episodes: unknown[] };
    expect(episodes.episodes).toHaveLength(2);

    const sessionList = (await readJson(client, 'sessions://list')) as Array<{ key: string }>;
    expect(sessionList).toEqual([{ key: 'default', createdAt: 1, lastSeenAt: 2, turns: 1 }]);

    const quality = (await readJson(client, 'self-reasoning://quality')) as {
      available: boolean;
      overall?: number;
    };
    expect(quality.available).toBe(true);
    expect(typeof quality.overall).toBe('number');

    await client.close();
  });

  it('reflects the persisted boundary a restart would resume', async () => {
    const statePath = mkdtempSync(join(tmpdir(), 'core19-c7.3-'));
    const original = createNAR({ enableSelf: true, persistState: true, statePath });
    disposables.push(original);
    await original.start();
    await original.run(4);
    await original.stop();

    const resumed = createNAR({ enableSelf: true, persistState: true, statePath });
    disposables.push(resumed);
    await resumed.start();

    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerMCPResources(server, { nar: resumed });
    const client = await connect(server);

    const state = (await readJson(client, 'nar://state')) as {
      persisted: { cycleCount: number; pendingTasks: number } | null;
    };
    expect(state.persisted?.cycleCount).toBeGreaterThan(0);

    await client.close();
  });
});
