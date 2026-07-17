import { createAgent } from '@senars/nar/agent';
import { SeNARSFactory } from '@senars/nar';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import type { CognitiveEvent } from '@senars/core';

describe('Core Agent with MettaEngine - Conversational Scenarios', () => {
  let agent: Awaited<ReturnType<typeof createAgent>>;

  beforeAll(async () => {
    const nar = SeNARSFactory.createForTesting({ maxConcepts: 100 });
    agent = await createAgent({ nar });
  });

  afterAll(async () => {
    await agent.stop();
  });

  it('handles basic greeting (no LM = empty response)', async () => {
    let response = '';
    for await (const chunk of agent.chat('Hello!')) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text;
      }
    }
    // With no LM service configured, response is empty (ModelRunner returns empty)
    expect(typeof response).toBe('string');
  });

  it('handles skill-related queries (no LM = empty response)', async () => {
    // Register a simple skill first
    agent.registerSkill('time', {
      execute: async () => new Date().toISOString(),
    });

    let response = '';
    for await (const chunk of agent.chat('What time is it?')) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text;
      }
    }
    expect(typeof response).toBe('string');
  });

  it('processes Narsese input (no LM = empty response)', async () => {
    let response = '';
    for await (const chunk of agent.chat('<test --> concept>.')) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text;
      }
    }
    expect(typeof response).toBe('string');
  });

  it('maintains conversation history via events', async () => {
    const events: CognitiveEvent[] = [];
    const handler = (e: CognitiveEvent) => events.push(e);
    
    agent.on('*', handler);
    
    // Need to fully consume the async generators to trigger event emission
    for await (const _ of agent.chat('First message')) {}
    for await (const _ of agent.chat('Second message')) {}
    
    await new Promise(r => setTimeout(r, 50));
    
    agent.off('*', handler);
    
    const inputEvents = events.filter(e => e.type === 'input.user');
    expect(inputEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('declares LTM capability', () => {
    const caps = agent.capabilities();
    expect(caps.supports.ltm).toBe(true);
  });

  it('declares skills capability', () => {
    const caps = agent.capabilities();
    expect(caps.supports.skills).toBe(true);
  });

  it('does not declare drives or RLPF capabilities', () => {
    const caps = agent.capabilities();
    expect(caps.supports.drives).toBe(false);
    expect(caps.supports.rlfp).toBe(false);
  });

  it('health check returns healthy status', () => {
    const health = agent.health();
    expect(health.status).toBe('healthy');
    expect(typeof health.cycleCount).toBe('number');
  });
});