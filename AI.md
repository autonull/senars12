# Agent System Redesign: AI SDK + NARS Cognitive Synergy

## Executive Summary

**Goal**: Create a usable agent that can reason by combining NARS (symbolic reasoning) + LM (semantic understanding) within Vercel's AI SDK framework—without sacrificing the flexibility needed for cognitive processing experimentation.

**Core Philosophy** (from UPDATE.md): *"One input, unified processing, synergistic output."* The question is never "which one handles this?" but "how do they collaborate?"

**Design Principle**: The AI SDK provides the agent framework (tool calling, structured outputs, agentic loops), while NARS provides formal reasoning capabilities. The LM decides **when** to use NARS vs respond directly, creating cognitive synergy without architectural complexity.

**Key Innovation**: Unlike simple AI SDK wrappers, this design preserves the rich cognitive architecture from BOT2/BOT3/BOT4 plans:
- Multi-stage pipeline for fine-grained control
- Auto-triggering reasoning based on heuristics + LM signals  
- Unified conversation state with working memory
- Graceful degradation (Full/LM-only/SeNARS-only modes)
- Configuration space amenable to optimization

---

## Architecture Overview

### Three Configuration Modes

| Mode | LM | NARS | Behavior |
|------|----|------|----------|
| **Full** | ✓ | ✓ | Intelligent agent with reasoning, memory, and natural conversation |
| **LM-only** | ✓ | ✗ | Ordinary LM-powered chatbot with tools and commands |
| **NARS-only** | ✗ | ✓ | Formal logic REPL with Narsese input/output |

The framework detects capabilities at startup and adapts automatically.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI SDK Agent                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LLM (Anthropic/Ollama/Transformers.js)               │  │
│  │  - Semantic understanding                              │  │
│  │  - Tool calling decisions                              │  │
│  │  - Response generation                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│         │                    │                               │
│         │ Tool Calls         │ NARS Operations               │
│         ▼                    ▼                               │
│  ┌────────────────────────────────────────────────┐        │
│  │        NARS Tools (nar_believe, nar_query,    │        │
│  │                  nar_reason, nar_question)     │        │
│  └────────────────────────────────────────────────┘        │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                       │
│                   │   NARS Engine   │                       │
│                   │   - NAL Rules   │                       │
│                   │   - Memory      │                       │
│                   │   - Attention   │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Message Pipeline (Optional)       │
│   - InputNormalizer                 │
│   - CommandProcessor                │
│   - InputClassifier                 │
│   - ReasoningTrigger                │
│   - ResponseComposer                │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Connection Adapters               │
│   - IRC / WebSocket / HTTP / MCP    │
└─────────────────────────────────────┘
```

**Key Insight**: The AI SDK Agent can operate in two modes:
1. **Direct Mode**: AI SDK handles everything (simpler, recommended for most cases)
2. **Pipeline Mode**: Custom pipeline stages preprocess before AI SDK (preserves BOT4 flexibility)

---

## Core Components

### 1. AIAgent Class

**File**: `src/agent/AIAgent.ts`

```typescript
import {agent, generateText, streamText, ToolCallPart} from 'ai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {createOllama} from 'ollama-ai-provider-v2';
import {createTransformers} from '../lm/transformers-provider.js';
import {narsTools} from './tools/nars-tools.js';
import {generalTools} from './tools/general-tools.js';
import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {BotConfig, Capabilities} from './types.js';

interface AIAgentConfig {
  nar?: NAR;
  episodicMemory?: EpisodicMemory;
  provider: 'anthropic' | 'ollama' | 'transformers' | 'custom';
  model?: string;
  instructions?: string | SystemPromptBuilder;
  config: Partial<BotConfig>;
  capabilities: Capabilities;
}

export class AIAgent {
  private readonly nar?: NAR;
  private readonly episodicMemory?: EpisodicMemory;
  private readonly config: Partial<BotConfig>;
  private readonly capabilities: Capabilities;
  private readonly agent;
  private readonly provider: any;
  
  constructor(config: AIAgentConfig) {
    this.nar = config.nar;
    this.episodicMemory = config.episodicMemory;
    this.config = config.config;
    this.capabilities = config.capabilities;
    
    this.provider = this.createProvider(config);
    
    this.agent = agent({
      model: this.provider(config.model ?? this.getDefaultModel()),
      tools: this.createTools(),
      instructions: this.buildInstructions(config.instructions),
      maxSteps: config.config.pipeline?.maxLoops ?? 10,
    });
  }
  
  private createProvider(config: AIAgentConfig): any {
    switch (config.provider) {
      case 'anthropic':
        return createAnthropic({apiKey: process.env.ANTHROPIC_API_KEY});
      case 'ollama':
        return createOllama({host: process.env.OLLAMA_HOST});
      case 'transformers':
        return createTransformers({
          model: config.config.lm?.transformersModel ?? 'Qwen/Qwen2.5-1.5B-Instruct',
        });
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
  
  private createTools() {
    const tools: Record<string, any> = {};
    
    // NARS tools (if available)
    if (this.nar) {
      Object.assign(tools, narsTools(this.nar));
    }
    
    // General tools
    Object.assign(tools, generalTools({
      nar: this.nar,
      episodicMemory: this.episodicMemory,
    }));
    
    return tools;
  }
  
  async chat(input: string, context: ConversationContext): Promise<string> {
    // Log to episodic memory
    await this.episodicMemory?.log('input', input, {
      sender: context.sender,
      channel: context.connectionType,
    });
    
    // Build conversation history
    const history = context.conversation.getHistory(20);
    const messages = [
      {role: 'system', content: this.buildSystemPrompt(context)},
      ...history.map(h => ({role: h.role, content: h.content})),
      {role: 'user', content: input},
    ];
    
    // Generate response
    const result = await this.agent.generate(messages);
    
    // Log response
    await this.episodicMemory?.log('response', result.text, {
      sender: context.sender,
      channel: context.connectionType,
    });
    
    // Add to conversation history
    context.conversation.addMessage({
      role: 'assistant',
      content: result.text,
      timestamp: Date.now(),
    }, this.nar?.getLMClient?.());
    
    return result.text;
  }
  
  async chatStream(input: string, context: ConversationContext): Promise<AsyncIterable<string>> {
    const history = context.conversation.getHistory(20);
    const messages = [
      {role: 'system', content: this.buildSystemPrompt(context)},
      ...history.map(h => ({role: h.role, content: h.content})),
      {role: 'user', content: input},
    ];
    
    const result = await this.agent.stream(messages);
    
    return result.textStream;
  }
  
  private buildSystemPrompt(custom: string | SystemPromptBuilder | undefined): string {
    if (typeof custom === 'function') {
      return custom({nar: this.nar, config: this.config});
    }
    return custom ?? this.defaultSystemPrompt();
  }
  
  private defaultSystemPrompt(): string {
    const mode = this.capabilities.mode;
    
    if (mode === 'full') {
      return `You are an intelligent assistant with access to a formal reasoning engine (SeNARS).

## Capabilities
- You can suggest logical analysis by including: [REASONING_SUGGESTED: brief reason]
- You can add beliefs: [BELIEVE: (<term --> category>. :confidence:frequency)]
- You can ask questions: [QUESTION: (<term --> ?>.)]

## When to Use Reasoning
- Causal questions ("why", "how", "therefore")
- Logical puzzles and syllogisms
- Comparisons and contrasts
- Contradictions or conflicting information
- Multi-hop inference patterns

## Response Guidelines
- Be concise and direct
- Acknowledge uncertainty when present
- Don't fabricate facts
- Use reasoning engine for formal logic, not for conversational chat`;
    }
    
    if (mode === 'lm-only') {
      return `You are a helpful conversational AI assistant.

## Capabilities
- Natural conversation
- Tool usage when appropriate
- Factual questions within your training

## Guidelines
- Be concise and direct
- Acknowledge uncertainty
- Don't fabricate facts`;
    }
    
    // NARS-only mode
    return `SeNARS Reasoning Engine — Narsese Input Mode

Accepted input:
- (<term --> category>.) — Add belief
- (<term --> ?>) — Ask question
  !(<term --> goal>.) — Set goal
- /run [n] — Run n reasoning steps
- /beliefs — Show current beliefs
- /concepts — Show active concepts
- /help — Show all commands`;
  }
}
```

### 2. NARS Tools

**File**: `src/agent/tools/nars-tools.ts`

```typescript
import {tool} from 'ai';
import {z} from 'zod';
import type {NAR} from '../../nar/nar.js';

export function narsTools(nar: NAR) {
  return {
    nar_believe: tool({
      description: 'Add a belief to NARS knowledge base in Narsese format',
      parameters: z.object({
        statement: z.string().describe('Narsese statement, e.g., "(cat --> animal). :|: truth=0.9"'),
        truth: z.object({
          frequency: z.number().min(0).max(1).optional(),
          confidence: z.number().min(0).max(1).optional(),
        }).optional(),
      }),
      execute: async ({statement, truth}) => {
        const fullStatement = truth 
          ? `${statement} :${truth.frequency}:${truth.confidence}`
          : statement;
        await nar.input(fullStatement);
        return {
          success: true,
          statement,
          truth,
          timestamp: Date.now(),
        };
      },
    }),
    
    nar_query: tool({
      description: 'Query the NARS knowledge base for information about a term',
      parameters: z.object({
        term: z.string().describe('Term to query'),
        filter: z.object({
          minConfidence: z.number().optional(),
          maxResults: z.number().optional(),
        }).optional(),
      }),
      execute: async ({term, filter}) => {
        const results = await nar.query.query(term, filter);
        return {
          results: results.beliefs.slice(0, filter?.maxResults ?? 50),
          count: results.beliefs.length,
          term,
        };
      },
    }),
    
    nar_question: tool({
      description: 'Ask a question to NARS and attempt to derive an answer',
      parameters: z.object({
        question: z.string().describe('Narsese question, e.g., "(cat --> ?)" or "What is a cat?"'),
        steps: z.number().min(1).max(100).optional().default(10),
      }),
      execute: async ({question, steps = 10}) => {
        await nar.input(question);
        const derived = await nar.run(steps);
        const answers = nar.getQuestions()?.slice(0, 5) ?? [];
        return {
          derived,
          answers,
          hasAnswer: derived > 0,
        };
      },
    }),
    
    nar_reason: tool({
      description: 'Run NARS reasoning engine for N steps to derive new beliefs',
      parameters: z.object({
        steps: z.number().min(1).max(100).describe('Number of reasoning steps (1-100)'),
        focusTerms: z.array(z.string()).optional().describe('Terms to focus reasoning on'),
      }),
      execute: async ({steps, focusTerms}) => {
        if (focusTerms) {
          for (const term of focusTerms) {
            nar.attention.prioritize(term);
          }
        }
        const derived = await nar.run(steps);
        return {
          derived,
          stats: nar.getStatistics(),
          beliefs: nar.getBeliefs().slice(-5),
        };
      },
    }),
    
    nar_get_beliefs: tool({
      description: 'Get current beliefs from NARS memory',
      parameters: z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        filter: z.object({
          minConfidence: z.number().optional(),
          term: z.string().optional(),
        }).optional(),
      }),
      execute: async ({limit = 20, filter}) => {
        let beliefs = nar.getBeliefs();
        
        if (filter?.term) {
          beliefs = beliefs.filter(b => b.term?.includes(filter.term));
        }
        if (filter?.minConfidence) {
          beliefs = beliefs.filter(b => b.truth?.confidence >= filter.minConfidence);
        }
        
        return {
          beliefs: beliefs.slice(0, limit),
          total: beliefs.length,
          limit,
        };
      },
    }),
    
    nar_get_questions: tool({
      description: 'Get pending questions from NARS that need answers',
      parameters: z.object({
        limit: z.number().optional().default(10),
      }),
      execute: async ({limit = 10}) => {
        const questions = nar.getQuestions()?.slice(0, limit) ?? [];
        return {questions, count: questions.length};
      },
    }),
    
    nar_get_attention: tool({
      description: 'Get current attention distribution in NARS memory',
      parameters: z.object({
        limit: z.number().optional().default(20),
      }),
      execute: async ({limit = 20}) => {
        const report = nar.attentionReport(limit);
        return {
          concepts: report.concepts,
          total: report.total,
        };
      },
    }),
  };
}
```

### 3. General Tools

**File**: `src/agent/tools/general-tools.ts`

```typescript
import {tool} from 'ai';
import {z} from 'zod';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';

interface ToolDeps {
  nar?: any;
  episodicMemory?: EpisodicMemory;
}

export function generalTools(deps: ToolDeps) {
  return {
    search_memory: tool({
      description: 'Search NARS memory for beliefs matching a pattern',
      parameters: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({query, limit = 10}) => {
        if (!deps.nar) {
          return {error: 'NARS not available', results: []};
        }
        const results = await deps.nar.query.query(query, {maxResults: limit});
        return {
          results: results.beliefs.slice(0, limit),
          count: results.beliefs.length,
        };
      },
    }),
    
    calculate: tool({
      description: 'Perform mathematical calculation',
      parameters: z.object({
        expression: z.string().describe('Math expression, e.g., "2 + 2 * 3"'),
      }),
      execute: async ({expression}) => {
        try {
          // Safe evaluation
          const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, '');
          const result = Function(`"use strict";return (${sanitized})`)();
          return {
            expression,
            result,
            success: true,
          };
        } catch (error) {
          return {
            expression,
            error: String(error),
            success: false,
          };
        }
      },
    }),
    
    get_recent_episodes: tool({
      description: 'Get recent episodes from episodic memory',
      parameters: z.object({
        limit: z.number().optional().default(10),
        type: z.enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error']).optional(),
      }),
      execute: async ({limit = 10, type}) => {
        if (!deps.episodicMemory) {
          return {error: 'Episodic memory not available', episodes: []};
        }
        const episodes = await deps.episodicMemory.getEpisodes({limit, type});
        return {
          episodes,
          count: episodes.length,
        };
      },
    }),
  };
}
```

### 4. Conversation State

**File**: `src/agent/ConversationState.ts`

```typescript
import type {LMClient} from '../nar/lm/types.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ReasoningArtifact {
  type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationConfig {
  maxHistory: number;
  summaryThreshold: number;
  maxArtifacts: number;
}

const DEFAULT_CONFIG: ConversationConfig = {
  maxHistory: 20,
  summaryThreshold: 30,
  maxArtifacts: 50,
};

export class ConversationState {
  private messages: Message[] = [];
  private summary?: string;
  private workingMemory = new Map<string, unknown>();
  private reasoningArtifacts: ReasoningArtifact[] = [];
  private pinnedBeliefs = new Set<string>();
  public mode: 'auto' | 'chat' | 'reason' = 'auto';
  
  private readonly config: ConversationConfig;
  
  constructor(config: Partial<ConversationConfig> = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
  }
  
  addMessage(msg: Message, lm?: LMClient): void {
    this.messages.push(msg);
    
    // Auto-summarize if threshold exceeded
    if (lm && this.messages.length >= this.config.summaryThreshold) {
      this.maybeSummarize(lm);
    }
  }
  
  getHistory(limit?: number): Message[] {
    const l = limit ?? this.config.maxHistory;
    return this.messages.slice(-l);
  }
  
  async getContextForLM(maxConcepts: number, nar?: any): Promise<string> {
    const parts: string[] = [];
    
    if (this.summary) {
      parts.push(`Conversation summary: ${this.summary}`);
    }
    
    if (nar) {
      const concepts = nar.attentionReport(maxConcepts);
      if (concepts.length > 0) {
        parts.push('Knowledge context:');
        for (const c of concepts) {
          parts.push(` - ${c.term} (priority: ${c.priority})`);
        }
      }
      
      const recent = this.getRecentArtifacts(5);
      if (recent.length > 0) {
        parts.push('Recent reasoning:');
        for (const a of recent) {
          parts.push(` - ${a.content}`);
        }
      }
    }
    
    if (this.pinnedBeliefs.size > 0) {
      parts.push('Pinned context:');
      for (const b of this.pinnedBeliefs) {
        parts.push(` - ${b}`);
      }
    }
    
    return parts.join('\n');
  }
  
  private async maybeSummarize(lm: LMClient): Promise<void> {
    const toSummarize = this.messages.slice(0, -10);
    const prompt = `Summarize the following conversation in 2-3 sentences:\n\n${
      toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')
    }`;
    
    this.summary = await lm.generate([{role: 'user', content: prompt}]);
    this.messages = this.messages.slice(-10);
  }
  
  addArtifact(artifact: ReasoningArtifact): void {
    this.reasoningArtifacts.push(artifact);
    const max = this.config.maxArtifacts;
    if (this.reasoningArtifacts.length > max) {
      this.reasoningArtifacts = this.reasoningArtifacts.slice(-Math.floor(max / 2));
    }
  }
  
  getRecentArtifacts(limit = 5): ReasoningArtifact[] {
    return this.reasoningArtifacts.slice(-limit);
  }
  
  pin(belief: string): void {
    this.pinnedBeliefs.add(belief);
  }
  
  unpin(belief: string): void {
    this.pinnedBeliefs.delete(belief);
  }
  
  getPinned(): string[] {
    return [...this.pinnedBeliefs];
  }
  
  set(key: string, value: unknown): void {
    this.workingMemory.set(key, value);
  }
  
  get<T>(key: string): T | undefined {
    return this.workingMemory.get(key) as T;
  }
  
  clear(): void {
    this.messages = [];
    this.reasoningArtifacts = [];
    this.pinnedBeliefs.clear();
    this.workingMemory.clear();
  }
}
```

### 5. Pipeline Integration (Optional)

For maximum flexibility (from BOT4), preserve the ability to insert custom pipeline stages:

**File**: `src/agent/pipeline/PipelineAgent.ts`

```typescript
import type {AIAgent} from '../AIAgent.js';
import type {IOMessage, BotResponse} from './types.js';

export interface PipelineStage {
  name: string;
  enabled: (ctx: PipelineContext) => boolean;
  execute: (ctx: PipelineContext) => Promise<void>;
}

export interface PipelineContext {
  input: IOMessage;
  classification: InputClassification;
  reasoningTriggered: boolean;
  response?: string;
  aiAgent: AIAgent;
  [key: string]: unknown;
}

export class PipelineAgent {
  private readonly stages: PipelineStage[];
  private readonly aiAgent: AIAgent;
  
  constructor(stages: PipelineStage[], aiAgent: AIAgent) {
    this.stages = stages;
    this.aiAgent = aiAgent;
  }
  
  async process(message: IOMessage): Promise<BotResponse> {
    const ctx: PipelineContext = {
      input: message,
      classification: {primary: 'chat', confidence: 0.1, signals: []},
      reasoningTriggered: false,
      aiAgent: this.aiAgent,
    };
    
    for (const stage of this.stages) {
      if (!stage.enabled(ctx)) continue;
      await stage.execute(ctx);
      
      // Early exit if response already set
      if (ctx.response && stage.name === 'CommandProcessor') {
        break;
      }
    }
    
    return {
      text: ctx.response || '',
      reasoning: ctx.reasoningTriggered ? {steps: 1, beliefs: []} : undefined,
      actions: [],
    };
  }
}

// Standard stages
export const standardStages = [
  'InputNormalizer',
  'CommandProcessor',
  'InputClassifier',
  'ReasoningTrigger',
  'AIResponder',
  'ResponseComposer',
  'StatePersistor',
];
```

---

## Configuration System

### Environment Variables

```bash
# Provider Configuration
LM_PROVIDER=anthropic  # anthropic | ollama | transformers
LM_MODEL=claude-sonnet-4-20250514
ANTHROPIC_API_KEY=...
OLLAMA_HOST=localhost:11434

# Agent Configuration
AGENT_NAME=SeNARS
AGENT_INSTRUCTIONS="You are SeNARS, an intelligent reasoning assistant"
AGENT_MODE=auto  # auto | chat | reason

# Memory
EPISODIC_MEMORY_PATH=.cache/episodes
EPISODIC_RETENTION_DAYS=30

# Reasoning
AUTO_TRIGGER_REASONING=true
REASONING_THRESHOLD=0.5
REASONING_COOLDOWN=3
MAX_REASONING_STEPS=5

# Connections
SENARS_IRC_ENABLED=true
SENARS_IRC_SERVER=irc.libera.chat
SENARS_IRC_NICK=senars-bot
SENARS_IRC_CHANNELS=#senars

SENARS_WS_PORT=8080
SENARS_HTTP_PORT=8081
SENARS_MCP_ENABLED=true
```

### Config File (JSONC)

```jsonc
{
  "agent": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250507",
    "instructions": "You are SeNARS, an intelligent reasoning assistant",
    "mode": "auto"
  },
  
  "memory": {
    "episodic": {
      "enabled": true,
      "path": ".cache/episodes",
      "retentionDays": 30
    },
    "conversation": {
      "maxHistory": 20,
      "summaryThreshold": 30,
      "maxArtifacts": 50
    }
  },
  
  "reasoning": {
    "autoTrigger": true,
    "triggerThreshold": 0.5,
    "triggerCooldown": 3,
    "maxStepsPerTrigger": 5,
    "backgroundReasoning": true,
    "backgroundIntervalMs": 60000
  },
  
  "streaming": {
    "enabled": true,
    "showReasoningSteps": true,
    "showToolCalls": true
  },
  
  "tui": {
    "typingIndicator": true,
    "colors": true,
    "compactMode": false,
    "statusBar": true
  },
  
  "connections": {
    "cli": {"enabled": true},
    "irc": {
      "enabled": true,
      "server": "irc.libera.chat",
      "nick": "senars-bot",
      "channels": ["#senars"]
    },
    "websocket": {"enabled": true, "port": 8080},
    "http": {"enabled": false, "port": 8081},
    "mcp": {"enabled": true, "transport": "stdio"}
  }
}
```

---

## Entry Point

**File**: `src/bin/bot.ts`

```typescript
#!/usr/bin/env tsx
import {AIAgent} from '../agent/AIAgent.js';
import {ConversationState} from '../agent/ConversationState.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {createLogger} from '../nar/logger/index.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {detectCapabilities} from '../agent/BotContext.js';
import {createConnectionAdapters} from './connections.js';
import {loadConfig} from '../config/loader.js';

const logger = createLogger({scope: 'bot'});

async function main() {
  // 1. Load configuration
  const config = await loadConfig();
  
  // 2. Create NARS (if enabled)
  let nar;
  if (config.capabilities.senars.enabled) {
    const registry = createSeNARSRegistry();
    nar = SeNARSFactory.createDefault({
      providerRegistry: registry,
      ...config.capabilities.senars,
    });
  }
  
  // 3. Create episodic memory (if enabled)
  let episodicMemory;
  if (config.memory.episodic.enabled) {
    episodicMemory = new EpisodicMemory({
      basePath: config.memory.episodic.path,
      retentionDays: config.memory.episodic.retentionDays,
    });
  }
  
  // 4. Detect capabilities
  const capabilities = detectCapabilities(
    config.agent.provider !== 'none' ? {} : undefined,
    nar
  );
  
  // 5. Create AI Agent
  const agent = new AIAgent({
    nar,
    episodicMemory,
    provider: config.agent.provider as any,
    model: config.agent.model,
    instructions: config.agent.instructions,
    config: {
      conversation: config.memory.conversation,
      reasoning: config.reasoning,
      streaming: config.streaming,
    },
    capabilities,
  });
  
  // 6. Create connection adapters
  const adapters = createConnectionAdapters(agent, config.connections);
  
  // 7. Start connections
  for (const adapter of adapters) {
    await adapter.connect();
    logger.info(`Connected ${adapter.type}: ${adapter.id}`);
  }
  
  // 8. Graceful shutdown
  setupGracefulShutdown(async () => {
    for (const adapter of adapters) {
      await adapter.disconnect();
    }
    logger.info('Bot stopped');
  });
  
  logger.info(`Bot ready: ${config.agent.name} (${capabilities.mode})`);
}

main().catch(console.error);
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/agent/ai-agent.test.ts
import {AIAgent} from '../../src/agent/AIAgent.js';
import {SeNARSFactory} from '../../src/nar/index.js';
import {ConversationState} from '../../src/agent/ConversationState.js';

describe('AIAgent', () => {
  it('should call nar_believe tool', async () => {
    const nar = SeNARSFactory.createDefault();
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
      model: 'Qwen/Qwen2.5-1.5B-Instruct',
    });
    
    const context = {
      sender: 'test',
      connectionType: 'cli' as const,
      conversation: new ConversationState(),
    };
    
    const result = await agent.chat('Remember that cats are animals', context);
    
    expect(result).toBeDefined();
    expect(nar.getBeliefs().length).toBeGreaterThan(0);
  });
  
  it('should use NARS for reasoning questions', async () => {
    const nar = SeNARSFactory.createDefault();
    await nar.input('(cat --> animal).');
    await nar.input('(animal --> living).');
    
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
    });
    
    const context = {
      sender: 'test',
      connectionType: 'cli' as const,
      conversation: new ConversationState(),
    };
    
    const result = await agent.chat('Is a cat living?', context);
    
    expect(result).toBeDefined();
    // Should contain reasoning result
  });
  
  it('should degrade gracefully without LM', async () => {
    const nar = SeNARSFactory.createDefault();
    
    const agent = new AIAgent({
      nar,
      provider: 'transformers',
    });
    
    expect(agent).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// tests/agent/ai-agent-integration.test.ts
describe('AIAgent Integration', () => {
  it('should handle IRC messages', async () => {
    const {agent, irc} = await setupAgentWithConnections();
    
    irc.send('!test user', 'What is 2+2?');
    
    const response = await irc.waitForResponse();
    expect(response).toMatch(/4/);
  });
  
  it('should trigger reasoning on causal questions', async () => {
    const {agent, ws} = await setupAgentWithConnections();
    
    ws.send('Why do birds migrate?');
    
    const response = await ws.waitForResponse();
    expect(response).toMatch(/migrat|food|temperature|season/i);
  });
});
```

---

## Migration Strategy

### Phase 1: Parallel Implementation (Week 1-2)

1. Create `AIAgent` class alongside existing `Agent`
2. Implement NARS tools
3. Test with CLI connection only
4. Validate NARS reasoning works through tool calls

### Phase 2: Connection Migration (Week 3-4)

1. Migrate IRC connection to new adapter pattern
2. Migrate WebSocket/HTTP connections
3. Migrate MCP server (use AI SDK MCP integration)
4. Test all connections in parallel

### Phase 3: Feature Parity (Week 5-6)

1. Episodic memory integration
2. Self-analysis tools
3. Scenario/experiment runners
4. Benchmark suites
5. Pipeline stages (optional, for advanced users)

### Phase 4: Deprecation (Week 7-8)

1. Remove old `Agent` class
2. Remove pipeline stages (if not using optional pipeline)
3. Remove redundant state management
4. Update documentation

---

## Benefits

### Simplicity
- **Before**: 376 lines Agent + 200 lines AgenticLoop + Pipeline + Stages
- **After**: ~200 lines AIAgent + direct tool calls

### Clarity
- Single source of truth for conversation state
- Tools explicitly defined with Zod schemas
- LLM decides when to use NARS vs respond directly

### Maintainability
- AI SDK handles tool calling, retries, streaming
- No custom pipeline stage management (unless using optional pipeline)
- Standard provider interface (Anthropic, Ollama, Transformers.js)

### Performance
- NARS reasoning on-demand (when LLM calls tools)
- No background loop overhead (unless explicitly configured)
- Episodic memory for context, not entire history

### Flexibility
- Configuration space amenable to optimization
- Optional pipeline for fine-grained control
- Three degradation modes (Full/LM-only/NARS-only)
- Preserves cognitive processing architecture

---

## Success Metrics

1. **Code Reduction**: 50% fewer lines in