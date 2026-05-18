/**
 * AgenticLoop integration tests
 */

import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import {AgenticLoop} from '../../src/agent/AgenticLoop.js';
import {Agent} from '../../src/agent/Agent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import {DEFAULT_NAR_CONFIG} from '../../src/config/defaults.js';
import {EpisodicMemory} from '../../src/nar/memory/EpisodicMemory.js';
import type {IOMessage} from '../../src/io/types.js';

describe('AgenticLoop', () => {
  let agent: Agent;
  let episodicMemory: EpisodicMemory;

  beforeEach(async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });
    agent = new Agent({nar});
    await agent.start();
    episodicMemory = new EpisodicMemory();
  });

  afterEach(async () => {
    await agent.stop();
  });

  it('should create with agent and episodic memory', () => {
    const loop = new AgenticLoop(agent, episodicMemory);
    expect(loop).toBeDefined();
    expect(loop.getStats()).toBeDefined();
  });

  it('should accept messages via pushMessage', () => {
    const loop = new AgenticLoop(agent, episodicMemory);
    const message: IOMessage = {
      id: 'test-1',
      source: 'test',
      sender: 'tester',
      text: '(cat --> animal).',
      timestamp: Date.now(),
    };

    loop.pushMessage(message);
    expect(loop.getStats().queueSize).toBe(1);
  });

  it('should process messages through message handler', async () => {
    const loop = new AgenticLoop(agent, episodicMemory);
    let processed = false;

    loop.setMessageHandler(async (msg) => {
      processed = true;
      expect(msg.text).toBe('(cat --> animal).');
    });

    const message: IOMessage = {
      id: 'test-1',
      source: 'test',
      sender: 'tester',
      text: '(cat --> animal).',
      timestamp: Date.now(),
    };

    loop.pushMessage(message);
    
    // Give time for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(processed).toBe(true);
  });

  it('should log to episodic memory', async () => {
    const loop = new AgenticLoop(agent, episodicMemory, {
      maxInputTurns: 1,
      maxWakeTurns: 1,
      sleepIntervalMs: 10,
      wakeupIntervalMs: 100,
    });

    const message: IOMessage = {
      id: 'test-1',
      source: 'test',
      sender: 'tester',
      text: 'test message',
      timestamp: Date.now(),
    };

    loop.pushMessage(message);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const episodes = await episodicMemory.getEpisodes({limit: 10});
    expect(episodes.length).toBeGreaterThan(0);
  });

  it('should start and stop', () => {
    const loop = new AgenticLoop(agent, episodicMemory);
    loop.start();
    expect(loop.getStats().turn).toBeDefined();
    loop.stop();
  });
});
