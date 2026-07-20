import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Agent, InMemoryEventLog } from '@senars/core';
import { JsonlSessionManager } from '@senars/core/memory';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Persistence: session survive agent restart', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'senars-persist-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('restores session history after agent stop/start', async () => {
    // Phase 1 — create agent with sessionManager, add data, stop triggers snapshot
    const sm1 = new JsonlSessionManager({ basePath: tmpDir });
    const agent1 = new Agent({
      id: 'persist-test-1',
      log: new InMemoryEventLog(),
      sessionManager: sm1,
    });
    const nar1 = new NAREngine();
    await nar1.initialize();
    agent1.registerEngine('nar', nar1);
    await agent1.start();

    const session = sm1.getOrCreate('default');
    session.history.push({ role: 'user', content: 'cat --> animal', timestamp: Date.now() });

    await agent1.stop(); // triggers sessionManager.snapshot()

    // Phase 2 — fresh agent with new sessionManager (same path), start triggers restore
    const sm2 = new JsonlSessionManager({ basePath: tmpDir });
    const agent2 = new Agent({
      id: 'persist-test-2',
      log: new InMemoryEventLog(),
      sessionManager: sm2,
    });
    const nar2 = new NAREngine();
    await nar2.initialize();
    agent2.registerEngine('nar', nar2);
    await agent2.start(); // triggers sessionManager.restore()

    const restored = sm2.getOrCreate('default');
    expect(restored.history.length).toBe(1);
    expect(restored.history[0].content).toBe('cat --> animal');

    await agent2.stop();
  }, 15000);

  it('restores via HTTP test endpoints', async () => {
    // Phase 1 — agent with UI, inject session data, save via test endpoint
    const sm1 = new JsonlSessionManager({ basePath: tmpDir });
    const agent1 = new Agent({
      id: 'persist-http-1',
      log: new InMemoryEventLog(),
      sessionManager: sm1,
    });
    const nar1 = new NAREngine();
    await nar1.initialize();
    agent1.registerEngine('nar', nar1);
    await agent1.start();

    const srv1 = await startAgentUI(agent1, { port: 0 });
    const port1 = srv1.address().port;

    sm1.getOrCreate('http-test');
    sm1.getOrCreate('http-test').history.push({ role: 'user', content: 'hello', timestamp: Date.now() });

    const saveResp = await fetch(`http://localhost:${port1}/test/session-save`, { method: 'POST' });
    const saveBody = await saveResp.json() as { success: boolean };
    expect(saveBody.success).toBe(true);

    await srv1.close();
    await agent1.stop();

    // Phase 2 — fresh agent + server, load via test endpoint
    const sm2 = new JsonlSessionManager({ basePath: tmpDir });
    const agent2 = new Agent({
      id: 'persist-http-2',
      log: new InMemoryEventLog(),
      sessionManager: sm2,
    });
    const nar2 = new NAREngine();
    await nar2.initialize();
    agent2.registerEngine('nar', nar2);
    await agent2.start();

    const srv2 = await startAgentUI(agent2, { port: 0 });
    const port2 = srv2.address().port;

    const loadResp = await fetch(`http://localhost:${port2}/test/session-load`, { method: 'POST' });
    const loadBody = await loadResp.json() as { success: boolean };
    expect(loadBody.success).toBe(true);

    const restored = sm2.getOrCreate('http-test');
    expect(restored.history.length).toBe(1);
    expect(restored.history[0].content).toBe('hello');

    await srv2.close();
    await agent2.stop();
  }, 15000);
});
