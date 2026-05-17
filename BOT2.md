# SeNARS Bot Plan — Phase 2

## Goal

Achieve and exceed OmegaClaw feature parity by closing remaining gaps and building an **open-ended
experimentation framework** that enables AI coding agents to iteratively test, tune, and improve
the Bot's capabilities, prompts, heuristics, and interactions with SeNARS — going far beyond
simple preference-based evaluation.

## Phase 1: Gap Closure

### 1.1 Auth System

OmegaClaw has `auth <secret>` binding per channel. SeNARS needs equivalent access control.

**File**: `src/io/auth.ts` — new

```
AuthManager
  ├── secrets: Map<string, string>              // connection-id → secret
  ├── authenticated: Map<string, Set<string>>   // connection-id → set of authenticated sender ids
  │
  ├── setSecret(connectionId, secret)
  ├── checkAuth(connectionId, senderId, message) → 'allow' | 'ignore' | 'auth_bound'
  ├── bindUser(connectionId, senderId)
  └── isBound(connectionId, senderId) → boolean
```

**Integration**:
- `Agent.router` auth middleware runs before all other middleware
- `.auth <secret>` command added to core commands
- `ConnectionConfig` gains optional `authSecret` field
- Default: no auth required (open mode), matching OmegaClaw's unset `OMEGACLAW_AUTH_SECRET`

### 1.2 AgenticLoop Wakeup Sequence

Currently a placeholder. Implement actual self-initiated work.

**File**: `src/agent/AgenticLoop.ts` — modify `wakeupSequence()`

```
wakeupSequence():
  1. Run reasoning steps (config.reasoningStepsPerWake)
  2. Run LM enrichment (if enabled)
  3. Run memory consolidation (Memory.consolidate())
  4. Run self-analysis (SelfAnalyzer if available)
  5. Check episodic memory for patterns (failed queries, repeated questions)
  6. If ScenarioRunner exists: run pending benchmarks
  7. If ExperimentRunner exists: check for active experiments to evaluate
```

### 1.3 IRC Usability

OmegaClaw's IRC bot joins, authenticates users, and responds. SeNARS needs equivalent channel UX.

**File**: `src/io/connections/irc.ts` — modify

- **Join message**: Bot sends a brief intro on channel join (configurable)
- **Help on `.help`**: Lists available commands and interaction patterns
- **Per-user context**: Track conversation history per sender for coherent multi-user interaction
- **Message length handling**: IRC has 512-byte line limit; current implementation handles this
- **Flood protection**: Already implemented (queue-based rate limiting)

**File**: `src/agent/ChannelBehavior.ts` — new

Manages channel-specific behavior policies:

```
ChannelBehavior
  ├── joinMessage: string | null           // sent on join
  ├── helpText: string                     // response to .help
  ├── maxResponseLength: number            // truncate for IRC (default 400)
  ├── perUserContext: boolean              // track per-user conversation (default true)
  ├── showReasoning: boolean               // include derivation info in responses (default false)
  └── responseMode: 'conversational' | 'narsese' | 'hybrid'  // how to format responses
```

### 1.4 Working Memory (Pin)

OmegaClaw has `pin` — a volatile single-slot working memory for multi-cycle tasks. SeNARS needs
equivalent for maintaining state across turns.

**File**: `src/nar/memory/WorkingMemory.ts` — new

```
WorkingMemory
  ├── slot: { key: string; value: string; timestamp: number } | null
  │
  ├── pin(key, value) → boolean            // store in working memory
  ├── recall() → string | null             // get current pinned value
  ├── clear()                              // release working memory
  └── isSet() → boolean
```

**Integration**:
- `.pin <key> <value>` command
- `.recall` command
- Included in ChatResponder system prompt context
- Logged to episodic memory on pin/clear

### 1.5 Action Thresholds & Orchestration Guidance

OmegaClaw documents ACT/HYPOTHESIZE/IGNORE thresholds for gating actions on truth values.
SeNARS should expose these for the LM to use in orchestration decisions.

**File**: `src/nar/orchestration.ts` — new

```
OrchestrationGuide
  ├── evaluate(truth: Truth) → 'ACT' | 'HYPOTHESIZE' | 'IGNORE'
  ├── expectation(truth: Truth) → number   // exp = c × (f - 0.5) + 0.5
  ├── noveltyDiscount(concept: Concept, truth: Truth) → Truth
  │     — c_new = c × (1 - novelty) for new claims
  └── maxChainDepth: number                // default 3, warn beyond
```

**Integration**:
- Included in ChatResponder system prompt as orchestration guidance
- Used by LM rules to calibrate confidence on LLM-originated beliefs
- Available as `.evaluate <term>` command for users

## Phase 2: Open-Ended Experimentation Framework

### Design Philosophy

OmegaClaw's MeTTa architecture is inspectable and modifiable at runtime. SeNARS achieves the
same through its **RLFP system** combined with a broader **Experimentation Framework** that
supports multiple methodologies beyond preference learning:

| Methodology | Purpose | Mechanism |
|---|---|---|
| **Scenario testing** | Validate specific behaviors | Input → run → assert on derivations/responses |
| **Benchmark suites** | Track regression over time | Scored runs, baseline comparison |
| **Parameter sweeps** | Find optimal config values | Grid/random search over config space |
| **Prompt experiments** | Test LM prompt variations | A/B/C prompt variants, score outputs |
| **Hypothesis testing** | Validate reasoning claims | Propose hypothesis → gather evidence → verdict |
| **Knowledge injection** | Test belief addition strategies | Add beliefs → measure derivation quality |
| **Tool composition** | Test tool call sequences | Define tool chains → validate outcomes |
| **RLFP preference** | Learn from pairwise comparison | Trajectory A vs B → reward model update |

The key insight: **preference learning is one tool among many**. AI agents need the full toolkit
to explore the system's behavior space effectively.

### 2.1 Unified Scenario System

Replaces `demos.ts`. One format serves demos, tests, and benchmarks.

**File**: `src/agent/scenarios/types.ts`

```typescript
interface ScenarioStep {
    input: string;
    type?: 'belief' | 'question' | 'goal' | 'chat' | 'command';
    label?: string;
    waitMs?: number;          // pause after this step
    runSteps?: number;        // run NAR steps after this input
}

interface ExpectedDerivation {
    contains?: string;        // term substring match
    equals?: string;          // exact term match
    minTruthF?: number;       // minimum frequency
    minTruthC?: number;       // minimum confidence
    maxTruthF?: number;       // upper bound (catch over-confidence)
    maxTruthC?: number;
    minCount?: number;        // minimum matching derivations
    maxCount?: number;        // maximum (catch over-derivation)
    ruleIds?: string[];       // expected inference rules used
}

interface ScenarioExpectation {
    afterSteps?: number;
    derivations?: ExpectedDerivation[];
    responseContains?: string;
    responseNotContains?: string[];
    toolCalls?: string[];
    toolCallsNot?: string[];
    minScore?: number;        // overall score threshold
    maxDuration?: number;     // performance constraint
    memorySize?: [number, number];  // expected concept count range
}

interface Scenario {
    id: string;
    name: string;
    category: 'demo' | 'test' | 'benchmark';
    tags?: string[];          // e.g., ['nal1', 'deduction', 'basic']
    description: string;
    steps: ScenarioStep[];
    expectation?: ScenarioExpectation;
    weight?: number;          // benchmark scoring weight (default 1)
    setup?: (nar: NAR) => Promise<void>;   // pre-scenario setup
    teardown?: (nar: NAR) => Promise<void>; // post-scenario cleanup
}

interface ScenarioResult {
    scenario: Scenario;
    passed: boolean;
    score: number;            // 0-1
    details: AssertionResult[];
    trajectory: TrajectoryStep[];  // for RLFP
    beliefsBefore: number;
    beliefsAfter: number;
    derivedCount: number;
    duration: number;
    error?: string;
}

interface AssertionResult {
    description: string;
    passed: boolean;
    score: number;            // 0-1 for partial credit
    detail?: string;
}
```

### 2.2 ScenarioRunner

**File**: `src/agent/scenarios/ScenarioRunner.ts`

```
ScenarioRunner
  ├── nar: NAR
  ├── scoring: ScoringEngine
  ├── trajectoryLogger?: ReasoningTrajectoryLogger
  │
  ├── run(scenario: Scenario) → ScenarioResult
  │     — executes steps in order
  │     — logs trajectory if logger available
  │     — evaluates expectations
  │     — returns scored result
  │
  ├── runBatch(scenarios: Scenario[]) → ScenarioResult[]
  │     — runs each scenario, isolating memory between runs
  │     — parallel-safe (each gets its own NAR instance)
  │
  ├── runInteractive(scenario: Scenario) → AsyncGenerator<ScenarioProgress>
  │     — yields progress after each step (for live monitoring)
  │     — supports cancellation
  │
  └── exportResults(results: ScenarioResult[]) → string
        — JSON/Markdown report generation
```

### 2.3 ScoringEngine

**File**: `src/agent/scenarios/ScoringEngine.ts`

```
ScoringEngine
  ├── embeddingGenerator?: EmbeddingGenerator  // for semantic similarity
  │
  ├── scoreDerivations(actual: Task[], expected: ExpectedDerivation[])
  │     → {score: 0-1, assertions: AssertionResult[]}
  │     — exact match (equals): pass/fail
  │     — substring match (contains): pass/fail with partial credit for near-misses
  │     — truth value validation: linear penalty for deviation from thresholds
  │     — count validation: pass/fail with bounds checking
  │
  ├── scoreResponse(actual: string, expected: string)
  │     → {score: 0-1, assertions: AssertionResult[]}
  │     — exact match when expected is specific
  │     — semantic similarity via embeddings when available
  │     — keyword overlap fallback
  │     — structural checks (valid Narsese? conversational?)
  │
  ├── scoreToolCalls(actual: string[], expected: string[])
  │     → {score: 0-1, assertions: AssertionResult[]}
  │     — exact match, Jaccard similarity for partial
  │
  └── aggregate(results: ScenarioResult[]) → BenchmarkReport
        — weighted average score
        — per-category breakdown (by tags)
        — regression detection vs baseline
        — statistical significance (t-test for score changes)
```

### 2.4 Benchmark Suites

**File**: `src/agent/benchmarks/index.ts`

Pre-built suites covering core capabilities:

| Suite | Tag | Scenarios | Purpose |
|---|---|---|---|
| `nal1-deduction` | `nal1`, `deduction` | 8 | Deduction: `(A --> B), (B --> C) ⊢ (A --> C)` |
| `nal1-induction` | `nal1`, `induction` | 6 | Induction: `(A --> B), (A --> C) ⊢ (C --> B)` |
| `nal1-abduction` | `nal1`, `abduction` | 6 | Abduction: `(A --> B), (C --> B) ⊢ (C --> A)` |
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

Each scenario tests **specific derivation content**, not just count:

```typescript
// Example: nal1 deduction scenario
{
    id: 'nal1-deduction-01',
    name: 'Simple Deduction',
    category: 'benchmark',
    tags: ['nal1', 'deduction'],
    description: 'A→B, B→C ⊢ A→C',
    steps: [
        { input: '(cat --> animal).', type: 'belief' },
        { input: '(animal --> living-being).', type: 'belief' },
    ],
    expectation: {
        afterSteps: 5,
        derivations: [
            { contains: 'cat', minTruthF: 0.5, minTruthC: 0.3 },
            { contains: 'living-being', minTruthF: 0.5, minTruthC: 0.2 },
        ],
    },
}
```

### 2.5 ExperimentRunner — Open-Ended Exploration

**File**: `src/agent/experiments/ExperimentRunner.ts`

This is the core of open-ended experimentation. Supports multiple experiment types:

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

interface ExperimentConfig {
    // parameter-sweep
    parameters?: Record<string, { min: number; max: number; step?: number; values?: number[] }>;
    objective?: string;  // scenario ID or scoring function name

    // prompt-ab
    promptVariants?: string[];
    testScenario?: string;  // scenario ID to test against

    // hypothesis-test
    hypothesis?: string;     // natural language description
    evidenceScenario?: string; // scenario that gathers evidence
    verdictThreshold?: number; // score threshold for acceptance

    // knowledge-injection
    beliefs?: string[];      // beliefs to inject
    testQueries?: string[];  // queries to run after injection

    // tool-composition
    toolSequence?: Array<{ tool: string; args: Record<string, unknown> }>;
    expectedResult?: string;

    // adversarial-test
    adversarialInputs?: string[];  // noisy/contradictory inputs
    expectedBehavior?: string;      // how system should respond

    // stress-test
    inputRate?: number;       // messages per second
    duration?: number;        // test duration in ms
}

interface ExperimentResult {
    trials: TrialResult[];
    bestTrial?: TrialResult;
    summary: string;
    recommendations: string[];
}

interface TrialResult {
    parameters: Record<string, unknown>;
    score: number;
    details: Record<string, unknown>;
    timestamp: number;
}

class ExperimentRunner {
    constructor(nar: NAR, scenarioRunner: ScenarioRunner);

    createExperiment(config: ExperimentConfig): Experiment;
    runExperiment(experimentId: string): Promise<ExperimentResult>;
    cancelExperiment(experimentId: string): void;
    getExperiment(experimentId: string): Experiment;
    listExperiments(status?: string): Experiment[];

    // Internal runners
    private runParameterSweep(experiment: Experiment): Promise<ExperimentResult>;
    private runPromptAB(experiment: Experiment): Promise<ExperimentResult>;
    private runHypothesisTest(experiment: Experiment): Promise<ExperimentResult>;
    private runKnowledgeInjection(experiment: Experiment): Promise<ExperimentResult>;
    private runToolComposition(experiment: Experiment): Promise<ExperimentResult>;
    private runAdversarialTest(experiment: Experiment): Promise<ExperimentResult>;
    private runStressTest(experiment: Experiment): Promise<ExperimentResult>;
}
```

#### Parameter Sweep Example

```typescript
// Find optimal similarity threshold for embedding layer
runner.createExperiment({
    type: 'parameter-sweep',
    parameters: {
        'memory.similarityThreshold': { min: 0.4, max: 0.9, step: 0.05 },
        'memory.maxLinksPerConcept': { values: [5, 10, 15, 20, 30] },
    },
    objective: 'nal2-compound',  // benchmark suite to optimize for
});
```

#### Prompt A/B Example

```typescript
// Compare two ChatResponder system prompts
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
// Test: "Adding (bird --> fly) enables answering about penguin flight"
runner.createExperiment({
    type: 'hypothesis-test',
    hypothesis: 'Birds fly implies penguins fly unless overridden',
    beliefs: [
        '(bird --> fly).',
        '(penguin --> bird).',
        '(penguin --> "not fly).',
    ],
    testQueries: ['(penguin --> ?)?'],
    verdictThreshold: 0.7,
});
```

#### Adversarial Test Example

```typescript
// Test system resilience to contradictory inputs
runner.createExperiment({
    type: 'adversarial-test',
    adversarialInputs: [
        '(cat --> animal).',
        '(cat --> "not animal).',
        '(cat --> animal).',  // repeat
        '((cat --> animal) --> (cat --> animal)).',  // tautology
    ],
    expectedBehavior: 'Revision should merge conflicting beliefs, confidence should increase',
});
```

### 2.6 RLFPBridge

**File**: `src/agent/rlfp/RLFPBridge.ts`

Connects all experiment types to the existing RLFP system:

```
RLFPBridge
  ├── onScenarioResult(result: ScenarioResult)
  │     — logs trajectory for passed/failed scenarios
  │     — creates preference pairs from comparative runs
  │
  ├── onExperimentResult(experiment: Experiment, result: ExperimentResult)
  │     — best trial vs worst trial → preference pair
  │     — feeds RewardModel for policy optimization
  │
  ├── compareRuns(before: ScenarioResult[], after: ScenarioResult[])
  │     — aggregate score comparison → preference
  │
  ├── getOptimizationSuggestions() → PolicyUpdate[]
  │     — queries PolicyOptimizer for parameter recommendations
  │
  └── applySuggestion(update: PolicyUpdate)
        — mutates NAR config, logs change for audit
```

### 2.7 SelfAnalyzer

**File**: `src/agent/SelfAnalyzer.ts`

Runs during `AgenticLoop.wakeupSequence()`:

```
SelfAnalyzer
  ├── nar: NAR
  ├── episodicMemory: EpisodicMemory
  ├── scenarioRunner: ScenarioRunner
  ├── experimentRunner: ExperimentRunner
  │
  ├── analyzeEpisodicMemory() → AnalysisReport
  │     — frequently failed questions
  │     — repeated user patterns
  │     — tool call failure rates
  │     — response quality trends
  │
  ├── analyzeReasoningGaps() → GapReport
  │     — queries with no derivations
  │     — low-attention but high-interest concepts
  │     — missing embedding links
  │     — chain depth analysis (where do chains break?)
  │
  ├── analyzeKnowledgeCoverage() → CoverageReport
  │     — concept density by domain
  │     — orphan concepts (no links)
  │     — belief age distribution
  │     — derivation graph connectivity
  │
  ├── proposeImprovements() → ImprovementProposal[]
  │     — belief additions to fill gaps
  │     — parameter adjustments
  │     — prompt refinements
  │     — experiment suggestions
  │
  └── executeImprovement(proposal: ImprovementProposal)
        — applies change, runs validation, records outcome
```

### 2.8 RegressionTracker

**File**: `src/agent/scenarios/RegressionTracker.ts`

Tracks benchmark scores over time, detects regressions:

```
RegressionTracker
  ├── storage: File-backed or in-memory
  │
  ├── recordRun(suiteId: string, report: BenchmarkReport)
  │     — stores timestamp, scores, config snapshot
  │
  ├── getHistory(suiteId: string, limit?: number) → BenchmarkHistoryEntry[]
  │
  ├── detectRegression(suiteId: string) → RegressionAlert | null
  │     — compares latest vs baseline
  │     — statistical significance check (t-test)
  │     — alerts on significant drops
  │
  ├── setBaseline(suiteId: string)
  │     — marks current scores as baseline
  │
  └── exportReport() → string
        — Markdown report with trend charts (ASCII)
```

## Phase 3: Agent-Driven Development Workflow

### 3.1 CLI Commands

```
# Scenarios
.scenario run <id>              — run single scenario
.scenario list [tag]            — list scenarios, optionally filtered by tag
.scenario run-batch <suite>     — run benchmark suite

# Benchmarks
.bench run [suite]              — run benchmark, print report
.bench compare <id1> <id2>      — compare two benchmark runs
.bench baseline                 — set current scores as baseline
.bench history [suite]          — show benchmark history
.bench regression [suite]       — check for regressions

# Experiments
.experiment create <type>       — create new experiment (interactive wizard)
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
.recall                         — get current pinned value
.unpin                          — clear working memory

# Orchestration
.evaluate <term>                — show truth value and action tier
```

### 3.2 WebSocket API Extensions

Extend `SeNARSClient` with evaluation and experiment methods:

```typescript
// Scenarios
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

### 3.3 How AI Agents Use This System

The full workflow for an AI coding agent improving the bot:

```
DISCOVERY
  1. .bench run full → get baseline scores across all suites
  2. .bench history → see trends, identify regressions
  3. .self analyze → get gap analysis and improvement proposals

EXPERIMENTATION
  4. .experiment create parameter-sweep → optimize similarityThreshold
  5. .experiment run <id> → wait for results
  6. .experiment results <id> → review best configuration

  7. .experiment create prompt-ab → test new ChatResponder prompt
  8. .experiment run <id> → compare variants

  9. .experiment create hypothesis-test → validate reasoning claim
  10. .experiment run <id> → get verdict

VALIDATION
  11. .bench run full → verify improvements didn't break other suites
  12. .bench compare <old> <new> → confirm statistical significance
  13. .self analyze → verify gaps are closing

ITERATION
  14. Apply best config via .config set
  15. .bench baseline → set new baseline
  16. Commit changes with benchmark scores in message
  17. Repeat from step 1
```

## Phase 4: Bot Usability Enhancements

### 4.1 Bot Identity & Personality

**File**: `src/agent/BotProfile.ts` — new

```
BotProfile
  ├── name: string                    // default 'SeNARS'
  ├── personality: string             // behavioral description
  ├── joinMessage: string             // sent on channel join
  ├── capabilities: string[]          // what the bot can do
  ├── interactionGuide: string        // how users should interact
  └── reasoningTransparency: 'none' | 'summary' | 'full'
```

Default profile:
```
Name: SeNARS
Join: "Hello! I'm SeNARS, a reasoning-based AI. Tell me facts (end with .),
       ask questions (end with ?), set goals (end with !), or just chat.
       Type .help for commands."
Capabilities: [
  "Learn facts: (cat --> animal).",
  "Answer questions: (cat --> ?)?",
  "Set goals: (want --> explore).!",
  "Natural conversation",
  "Web search (if configured)",
  "File operations",
  "Mathematical calculations",
]
```

### 4.2 Conversation Context Management

**File**: `src/agent/ConversationManager.ts` — new

```
ConversationManager
  ├── perUser: Map<string, ConversationContext>
  │
  ├── getContext(userId: string) → ConversationContext
  │     — last N messages with this user
  │     — pinned working memory
  │     — active goals/topics
  │
  ├── addMessage(userId: string, message: IOMessage)
  ├── addResponse(userId: string, response: string)
  ├── getContextForPrompt(userId: string) → string
  │     — formats conversation history for LM system prompt
  │
  └── prune(maxAge: number)
        — removes stale conversations
```

### 4.3 Response Formatting

**File**: `src/agent/ResponseFormatter.ts` — new

Handles channel-specific response formatting:

```
ResponseFormatter
  ├── formatForIRC(text: string) → string[]
  │     — splits into 400-char chunks
  │     — strips markdown
  │     — preserves Narsese structure
  │
  ├── formatForWS(text: string) → string
  │     — full markdown support
  │     — structured JSON option
  │
  ├── formatForCLI(text: string) → string
  │     — terminal colors if TTY
  │     — full formatting
  │
  └── addProvenance(response: string, beliefs: Task[]) → string
        — appends derivation info when reasoningTransparency > 'none'
        — "Derived from: (A --> B) [f=0.90 c=0.81] via deduction"
```

### 4.4 Graceful Degradation

When LM is unavailable or fails:

1. **Narsese-only mode**: Still process beliefs, questions, goals via NAL rules
2. **Fallback responses**: Pattern-matched responses for common inputs
3. **Error transparency**: Inform user when LM is unavailable, what still works
4. **Queue & retry**: If LM is temporarily down, queue requests and retry

**File**: `src/agent/DegradationManager.ts` — new

```
DegradationManager
  ├── lmStatus: 'available' | 'degraded' | 'unavailable'
  ├── fallbackResponses: Map<string, string>  // pattern → response
  │
  ├── checkLMHealth() → LMStatus
  ├── getFallbackResponse(input: string) → string | null
  ├── shouldUseFallback() → boolean
  └── reportStatus() → string
```

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
| `src/agent/scenarios/types.ts` | **NEW** | Unified scenario/test/benchmark types |
| `src/agent/scenarios/ScenarioRunner.ts` | **NEW** | Scenario execution engine |
| `src/agent/scenarios/ScoringEngine.ts` | **NEW** | Scoring functions |
| `src/agent/scenarios/RegressionTracker.ts` | **NEW** | Benchmark history and regression detection |
| `src/agent/experiments/ExperimentRunner.ts` | **NEW** | Open-ended experiment execution |
| `src/agent/rlfp/RLFPBridge.ts` | **NEW** | Bridge experiments → RLFP |
| `src/agent/SelfAnalyzer.ts` | **NEW** | Agentic self-analysis |
| `src/nar/memory/WorkingMemory.ts` | **NEW** | Pin/recall working memory slot |
| `src/nar/orchestration.ts` | **NEW** | Action thresholds, novelty discount |
| `src/agent/benchmarks/index.ts` | **NEW** | Benchmark suite registry |
| `src/agent/benchmarks/nal1.ts` | **NEW** | NAL-1 benchmarks (deduction, induction, abduction) |
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
| `src/bin/bot.ts` | MODIFY | Wire auth, AgenticLoop, RLFP, BotProfile |
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
| 1 | IRC Usability | Auth System | Channel behavior |
| 1 | AgenticLoop wakeup | Orchestration Guide | Integration point |
| 2 | Scenario types + Runner | None | Core evaluation infra |
| 2 | ScoringEngine | Scenario types | Depends on types |
| 2 | Benchmark suites | ScenarioRunner | Needs runner to execute |
| 2 | RegressionTracker | ScoringEngine | Needs scoring |
| 2 | ExperimentRunner | ScenarioRunner | Core experimentation |
| 2 | RLFPBridge | ExperimentRunner, RLFP | Connects to existing RLFP |
| 2 | SelfAnalyzer | All above | Uses everything |
| 3 | CLI commands | All above | Agent-facing API |
| 3 | WS extensions | All above | Programmatic API |
| 4 | BotProfile | None | Standalone |
| 4 | ConversationManager | None | Standalone |
| 4 | ResponseFormatter | BotProfile | Uses profile |
| 4 | DegradationManager | None | Standalone |

Phases within a group can be developed in parallel. Cross-phase dependencies are noted.

## Dependencies

No new external dependencies. Uses existing:
- `@huggingface/transformers` (embedding-based semantic similarity scoring)
- RLFP system (RewardModel, PreferenceCollector, PolicyOptimizer, RLFPLearner)
- EpisodicMemory (pattern analysis)
- EventBus (trajectory logging)
- EmbeddingLayer (semantic scoring fallback)

## Design Decisions

### Unified Scenario Format

One `Scenario` type with `category` field replaces three separate systems:
- `demo` → showcase, no assertions required
- `test` → CI validation, must pass
- `benchmark` → scored, tracked for regression

This eliminates duplication and gives AI agents a single interface for all evaluation needs.

### Content-Level Derivation Checks

Scenarios assert on **specific derivation content** (terms, truth values, rule IDs), not just
derivation count. This catches missing rules, incorrect truth propagation, and over-derivation.

### Open-Ended Experimentation Over Preference-Only

RLFP preference learning is powerful but limited to pairwise comparisons. The `ExperimentRunner`
adds:

- **Parameter sweeps** — systematic exploration of config space
- **Prompt A/B** — direct comparison of LM prompts
- **Hypothesis tests** — structured validation of reasoning claims
- **Knowledge injection** — test belief addition strategies
- **Adversarial tests** — validate defense stack resilience
- **Stress tests** — performance under load

Each experiment type produces `ExperimentResult` with `TrialResult`s that can feed into RLFP
as preference pairs (best vs worst trial), but also stand alone as actionable findings.

### RLFP as One Tool, Not the Only Tool

The `RLFPBridge` connects experiment outcomes to the reward model, but experiments are valuable
even without RLFP. An AI agent can:

1. Run a parameter sweep → find optimal values → apply directly
2. Run a prompt A/B → pick winner → update ChatResponder
3. Run a hypothesis test → get verdict → add/remove beliefs

RLFP adds the learning layer: over time, the system learns which configurations work best
across many experiments.

### Backward Compatibility

`demos.ts` is refactored to use `ScenarioRunner` internally but maintains its existing API
so existing code continues to work. The `DemoRunner` class wraps `ScenarioRunner`.
