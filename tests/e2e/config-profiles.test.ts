import { Agent, InMemoryEventLog } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

describe('Config Profiles (P6#2)', () => {
  let agent: Agent;
  let server: Awaited<ReturnType<typeof startAgentUI>>;
  let port: number;

  beforeAll(async () => {
    const narEngine = new NAREngine();
    await narEngine.initialize();

    agent = new Agent({ id: 'config-profile-test', log: new InMemoryEventLog() });
    agent.registerEngine('nar', narEngine);
    await agent.start();

    server = await startAgentUI(agent, { port: 0 });
    port = server.address().port;
  }, 15000);

  afterAll(async () => {
    await server.close();
    await agent.stop();
  });

  it('applies multiple config.set messages in sequence (profile application)', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    let schemaCount = 0;
    let finalSchema: any = null;

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'config.schema') {
          schemaCount++;
          finalSchema = msg;
          if (schemaCount === 1) {
            // Simulate profile application: send multiple config.set in sequence
            ws.send(JSON.stringify({ type: 'config.set', key: 'nars.maxDerivationsPerStep', value: 2000 }));
            ws.send(JSON.stringify({ type: 'config.set', key: 'nars.activationDecayRate', value: 0.005 }));
          } else if (schemaCount === 3) {
            // Wait for 3 schemas (initial + 2 changes)
            resolve();
          }
        }
      });
      ws.on('error', reject);
      ws.on('open', () => { /* wait for messages */ });
    });

    ws.close();

    expect(schemaCount).toBeGreaterThanOrEqual(3);
    // Last schema should reflect latest value
    expect(finalSchema.data['nars.maxDerivationsPerStep'].value).toBe(2000);
    expect(finalSchema.data['nars.activationDecayRate'].value).toBe(0.005);

    // Verify engine actually applied both changes
    const narEngine = agent.engines.get('nar') as any;
    expect(narEngine.nar.getConfig().maxDerivationsPerStep).toBe(2000);
    expect(narEngine.nar.getConfig().activationDecayRate).toBe(0.005);

    // Reset
    narEngine.nar.setConfig({ maxDerivationsPerStep: 1000, activationDecayRate: 0.01 });
  }, 10000);

  it('rejects unknown config keys gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    // Wait for initial schema
    await new Promise<void>((resolve) => {
      ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'config.schema') resolve();
      });
    });

    // Send config.set with unknown key - should be silently ignored
    ws.send(JSON.stringify({ type: 'config.set', key: 'nars.nonexistent', value: 999 }));

    // Verify the NAR config wasn't affected
    const narEngine = agent.engines.get('nar') as any;
    expect(narEngine.nar.getConfig().maxConcepts).toBe(1000);

    ws.close();
  }, 10000);
});
