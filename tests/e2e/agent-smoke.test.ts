import { Agent } from '@senars/core';
import { NarBackend } from '@senars/nar';
import { SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
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

describe('Agent-as-Kernel: smoke test (real WS + Agent + NarBackend)', () => {
  let agent: Agent;
  let server: TestServer;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];

  const send = (msg: ClientMessage): void => ws.send(JSON.stringify(msg));

  const nodeIds = (): Set<string> => {
    const ids = new Set<string>();
    for (const m of received) {
      if (m.type === 'cognitive.delta') {
        for (const op of m.ops) if (op.action === 'add_node') ids.add(op.id);
      }
    }
    return ids;
  };

  beforeAll(async () => {
    const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
    const oldAgent = createAgent({ nar });
    const narBackend = new NarBackend(oldAgent);

    agent = new Agent({ name: 'smoke-test' });
    await agent.registerBackend(narBackend, {});
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
    const before = nodeIds();
    send({ type: 'chat.user', content: '<cat --> mammal>.' });
    await waitFor(received, (m) => m.type === 'cognitive.delta' && nodeIds().has('cat'));
    const after = nodeIds();
    expect(after.has('cat')).toBe(true);
    expect(after.has('mammal')).toBe(true);
    expect(after.size).toBeGreaterThan(before.size);
  });

  it('lens.set re-emits a delta tagged with the chosen lens', async () => {
    send({ type: 'lens.set', lens: 'contradiction' });
    const delta = await waitFor(
      received,
      (m) => m.type === 'cognitive.delta' && m.lens === 'contradiction',
    );
    expect(delta.type === 'cognitive.delta' && delta.lens).toBe('contradiction');
  });

  it('focus.set sends a delta response', async () => {
    send({ type: 'focus.set', term: 'bird' });
    const delta = await waitFor(
      received,
      (m) => m.type === 'cognitive.delta',
    );
    expect(delta.type === 'cognitive.delta').toBe(true);
  });
});
