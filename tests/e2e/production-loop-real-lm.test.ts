import { randomUUID } from 'node:crypto';
import type { IncomingFromServer } from '@senars/core';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createAgentFromEnv } from '../../src/bin/lib/lifecycle';

function waitFor<T>(predicate: () => T | undefined, timeoutMs = 30000): Promise<T> {
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

describe('Production loop with real LMService (LM_PROVIDER=mock via AI SDK)', () => {
  let server: Awaited<ReturnType<typeof startAgentUI>>;
  let agent: Awaited<ReturnType<typeof createAgentFromEnv>>['agent'];
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];
  const origLmProvider = process.env.LM_PROVIDER;

  beforeAll(async () => {
    process.env.LM_PROVIDER = 'mock';
    process.env.EPISODIC_MEMORY_PATH = '.cache/e2e-real-lm';

    const ctx = await createAgentFromEnv({ narConfig: { maxConcepts: 50 } });
    agent = ctx.agent;

    const ui = await startAgentUI(agent, { port: 0 });
    server = ui;
    const { port } = ui.address();

    await new Promise<void>((resolve, reject) => {
      ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', () => resolve());
      ws.on('error', (e) => reject(e));
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
    process.env.LM_PROVIDER = origLmProvider;
  });

  it('sends NL input and receives chat response via real LMService + cortex (AI SDK integration)', async () => {
    ws.send(
      JSON.stringify({ type: 'chat.user', content: 'What is a cat?', messageId: randomUUID() })
    );

    const complete = await waitFor(
      (): IncomingFromServer | undefined => received.find((m) => m.type === 'chat.agent.complete'),
      20000
    );

    expect(complete).toBeDefined();
    const msg = complete as IncomingFromServer & { content: string };
    expect(msg.content).toBeDefined();
    expect(msg.content.length).toBeGreaterThan(0);
    // The mock LM's generateText returns "Mock response: <prompt>"
    expect(msg.content).toContain('Mock response');
  }, 60000);

  it('cognitive.delta flows from engine initialization', async () => {
    // The beforeAll already waited for an initial cognitive.delta from engine startup.
    // Verify at least one delta was captured.
    const initialDelta = received.find((m) => m.type === 'cognitive.delta');
    expect(initialDelta).toBeDefined();
    if (!initialDelta) return;
    expect(initialDelta.type).toBe('cognitive.delta');
    // Even with no derivations, the projection sends an initial empty delta
    expect(Array.isArray(initialDelta.ops)).toBe(true);
  });
});
