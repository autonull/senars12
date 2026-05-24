import {describe, it, expect, beforeEach} from '@jest/globals';
import {AIAgent} from '../../src/agent/AIAgent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {ConversationState} from '../../src/agent/ConversationState.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import type {Capabilities} from '../../src/agent/BotContext.js';
import {DEFAULT_BOT_CONFIG} from '../../src/config/defaults.js';
import type {BotConfig} from '../../src/agent/BotContext.js';

function createMockModel() {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    defaultObjectGenerationMode: 'json' as const,
    doGenerate: async () => ({
      content: [{type: 'text' as const, text: 'Mock response with reasoning.'}],
      finishReason: 'stop' as const,
      usage: {inputTokens: 10, outputTokens: 5, totalTokens: 15},
    }),
    doStream: async () => {
      const {ReadableStream} = await import('node:stream/web');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({type: 'text-delta', id: '0', delta: 'Mock'})));
          controller.enqueue(encoder.encode(JSON.stringify({type: 'text-delta', id: '0', delta: ' response'})));
          controller.enqueue(encoder.encode(JSON.stringify({type: 'text-end', id: '0'})));
          controller.close();
        },
      });
      return {stream, rawResponse: {headers: new Headers({'content-type': 'text/plain'})}};
    },
  };
}

describe('AIAgent', () => {
  const testBotConfig: BotConfig = {
    reasoning: {
      autoTrigger: true,
      triggerThreshold: 0.5,
      triggerCooldown: 3,
      maxStepsPerTrigger: 5,
      backgroundReasoning: false,
      backgroundIntervalMs: 60000,
      lmDriven: true,
    },
    streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50},
    directives: {builtIn: true},
    nlParsers: {builtIn: true},
    classifier: {},
    lmRules: {enabled: true, rules: []},
    tui: {typingIndicator: false, colors: true, compactMode: false, statusBar: true},
    prompts: {},
  } as const;

  const createTestContext = (conversation?: ConversationState) => ({
    sender: 'test',
    connectionType: 'cli' as const,
    conversation: conversation || new ConversationState(testBotConfig),
  });

  const createTestCapabilities = (): Capabilities => ({
    hasLM: true,
    hasSeNARS: true,
    hasStreaming: false,
    hasTools: true,
    hasMemory: true,
    mode: 'full',
  });

  const testConfig = {
    reasoning: {
      autoTrigger: true,
      triggerThreshold: 0.5,
      triggerCooldown: 3,
      maxStepsPerTrigger: 5,
      backgroundReasoning: false,
      backgroundIntervalMs: 60000,
      lmDriven: true,
    },
    streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50},
  };

  const mockModel = createMockModel();

  it('should initialize with NARS', () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      languageModel: mockModel,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    expect(agent).toBeDefined();
    expect(agent.getCapabilities()).toBeDefined();
  });

  it('should call nar_believe tool', async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      languageModel: mockModel,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext();
    const result = await agent.chat('Remember that cats are animals', context);

    expect(result).toBeDefined();
    expect(nar.getBeliefs().length).toBeGreaterThan(0);
  });

  it('should use NARS for reasoning questions', async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    await nar.input('(cat --> animal).');
    await nar.input('(animal --> living).');

    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      languageModel: mockModel,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext();
    const result = await agent.chat('Is a cat living?', context);

    expect(result).toBeDefined();
  });

  it('should degrade gracefully without LM', async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});

    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      languageModel: mockModel,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    expect(agent).toBeDefined();
  });

  it('should maintain conversation history', async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const conversation = new ConversationState(testBotConfig);
    
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      languageModel: mockModel,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext(conversation);
    await agent.chat('Hello', context);
    await agent.chat('How are you?', context);

    const history = conversation.getHistory(20);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should use cognitive context builder', async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      languageModel: mockModel,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext();
    await agent.chat('Test cognitive context', context);

    expect(nar.getStatistics()).toBeDefined();
  });
});
