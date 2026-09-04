import type { IncomingFromServer } from '@senars/core';
import { Agent } from '@senars/core';
import { MettaEngine } from '@senars/metta/engine/MettaEngine';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

function waitFor(
  messages: IncomingFromServer[],
  predicate: (m: IncomingFromServer) => boolean,
  timeoutMs = 5000
): Promise<IncomingFromServer> {
  return new Promise((resolve, reject) => {
    const found = messages.find(predicate);
    if (found) return resolve(found);
    const timer = setTimeout(
      () => reject(new Error('waitFor timed out waiting for message')),
      timeoutMs
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

describe('Agent-as-Kernel: Metta smoke test (real WS + Agent + MettaEngine)', () => {
  let agent: Agent;
  let server: TestServer;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];
  const send = (msg: ClientMessage): void => ws.send(JSON.stringify(msg));

  beforeAll(async () => {
    const mettaEngine = new MettaEngine();
    await mettaEngine.initialize();

    agent = new Agent({ id: 'metta-smoke-test' });
    agent.registerEngine('metta', mettaEngine);
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
    const delta = await waitFor(received, (m) => m.type === 'cognitive.delta' && 'lens' in m);
    expect(delta.type === 'cognitive.delta').toBe(true);
  });
});
