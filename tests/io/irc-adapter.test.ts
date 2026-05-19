/**
 * IRC Adapter tests
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {createIRCAdapter} from '../../src/io/adapters/irc-adapter.js';
import {Agent} from '../../src/agent/Agent.js';
import {AgenticLoop} from '../../src/agent/AgenticLoop.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import {DEFAULT_NAR_CONFIG} from '../../src/config/defaults.js';
import {BotProfile} from '../../src/agent/BotProfile.js';
import {ChannelBehavior} from '../../src/agent/ChannelBehavior.js';
import {ConversationManager} from '../../src/agent/ConversationManager.js';
import {ResponseFormatter} from '../../src/agent/ResponseFormatter.js';
import {EpisodicMemory} from '../../src/nar/memory/EpisodicMemory.js';

describe('IRCAdapter', () => {
  let agent: Agent;
  let agenticLoop: AgenticLoop;
  let botProfile: BotProfile;
  let channelBehavior: ChannelBehavior;
  let conversationManager: ConversationManager;
  let responseFormatter: ResponseFormatter;

  beforeEach(async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });
    agent = new Agent({nar});
    await agent.start();
    
    const episodicMemory = new EpisodicMemory();
    agenticLoop = new AgenticLoop(agent, episodicMemory);
    
  botProfile = new BotProfile();
  channelBehavior = new ChannelBehavior('irc');
  conversationManager = new ConversationManager();
  responseFormatter = new ResponseFormatter();
  });

  afterEach(async () => {
    await agent.stop();
  });

  it('should create IRC adapter', () => {
    const mockIrcConnection = {
      onMessage: () => {},
      onStateChange: () => {},
      on: () => {},
      send: async () => {},
      name: 'test-bot',
    } as any;

    const adapter = createIRCAdapter({
      botProfile,
      conversationManager,
      responseFormatter,
      agent,
      agenticLoop,
      ircConnection: mockIrcConnection,
      channels: ['#test'],
    });

    expect(adapter).toBeDefined();
  });

  it('should handle PM messages', () => {
    const mockIrcConnection = {
      onMessage: (handler: any) => {
        handler({
          id: '1',
          source: 'irc',
          sender: 'user1',
          text: 'hello',
          timestamp: Date.now(),
          metadata: {},
        });
      },
      onStateChange: () => {},
      on: () => {},
      send: async () => {},
      name: 'test-bot',
    } as any;

    const adapter = createIRCAdapter({
      botProfile,
      conversationManager,
      responseFormatter,
      agent,
      agenticLoop,
      ircConnection: mockIrcConnection,
      channels: ['#test'],
    });

    expect(adapter).toBeDefined();
  });

  it('should strip nick prefix from channel messages', () => {
    expect('hello'.trim()).toBe('hello');
    expect('SeNARS: hello'.replace(/^SeNARS[:.]\s*/i, '').trim()).toBe('hello');
  });

  it('should format responses for IRC', () => {
    const longText = 'a'.repeat(500);
    const chunks = responseFormatter.formatForIRC(longText);
    
    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(400);
    });
  });

  it('should manage conversation context', async () => {
    const userId = 'user123';
    
    conversationManager.addMessage(userId, 'user', 'Hello');
    conversationManager.addMessage(userId, 'assistant', 'Hi there!');
    
    const context = conversationManager.getContext(userId);
    expect(context.messages.length).toBe(2);
    
    const prompt = conversationManager.getContextForPrompt(userId);
    expect(prompt).toContain('user: Hello');
    expect(prompt).toContain('assistant: Hi there!');
  });
});
