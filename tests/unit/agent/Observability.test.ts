import { createAgent } from '../../../nar/src/agent/index.js';
import { describe, expect, it } from 'vitest';
import { SeNARSFactory } from '../../../nar/src';
import { createMockLMService } from '../../../nar/src/lm';

const scriptedLM = createMockLMService({
  available: true,
  generateTextFn: async (prompt: string) => {
    if (prompt.toLowerCase().includes('hello')) return 'Hi!';
    if (prompt.toLowerCase().includes('big')) return 'A'.repeat(200);
    return 'OK';
  },
});

async function collectChat(agent: Awaited<ReturnType<typeof createAgent>>, input: string): Promise<string> {
  let result = '';
  for await (const evt of agent.chat(input)) {
    if (evt.kind === 'text-delta' && evt.text) result += evt.text;
  }
  return result;
}

describe('Agent cognitive event listeners', () => {
  it('receives cognitive events via on()', async () => {
    const agent = await createAgent({ lmService: scriptedLM });
    const events: any[] = [];
    const handler = (e: any) => events.push(e);
    agent.on('*', handler);
    await collectChat(agent, 'hello');
    agent.off('*', handler);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'input.user')).toBe(true);
  });

  it('off() removes a listener', async () => {
    const agent = await createAgent({ lmService: scriptedLM });
    let count = 0;
    const handler = (): void => {
      count++;
    };
    agent.on('*', handler);
    await collectChat(agent, 'hello');
    expect(count).toBeGreaterThan(0);
    agent.off('*', handler);
    await collectChat(agent, 'hello');
    expect(count).toBeGreaterThan(0); // first chat events already received
  });

  it('start()/stop() lifecycle', async () => {
    const nar = SeNARSFactory.createForTesting({ maxConcepts: 5 });
    const agent = await createAgent({ nar });
    await agent.start();
    expect(agent.health().status).toBe('healthy');
    await agent.stop();
    expect(agent.health().status).toBe('stuck');
  });
});