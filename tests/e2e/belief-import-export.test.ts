import { Agent, InMemoryEventLog } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Belief import/export via test endpoints', () => {
  let agent: Agent;
  let server: Awaited<ReturnType<typeof startAgentUI>>;
  let port: number;

  beforeAll(async () => {
    const narEngine = new NAREngine();
    await narEngine.initialize();

    agent = new Agent({ id: 'belief-import-test', log: new InMemoryEventLog() });
    agent.registerEngine('nar', narEngine);
    await agent.start();

    server = await startAgentUI(agent, { port: 0 });
    port = server.address().port;
  }, 15000);

  afterAll(async () => {
    await server.close();
    await agent.stop();
  });

  it('imports Narsese beliefs and exports them back', async () => {
    const statements = ['<cat --> animal>.', '<dog --> animal>.'];

    const importResp = await fetch(`http://localhost:${port}/test/import-beliefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements }),
    });
    const importBody = (await importResp.json()) as {
      success: boolean;
      count?: number;
      error?: string;
    };
    expect(importBody.success).toBe(true);

    const exportResp = await fetch(`http://localhost:${port}/test/export-beliefs`);
    const exportBody = (await exportResp.json()) as {
      beliefs: Array<{ term: string; truth: { frequency: number; confidence: number } }>;
      count: number;
    };

    expect(exportBody.count).toBeGreaterThanOrEqual(2);
    const terms = exportBody.beliefs.map((b) => b.term);
    expect(terms.some((t) => t.includes('cat'))).toBe(true);
    expect(terms.some((t) => t.includes('dog'))).toBe(true);
  }, 15000);

  it('rejects when no NAR engine is registered', async () => {
    const noNarAgent = new Agent({ id: 'no-nar', log: new InMemoryEventLog() });
    await noNarAgent.start();

    const srv2 = await startAgentUI(noNarAgent, { port: 0 });
    const p2 = srv2.address().port;

    const resp = await fetch(`http://localhost:${p2}/test/import-beliefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements: ['<bird --> animal>.'] }),
    });
    const body = (await resp.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('No NAR engine');

    await srv2.close();
    await noNarAgent.stop();
  }, 15000);
});
