# SeNARS Agent Architecture - Phase 3 & 4 Update

## Overview

This document describes the new AIAgent architecture implemented in Phases 3-4, replacing the legacy pipeline-based system.

## Quick Start

```typescript
import {AIAgent, ConversationState, SelfAnalysisManager} from './agent/index.js';
import {SeNARSFactory} from './nar/index.js';
import {EpisodicMemory} from './nar/memory/EpisodicMemory.js';

// Create NARS instance
const nar = SeNARSFactory.createDefault({providerRegistry: createSeNARSRegistry()});

// Create episodic memory
const episodicMemory = new EpisodicMemory({
  enabled: true,
  basePath: '.cache/episodes',
  retentionDays: 30,
  maxEntriesPerFile: 10000,
});

// Create AI Agent with self-analysis
const agent = new AIAgent({
  nar,
  episodicMemory,
  provider: 'anthropic', // or 'ollama' or 'transformers'
  config: {
    reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
    streaming: {enabled: false, showReasoningSteps: true, showToolCalls: true},
    conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50},
    pipeline: {maxLoops: 10, stageTimeoutMs: 5000, enableLoopBack: false, loopBackOn: []},
    prompts: {},
  },
  capabilities: {
    hasLM: true,
    hasSeNARS: true,
    hasStreaming: false,
    hasTools: true,
    hasMemory: true,
    mode: 'full',
  },
  selfAnalysisConfig: {
    enabled: true,
    analysisInterval: 10,
    autoImprove: false,
    maxImprovements: 3,
  },
});

// Create conversation state
const conversation = new ConversationState(botConfig);

// Chat
const context = {sender: 'user', connectionType: 'cli', conversation};
const response = await agent.chat('(cat --> animal).', context);
console.log(response);

// Get self-analysis summary
const summary = await agent.getSelfAnalysisSummary();
console.log(summary);
```

## Architecture

### Core Components

#### AIAgent
The main AI agent that combines NARS reasoning with LM semantic understanding.

**Features:**
- Tool calling (NARS operations)
- Cognitive context building
- Episodic memory logging
- Self-analysis integration
- Multiple LM providers (Anthropic, Ollama, Transformers)

**Methods:**
- `chat(input, context)` - Main chat interface
- `getSelfAnalysisSummary()` - Get self-analysis report
- `getAnalysisReport()` - Get detailed analysis
- `getTurnCount()` - Get conversation turn count
- `getCapabilities()` - Get agent capabilities

#### SelfAnalysisManager (Phase 3)
Continuous self-improvement through turn tracking and analysis.

**Features:**
- Automatic turn recording
- Periodic analysis triggers
- Knowledge gap detection
- Coverage analysis
- Self-improvement execution

#### BenchmarkRunner (Phase 3)
Performance evaluation and regression tracking.

**Features:**
- Execute benchmark suites (NAL1-9, tools, chat, memory, LM)
- Scenario execution with retry logic
- Result aggregation
- Summary generation

#### ConversationState
Manages conversation history and context.

**Features:**
- Message history
- Working memory
- Reasoning artifacts
- Pinned beliefs

### Configuration

#### BotConfig
```typescript
interface BotConfig {
  reasoning: {
    autoTrigger: boolean;
    triggerThreshold: number;
    triggerCooldown: number;
    maxStepsPerTrigger: number;
    backgroundReasoning: boolean;
    backgroundIntervalMs: number;
    lmDriven: boolean;
  };
  streaming: {
    enabled: boolean;
    showReasoningSteps: boolean;
    showToolCalls: boolean;
  };
  conversation: {
    maxHistory: number;
    summaryThreshold: number;
    maxArtifacts: number;
  };
  pipeline: {
    maxLoops: number;
    stageTimeoutMs: number;
    enableLoopBack: boolean;
    loopBackOn: ('believe' | 'question' | 'tool_call')[];
  };
  prompts: {
    system?: string;
    directiveInstructions?: string;
    responseGuidelines?: string;
  };
}
```

#### SelfAnalysisConfig
```typescript
interface SelfAnalysisConfig {
  enabled: boolean;
  analysisInterval: number; // Turns between analysis
  autoImprove: boolean;
  maxImprovements: number;
}
```

### Environment Variables

```bash
# LM Provider
export LM_PROVIDER=anthropic  # anthropic | ollama | transformers
export LM_MODEL=claude-sonnet-4-20250514
export ANTHROPIC_API_KEY=your-key-here
export OLLAMA_HOST=localhost:11434

# Episodic Memory
export EPISODIC_MEMORY_PATH=.cache/episodes
export EPISODIC_RETENTION_DAYS=30

# Self-Analysis
export SELF_ANALYSIS_ENABLED=true
export SELF_ANALYSIS_INTERVAL=10

# Benchmarking
export BENCHMARK_TIMEOUT=30000
export BENCHMARK_MAX_RETRIES=1
```

## Usage Examples

### Basic Chat
```typescript
const agent = new AIAgent({...});
const conversation = new ConversationState(config);
const context = {sender: 'user', connectionType: 'cli', conversation};

const response = await agent.chat('Hello!', context);
```

### With Self-Analysis
```typescript
const agent = new AIAgent({
  // ... other config
  selfAnalysisConfig: {
    enabled: true,
    analysisInterval: 10,
    autoImprove: false,
  },
});

// Automatic analysis happens during chat
await agent.chat('Test message', context);

// Get report
const summary = await agent.getSelfAnalysisSummary();
```

### Running Benchmarks
```typescript
import {BenchmarkRunner} from './agent/index.js';

const {runner, cleanup} = await BenchmarkRunner.create({
  suites: ['nal1-deduction', 'nal1-induction'],
  provider: 'transformers',
});

const results = await runner.runAllSuites();
console.log(runner.getSummary(results));
cleanup();
```

## Migration from Legacy Agent

### Old Pattern (Removed)
```typescript
import {Agent, AgenticLoop} from './agent/index.js';

const agent = new Agent({profile, nar, lm, config});
const loop = new AgenticLoop(agent, config);
await loop.processMessage(message);
```

### New Pattern
```typescript
import {AIAgent, ConversationState} from './agent/index.js';

const agent = new AIAgent({...});
const conversation = new ConversationState(config);
const context = {sender: 'user', connectionType: 'cli', conversation};
const response = await agent.chat(input, context);
```

## Files Structure

```\nsrc/agent/\n├── AIAgent.ts                 # Main agent\n├── SelfAnalysisManager.ts     # Self-analysis (Phase 3)\n├── CognitiveContext.ts        # Cognitive context builder\n├── ConversationState.ts       # Conversation state\n├── BotContext.ts              # Types and context\n├── BotProfile.ts              # Bot profile\n├── ChannelBehavior.ts         # Channel behavior\n├── IdentityResolver.ts        # Identity resolution\n├── DegradationManager.ts      # Degradation management\n├── ResponseFormatter.ts       # Response formatting\n├── ResponseInterpreter.ts     # Response interpretation\n├── SelfAnalyzer.ts            # Self-analyzer core\n├── config.ts                  # Configuration\n├── index.ts                   # Exports\n├── types.ts                   # Type definitions\n├── benchmarks/                # Benchmark suite (Phase 3)\n│   ├── BenchmarkRunner.ts\n│   └── index.ts\n├── scenarios/                 # Scenario runners\n├── experiments/               # Experiment runners\n├── tools/                     # NARS and general tools\n├── streaming/                 # Streaming support\n├── tui/                       # TUI components\n└── rlfp/                      # RLFP bridge\n```\n\n## Testing

### Run Demo
```bash\ntsx src/bin/demo-phase3.ts\n```\n\n### Run Tests
```bash\nnpm test -- tests/agent/ai-agent.test.ts\n```\n\n### Run Benchmarks
```bash\n# Via demo\ntsx src/bin/demo-phase3.ts\n\n# Or programmatically\nimport {BenchmarkRunner} from './agent/index.js';\nconst {runner} = await BenchmarkRunner.create({...});\nconst results = await runner.runAllSuites();\n```\n\n## Documentation

- `PHASE3_SUMMARY.md` - Detailed Phase 3 implementation\n- `PHASE3_COMPLETE.md` - Phase 3 quick reference\n- `PHASE3_VERIFICATION.md` - Verification report\n- `PHASE4_COMPLETE.md` - Phase 4 deprecation summary\n- `AI.md` - Overall architecture plan\n\n## Support

For issues or questions, refer to the documentation files or check the examples in `src/bin/`.
