import { Agent, InMemoryEventLog } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI, type TestServer } from '@senars/ui/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

async function post(base: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('deterministic test endpoints (real engine)', () => {
  let server: TestServer;
  let agent: Agent;
  let base: string;

  beforeEach(async () => {
    agent = new Agent({ id: 'endpoint-test', log: new InMemoryEventLog() });
    const narEngine = new NAREngine(undefined, agent.emitCognitive.bind(agent));
    agent.registerEngine('nar', narEngine);
    await agent.start();
    server = await startAgentUI(agent, { port: 0 });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await server.close();
    await agent.stop();
  });

  it('lists scenarios and loads one through the engine', async () => {
    const listed = await (await fetch(`${base}/test/scenarios`)).json();
    expect(listed.scenarios).toContain('basic-derivation');

    const loaded = await (await post(base, '/test/scenario', { id: 'basic-derivation' })).json();
    expect(loaded).toMatchObject({ success: true, id: 'basic-derivation' });

    const unknown = await post(base, '/test/scenario', { id: 'nope' });
    expect(unknown.status).toBe(404);
  });

  it('reset restores the scenario baseline while reset-all forces bootstrap', async () => {
    await post(base, '/test/scenario', { id: 'basic-derivation' });
    const stepped = await (await post(base, '/test/step', { cycles: 2 })).json();
    expect(stepped.success).toBe(true);
    expect(stepped.seq).toBeGreaterThan(0);

    const reset = await (await post(base, '/test/reset')).json();
    expect(reset.success).toBe(true);
    expect(reset.seq).toBeGreaterThan(0);

    const resetAll = await (await post(base, '/test/reset-all')).json();
    expect(resetAll.success).toBe(true);
    expect(resetAll.seq).toBeGreaterThan(0);
  });

  it('rejects a synthetic inject-event without a type', async () => {
    const bad = await post(base, '/test/inject-event', { event: {} });
    expect(bad.status).toBe(400);
    const good = await (
      await post(base, '/test/inject-event', {
        event: { type: 'concept.activated', payload: { term: 'test', priority: 0.5 } },
      })
    ).json();
    expect(good.success).toBe(true);
  });
});
