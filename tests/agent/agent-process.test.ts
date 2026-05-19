/**
 * Agent processMessage() tests
 * Tests for unified message pipeline
 */

import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import {Agent} from '../../src/agent/Agent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import {DEFAULT_NAR_CONFIG} from '../../src/config/defaults.js';

describe('Agent.processMessage()', () => {
  let agent: Agent;

  beforeEach(async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });
    agent = new Agent({nar});
    await agent.start();
  });

  afterEach(async () => {
    await agent.stop();
  });

  it('should process belief input', async () => {
    const response = await agent.processMessage('(cat --> animal).', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    expect(response.type).toBe('belief');
    expect(response.text).toContain('Added');
  });

  it('should process question input', async () => {
await agent.processMessage('(cat-->animal).', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    const response = await agent.processMessage('What is a cat?', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    expect(response.type).toBe('chat');
  });

  it('should process command input', async () => {
    const response = await agent.processMessage('.help', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    expect(response.type).toBe('command');
  });

  it('should handle working memory commands', async () => {
    const pinResponse = await agent.processMessage('.pin testkey testvalue', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    expect(pinResponse.type).toBe('command');
    expect(pinResponse.text).toContain('Pinned');

    const recallResponse = await agent.processMessage('.recall testkey', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    expect(recallResponse.type).toBe('command');
    expect(recallResponse.text).toContain('testvalue');
  });

  it('should classify goal input', async () => {
    const response = await agent.processMessage('!achieve goal', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    expect(response.type).toBe('goal');
  });

  it('should record in lastResults', async () => {
    await agent.processMessage('(dog --> animal).', {
      connectionId: 'test',
      connectionType: 'cli',
      sender: 'tester',
      respond: async () => {},
    });

    const snapshot = agent.getSnapshot();
    expect(snapshot.turn).toBeGreaterThan(0);
  });
});
