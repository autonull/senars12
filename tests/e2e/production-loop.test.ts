import { randomUUID } from 'node:crypto';
import { Agent } from '@senars/core';
import type { IncomingFromServer } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

function waitFor<T>(predicate: () => T | undefined, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const result = predicate();
      if (result !== undefined) return resolve(result);
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(check, 20);
    };
    check();
  });
}

describe('Production loop: agent deltas reach the graph', () => {
  let server: Awaited<ReturnType<typeof startAgentUI>>;
  let agent: Agent;
  let port: number;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];

  beforeAll(async () => {
    const narEngine = new NAREngine();
    await narEngine.initialize();

    agent = new Agent({ id: 'production-loop-test' });
    agent.registerEngine('nar', narEngine);
    await agent.start();

    const ui = await startAgentUI(agent);
    server = ui;
    port = ui.address().port;

    await new Promise<void>((resolve, reject) => {
      ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', () => resolve());
      ws.on('error', reject);
      ws.on('message', (data: Buffer) => {
        try {
          received.push(JSON.parse(data.toString()) as IncomingFromServer);
        } catch {
          /* ignore */
        }
      });
    });

    await waitFor(() => received.find((m) => m.type === 'cognitive.delta'));
  }, 30000);

  afterAll(async () => {
    if (ws) ws.terminate();
    await server.close();
    await agent.stop();
  });

  it('emits cognitive.delta with probe terms', async () => {
    ws.send(
      JSON.stringify({ type: 'chat.user', content: '(cat --> animal).', messageId: randomUUID() })
    );

    const delta = await waitFor(() =>
      received.find(
        (d) =>
          d.type === 'cognitive.delta' &&
          d.ops.some((op) => op.data?.term?.includes('cat') || op.data?.term?.includes('animal'))
      )
    );

    expect(delta).toBeDefined();
    if (!delta) return;
    expect(delta.type).toBe('cognitive.delta');
    expect(delta.ops.some((op) => op.action === 'add_node')).toBe(true);
  });
});
