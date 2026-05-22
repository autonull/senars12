#!/usr/bin/env tsx
/**
 * Phase 3 Integration Test Script
 * Tests: Episodic Memory, Self-Analysis, and Benchmark Integration
 */

import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {AIAgent} from '../agent/AIAgent.js';
import {ConversationState} from '../agent/ConversationState.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {SelfAnalysisManager} from '../agent/SelfAnalysisManager.js';
import {BenchmarkRunner} from '../agent/benchmarks/BenchmarkRunner.js';
import type {BotConfig, Capabilities} from '../agent/BotContext.js';

const botConfig: BotConfig = {
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
};

const capabilities: Capabilities = {
  hasLM: false,
  hasSeNARS: true,
  hasStreaming: false,
  hasTools: true,
  hasMemory: true,
  mode: 'senars-only',
};

async function testEpisodicMemoryIntegration() {
console.log('=== Testing Episodic Memory Integration ===');

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({providerRegistry: registry});
const episodicMemory = new EpisodicMemory({enabled: true, basePath: '.cache/test-episodes', retentionDays: 1, maxEntriesPerFile: 10000});

const agent = new AIAgent({
nar,
episodicMemory,
provider: 'transformers',
config: botConfig,
capabilities,
});

const conversation = new ConversationState(botConfig);

await episodicMemory.clear();

const context = {
sender: 'test',
connectionType: 'cli' as const,
conversation,
};

  try {
    await agent.chat('(cat --> animal).', context);
    await agent.chat('(animal --> living).', context);
    
    const episodes = await episodicMemory.getEpisodes({limit: 10});
    console.log(`✓ Logged ${episodes.length} episodes`);
    
    const summary = await episodicMemory.getRecentSummary(5);
    console.log('Recent episodes:', summary);
    
    console.log('✓ Episodic Memory Integration: PASSED\n');
    return true;
  } catch (error) {
    console.error('✗ Episodic Memory Integration: FAILED');
    console.error(error);
    return false;
  }
}

async function testSelfAnalysisManager() {
console.log('=== Testing Self-Analysis Manager ===');

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({providerRegistry: registry});
const episodicMemory = new EpisodicMemory({enabled: true, basePath: '.cache/test-episodes', retentionDays: 1, maxEntriesPerFile: 10000});

const selfAnalysisManager = new SelfAnalysisManager(nar, episodicMemory, undefined, undefined, {
enabled: true,
analysisInterval: 5,
autoImprove: false,
});

  await selfAnalysisManager.recordTurn(true, 'Test success');
  await selfAnalysisManager.recordTurn(false, 'Test failure');
  await selfAnalysisManager.recordTurn(true, 'Test success');
  
  const state = selfAnalysisManager.getState();
  console.log(`Turn count: ${state.turnCount}`);
  console.log(`Successes: ${state.totalSuccesses}, Failures: ${state.totalFailures}`);
  
  const summary = await selfAnalysisManager.generateSummary();
  console.log('Self-Analysis Summary:');
  console.log(summary);
  
  console.log('✓ Self-Analysis Manager: PASSED\n');
  return true;
}

async function testBenchmarkRunner() {
  console.log('=== Testing Benchmark Runner ===');
  
  try {
    const {runner, cleanup} = await BenchmarkRunner.create({
      suites: ['nal1-deduction', 'nal1-induction'],
      timeout: 10000,
      maxRetries: 1,
      provider: 'transformers',
    });

    const results = await runner.runAllSuites();
    
    console.log('\nBenchmark Results:');
    console.log(runner.getSummary(results));
    
    cleanup();
    console.log('✓ Benchmark Runner: PASSED\n');
    return true;
  } catch (error) {
    console.error('✗ Benchmark Runner: FAILED');
    console.error(error);
    return false;
  }
}

async function testCognitiveContextWithMemory() {
console.log('=== Testing Cognitive Context with Episodic Memory ===');

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({providerRegistry: registry});
const episodicMemory = new EpisodicMemory({enabled: true, basePath: '.cache/test-episodes', retentionDays: 1, maxEntriesPerFile: 10000});

const agent = new AIAgent({
nar,
episodicMemory,
provider: 'transformers',
config: botConfig,
capabilities,
});

  const conversation = new ConversationState(botConfig);
  
  await episodicMemory.clear();
  
  const context = {
    sender: 'test',
    connectionType: 'cli' as const,
    conversation,
  };

  try {
    await agent.chat('(Felix --> cat).', context);
    await agent.chat('(cat --> animal).', context);
    await agent.chat('(animal --> living).', context);
    
    const episodes = await episodicMemory.getEpisodes({limit: 10});
    console.log(`✓ Logged ${episodes.length} cognitive interactions`);
    
    const history = conversation.getHistory(20);
    console.log(`✓ Conversation history: ${history.length} messages`);
    
    console.log('✓ Cognitive Context with Memory: PASSED\n');
    return true;
  } catch (error) {
    console.error('✗ Cognitive Context with Memory: FAILED');
    console.error(error);
    return false;
  }
}

async function main() {
  console.log('Phase 3 Integration Tests\n');
  console.log('=' .repeat(50));
  
  const results: boolean[] = [];
  
  results.push(await testEpisodicMemoryIntegration());
  results.push(await testSelfAnalysisManager());
  results.push(await testCognitiveContextWithMemory());
  results.push(await testBenchmarkRunner());
  
  console.log('=' .repeat(50));
  console.log(`\nResults: ${results.filter(r => r).length}/${results.length} tests passed`);
  
  if (results.every(r => r)) {
    console.log('✓ All Phase 3 integration tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

main().catch(console.error);
