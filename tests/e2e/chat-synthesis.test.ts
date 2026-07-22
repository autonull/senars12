import { randomUUID } from 'node:crypto';
import type { IncomingFromServer } from '@senars/core';
import { createAgent } from '@senars/nar/agent';
import { createMockLMService } from '@senars/nar/lm';
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

describe('chat-synthesis', () => {
  let server: Awaited<ReturnType<typeof startAgentUI>>;
  let agent: Awaited<ReturnType<typeof createAgent>>;
  let ws: WebSocket;
  const received: IncomingFromServer[] = [];

  beforeAll(async () => {
    const scripted = createMockLMService({
      generateTextFn: () =>
        'I am a reasoning agent. I synthesize responses from symbolic derivations.',
      available: true,
    });

    agent = await createAgent({ lmService: scripted });

    server = await startAgentUI(agent, { port: 0 });
    const { port } = server.address();

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
  }, 30000);

  afterAll(async () => {
    if (ws) ws.terminate();
    await server.close();
    await agent.stop();
  });

  it('returns scripted LM response instead of [agent] fallback', async () => {
    ws.send(
      JSON.stringify({ type: 'chat.user', content: 'What is a cat?', messageId: randomUUID() })
    );

    const complete = await waitFor(
      (): IncomingFromServer | undefined => received.find((m) => m.type === 'chat.agent.complete'),
      20000
    );

    expect(complete).toBeDefined();
    const msg = complete as IncomingFromServer & { content: string };
    expect(msg.content).not.toContain('[agent]');
    expect(msg.content).toContain('synthesize');
  }, 30000);
});
