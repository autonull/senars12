import { randomUUID } from 'node:crypto';
import { Agent } from '@senars/core';
import type { IncomingFromServer } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

function waitFor<T>(predicate: () => T | undefined, timeoutMs = 15000): Promise<T> {
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
      ws.on('open', () => {
        console.log('[TEST] WebSocket opened');
        resolve();
      });
      ws.on('error', (e) => {
        console.error('[TEST] WebSocket error:', e);
        reject(e);
      });
      ws.on('close', (code, reason) => {
        console.log('[TEST] WebSocket closed:', code, reason?.toString());
      });
      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as IncomingFromServer;
          console.log('[TEST] Received:', msg.type, msg.seqId ?? '', msg.ops?.length ?? 0);
          received.push(msg);
        } catch {
          /* ignore */
        }
      });
    });

    console.log('[TEST] Waiting for initial cognitive.delta...');
    await waitFor(() => received.find((m) => m.type === 'cognitive.delta'));
    console.log('[TEST] Got initial cognitive.delta');
  }, 30000);

  afterAll(async () => {
    if (ws) ws.terminate();
    await server.close();
    await agent.stop();
  });

  it('emits cognitive.delta with probe terms', async () => {
    console.log('[TEST] it block started');
    console.log('[TEST] Sending chat message...');
    ws.send(
      JSON.stringify({ type: 'chat.user', content: '(cat --> animal).', messageId: randomUUID() })
    );
    console.log('[TEST] ws.send returned');

    const delta = await waitFor(() =>
      received.find(
        (d) =>
          d.type === 'cognitive.delta' &&
          d.ops.some((op) => op.data?.term?.includes('cat') || op.data?.term?.includes('animal'))
      )
    );

    console.log('[TEST] Got cognitive.delta:', delta?.ops?.length);
    expect(delta).toBeDefined();
    if (!delta) return;
    expect(delta.type).toBe('cognitive.delta');
    expect(delta.ops.some((op) => op.action === 'add_node')).toBe(true);
  }, 60000);
});
