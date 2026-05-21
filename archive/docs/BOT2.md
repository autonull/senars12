# SeNARS Bot Plan — Phase 2 (Revised)

## Goal

Achieve and exceed OmegaClaw feature parity by closing remaining gaps and building an **open-ended
experimentation framework** that enables AI coding agents to iteratively test, tune, and improve
the Bot's capabilities, prompts, heuristics, and interactions with SeNARS.

## Gap Analysis

After thorough review of both codebases, the plan below addresses these gaps:

### 1. Skill Catalog (OmegaClaw `getSkills`)

OmegaClaw's `getSkills()` returns a text list of all callable skills injected into every LLM prompt.
SeNARS ChatResponder has no equivalent — the LM doesn't know what tools, commands, or NAL operations
are available. **Fix**: `SkillCatalog` auto-generates from registered tools, commands, and NAL operations.

### 2. Grounded Reasoning

OmegaClaw has documented grounding: fetch facts from verified sources, map source quality to confidence,
store with provenance. SeNARS has HTTP/Search tools but no structured grounding pipeline.
**Fix**: `GroundingPipeline` with source-quality→confidence mapping and provenance tracking.

### 3. Multi-Cycle Reasoning State

OmegaClaw uses `pin` + `&lastresults` + history for state across reasoning cycles. SeNARS ChatResponder
has conversation history but no structured multi-cycle state.
**Fix**: `WorkingMemory` (multi-slot pin/recall) + `lastResults` tracking.

### 4. Error Feedback Loop

OmegaClaw feeds parse/skill errors back into the next prompt for self-correction. SeNARS logs errors
but doesn't feed them into ChatResponder.
**Fix**: Error feedback appended to ChatResponder system prompt.

### 5. Confidence Calibration

OmegaClaw discounts LLM-originated confidence by ~15pp. SeNARS accepts LM output without calibration.
**Fix**: `OrchestrationGuide` with `calibrateLLMConfidence()` and novelty discount.

### 6. Response Interpreter

OmegaClaw's loop parses LLM output as s-expressions (skill calls) and executes them. SeNARS ChatResponder
returns natural language only. The Bot should be able to auto-believe Narsese, execute tool calls,
and ask questions of the reasoning engine from its own responses.
**Fix**: `ResponseInterpreter` that parses ChatResponder output for structured actions.

### 7. Response Repair Unused

`response-repair.ts` exists (repairParentheses, repairResponse, tryRepairAndParse) but is **not imported
anywhere**. OmegaClaw's `balance_parentheses` is called on every LLM response in the loop.
**Fix**: Wire response-repair into LMRule and ChatResponder.

### 8. MCP Design: Bot as MCP Server

`SeNARSMCPServer` exists as a standalone binary (`mcp-server.ts`) with its own disconnected NAR
instance. `registerAgentAPI()` is dead code — never called. This is redundant and broken.

**Correct design**: Wire MCP server into `bot.ts` as a shared component, not a separate process.
External AI agents (Claude Code, Cursor) connect to the **same NAR instance** the Bot uses —
shared memory, shared beliefs, shared reasoning. The standalone `mcp-server.ts` binary is removed.

### 9. SeNARS Tool System

SeNARS has 11 built-in tools (Calculate, Sleep, ReadFile, WriteFile, HTTP, Search, Reason,
Explain, Learn, Timer, Process) plus BraveSearchTool. These work within the NAR engine but:
- Are not exposed to the LM (ChatResponder doesn't know they exist)
- Are not exposed via MCP (no MCP tool registration)
- Cannot be triggered from ChatResponder output (no response interpreter)

**Fix**: `SkillCatalog` exposes tools to LM, MCP server exposes tools externally,
`ResponseInterpreter` triggers tools from Bot's own responses. Tools remain fully functional
in the NAR engine — no changes to tool implementations needed.

### 10. No Benchmark/Experiment System

OmegaClaw has no formal benchmark system (relies on operational experience). SeNARS should have one —
this is a **strength**, not a gap, but needs building.
**Fix**: `ScenarioRunner`, `ExperimentRunner`, `BenchmarkSuite`, `ScoringEngine`, `RLFPBridge`.

## Phase 1: Core Bot Functionality (IRC-Ready)

### 1.1 Auth System

**File**: `src/io/auth.ts` — new

```
AuthManager
  ├── secrets: Map<string, string>              // connection-id → secret
  ├── authenticated: Map<string, Set<string>>   // connection-id → authenticated sender ids
  │
  ├── setSecret(connectionId, secret)
  ├── checkAuth(connectionId, senderId, message) → 'allow' | 'ignore' | 'auth_bound'
  ├── bindUser(connectionId, senderId)
  └── isBound(connectionId, senderId) → boolean
```

Integration: auth middleware in Agent.router (runs first), `.auth <secret>` command,
`ConnectionConfig.authSecret` field. Default: no auth (open mode).

### 1.2 Working Memory (Pin/Recall)

**File**: `src/nar/memory/WorkingMemory.ts` — new

```
WorkingMemory
  ├── slots: Map<string, { value: string; timestamp: number }>
  │
  ├── pin(key, value)
  ├── recall(key?) → string | null
  ├── recallAll() → Map<string, string>
  ├── unpin(key?)
  └── isSet(key) → boolean
```

Multi-slot (more useful than OmegaClaw's single-slot). Commands: `.pin`, `.recall`, `.unpin`.
Included in ChatResponder system prompt context.

### 1.3 Skill Catalog

**File**: `src/agent/SkillCatalog.ts` — new

```
SkillCatalog
  ├── nar: NAR
  │
  ├── getSkillsText() → string
  │     — auto-generates from registered tools, commands, NAL operations
  │     — includes signatures, descriptions, examples
  │     — updated dynamically as components register
  │
  ├── getSkillsForPrompt() → string
  │     — concise version for ChatResponder system prompt
  │
  └── registerCustomSkill(name, description, example)
```

Injected into ChatResponder: `## Available Skills\n${catalog.getSkillsForPrompt()}`

### 1.4 Response Interpreter

**File**: `src/agent/ResponseInterpreter.ts` — new

Parses ChatResponder output for structured actions, then feeds results back into the system:

```
ResponseInterpreter
  ├── nar: NAR
  │
  ├── interpret(response: string) → InterpretationResult
  │     — extracts Narsese statements → auto-believe
  │     — extracts tool calls → execute
  │     — extracts questions → ask reasoning engine
  │     — returns structured actions + cleaned natural language
  │
  ├── executeAndRespond(result: InterpretationResult) → string
  │     — executes extracted actions
  │     — appends action results to response
  │     — e.g., "I've added that cats are animals. (Derived 2 beliefs)"
  │
  └── registerPattern(pattern, handler)
        — custom extraction patterns
```

**Integration**: Called after `ChatResponder.respond()` in the Agent router's final middleware:
```
response = await chatResponder.respond(message.text)
result = await responseInterpreter.interpret(response)
if (result.hasActions) response = await responseInterpreter.executeAndRespond(result)
await context.respond(response)
```

### 1.5 Orchestration Guide

**File**: `src/nar/orchestration.ts` — new

```
OrchestrationGuide
  ├── evaluate(truth: Truth) → 'ACT' | 'HYPOTHESIZE' | 'IGNORE'
  ├── expectation(truth: Truth) → number   // exp = c × (f - 0.5) + 0.5
  ├── calibrateLLMConfidence(truth: Truth) → Truth  // -15pp for LLM-originated
  ├── noveltyDiscount(concept: Concept, truth: Truth) → Truth
  └── maxChainDepth: number                // default 3
```

Included in ChatResponder system prompt. Used by LM rules to calibrate confidence.

### 1.6 Wire Response Repair

**Files**: `src/nar/lm/rules.ts`, `src/agent/ChatResponder.ts` — modify

Import and use `tryRepairAndParse` from `response-repair.ts` in:
- `LMRule.taskFromProcessed()` — repair before parsing LM output
- `ChatResponder.respond()` — repair before returning response

### 1.7 AgenticLoop Wakeup Sequence

**File**: `src/agent/AgenticLoop.ts` — modify

The AgenticLoop bridges event-driven channels (IRC, WS, HTTP) to the Agent's message processing:

```
Connections (IRC, WS, HTTP, MCP)
  └── onMessage(handler) → pushes IOMessage into MessageQueue

AgenticLoop
  ├── queue.drain() → processes each through Agent.router
  └── wakeupSequence() → self-initiated work when idle
```

Current `AgenticLoop` has `setMessageHandler()` but `bot.ts` never wires it to `Agent.router`.
The loop also never starts. Fix:

```
// bot.ts
loop.setMessageHandler(async (msg) => {
    await agent.router.route(msg, {
        connection: msg.source,
        nar: agent.getNAR(),
        respond: (text) => agent.sendTo(msg.source, msg.sender, text)
    });
});
loop.start();
```

Modified `wakeupSequence()`:
```
wakeupSequence():
  1. Run reasoning steps (config.reasoningStepsPerWake)
  2. Run LM enrichment (if enabled)
  3. Run memory consolidation
  4. Run self-analysis (SelfAnalyzer if available)
  5. Check episodic memory for patterns
  6. Run pending benchmarks (ScenarioRunner if available)
  7. Check active experiments (ExperimentRunner if available)
```

### 1.8 Bot Profile & Channel Behavior

**File**: `src/agent/BotProfile.ts` — new

```
BotProfile
  ├── name: string                    // 'SeNARS'
  ├── personality: string
  ├── joinMessage: string             // sent on channel join
  ├── capabilities: string[]
  ├── interactionGuide: string        // how users interact
  └── reasoningTransparency: 'none' | 'summary' | 'full'
```

**File**: `src/agent/ChannelBehavior.ts` — new

```
ChannelBehavior
  ├── maxResponseLength: number       // IRC: 400
  ├── perUserContext: boolean
  ├── showReasoning: boolean
  └── responseMode: 'conversational' | 'narsese' | 'hybrid'
```

### 1.9 Conversation Manager

**File**: `src/agent/ConversationManager.ts` — new

```
ConversationManager
  ├── perUser: Map<string, ConversationContext>
  │
  ├── getContext(userId) → ConversationContext
  ├── addMessage(userId, message)
  ├── addResponse(userId, response)
  ├── getContextForPrompt(userId) → string   // for LM system prompt
  └── prune(maxAge)
```

### 1.10 Response Formatter

**File**: `src/agent/ResponseFormatter.ts` — new

```
ResponseFormatter
  ├── formatForIRC(text) → string[]     // 400-char chunks, strip markdown
  ├── formatForWS(text) → string        // full markdown, JSON option
  ├── formatForCLI(text) → string       // terminal colors
  └── addProvenance(response, beliefs) → string  // derivation info
```

### 1.11 Graceful Degradation

**File**: `src/agent/DegradationManager.ts` — new

```
DegradationManager
  ├── lmStatus: 'available' | 'degraded' | 'unavailable'
  ├── fallbackResponses: Map<string, string>
  │
  ├── checkLMHealth() → LMStatus
  ├── getFallbackResponse(input) → string | null
  ├── shouldUseFallback() → boolean
  └── reportStatus() → string
```

### 1.12 Grounding Pipeline

**File**: `src/nar/grounding.ts` — new

Uses existing HTTP and Search tools to fetch external facts, then maps source quality to confidence:

```
GroundingPipeline
  ├── nar: NAR
  ├── memory: Memory
  ├── tools: ToolManager        // uses HTTP, BraveSearch, Search tools
  │
  ├── groundFact(query: string, source: string, quality: SourceQuality) → Task
  │     — uses Search/HTTP tools to fetch fact
  │     — maps quality to confidence (PRIMARY=0.9, LLM_PRIOR=0.5)
  │     — stores with provenance in memory
  │
  ├── recallGroundedFact(query: string) → Task | null
  │     — checks embedding memory first (existing EmbeddingLayer)
  │
  └── SourceQuality
        PRIMARY = 0.9       // SEC, PubMed, official API
        SECONDARY = 0.7     // Reuters, AP, major news
        GENERAL = 0.55      // Wikipedia, general news
        TERTIARY = 0.4      // Blog, forum
        LLM_PRIOR = 0.5     // LLM alone (assume 15pp overconfident)
```

### 1.13 Last Results Tracking

OmegaClaw feeds the previous turn's skill results into the next prompt (`&lastresults`).
This enables multi-cycle reasoning where the LM sees what happened last turn.

**File**: `src/agent/LastResults.ts` — new

```
LastResults
  ├── history: Array<{ turn: number; input: string; response: string; actions: string[] }>
  │
  ├── record(turn, input, response, actions)
  ├── getRecent(n) → string           // last N turns, formatted for prompt
  └── clear()
```

Injected into ChatResponder system prompt:
```
## Previous Turn Results
${lastResults.getRecent(3)}
```

## Phase 2: Open-Ended Experimentation Framework

### 2.1 Unified Scenario System

**File**: `src/agent/scenarios/types.ts` — new

```typescript
interface ScenarioStep {
    input: string;
    type?: 'belief' | 'question' | 'goal' | 'chat' | 'command';
    label?: string;
    waitMs?: number;
    runSteps?: number;
}

interface ExpectedDerivation {
    contains?: string;        // term substring match
    equals?: string;          // exact term match
    minTruthF?: number;
    minTruthC?: number;
    maxTruthF?: number;
    maxTruthC?: number;
    minCount?: number;
    maxCount?: number;
    ruleIds?: string[];
}

interface ScenarioExpectation {
    afterSteps?: number;
    derivations?: ExpectedDerivation[];
    responseContains?: string;
    responseNotContains?: string[];
    toolCalls?: string[];
    toolCallsNot?: string[];
    minScore?: number;
    maxDuration?: number;
    memorySize?: [number, number];
}

interface Scenario {
    id: string;
    name: string;
    category: 'demo' | 'test' | 'benchmark';
    tags?: string[];
    description: string;
    steps: ScenarioStep[];
    expectation?: ScenarioExpectation;
    weight?: number;
    setup?: (nar: NAR) => Promise<void>;
    teardown?: (nar: NAR) => Promise<void>;
}

interface ScenarioResult {
    scenario: Scenario;
    passed: boolean;
    score: number;
    details: AssertionResult[];
    trajectory: TrajectoryStep[];
    beliefsBefore: number;
    beliefsAfter: number;
    derivedCount: number;
    duration: number;
    error?: string;
}

interface AssertionResult {
    description: string;
    passed: boolean;
    score: number;
    detail?: string;
}
```

### 2.2 ScenarioRunner

**File**: `src/agent/scenarios/ScenarioRunner.ts` — new

```
ScenarioRunner
  ├── nar: NAR
  ├── scoring: ScoringEngine
  ├── trajectoryLogger?: ReasoningTrajectoryLogger
  │
  ├── run(scenario) → ScenarioResult
  ├── runBatch(scenarios) → ScenarioResult[]
  ├── runInteractive(scenario) → AsyncGenerator<ScenarioProgress>
  └── exportResults(results) → string
```

### 2.3 ScoringEngine

**File**: `src/agent/scenarios/ScoringEngine.ts` — new

```
ScoringEngine
  ├── embeddingGenerator?: EmbeddingGenerator
  │
  ├── scoreDerivations(actual, expected) → {score, assertions}
  ├── scoreResponse(actual, expected) → {score, assertions}
  ├── scoreToolCalls(actual, expected) → {score, assertions}
  └── aggregate(results) → BenchmarkReport
```

### 2.4 Benchmark Suites

**File**: `src/agent/benchmarks/index.ts` — new

| Suite | Tag | Scenarios | Purpose |
|---|---|---|---|
| `nal1-deduction` | `nal1`, `deduction` | 8 | `(A --> B), (B --> C) ⊢ (A --> C)` |
| `nal1-induction` | `nal1`, `induction` | 6 | `(A --> B), (A --> C) ⊢ (C --> B)` |
| `nal1-abduction` | `nal1`, `abduction` | 6 | `(A --> B), (C --> B) ⊢ (C --> A)` |
| `nal2-compound` | `nal2`, `compound` | 10 | Intersection, union, product terms |
| `nal3-higher` | `nal3`, `higher-order` | 8 | Implication, equivalence inference |
| `nal4-revision` | `nal4`, `revision` | 6 | Belief revision with conflicting evidence |
| `nal5-negative` | `nal5`, `negation` | 8 | Negative terms, complex structures |
| `nal-temporal` | `nal7`, `temporal` | 6 | Temporal inference rules |
| `nal-procedural` | `nal8`, `procedural` | 6 | Goal decomposition, operation execution |
| `nal-self` | `nal9`, `self` | 4 | Self-referential reasoning |
| `tools-basic` | `tools` | 8 | Calculate, Search, HTTP, file I/O |
| `chat-basic` | `chat` | 10 | ChatResponder response quality |
| `memory-ops` | `memory` | 10 | Add, query, consolidate, forget |
| `lm-rules` | `lm` | 8 | LM rule firing and output quality |
| `full` | — | 104 | All suites combined |

### 2.5 ExperimentRunner

**File**: `src/agent/experiments/ExperimentRunner.ts` — new

```typescript
type ExperimentType =
    | 'parameter-sweep'     // grid/random search over config space
    | 'prompt-ab'           // A/B/C prompt variant comparison
    | 'hypothesis-test'     // propose → gather evidence → verdict
    | 'knowledge-injection' // test belief addition strategies
    | 'tool-composition'    // test tool call sequences
    | 'strategy-comparison' // compare reasoning strategies
    | 'adversarial-test'    // test against noisy/adversarial input
    | 'stress-test';        // performance under load

interface Experiment {
    id: string;
    name: string;
    type: ExperimentType;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    config: ExperimentConfig;
    results?: ExperimentResult;
    createdAt: number;
    completedAt?: number;
}

class ExperimentRunner {
    constructor(nar: NAR, scenarioRunner: ScenarioRunner);

    createExperiment(config: ExperimentConfig): Experiment;
    runExperiment(experimentId: string): Promise<ExperimentResult>;
    cancelExperiment(experimentId: string): void;
    getExperiment(experimentId: string): Experiment;
    listExperiments(status?: string): Experiment[];
}
```

#### Parameter Sweep Example
```typescript
runner.createExperiment({
    type: 'parameter-sweep',
    parameters: {
        'memory.similarityThreshold': { min: 0.4, max: 0.9, step: 0.05 },
        'memory.maxLinksPerConcept': { values: [5, 10, 15, 20, 30] },
    },
    objective: 'nal2-compound',
});
```

#### Prompt A/B Example
```typescript
runner.createExperiment({
    type: 'prompt-ab',
    promptVariants: [
        'You are SeNARS, a reasoning AI...',
        'You are an analytical assistant built on NARS...',
    ],
    testScenario: 'chat-basic',
});
```

#### Hypothesis Test Example
```typescript
runner.createExperiment({
    type: 'hypothesis-test',
    hypothesis: 'Birds fly implies penguins fly unless overridden',
    beliefs: ['(bird --> fly).', '(penguin --> bird).', '(penguin --> "not fly).'],
    testQueries: ['(penguin --> ?)?'],
    verdictThreshold: 0.7,
});
```

#### Adversarial Test Example
```typescript
runner.createExperiment({
    type: 'adversarial-test',
    adversarialInputs: [
        '(cat --> animal).',
        '(cat --> "not animal).',
        '(cat --> animal).',
        '((cat --> animal) --> (cat --> animal)).',
    ],
    expectedBehavior: 'Revision should merge conflicting beliefs, confidence should increase',
});
```

### 2.6 RLFPBridge

**File**: `src/agent/rlfp/RLFPBridge.ts` — new

```
RLFPBridge
  ├── onScenarioResult(result: ScenarioResult)
  ├── onExperimentResult(experiment, result)
  ├── compareRuns(before, after)
  ├── getOptimizationSuggestions() → PolicyUpdate[]
  └── applySuggestion(update)
```

Connects all experiment types to existing RLFP system:
- Passed/failed scenarios → trajectory logging
- Comparative runs → preference pairs
- Best vs worst trial → reward model update

### 2.7 SelfAnalyzer

**File**: `src/agent/SelfAnalyzer.ts` — new

```
SelfAnalyzer
  ├── nar: NAR
  ├── episodicMemory: EpisodicMemory
  ├── scenarioRunner: ScenarioRunner
  ├── experimentRunner: ExperimentRunner
  │
  ├── analyzeEpisodicMemory() → AnalysisReport
  ├── analyzeReasoningGaps() → GapReport
  ├── analyzeKnowledgeCoverage() → CoverageReport
  ├── proposeImprovements() → ImprovementProposal[]
  └── executeImprovement(proposal)
```

Runs during `AgenticLoop.wakeupSequence()`:
- Identifies frequently failed questions
- Detects repeated user patterns
- Finds tool call failure rates
- Measures response quality trends
- Analyzes derivation graph connectivity
- Proposes belief additions, parameter adjustments, prompt refinements

### 2.8 RegressionTracker

**File**: `src/agent/scenarios/RegressionTracker.ts` — new

```
RegressionTracker
  ├── storage: File-backed
  │
  ├── recordRun(suiteId, report)
  ├── getHistory(suiteId, limit?) → BenchmarkHistoryEntry[]
  ├── detectRegression(suiteId) → RegressionAlert | null
  ├── setBaseline(suiteId)
  └── exportReport() → string
```

Tracks benchmark scores over time, detects regressions with t-test for statistical significance.

## Phase 3: Agent-Driven Development Workflow

### 3.1 CLI Commands

```
# Scenarios & Benchmarks
.scenario run <id>              — run single scenario
.scenario list [tag]            — list scenarios filtered by tag
.scenario run-batch <suite>     — run benchmark suite
.bench run [suite]              — run benchmark, print report
.bench compare <id1> <id2>      — compare two benchmark runs
.bench baseline                 — set current scores as baseline
.bench history [suite]          — show benchmark history
.bench regression [suite]       — check for regressions

# Experiments
.experiment create <type>       — create new experiment
.experiment run <id>            — run experiment
.experiment list [status]       — list experiments
.experiment results <id>        — show experiment results
.experiment cancel <id>         — cancel running experiment

# Self-Analysis
.self analyze                   — run self-analysis, print report
.self propose                   — show improvement suggestions
.self apply <id>                — apply suggested improvement
.self status                    — show self-analysis state

# Config
.config get [key]               — show current config
.config set <key> <value>       — change config at runtime
.config reset [key]             — restore default
.config diff                    — show non-default values
.config history                 — recent config changes

# RLFP
.prefer <scenario> <runA> <runB> — record manual preference
.reward                         — show RLFP reward model status
.policy                         — show policy optimizer strategies

# Working Memory
.pin <key> <value>              — store in working memory
.recall [key]                   — get pinned value(s)
.unpin [key]                    — clear working memory

# Orchestration
.evaluate <term>                — show truth value and action tier

# Grounding
.ground <query> <source>        — add externally grounded fact
.grounded [query]               — list grounded facts
```

### 3.2 WebSocket API Extensions

Extend `SeNARSClient` with:

```typescript
// Scenarios & Benchmarks
async runScenario(id: string): Promise<ScenarioResult>
async listScenarios(tag?: string): Promise<Scenario[]>
async runBenchmark(suite: string): Promise<BenchmarkReport>

// Experiments
async createExperiment(config: ExperimentConfig): Promise<string>
async runExperiment(id: string): Promise<ExperimentResult>
async listExperiments(status?: string): Promise<Experiment[]>
async getExperimentResults(id: string): Promise<ExperimentResult>

// Config
async getConfig(key?: string): Promise<Record<string, unknown>>
async setConfig(key: string, value: unknown): Promise<void>

// Self-Analysis
async selfAnalyze(): Promise<AnalysisReport>
async selfPropose(): Promise<ImprovementProposal[]>
async selfApply(proposalId: string): Promise<void>

// Regression
async getBenchmarkHistory(suite: string): Promise<BenchmarkHistoryEntry[]>
async detectRegression(suite: string): Promise<RegressionAlert | null>
```

### 3.3 AI Agent Workflow

```
DISCOVERY
  1. .bench run full → baseline scores
  2. .bench history → trends, regressions
  3. .self analyze → gap analysis

EXPERIMENTATION
  4. .experiment create parameter-sweep → optimize config
  5. .experiment run <id> → results
  6. .experiment create prompt-ab → test prompts
  7. .experiment create hypothesis-test → validate reasoning

VALIDATION
  8. .bench run full → verify no regressions
  9. .bench compare <old> <new> → statistical significance
  10. .self analyze → verify gaps closing

ITERATION
  11. .config set → apply best config
  12. .bench baseline → new baseline
  13. Commit with benchmark scores
  14. Repeat
```

## Phase 4: MCP Server Integration

### Design: Bot as MCP Server (not separate process)

`SeNARSMCPServer` currently runs as a standalone binary with its own disconnected NAR instance.
The correct design integrates it into `bot.ts` so external AI agents connect to the **same NAR
instance** the Bot uses — shared memory, beliefs, and reasoning state.

**Architecture**:
```
bot.ts
└── Agent
     ├── NAR (single shared instance)
     ├── Connections (IRC, WS, HTTP)
     ├── ChatResponder
     ├── ScenarioRunner / ExperimentRunner
     └── MCP Server (stdio or SSE transport)
          ├── registerAgentAPI(agent) → APIRegistry populated
          ├── EnhancedMCPAdapter → exposes real tools
          └── Shares NAR, memory, tools with everything else
```

The standalone `mcp-server.ts` binary is removed.

### 4.1 Wire MCP Server into Bot

**File**: `src/bin/bot.ts` — modify

Create `SeNARSMCPServer` within bot.ts, passing the shared NAR and Agent:

```typescript
const mcpServer = new SeNARSMCPServer({
    name: 'senars-bot',
    version: '1.0.0',
    transport: process.env.SENARS_MCP_TRANSPORT ?? 'stdio',
});

// Register all agent APIs with shared NAR
registerAgentAPI(agent, mcpServer.getAdapter());

// Register SeNARS tools as MCP tools
registerNARToolsAsMCP(nar, mcpServer.getAdapter());

// Register scenario/experiment/self-analysis endpoints
registerEvaluationAPIs(scenarioRunner, experimentRunner, selfAnalyzer, mcpServer.getAdapter());

await mcpServer.start();
```

### 4.2 Register SeNARS Tools as MCP Tools

**File**: `src/api/mcp-tools.ts` — new

Map existing NAR tools to MCP tool definitions:

| NAR Tool | MCP Tool | Description |
|---|---|---|
| Calculate | `calculate` | Evaluate arithmetic/math expressions |
| ReadFile | `read_file` | Read file contents |
| WriteFile | `write_file` | Write content to file |
| HTTP | `http_request` | Make HTTP requests |
| Search | `search_memory` | Search NAR memory for beliefs |
| BraveSearch | `web_search` | Search the web via Brave API |
| Reason | `run_reasoning` | Run NAL inference steps |
| Explain | `explain_belief` | Explain how a belief was derived |
| Learn | `learn_belief` | Add a belief to memory |
| Process | `run_process` | Execute a shell command |
| Timer | `set_timer` | Set a timer/delay |

### 4.3 Register MCP Prompts

**File**: `src/api/mcp-prompts.ts` — new

SeNARS-specific prompt templates for AI agents:

| Prompt | Purpose |
|---|---|
| `reasoning_chain` | Guide for building NAL inference chains |
| `grounded_fact` | Template for adding externally verified facts |
| `multi_cycle_task` | Template for multi-turn reasoning tasks |
| `experiment_design` | Template for designing parameter sweeps |
| `benchmark_analysis` | Template for analyzing benchmark results |

### 4.4 Register MCP Resources

**File**: `src/api/mcp-resources.ts` — new

Expose SeNARS state as MCP resources:

| Resource URI | Content |
|---|---|
| `nar://beliefs` | All stored beliefs with truth values |
| `nar://concepts` | Active concepts with attention priorities |
| `nar://attention` | Current attention snapshot |
| `nar://episodes` | Recent episodic memory entries |
| `nar://benchmarks` | Benchmark history and scores |
| `nar://config` | Current configuration |
| `nar://tools` | Available tools with schemas |

### 4.5 Register API Endpoints

**File**: `src/api/agent-api.ts` — modify

Add endpoints for new subsystems:
- `runScenario`, `listScenarios`, `runBenchmark`
- `createExperiment`, `runExperiment`, `listExperiments`
- `selfAnalyze`, `selfPropose`, `selfApply`
- `getConfig`, `setConfig`, `configHistory`
- `getBenchmarkHistory`, `detectRegression`

## File Change Summary

| File | Action | Description |
|---|---|---|
| `src/io/auth.ts` | **NEW** | AuthManager for channel access control |
| `src/io/commands/auth.ts` | **NEW** | `.auth` command |
| `src/io/commands/config.ts` | **NEW** | Runtime config mutation commands |
| `src/io/types.ts` | MODIFY | Add `authSecret` to `ConnectionConfig` |
| `src/agent/Agent.ts` | MODIFY | Add auth middleware, wire new commands |
| `src/agent/AgenticLoop.ts` | MODIFY | Implement wakeupSequence |
| `src/agent/BotProfile.ts` | **NEW** | Bot identity and personality |
| `src/agent/ChannelBehavior.ts` | **NEW** | Channel-specific behavior policies |
| `src/agent/ConversationManager.ts` | **NEW** | Per-user conversation context |
| `src/agent/ResponseFormatter.ts` | **NEW** | Channel-specific response formatting |
| `src/agent/DegradationManager.ts` | **NEW** | Graceful degradation when LM unavailable |
| `src/agent/SkillCatalog.ts` | **NEW** | Auto-generated skill catalog for LM prompts |
| `src/agent/ResponseInterpreter.ts` | **NEW** | Parse ChatResponder output, execute actions, feed back |
| `src/agent/scenarios/types.ts` | **NEW** | Unified scenario/test/benchmark types |
| `src/agent/scenarios/ScenarioRunner.ts` | **NEW** | Scenario execution engine |
| `src/agent/scenarios/ScoringEngine.ts` | **NEW** | Scoring functions |
| `src/agent/scenarios/RegressionTracker.ts` | **NEW** | Benchmark history and regression detection |
| `src/agent/experiments/ExperimentRunner.ts` | **NEW** | Open-ended experiment execution |
| `src/agent/rlfp/RLFPBridge.ts` | **NEW** | Bridge experiments → RLFP |
| `src/agent/SelfAnalyzer.ts` | **NEW** | Agentic self-analysis |
| `src/nar/memory/WorkingMemory.ts` | **NEW** | Pin/recall working memory |
| `src/nar/orchestration.ts` | **NEW** | Action thresholds, confidence calibration |
| `src/nar/grounding.ts` | **NEW** | Grounded reasoning pipeline |
| `src/agent/LastResults.ts` | **NEW** | Track previous turn results for multi-cycle context |
| `src/nar/lm/rules.ts` | MODIFY | Wire response-repair into LM rules |
| `src/agent/ChatResponder.ts` | MODIFY | Wire response-repair, inject skill catalog, error feedback, last results |
| `src/agent/benchmarks/index.ts` | **NEW** | Benchmark suite registry |
| `src/agent/benchmarks/nal1.ts` | **NEW** | NAL-1 benchmarks |
| `src/agent/benchmarks/nal2.ts` | **NEW** | NAL-2 compound term benchmarks |
| `src/agent/benchmarks/nal3.ts` | **NEW** | NAL-3 higher-order benchmarks |
| `src/agent/benchmarks/nal4.ts` | **NEW** | NAL-4 revision benchmarks |
| `src/agent/benchmarks/nal5.ts` | **NEW** | NAL-5 negation benchmarks |
| `src/agent/benchmarks/nal7.ts` | **NEW** | NAL-7 temporal benchmarks |
| `src/agent/benchmarks/nal8.ts` | **NEW** | NAL-8 procedural benchmarks |
| `src/agent/benchmarks/nal9.ts` | **NEW** | NAL-9 self-reasoning benchmarks |
| `src/agent/benchmarks/tools.ts` | **NEW** | Tool invocation benchmarks |
| `src/agent/benchmarks/chat.ts` | **NEW** | ChatResponder quality benchmarks |
| `src/agent/benchmarks/memory.ts` | **NEW** | Memory operation benchmarks |
| `src/agent/benchmarks/lm.ts` | **NEW** | LM rule benchmarks |
| `src/agent/client/SeNARSClient.ts` | MODIFY | Add experiment/config/self-analysis methods |
| `src/agent/demos.ts` | MODIFY | Refactor to use ScenarioRunner, backward compat |
| `src/agent/index.ts` | MODIFY | Export new modules |
| `src/api/mcp-tools.ts` | **NEW** | Register NAR tools as MCP tools |
| `src/api/mcp-prompts.ts` | **NEW** | Register SeNARS prompt templates |
| `src/api/mcp-resources.ts` | **NEW** | Register SeNARS state as MCP resources |
| `src/api/agent-api.ts` | MODIFY | Add scenario/experiment/self-analysis endpoints |
| `src/bin/bot.ts` | MODIFY | Wire auth, AgenticLoop, RLFP, BotProfile, MCP server |
| `src/bin/mcp-server.ts` | **REMOVE** | Redundant — MCP integrated into bot.ts |
| `src/config/defaults.ts` | MODIFY | Add all new defaults |
| `tests/agent/scenarios.test.ts` | **NEW** | Unit tests for ScenarioRunner, ScoringEngine |
| `tests/agent/experiments.test.ts` | **NEW** | Tests for ExperimentRunner |
| `tests/agent/benchmarks.test.ts` | **NEW** | Integration tests for benchmark suites |
| `tests/agent/rlfp-bridge.test.ts` | **NEW** | Tests for RLFPBridge |
| `tests/agent/self-analyzer.test.ts` | **NEW** | Tests for SelfAnalyzer |

## Execution Order

| Phase | Component | Dependencies | Notes |
|---|---|---|---|
| 1 | Auth System | None | Standalone |
| 1 | Working Memory | None | Standalone |
| 1 | Orchestration Guide | None | Standalone |
| 1 | Skill Catalog | None | Depends on existing tool/command registration |
| 1 | Response Interpreter | None | Standalone |
| 1 | Response Repair wiring | None | Import existing module |
| 1 | BotProfile | None | Standalone |
| 1 | ChannelBehavior | BotProfile | Uses profile |
| 1 | ConversationManager | None | Standalone |
| 1 | ResponseFormatter | ChannelBehavior | Uses behavior config |
| 1 | DegradationManager | None | Standalone |
| 1 | Grounding Pipeline | Orchestration Guide, NAR tools | Uses confidence calibration, HTTP/Search tools |
| 1 | Last Results Tracking | None | Standalone, feeds into ChatResponder prompt |
| 1 | AgenticLoop wiring | Agent.router | Connect loop to Agent router, start loop |
| 2 | Scenario types + Runner | None | Core evaluation infra |
| 2 | ScoringEngine | Scenario types | Depends on types |
| 2 | Benchmark suites | ScenarioRunner | Needs runner to execute |
| 2 | RegressionTracker | ScoringEngine | Needs scoring |
| 2 | ExperimentRunner | ScenarioRunner | Core experimentation |
| 2 | RLFPBridge | ExperimentRunner, RLFP | Connects to existing RLFP |
| 2 | SelfAnalyzer | All above | Uses everything |
| 3 | CLI commands | All above | Agent-facing API |
| 3 | WS extensions | All above | Programmatic API |
| 4 | MCP Server in bot.ts | All above | Shares NAR instance |
| 4 | MCP Tools | NAR tools, MCP Server | Expose tools via MCP |
| 4 | MCP Prompts | MCP Server | Prompt templates |
| 4 | MCP Resources | MCP Server | State as resources |
| 4 | API Endpoints | All above | Registry endpoints |
| — | `mcp-server.ts` | — | **Remove** — redundant |

Phases within a group can be developed in parallel. Cross-phase dependencies are noted.

## Dependencies

No new external dependencies. Uses existing:
- `@huggingface/transformers` (embedding-based semantic similarity scoring)
- RLFP system (RewardModel, PreferenceCollector, PolicyOptimizer, RLFPLearner)
- EpisodicMemory (pattern analysis)
- EventBus (trajectory logging)
- EmbeddingLayer (semantic scoring fallback)
- `SeNARSMCPServer`, `EnhancedMCPAdapter`, `APIRegistry` (already exist, wired into bot)
- `PromptManager`, `ResourceManager` (already exist, used for MCP prompts/resources)
- response-repair.ts (already exists, just needs wiring)
- NAR tools (11 built-in + BraveSearchTool, exposed via MCP)

## Design Decisions

### Unified Scenario Format

One `Scenario` type with `category` field replaces demos/tests/benchmarks:
- `demo` → showcase, no assertions
- `test` → CI validation, must pass
- `benchmark` → scored, tracked for regression

### Content-Level Derivation Checks

Scenarios assert on **specific derivation content** (terms, truth values, rule IDs), not just count.
Catches missing rules, incorrect truth propagation, and over-derivation.

### Open-Ended Experimentation

RLFP preference learning is one tool among many. `ExperimentRunner` adds:
- Parameter sweeps, prompt A/B, hypothesis tests, knowledge injection, adversarial tests, stress tests

Each produces actionable results independently; RLFP adds the learning layer over time.

### Response Interpreter

The Bot's own LM responses can trigger NAL operations. This bridges the gap between
OmegaClaw's "LLM emits skill calls" model and SeNARS's "LLM produces natural language" model.
The Bot can auto-believe facts it states, execute tools it mentions, and ask questions of itself.

### Skill Catalog

Auto-generated from registered components — no manual maintenance needed. As tools and commands
are registered, the catalog updates. This is more maintainable than OmegaClaw's manual `getSkills`
list in MeTTa.

### Grounded Reasoning

Source quality → confidence mapping prevents LLM overconfidence. Grounded facts persist across
sessions with provenance, creating a reliability flywheel.

### Backward Compatibility

`demos.ts` refactored to use `ScenarioRunner` internally but maintains existing API.
`DemoRunner` wraps `ScenarioRunner`.

### MCP: Integrated, Not Separate

`SeNARSMCPServer` runs inside `bot.ts`, sharing the same NAR instance. External AI agents
(Claude Code, Cursor) connect to the live Bot — same memory, same beliefs, same reasoning state.
The standalone `mcp-server.ts` binary is removed as redundant.

### SeNARS Tools: Three Exposure Paths

The 11 built-in tools + BraveSearchTool are exposed through three channels:
1. **NAR engine** — used during reasoning (already works)
2. **SkillCatalog** — listed in ChatResponder system prompt for LM awareness (new)
3. **MCP server** — callable by external AI agents via MCP protocol (new)

Additionally, `ResponseInterpreter` can trigger tools from the Bot's own ChatResponder output,
enabling the Bot to self-initiate tool use during conversation.

### Response Interpreter Feedback Loop

The Bot doesn't just respond — it acts on its own responses. `ResponseInterpreter` parses
ChatResponder output for Narsese statements (auto-believes them), tool calls (executes them),
and questions (asks the reasoning engine). Results are appended to the response and fed into
`LastResults` for the next turn. This creates a closed loop: respond → interpret → act → learn.

### AgenticLoop Wiring

The existing `AgenticLoop` has `setMessageHandler()` but `bot.ts` never calls it or starts the
loop. The fix wires `Agent.router` as the message handler and calls `loop.start()`. This is the
critical integration point that makes the Bot autonomous rather than purely reactive.

### Last Results for Multi-Cycle Reasoning

OmegaClaw's `&lastresults` feeds previous turn's skill results into the next prompt, enabling
the LM to continue multi-step reasoning across turns. `LastResults` provides the same mechanism,
tracking input/response/action triples and injecting the last N turns into ChatResponder's
system prompt.
