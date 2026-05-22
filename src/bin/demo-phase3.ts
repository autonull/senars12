#!/usr/bin/env tsx
/**
 * Phase 3 Demo: Self-Analysis and Benchmark Integration
 * 
 * This demo showcases:
 * 1. Episodic Memory integration with AIAgent
 * 2. Self-Analysis Manager for continuous improvement
 * 3. Benchmark Runner for performance evaluation
 */

import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {AIAgent} from '../agent/AIAgent.js';
import {ConversationState} from '../agent/ConversationState.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
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
  pipeline: {maxLoops: 10, stageTimeoutMs: 5000, enableLoopBack: false, loopBackOn: []},
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

async function demo1_EpisodicMemory() {
  console.log('='.repeat(60));
  console.log('Demo 1: Episodic Memory Integration');
  console.log('='.repeat(60));
  
  const registry = createSeNARSRegistry();
  const nar = SeNARSFactory.createDefault({providerRegistry: registry});
  const episodicMemory = new EpisodicMemory({
    enabled: true,
    basePath: '.cache/demo-episodes',
    retentionDays: 1,
    maxEntriesPerFile: 10000,
  });
  
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
    sender: 'demo',
    connectionType: 'cli',
    conversation,
  };

  console.log('\n1. Adding beliefs to NARS...');
  await agent.chat('(cat --> animal).', context);
  await agent.chat('(animal --> living).', context);
  await agent.chat('(Felix --> cat).', context);
  
  console.log('2. Checking episodic memory...');
  const episodes = await episodicMemory.getEpisodes({limit: 10});
  console.log(`   ✓ Logged ${episodes.length} episodes`);
  
  console.log('3. Recent episode summary:');
  const summary = await episodicMemory.getRecentSummary(5);
  console.log(`   ${summary.split('\n').join('\n   ')}`);
  
  console.log('\n✓ Demo 1 Complete\n');
}

async function demo2_SelfAnalysis() {
  console.log('='.repeat(60));
  console.log('Demo 2: Self-Analysis Manager');
  console.log('='.repeat(60));
  
  const registry = createSeNARSRegistry();
  const nar = SeNARSFactory.createDefault({providerRegistry: registry});
  
  const agent = new AIAgent({
    nar,
    provider: 'transformers',
    config: botConfig,
    capabilities,
    selfAnalysisConfig: {
      enabled: true,
      analysisInterval: 5,
      autoImprove: false,
      maxImprovements: 3,
    },
  });

  const conversation = new ConversationState(botConfig);
  const context = {
    sender: 'demo',
    connectionType: 'cli',
    conversation,
  };

  console.log('\n1. Simulating conversation turns...');
  const inputs = [
    '(cat --> animal).',
    '(animal --> living).',
    '(Felix --> cat).',
    '(bird --> animal).',
    '(Tweety --> bird).',
  ];
  
  for (const input of inputs) {
    try {
      await agent.chat(input, context);
      console.log(`   ✓ Processed: ${input}`);
    } catch (error) {
      console.log(`   ✗ Error: ${error}`);
    }
  }
  
  console.log('\n2. Turn count:', agent.getTurnCount());
  
  console.log('\n3. Self-Analysis Summary:');
  const summary = await agent.getSelfAnalysisSummary();
  console.log(`   ${summary.split('\n').join('\n   ')}`);
  
  console.log('\n✓ Demo 2 Complete\n');
}

async function demo3_BenchmarkRunner() {
  console.log('='.repeat(60));
  console.log('Demo 3: Benchmark Runner');
  console.log('='.repeat(60));
  
  try {
    console.log('\n1. Creating benchmark runner...');
    const {runner, cleanup} = await BenchmarkRunner.create({
      suites: ['nal1-deduction', 'nal1-induction'],
      timeout: 10000,
      maxRetries: 1,
      provider: 'transformers',
    });
    
    console.log('2. Running benchmark suites...');
    const results = await runner.runAllSuites();
    
    console.log('\n3. Benchmark Results:');
    console.log(runner.getSummary(results));
    
    cleanup();
    console.log('\n✓ Demo 3 Complete\n');
  } catch (error) {
    console.log('✗ Benchmark runner error (expected without LM provider):', error);
  }
}

async function demo4_CognitiveContextWithMemory() {
  console.log('='.repeat(60));
  console.log('Demo 4: Cognitive Context + Episodic Memory');
  console.log('='.repeat(60));
  
  const registry = createSeNARSRegistry();
  const nar = SeNARSFactory.createDefault({providerRegistry: registry});
  const episodicMemory = new EpisodicMemory({
    enabled: true,
    basePath: '.cache/demo-episodes',
    retentionDays: 1,
    maxEntriesPerFile: 10000,
  });
  
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
    sender: 'demo',
    connectionType: 'cli',
    conversation,
  };

  console.log('\n1. Building cognitive context through conversation...');
  const conversationFlow = [
    '(Felix --> cat).',
    '(cat --> animal).',
    '(animal --> living).',
    '(Tweety --> bird).',
    '(bird --> animal).',
    'What is Felix?',
  ];
  
  for (const input of conversationFlow) {
    try {
      const response = await agent.chat(input, context);
      console.log(`   Q: ${input}`);
      console.log(`   A: ${response.substring(0, 60)}...`);
    } catch (error) {
      console.log(`   Q: ${input}`);
      console.log(`   A: [Error: ${error}]`);
    }
  }
  
  console.log('\n2. Episodic memory check...');
  const episodes = await episodicMemory.getEpisodes({limit: 20});
  console.log(`   ✓ Total episodes: ${episodes.length}`);
  
  console.log('3. Conversation history:');
  const history = conversation.getHistory(20);
  console.log(`   ✓ Messages: ${history.length}`);
  
  console.log('\n✓ Demo 4 Complete\n');
}

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         Phase 3 Feature Parity Demo                      ║');
  console.log('║  Episodic Memory + Self-Analysis + Benchmarks            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  try {
    await demo1_EpisodicMemory();
    await demo2_SelfAnalysis();
    await demo3_BenchmarkRunner();
    await demo4_CognitiveContextWithMemory();
    
    console.log('='.repeat(60));
    console.log('All Demos Complete!');
    console.log('='.repeat(60));
    console.log('\nKey Features Demonstrated:');
    console.log('✓ Episodic Memory: Automatic logging of inputs/responses');
    console.log('✓ Self-Analysis: Turn tracking and analysis');
    console.log('✓ Benchmark Runner: Suite execution framework');
    console.log('✓ Cognitive Context: NARS attention + conversation state');
    console.log('\n');
    
  } catch (error) {
    console.error('Demo error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
