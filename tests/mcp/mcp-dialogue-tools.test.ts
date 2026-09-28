import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DialogueCapture } from '@senars/nar/dialogue';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { dialogueDefaults } from '@senars/util/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerDialogueTools } from '../../src/bin/lib/mcp/mcp-dialogue-tools.js';

const connect = async (server: McpServer): Promise<Client> => {
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
};

describe('MCP dialogue tools (TODO25 surface)', () => {
  let dir: string;
  let episodic: EpisodicMemory;
  let dialogue: DialogueCapture;
  let client: Client;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-dialogue-'));
    episodic = new EpisodicMemory({ basePath: dir });
    dialogue = new DialogueCapture({
      episodic,
      config: { ...dialogueDefaults, enabled: true, captureAll: true },
    });
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerDialogueTools(server, { dialogue, episodic });
    client = await connect(server);
  });

  afterEach(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('registers the four flywheel tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'dialogue_probes',
      'dialogue_react',
      'dialogue_retrospect',
      'dialogue_turns',
    ]);
  });

  it('lists captured turns for a session (not the old stub response)', async () => {
    await dialogue.onExchange({
      correlationId: 'c1',
      utterance: 'the robin is a bird',
      response: 'yes',
    });
    const { structuredContent } = await client.callTool({
      name: 'dialogue_turns',
      arguments: { limit: 5 },
    });
    const content = structuredContent as {
      sessionId: string | null;
      turns: Array<{ seq: number }>;
    };
    expect(content.sessionId).toBeTruthy();
    expect(content.turns).toHaveLength(1);
    expect(content.turns[0]!.seq).toBe(1);
  });

  it('binds an explicit reaction to the latest turn', async () => {
    const turnId = await dialogue.onExchange({
      correlationId: 'c1',
      utterance: 'the robin is a bird',
      response: 'yes',
    });
    await client.callTool({ name: 'dialogue_react', arguments: { kind: 'accept' } });
    expect(dialogue.getTurn(turnId!)?.reaction?.kind).toBe('accept');
  });

  it('produces a retrospective for a session', async () => {
    const { structuredContent } = await client.callTool({
      name: 'dialogue_retrospect',
      arguments: { sessionId: 's1' },
    });
    const content = structuredContent as {
      sessionId: string;
      retrospective: { turnCount: number };
    };
    expect(content.sessionId).toBe('s1');
    expect(content.retrospective.turnCount).toBe(0);
  });

  it('selects probes from reaction episodes', async () => {
    await dialogue.onExchange({
      correlationId: 'c1',
      utterance: 'the robin is a bird',
      response: 'yes',
    });
    await dialogue.bindReaction(dialogue.latestTurn()!.turnId, 'correct', 'it is a mammal');
    const { structuredContent } = await client.callTool({
      name: 'dialogue_probes',
      arguments: { limit: 4 },
    });
    const content = structuredContent as { probes: Array<{ kind: string }> };
    expect(content.probes.map((p) => p.kind)).toContain('correction');
  });
});
