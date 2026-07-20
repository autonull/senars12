import { randomUUID } from 'node:crypto';
import { Agent } from '@senars/core';
import type { IncomingFromServer } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, describe, expect, it } from 'vitest';
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

async function makeAgent(): Promise<Agent> {
  const engine = new NAREngine();
  await engine.initialize();
  const agent = new Agent({ id: `reconnect-${randomUUID()}` });
  agent.registerEngine('nar', engine);
  await agent.start();
  return agent;
}

function connect(port: number, sink: IncomingFromServer[]): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('message', (data: Buffer) => {
      try {
        sink.push(JSON.parse(data.toString()) as IncomingFromServer);
      } catch {
        /* ignore */
      }
    });
  });
}

describe('WebSocket reconnect resilience (P7)', () => {
  const received1: IncomingFromServer[] = [];
  const received2: IncomingFromServer[] = [];
  let server1: Awaited<ReturnType<typeof startAgentUI>>;
  let server2: Awaited<ReturnType<typeof startAgentUI>>;
  let agent1: Agent;
  let agent2: Agent;
  let ws1: WebSocket | undefined;
  let ws2: WebSocket | undefined;
  let port = 0;

  it('redelivers cognitive.delta after the server is restarted on the same port', async () => {
    agent1 = await makeAgent();
    server1 = await startAgentUI(agent1, { port: 0 });
    port = server1.address().port;

    ws1 = await connect(port, received1);
    await waitFor(() => received1.find((m) => m.type === 'cognitive.delta'));
    expect(received1.some((m) => m.type === 'cognitive.delta')).toBe(true);

    ws1?.terminate();
    await server1.close();
    await agent1.stop();

    agent2 = await makeAgent();
    server2 = await startAgentUI(agent2, { port });
    ws2 = await connect(port, received2);

    const redelivered = await waitFor(() => received2.find((m) => m.type === 'cognitive.delta'));
    expect(redelivered).toBeDefined();
    expect(redelivered.type).toBe('cognitive.delta');
  }, 60000);

  afterAll(async () => {
    ws1?.terminate();
    ws2?.terminate();
    await server1?.close().catch(() => {});
    await server2?.close().catch(() => {});
    await agent1?.stop().catch(() => {});
    await agent2?.stop().catch(() => {});
  });
});
