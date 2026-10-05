import type { IncomingFromServer } from '@senars/core';
import { Agent } from '@senars/core';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { waitForMessage } from './fixtures.js';

interface ClientMessage {
  type: string;

  [key: string]: unknown;
}

describe('Agent-as-Kernel: Metta smoke test (real WS + Agent + MettaEngine)', () => {
  let agent: Agent;
  let server: TestServer;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];
  const send = (msg: ClientMessage): void => ws.send(JSON.stringify(msg));

  beforeAll(async () => {
    agent = new Agent({ id: 'metta-smoke-test' });
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

  it('boots and reports the bound port', () => {
    expect(server.address().port).toBeGreaterThan(0);
  });

  it('sends initial handshake (config.schema, lens.fields, lens.list)', () => {
    const types = new Set(received.map((m) => m.type));
    expect(types.has('config.schema')).toBe(true);
    expect(types.has('lens.fields')).toBe(true);
    expect(types.has('lens.list')).toBe(true);
  });

  it('lens.set works on MeTTa graph', async () => {
    send({ type: 'lens.set', lens: 'belief' });
    const delta = await waitForMessage(
      received,
      (m) => m.type === 'cognitive.delta' && 'lens' in m
    );
    expect(delta.type === 'cognitive.delta').toBe(true);
  });
});
