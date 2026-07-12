import { createAgent } from '@senars/nar/agent';
import { DEFAULT_NAR_CONFIG, SeNARSFactory } from '@senars/nar';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWebUI, type TestServer } from '@senars/ui/server';
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

describe('Pillar 3: browser-free smoke test (real WS + real NAR)', () => {
  let agent: ReturnType<typeof createAgent>;
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

  const edgeKeys = (): Array<{ source: string; target: string }> => {
    const edges: Array<{ source: string; target: string }> = [];
    for (const m of received) {
      if (m.type === 'cognitive.delta') {
        for (const op of m.ops) {
          if (op.action === 'add_edge') edges.push({ source: op.source, target: op.target });
        }
      }
    }
    return edges;
  };

  beforeAll(async () => {
    const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
    agent = createAgent({ nar });
    agent.start();
    await agent.waitForReady();

    server = await startWebUI(agent, { nar, bootstrap: true, port: 0 });
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

  it('initial graph projects bootstrap beliefs (nodes + relation edges)', () => {
    const ids = nodeIds();
    for (const term of ['sky', 'blue', 'bird', 'animal', 'robin']) {
      expect(ids.has(term), `expected node for ${term}`).toBe(true);
    }
    const edges = edgeKeys();
    expect(edges.some((e) => e.source === 'bird' && e.target === 'animal')).toBe(true);
    expect(edges.some((e) => e.source === 'sky' && e.target === 'blue')).toBe(true);
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

  it('focus.set restricts the projected graph (Option A)', async () => {
    send({ type: 'focus.set', term: 'bird' });
    const delta = await waitFor(received, (m) => {
      if (m.type !== 'cognitive.delta') return false;
      const ids = m.ops.filter((op) => op.action === 'add_node').map((op) => op.id);
      return ids.includes('bird') && !ids.includes('sky');
    });
    const ids = delta.ops.filter((op) => op.action === 'add_node').map((op) => op.id);
    expect(ids.includes('bird')).toBe(true);
    expect(ids.includes('sky')).toBe(false);
  });

  it('node.history.request returns non-empty real revision history', async () => {
    send({ type: 'chat.user', content: '<bird --> animal>. %0.3;0.8%' });
    await waitFor(received, (m) => m.type === 'cognitive.delta');
    send({ type: 'node.history.request', term: '<bird --> animal>' });
    const msg = await waitFor(
      received,
      (m) => m.type === 'node.history' && m.term === '<bird --> animal>',
    );
    if (msg.type === 'node.history') {
      expect(msg.history.length).toBeGreaterThanOrEqual(2);
      expect(msg.history[0]!.source).toBe('revision');
    }
  });
});
