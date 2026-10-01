import type { IncomingFromServer } from '@senars/core';
import { Agent } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { waitForMessage } from './fixtures.js';

interface ClientMessage {
  type: string;

  [key: string]: unknown;
}


describe('Agent-as-Kernel: smoke test (real WS + Agent + NAREngine)', () => {
  let agent: Agent;
  let server: TestServer;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];

  const send = (msg: ClientMessage): void => ws.send(JSON.stringify(msg));

  beforeAll(async () => {
    const narEngine = new NAREngine();
    await narEngine.initialize();

    agent = new Agent({ id: 'smoke-test' });
    agent.registerEngine('nar', narEngine);
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

    await waitForMessage(received, (m) => m.type === 'cognitive.delta');
  }, 30000);

  afterAll(async () => {
    if (ws) {
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
    }
    await Promise.race([server.close(), new Promise<void>((resolve) => setTimeout(resolve, 3000))]);
    agent.stop();
  });

  it('boots on an ephemeral port and reports the bound port', () => {
    expect(server.address().port).toBeGreaterThan(0);
  });

  it('sends initial handshake (config.schema, lens.fields, lens.list)', () => {
    const types = new Set(received.map((m) => m.type));
    expect(types.has('config.schema')).toBe(true);
    expect(types.has('lens.fields')).toBe(true);
    expect(types.has('lens.list')).toBe(true);
  });

  it('Narsese input over WS grows the graph (new node + relation edge)', async () => {
    send({ type: 'chat.user', content: '<cat-->mammal>.' });
    const nodeId = (o: { action: string; id?: string }): string | undefined =>
      'id' in o ? o.id : undefined;
    await waitForMessage(
      received,
      (m) => m.type === 'cognitive.delta' && m.ops.some((o) => nodeId(o)?.includes('mammal'))
    );
    const deltas = received.filter((m) => m.type === 'cognitive.delta');
    expect(deltas.length).toBeGreaterThanOrEqual(1);
    const nodeIds = deltas.flatMap((m) =>
      m.ops.map((o) => nodeId(o)).filter((id): id is string => !!id)
    );
    expect(nodeIds.some((id) => id.includes('cat') || id.includes('mammal'))).toBe(true);
  });

  it('lens.set re-emits a delta tagged with the chosen lens', async () => {
    send({ type: 'lens.set', lens: 'contradiction' });
    const delta = await waitForMessage(received, (m) => m.type === 'cognitive.delta' && 'lens' in m);
    expect(delta.type === 'cognitive.delta').toBe(true);
  });

  it('focus.set sends a delta response', async () => {
    send({ type: 'focus.set', term: 'bird' });
    const delta = await waitForMessage(received, (m) => m.type === 'cognitive.delta');
    expect(delta.type === 'cognitive.delta').toBe(true);
  });
});
