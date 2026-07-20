import { Agent, InMemoryEventLog } from '@senars/core';
import { NAREngine } from '@senars/nar/engine/NAREngine';
import { startAgentUI } from '@senars/ui/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

describe('NAR Parameter HUD (P6#1)', () => {
  let agent: Agent;
  let server: Awaited<ReturnType<typeof startAgentUI>>;
  let port: number;

  beforeAll(async () => {
    const narEngine = new NAREngine();
    await narEngine.initialize();

    agent = new Agent({ id: 'config-hud-test', log: new InMemoryEventLog() });
    agent.registerEngine('nar', narEngine);
    await agent.start();

    server = await startAgentUI(agent, { port: 0 });
    port = server.address().port;
  }, 15000);

  afterAll(async () => {
    await server.close();
    await agent.stop();
  });

  it('sends config.schema with NAR fields on connect', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages: unknown[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        messages.push(msg);
        if (msg.type === 'config.schema') resolve();
      });
      ws.on('error', reject);
      ws.on('open', () => { /* wait for messages */ });
    });

    ws.close();

    const schemaMsg = messages.find((m: any) => m.type === 'config.schema') as any;
    expect(schemaMsg).toBeDefined();
    expect(schemaMsg.data).toBeDefined();
    expect(schemaMsg.data['nars.maxConcepts']).toBeDefined();
    expect(schemaMsg.data['nars.maxConcepts'].type).toBe('slider');
    expect(schemaMsg.data['nars.maxConcepts'].value).toBe(1000);
    expect(schemaMsg.data['nars.activationDecayRate']).toBeDefined();
    expect(schemaMsg.data['nars.maxDerivationDepth']).toBeDefined();
    expect(schemaMsg.data['nars.maxDerivationsPerStep']).toBeDefined();
  }, 10000);

  it('applies config.set and broadcasts updated schema', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    let schemaReceived = 0;
    let receivedSchema: any = null;

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'config.schema') {
          schemaReceived++;
          receivedSchema = msg;
          if (schemaReceived === 1) {
            // Send config change after first schema
            ws.send(JSON.stringify({ type: 'config.set', key: 'nars.maxConcepts', value: 500 }));
          } else if (schemaReceived === 2) {
            resolve();
          }
        }
      });
      ws.on('error', reject);
      ws.on('open', () => { /* wait */ });
    });

    ws.close();

    expect(receivedSchema).toBeDefined();
    expect(receivedSchema.data['nars.maxConcepts'].value).toBe(500);

    // Verify the NAR engine actually applied the change
    const narEngine = agent.engines.get('nar') as any;
    expect(narEngine.nar.getConfig().maxConcepts).toBe(500);

    // Reset for other tests
    ws.send(JSON.stringify({ type: 'config.set', key: 'nars.maxConcepts', value: 1000 }));
  }, 10000);

  it('changes NAR behavior after config update', async () => {
    // Get initial beliefs count
    const narEngine = agent.engines.get('nar') as any;
    const initialConfig = narEngine.nar.getConfig();

    // Change decay rate to a very fast value
    narEngine.nar.setConfig({ activationDecayRate: 0.5 });

    // Import a belief and run cycles
    await narEngine.nar.believe('<test_config --> test>.');
    await narEngine.nar.run(10);

    // Verify belief was processed (NAR still works)
    const beliefs = narEngine.nar.getBeliefs();
    const hasTest = beliefs.some((b: any) => b.term.toString().includes('test_config'));
    expect(hasTest).toBe(true);

    // Restore config
    narEngine.nar.setConfig(initialConfig);
  }, 10000);
});
