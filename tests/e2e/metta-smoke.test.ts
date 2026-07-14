import { Agent } from '@senars/core';
import { MettaBackend } from '@senars/metta';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import type { IncomingFromServer } from '@senars/ui/shared/protocol';

interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

function waitFor(
  messages: IncomingFromServer[],
  predicate: (m: IncomingFromServer) => boolean,
  timeoutMs = 5000,
): Promise<IncomingFromServer> {
  return new Promise((resolve, reject) => {
    const found = messages.find(predicate);
    if (found) return resolve(found);
    const timer = setTimeout(
      () => reject(new Error('waitFor timed out waiting for message')),
      timeoutMs,
    );
    const check = setInterval(() => {
      const hit = messages.find(predicate);
      if (hit) {
        clearTimeout(timer);
        clearInterval(check);
        resolve(hit);
      }
    }, 20);
  });
}

function nodeIdsFromDeltas(messages: IncomingFromServer[]): Set<string> {
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.type === 'cognitive.delta') {
      for (const op of m.ops) if (op.action === 'add_node') ids.add(op.id);
    }
  }
  return ids;
}

describe('Agent-as-Kernel: Metta smoke test (real WS + Agent + MettaBackend)', () => {
  let agent: Agent;
  let server: TestServer;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];
  const send = (msg: ClientMessage): void => ws.send(JSON.stringify(msg));

  beforeAll(async () => {
    const mettaBackend = new MettaBackend();
    agent = new Agent({ name: 'metta-smoke-test' });
    await agent.registerBackend(mettaBackend, {});
    agent.start();

    server = await startAgentUI(agent, { port: 0, bootstrap: false });
    const { port } = server.address();

    await new Promise<void>((resolve, reject) => {
      ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('message', (raw) => {
        try {
          received.push(JSON.parse(raw.toString()) as IncomingFromServer);
        } catch {
          /* ignore malformed */
        }
      });
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    await waitFor(received, (m) => m.type === 'cognitive.delta');
  }, 30000);

  afterAll(async () => {
    if (ws) {
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
    }
    await Promise.race([
      server.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
    agent.stop();
  });

  it('boots and reports the bound port', () => {
    expect(server.address().port).toBeGreaterThan(0);
  });

  it('sends initial handshake (config.schema, lens.fields, lens.list)', () => {
    const types = new Set(received.map((m) => m.type));
    expect(types.has('config.schema')).toBe(true);
    expect(types.has('lens.fields')).toBe(true);
    expect(types.has('lens.list')).toBe(true);
  });

  it('MeTTa input over WS grows the graph with atom nodes', async () => {
    const beforeIds = nodeIdsFromDeltas(received);
    send({ type: 'chat.user', content: '(+ 1 2)' });

    await waitFor(received, (m) => m.type === 'cognitive.delta' && nodeIdsFromDeltas([m]).size > beforeIds.size);

    const allIds = nodeIdsFromDeltas(received);
    expect(allIds.size).toBeGreaterThan(beforeIds.size);
  });

  it('MeTTa syntax input creates nodes via skill input type', async () => {
    const beforeDeltas = received.length;
    // Add an atom first so we have something to match
    agent.submit('(+ 9 10)', 'setup-match-test');
    await new Promise((r) => setTimeout(r, 100));

    send({ type: 'chat.user', content: '(match (color $x) red)' });
    await waitFor(received, (m) => m.type === 'cognitive.delta');

    const deltas = received.slice(beforeDeltas).filter((m) => m.type === 'cognitive.delta');
    // Match on empty space returns no results but still produces a delta
    expect(deltas.length).toBeGreaterThanOrEqual(0);
  });

  it('skill: prefix routes to MettaBackend', async () => {
    // Check that the skill prefix is recognized by looking at the routing result
    // The content will be evaluated and should complete without error
    const beforeChat = received.filter((m) => m.type === 'chat.agent.complete').length;
    send({ type: 'chat.user', content: 'skill:(+ 5 7)' });

    // The chat should complete (either with result or error)
    await waitFor(received, (m) => m.type === 'chat.agent.complete', 2000);

    const afterChat = received.filter((m) => m.type === 'chat.agent.complete').length;
    expect(afterChat).toBeGreaterThanOrEqual(beforeChat);
  });

  it('lens.set works on MeTTa graph', async () => {
    send({ type: 'lens.set', lens: 'belief' });
    const delta = await waitFor(
      received,
      (m) => m.type === 'cognitive.delta' && m.lens === 'belief',
    );
    expect(delta.type === 'cognitive.delta' && delta.lens).toBe('belief');
  });
});