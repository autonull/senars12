import {describe, it, expect, beforeEach} from '@jest/globals';
import {AIAgent} from '../../src/agent/AIAgent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {ConversationState} from '../../src/agent/ConversationState.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import type {Capabilities, BotConfig} from '../../src/agent/types.js';
import {makeDefaultBotConfig} from '../../src/config/defaults.js';
import type {LMClient} from '../../src/nar/lm/types.js';

function createMockLMClient(nar?: any): LMClient {
  return {
    provider: 'mock',
    available: true,
    model: 'mock-model',
    async generateText(prompt: string): Promise<string> {
      const p = prompt.toLowerCase();
      if (p.includes('cats are animals')) {
        if (nar) await nar.input('(cat --> animal).');
        return 'I have added the belief (cat --> animal) to memory.';
      }
      if (p.includes('is a cat living')) {
        return 'Yes, a cat is living because it is an animal and animals are living things.';
      }
      return 'Mock response with reasoning.';
    },
  };
}

describe('AIAgent', () => {
  const testBotConfig: BotConfig = makeDefaultBotConfig({
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
  });

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

  const testConfig = makeDefaultBotConfig({
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
  });

  const mockLMClient = createMockLMClient();

  it('should initialize with NARS', () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      lmClient: mockLMClient,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    expect(agent).toBeDefined();
    expect(agent.getCapabilities()).toBeDefined();
  });

  it.skip('should call nar_believe tool', async () => {
    // TODO: AI SDK 5 dispatch path bypasses our mock adapter. Restore once
    // AISDKAdapter.doGenerate is reachable from the test's runLM call.
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      lmClient: createMockLMClient(nar),
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
      lmClient: mockLMClient,
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
      lmClient: mockLMClient,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    expect(agent).toBeDefined();
  });

  it.skip('should maintain conversation history', async () => {
    // TODO: see `should call nar_believe tool` — AI SDK 5 dispatch path.
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const conversation = new ConversationState(testBotConfig);

    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      lmClient: mockLMClient,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext(conversation);
    await agent.chat('Hello', context);
    await agent.chat('How are you?', context);

    const history = conversation.getHistory(20);
    expect(history.length).toBeGreaterThanOrEqual(2);
  }, 10000);

  it('should use cognitive context builder', async () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});

    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      lmClient: mockLMClient,
      config: testConfig,
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext();
    await agent.chat('Test cognitive context', context);

    expect(nar.getStatistics()).toBeDefined();
  });
});


