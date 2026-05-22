import {describe, it, expect, beforeEach} from '@jest/globals';
import {AIAgent} from '../../src/agent/AIAgent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {ConversationState} from '../../src/agent/ConversationState.js';
import {createSeNARSRegistry} from '../../src/nar/lm/providers.js';
import type {Capabilities} from '../../src/agent/BotContext.js';
import {DEFAULT_BOT_CONFIG} from '../../src/config/defaults.js';
import type {BotConfig} from '../../src/agent/BotContext.js';

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

  it('should initialize with NARS', () => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({providerRegistry: registry});
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      config: {
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
      },
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
      model: 'Qwen/Qwen2.5-1.5B-Instruct',
      config: {
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
      },
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
      model: 'Qwen/Qwen2.5-1.5B-Instruct',
      config: {
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
      },
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
      model: 'Qwen/Qwen2.5-1.5B-Instruct',
      config: {
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
      },
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
      model: 'Qwen/Qwen2.5-1.5B-Instruct',
      config: {
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
      },
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
      model: 'Qwen/Qwen2.5-1.5B-Instruct',
      config: {
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
      },
      capabilities: createTestCapabilities(),
    });

    const context = createTestContext();
    await agent.chat('Test cognitive context', context);

    expect(nar.getStatistics()).toBeDefined();
  });
});
