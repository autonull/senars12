# 🧠 SeNARS12

> **Semantic Non-Axiomatic Reasoning System** — Next-generation cognitive architecture fusing fluid LLM creativity with rigorous symbolic logic 🚀

---

## 🌟 Vision

**SeNARS12** is more than a reasoning engine—it's a **cognitive kernel** for the AI-native future. We're building a system that thinks like humans do: fluidly, adaptively, and resourcefully, while maintaining mathematical rigor.

---

## ✨ What Makes SeNARS12 Special

### 🔮 Parser-less Symbolic Foundation

### 🧩 Core Principles (AIKR)

| Principle | Description |
|-----------|-------------|
| **Anytime** ⏱️ | Interruptible execution at any point — yields partial results on demand |
| **Interruptible** ⏸️ | Cooperative yielding to event loop — never blocks indefinitely |
| **AIKR** 📚 | Assumption of Insufficient Knowledge Resources: Memory/attention/bag capacity, derivation depth enforced by types, CPU throttling, backpressure |

### 🎨 Zero-Cost Abstractions

TypeScript metaprogramming shifts correctness checks from runtime to compile-time:

- **Phantom types** track derivation depth
- **Discriminated unions** ensure exhaustive pattern matching
- **Structural sharing** via memoization factory
- **Canonical normalization** with stable hashes

### 🎯 Design Philosophy

> **TypeScript is not just a safety net—it's a reasoning layer.** 🎓

By encoding NAL semantics at the type level:
- Derivation depth tracked via phantom types
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource bounds baked into types

This eliminates entire classes of bugs, enables IDE-native development with full IntelliSense, and guarantees AIKR compliance **by construction** rather than runtime monitoring.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SeNARS12 COGNITIVE KERNEL                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │  SYSTEM 1       │  │  SYSTEM 2       │  │  EXECUTIVE      │    │
│  │  (Intuitive)    │  │  (Analytical)   │  │  CONTROLLER     │    │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤    │
│  │ • LM Enrichment │  │ • NAL Inference │  │ • Attention     │    │
│  │ • Semantic Sim  │  │ • Rule Engine   │  │ • Drives/Goals  │    │
│  │ • Pattern Match │  │ • Derivation    │  │ • Meta-Reasoning│    │
│  │ • Analogical    │  │ • Truth Algebra │  │ • Self-Analysis │    │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘    │
│           │                    │                    │             │
│           └────────────────────┼────────────────────┘             │
│                                ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    REASONING ENGINES                        │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐  │  │
│  │  │ NAR (Non-Axiomatic  │  │ MeTTa (Meta Type Theory)    │  │  │
│  │  │  Reasoning)         │  │  • E-graph equality sat.    │  │  │
│  │  │ • Narsese grammar   │  │  • Pattern matching/rewrite │  │  │
│  │  │ • Truth algebra     │  │  • Multi-space reasoning    │  │  │
│  │  │ • AIKR-bounded      │  │  • Skill/program execution  │  │  │
│  │  │ • Anytime/Interr.   │  │  • Dependent type theory    │  │  │
│  │  └─────────────────────┘  │  • JIT + parallel execution │  │  │
│  │                           └─────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                ▼                                  │
│              ┌─────────────────────────────────┐                  │
│              │     ADAPTIVE SUBSTRATE          │                  │
│              │  (Memory, Learning, Persistence)│                  │
│              └─────────────────────────────────┘                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (watch)
pnpm run dev

# Run once
pnpm run start

# Test everything
pnpm run test

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

### 🤖 Run the Bot on IRC

The `pnpm bot` command starts a multi-transport agent that drives a single SeNARS agent through IRC, CLI, and WebSocket.

```bash
cp .env.example .env       # fill in your LM provider credentials
pnpm bot                    # IRC + WS by default
```

Default behavior: connects to `irc.libera.chat#senars` as `senars-bot` and starts a WebSocket server on `ws://localhost:8765`. Friends can join the IRC channel and chat, or connect their bots to the WebSocket.

To enable HTTP (REST) too: set `ENABLE_HTTP=true` in `.env`. See `docs/bot-api.md` for the bot-to-bot API and `docs/manual-test-irc.md` for a 9-step manual test protocol.

---

## 📦 Core Capabilities

### 1. Narsese Term Language

Full implementation of the Narsese grammar with type-safe construction:

```typescript
import { TermBuilder, atom, termParser, Truth } from '@senars/nar';

// Atomic terms
const cat = atom('cat');
const animal = atom('animal');

// Compound terms
const inheritance = TermBuilder.inheritance(cat, animal);  // (cat --> animal)
const implication = TermBuilder.implication(cat, animal);  // (cat ==> animal)
const conjunction = TermBuilder.conjunction(cat, animal);  // (cat & animal)

// Parse from string
const parsed = termParser.parse('(cat --> animal)');
```

**Term Types Supported:**
| Kind | Syntax | Description |
|------|--------|-------------|
| Atomic | `cat` | Basic concept |
| Variable | `?x`, `?y` | Unification variables |
| Inheritance | `(A --> B)` | Subclass/superclass |
| Similarity | `(A <-> B)` | Symmetric similarity |
| Implication | `(A ==> B)` | Conditional implication |
| Equivalence | `(A <=> B)` | Bidirectional equivalence |
| Conjunction | `(A & B & C)` | Logical AND |
| Disjunction | `(A \| B \| C)` | Logical OR |
| Negation | `(- A)` | Logical NOT |
| Sequence | `(A * B * C)` | Temporal sequence |
| Parallel | `(A | B | C)` | Parallel execution |

### 2. Truth Value Algebra

Non-Axiomatic Logic truth values with **frequency** (f) and **confidence** (c):

```typescript
import { Truth } from '@senars/nar';

const truth = Truth.create(0.8, 0.9);  // f=0.8, c=0.9
const revised = Truth.revision(truth1, truth2);  // Belief revision
const projected = Truth.deduction(truth1, truth2); // Inference
```

**Operations:** `revision`, `deduction`, `induction`, `abduction`, `comparison`, `negation`, `expectation`

### 3. Inference Rules (NAL + Extended)

**Core NAL Rules (15+):**
| Category | Rules |
|----------|-------|
| Core | `revision`, `choice`, `structural-syllogism` |
| Logic | `deduction`, `induction`, `abduction`, `exemplification` |
| Propositional | `negation-intro`, `negation-elim`, `conjunction-intro`, `disjunction-elim` |
| Higher-Order | `higher-order-deduction`, `analogical` |
| Comparison | `comparison`, `analogy` |

**Extended Rules (30+):**
| Category | Rules |
|----------|-------|
| Classical | `modus-ponens`, `modus-tollens`, `hypothetical-syllogism`, `disjunctive-syllogism` |
| Structural | `composition`, `decomposition`, `conversion` |
| Temporal | `temporal-deduction`, `temporal-induction`, `sequence-to-implication` |
| Procedural | `operation-execution`, `goal-achievement`, `procedure-composition` |
| Meta-Cognitive | `error-pattern-detection`, `metacognitive-revision`, `resource-allocation`, `strategy-effectiveness`, `self-model-consistency`, `utility-estimation`, `goal-execution` |
| Variable | `variable-substitution`, `variable-unification` |

**LLM-Enhanced Rules (Dynamic):**
- Semantic similarity rules using embeddings
- Belief/goal/question generation from LLM
- Meta-reasoning about reasoning quality

### 4. Memory Architecture

**Multi-Layer Memory System:**

```typescript
import { Memory, WorkingMemory, EpisodicMemory, Concept } from '@senars/nar';

// Long-term concept memory with priority bags
const memory = new Memory(config);
const concept = memory.getConcept(term);

// Working memory for active reasoning
const wm = new WorkingMemory();
wm.addFocus(term, priority);

// Episodic memory for experience
const episodic = new EpisodicMemory(config);
await episodic.record({ type: 'interaction', content: '...', context: {...} });
const episodes = await episodic.getEpisodes({ limit: 10, query: 'cat' });
```

**Memory Features:**
- **Bounded priority bags** with LRU eviction (AIKR-compliant)
- **Revision history** tracking truth value evolution
- **Embedding-based similarity** for semantic retrieval
- **Temporal embedding memory** for time-aware recall
- **Pressure-driven consolidation** (forgetting + archival)
- **State persistence** (JSON serialization/deserialization)

### 5. Reasoning Engine

```typescript
import { NAR, createNAR } from '@senars/nar';

const nar = createNAR({
  maxConcepts: 10000,
  maxTasksPerConcept: 100,
  enableLMRules: true,
  enableTools: true,
  enableSelf: true,
  enableRLFP: true,
  persistState: true,
  statePath: '.cache/nar-state',
});

await nar.start();

// Input beliefs, goals, questions
await nar.believe('(cat --> animal). %1.0;0.9%');
await nar.goal('(whiskers --> cat)!');
await nar.question('(whiskers --> ?what)?');

// Run inference cycles
const derivations = await nar.run(10);

// Query results
const beliefs = nar.getBeliefs();
const answer = nar.ask('(whiskers --> animal)');
```

**Execution Modes:**
- `run(steps)` — Synchronous batch execution
- `runStream(steps)` — Async generator for incremental results
- Configurable derivation strategies: `BagStrategy`, `ExhaustiveStrategy`, `SampledDerivation`, `FocusedDerivation`, `AnytimeDerivation`

### 6. Cognitive Architecture (System 1/2 + Executive)

**System 1 — Intuitive/Associative (LM-Enhanced):**
```typescript
// LLM-driven memory enrichment
await nar.enrichMemoryWithLM();

// Bidirectional feedback on hypotheses
await nar.processHypothesisWithFeedback(task);

// Proactive knowledge generation
nar.config.enableProactiveEnrichment = true;
```

**System 2 — Analytical (Symbolic):**
```typescript
// Structured derivation with full trace
const trace = nar.traceTerm(term);
const explanation = nar.explain(conclusion);
const derivation = nar.getDerivationHistory(task);
```

**Executive Controller (Metacognition):**
```typescript
import { CognitiveController, CognitiveParameters } from '@senars/nar/cognitive';

const controller = new CognitiveController(registry, memory, processor, metrics, rlfp, params);
controller.adapt();  // Auto-tune strategies based on performance

// Attention models
SimpleAttention | SpreadingActivation | GoalRelevanceAttention | CompositeAttention

// Drives (intrinsic motivation)
CuriosityDrive | CompetenceDrive | EfficiencyDrive
```

### 7. Reinforcement Learning from Reasoning Feedback (RLFP)

```typescript
import { RLFPLearner, PreferenceCollector, RewardModel, PolicyOptimizer } from '@senars/nar/rlfp';

const rlfp = nar.getRLFP();
// Logs reasoning trajectories
// Collects human preferences on derivations
// Trains reward model on preference pairs
// Optimizes policy via RL (PPO/GRPO)
```

### 8. Tools & Function Calling

```typescript
import { ToolManager, discoverTools, ExplainTool, SleepTool, TimerTool } from '@senars/nar/tools';

const tools = nar.tools;
await tools.execute('explain', { term: '(cat --> animal)' });
await tools.execute('sleep', { ms: 1000 });
await tools.execute('timer', { action: 'start', name: 'reasoning' });

// Custom tools via decorator
@Tool({ name: 'my_tool', description: '...', schema: {...} })
async function myTool(args: { input: string }) { ... }
```

### 9. Natural Language Interface

```typescript
import { NLUnderstandingService, NLGenerationService, ContextAssembler } from '@senars/nar/nl';

// Convert natural language to Narsese
const understanding = new NLUnderstandingService(lmService);
const taskBatch = await understanding.understand("Cats are mammals. Whiskers is a cat.");

// Convert Narsese results to natural language
const generation = new NLGenerationService(lmService);
const answer = await generation.generate({
  query: '(whiskers --> ?what)?',
  beliefs: [...],
  trace: [...]
});

// Ask in plain English
const answer = await nar.askNaturalLanguage("What is Whiskers?");
```

### 10. MeTTa — Meta Type Theory Engine

A **second reasoning engine** running alongside NAR, providing equality saturation, pattern matching, and dependent type theory:

```typescript
import { createMeTTa, parseMeTTa, EGraph, MeTTaRuntime } from '@senars/metta';

const runtime = createMeTTa();

// Define rewrite rules
await runtime.evaluate(parseMeTTa(`
  (= (add $x 0) $x)
  (= (add $x (succ $y)) (succ (add $x $y)))
`));

// Query with pattern matching
const result = await runtime.evaluate(parseMeTTa('(add (succ 0) (succ (succ 0)))'));
// → (succ (succ (succ 0)))

// Multi-space reasoning
const space1 = runtime.createSpace();
const space2 = runtime.createSpace();
// Each space has independent facts, can be merged/queried

// E-graph for equality saturation
const egraph = new EGraph();
egraph.addExpr(parseMeTTa('(add a b)'));
egraph.addExpr(parseMeTTa('(add b a)'));
egraph.union(parseMeTTa('a'), parseMeTTa('b'));
// Now (add a b) ≡ (add b a) ≡ (add a a)
```

**MeTTa Capabilities:**

| Feature | Description |
|---------|-------------|
| **E-Graphs** | Equality saturation for algebraic simplification, program optimization |
| **Pattern Matching** | Structural matching with variables, guards, and multi-match |
| **Rewrite Rules** | User-defined ` (= lhs rhs )` rules with conditional guards |
| **Multi-Space** | Independent fact spaces (contexts) with merge/fork/clone |
| **Skill Execution** | MeTTa programs as callable skills from NAR/agent |
| **Dependent Types** | Full type theory with Π/Σ types, type inference, unification |
| **JIT Compiler** | Hot path compilation to native code via Effect JIT |
| **Parallel Execution** | `parallelReduce`, `parallelMap` for batch operations |
| **Persistent Spaces** | Serializable spaces with incremental persistence |
| **IPC/Shared Memory** | Cross-process space sharing via shared memory queues |

**Integration with Agent:**

The agent registers both engines and routes stimuli by prefix:

```typescript
import { createAgent } from '@senars/nar/agent';
import { MettaEngine } from '@senars/metta/agent';

const agent = await createAgent({ /* config */ });
// Both engines auto-registered: 'nar' and 'metta'

// NAR input: (cat --> animal).
// MeTTa input: metta: (= (add $x 0) $x)
```

### 11. Cognitive Parameters & Strategy System

**Tunable Hyperparameters** — All behavior is controlled via `CognitiveParameters` with validated ranges:

```typescript
import { CognitiveParameters, DEFAULT_COGNITIVE_PARAMETERS, FAST_COGNITIVE_CONFIG, LM_HEAVY_CONFIG, RESEARCH_COGNITIVE_CONFIG } from '@senars/nar/config';
```

| Preset | Use Case |
|--------|----------|
| `DEFAULT_COGNITIVE_PARAMETERS` | Balanced general use |
| `FAST_COGNITIVE_CONFIG` | Minimal LM, max speed |
| `LM_HEAVY_CONFIG` | Maximum LM enhancement |
| `RESEARCH_COGNITIVE_CONFIG` | Full tracing, limited derivations |

**Parameter Categories:**
| Category | Controls |
|----------|----------|
| **Priority** | Initial/max priority, mention boosts, decay rate, propagation |
| **LM** | Enabled, rule categories (translation, meta-reasoning, uncertainty, schema induction, ...), timeout, selection strategy |
| **Attention** | Auto-prime, structural/semantic similarity, activation propagation |
| **Inference** | Max derivations/depth, circular detection, trace collection, CPU throttle, sampling limits |

**Pluggable Strategies** (configurable via `strategies` object):

| Strategy Type | Options |
|---------------|---------|
| **Sampling** | `priority`, `top-n`, `novelty`, `goal-biased`, `diverse` |
| **Premise Formation** | `default-formation`, `sample`, `focused` |
| **Derivation** | `default`, `anytime`, `sampled`, `focused`, `exhaustive` |
| **LM Rule Selection** | `all`, `priority`, `rotation`, `diverse` |
| **Attention** | `simple`, `spreading-activation`, `goal-relevance`, `composite` |

**Optimization-Ready** — `PARAMETER_SPACE` defines min/max/default for every tunable, enabling:
- Grid/random search via `CognitiveOptimizer`
- RL-based policy optimization (RLFP)
- Evolutionary parameter tuning

### 12. Lens System — Declarative UI Projections

**Lenses** map cognitive state to visual channels (color, size, opacity, stroke) via a composable AST:

```typescript
import { LensSpec, ModulationSchema, builtinLensSpecs, isBuiltinLens } from '@senars/core';
```

**Built-in Lenses:**
| Lens | Description | Visual Mapping |
|------|-------------|----------------|
| `belief` | What the system knows | Color=truth frequency, Opacity=confidence |
| `goal` | What the system wants | Size=priority, Color=cyan |
| `contradiction` | Where beliefs conflict | Color=orange, Dashed stroke |

**Modulation AST** (composable):
```typescript
{ op: 'union', children: [
  { op: 'channel', channel: 'color', child: { op: 'field', field: 'truth', map: 'truth-to-color' }},
  { op: 'when', predicate: 'isContradiction', child: { op: 'channel', channel: 'color', child: { op: 'const', value: '#ffaa00' }}}
]}
```

Operations: `const`, `field`, `channel`, `when`, `union` — enabling arbitrary visual mappings.

### 13. Protocol — Client/Server Cognitive Sync

Real-time WebSocket protocol for UI synchronization:

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `chat.user` / `chat.agent.complete` | ↔ | Chat streaming |
| `cognitive.delta` | Server→Client | Graph ops (add/update/remove nodes/edges) |
| `config.schema` / `config.set` | ↔ | Live parameter tuning |
| `lens.list` / `lens.define` | ↔ | Lens management |
| `sync.request` / `state.snapshot` | ↔ | Full state sync |
| `viewport.set` / `focus.set` | Client→Server | Camera/selection |
| `history.request` | ↔ | Node derivation history |

**Graph Node Types:**
| Type | Source | Fields |
|------|--------|--------|
| `NarConceptNode` | NAR | term, truth, priority, revision history |
| `MettaAtomNode` | MeTTa | atom, type, space |
| `MettaSkillNode` | MeTTa | skill name, code, I/O schema |

---

## 🔌 Integration Layer

### Core Agent Runtime (`@senars/core`)

The **Agent** class is the central orchestrator — a multi-engine cognitive runtime with a 6-phase reasoning cycle:

```typescript
import { Agent, createAgent, LLMCortex, createCortexFromLM } from '@senars/core';
import { createMeTTa } from '@senars/metta';
import { NAR } from '@senars/nar';

const agent = await createAgent({
  log: new SqliteEventLog({ path: '.cache/agent.db' }),
  cortex: createCortexFromLM(lmService),
  episodicMemory,
  sessionManager: new JsonlSessionManager({ path: '.cache/sessions' }),
  builtinTools: true,
  commandParser: new MettaCommandParser().parse,
});

// Both engines auto-registered
agent.registerEngine('nar', new NAREngine(nar));
agent.registerEngine('metta', new MettaEngine(createMeTTa()));

// Start the agent
await agent.start();

// Chat interface (streams responses)
for await (const event of agent.chat("What is a cat?")) {
  if (event.kind === 'text-delta') console.log(event.text);
}

// Health & capabilities
agent.health();     // { status: 'healthy', cycleCount: 42, ... }
agent.capabilities(); // { engine: 'metta', supports: { chat: true, skills: true, ... } }
```

**6-Phase Reasoning Cycle:**
| Phase | Function |
|-------|----------|
| **Perceive** | Emit `input.user` cognitive event |
| **Recall** | Retrieve working/episodic/semantic memory |
| **Reason** | Query all registered engines (NAR + MeTTa) |
| **Narrate** | Synthesize response via LLMCortex or raw derivations |
| **Consolidate** | Persist to episodic memory |
| **Act** | Parse commands, check policy, execute tools |

**Key Subsystems:**

| Subsystem | Exports | Purpose |
|-----------|---------|---------|
| **Agent** | `Agent`, `createAgent`, `AgentOptions` | Main runtime |
| **Engines** | `BaseEngine`, `NAREngine`, `MettaEngine` | Reasoning backends |
| **Cortex** | `LLMCortex`, `createCortexFromLM` | LLM narrative synthesis |
| **Memory** | `MemoryService`, `InMemorySessionManager`, `JsonlSessionManager` | Working + episodic + sessions |
| **Event Log** | `InMemoryEventLog`, `SqliteEventLog` | Persistent cognitive audit trail |
| **Tools** | `ToolRegistry`, `BUILTIN_TOOLS`, `buildAgentTools` | Function calling + skills |
| **Policy** | `PolicyEngine`, `PolicyRule` | Guardrails / HITL approval |
| **Approval** | `ApprovalService`, `PendingApproval` | Human-in-the-loop |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | LLM orchestration |
| **Knowledge** | `KnowledgeManager` | Structured knowledge CRUD |
| **Stats** | `StatsManager`, `AgentStats` | Telemetry |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp` | UI projection types |
| **Utils** | `makeId`, `generateId`, `clamp`, `sleep`, ... | Shared utilities |

---

### Multi-Transport Agent (The "Bot")

A single SeNARS agent accessible via multiple transports simultaneously:

| Transport | Protocol | Use Case |
|-----------|----------|----------|
| **CLI** | stdin/stdout | Local REPL, scripting |
| **IRC** | IRC | Chat rooms, multi-user |
| **WebSocket** | WS | Real-time web clients |
| **HTTP** | REST | API integration |
| **MCP** | Model Context Protocol | AI assistant integration |

```typescript
import { ConnectionManager, CLIConnection, IRCConnection, WSConnection, HTTPConnection, MCPConnection } from '@senars/io';

const cm = new ConnectionManager();
cm.registerFactory({ type: 'cli', create: ... });
cm.registerFactory({ type: 'irc', create: ... });
cm.registerFactory({ type: 'websocket', create: ... });
cm.registerFactory({ type: 'http', create: ... });
cm.registerFactory({ type: 'mcp', create: ... });

// All connections share ONE agent instance
for (const cfg of configs) {
  const conn = await cm.addConnection(cfg);
  bindAgentToConnection(agent, conn, { auth, commandRegistry, sessionManager });
}
```

### API Layer

**REST API (HTTP Adapter):**
```bash
POST /api/v1/nar/believe     # Input belief
POST /api/v1/nar/goal        # Input goal
POST /api/v1/nar/question    # Input question
POST /api/v1/nar/run         # Run inference steps
GET  /api/v1/nar/beliefs     # Query beliefs
GET  /api/v1/nar/concepts    # List concepts
GET  /api/v1/nar/stats       # Statistics
```

**WebSocket API:**
```json
{ "type": "nar.input", "data": { "input": "(cat --> animal).", "type": "belief" } }
{ "type": "nar.run", "data": { "steps": 5 } }
{ "type": "nar.query", "data": { "term": "(whiskers --> ?what)?" } }
```

**MCP (Model Context Protocol):**
```typescript
import { SeNARSMCPServer } from '@senars/api';

const server = new SeNARSMCPServer(nar);
// Exposes tools: nar_believe, nar_goal, nar_question, nar_run, nar_query, nar_explain
```

---

## 🖥️ Web UI

Real-time cognitive visualization dashboard:

- **Graph Viewport** — 3D force-directed concept graph (via SpaceGraphJS)
- **Chat History** — Conversation with agent
- **Cognitive Metrics** — Attention, derivation rate, memory pressure
- **Config HUD** — Live parameter tuning
- **Timeline Scrubber** — Replay reasoning history
- **Lens Designer** — Custom graph projections
- **Node Detail Drawer** — Inspect concept/task details

```bash
# Start with web UI
ENABLE_WEB_UI=true pnpm bot
# Opens http://localhost:3000
```

---

## ⚙️ Configuration

```typescript
// Full NARConfig interface
interface NARConfig extends CoreConfig {
  // LLM Integration
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
  enableLMRules?: boolean;
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;

  // Optional Subsystems
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: { optimizeInterval?: number };

  // Cognitive Architecture
  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: CognitiveRegistry;
  adaptationInterval?: number;

  // Persistence
  persistState?: boolean;
  statePath?: string;
}
```

**Environment Variables (`.env`):**
```bash
# LM Provider
LM_PROVIDER=openai|anthropic|ollama|local
LM_MODEL=gpt-4o|claude-3|...
LM_API_KEY=...

# Transports
ENABLE_IRC=true
ENABLE_WS=true
ENABLE_HTTP=true
ENABLE_MCP=true
ENABLE_WEB_UI=true

# IRC
IRC_SERVER=irc.libera.chat
IRC_CHANNEL=#senars
IRC_NICK=senars-bot

# Persistence
STATE_PATH=.cache/nar-state
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm run test

# Unit tests only
pnpm run test:unit

# With coverage
pnpm run test --coverage

# End-to-end smoke tests
pnpm exec tsx scripts/execute-turn-smoke.ts      # Real LM agent.executeEpisode
pnpm exec tsx scripts/cli-smoke.ts               # Full cognitive pipeline
```

**Test Structure:**
```
tests/nar/
├── unit/              # 30+ unit test files
├── e2e/               # 6 end-to-end test suites
├── property/          # Property-based testing
├── benchmark.test.ts  # Performance benchmarks
├── rlfp.test.ts       # RLFP integration
├── stream.test.ts     # Streaming execution
```

---

## 📚 Key Documentation

| Document | Description |
|----------|-------------|
| `docs/tech/functionality.md` | Complete cognitive architecture specification |
| `docs/tech/neuro-symbolic.md` | Neuro-symbolic integration deep dive |
| `docs/tech/reasoning.md` | Reasoning engine internals |
| `docs/tech/deep-dive.md` | Implementation details |
| `docs/bot-api.md` | Bot-to-bot API reference |
| `docs/manual-test-irc.md` | 9-step IRC manual test protocol |
| `docs/plan/NEXT.md` | Strategic roadmap |
| `docs/plan/HYBRID_REASONING.md` | Hybrid reasoning architecture |

---

## 🔮 Future Functionality (Roadmap)

### Priority 1: One-Command Demo (Immediate)
```bash
npx senars-demo
# Knowledge Discovery → Consistency → Memory demos in 60 seconds
```

### Priority 2: Embed Pattern (Weeks 2-4)
```javascript
// Dead-simple embedding
import { SeNARS } from 'senars';
const brain = new SeNARS();
brain.learn('(cats --> mammals).');
const answer = await brain.ask('(whiskers --> ?what)?');
// { answer: 'mammals', truth: {f: 0.81, c: 0.73}, proof: [...] }
```
- Framework adapters: Express, React (`useSeNARS`), LangChain, MCP ✓

### Priority 3: Proof Points (Weeks 3-5)
- Consistency benchmark (LLM vs SeNARS)
- Memory persistence benchmark
- Explainability demo (derivation chains)

### Priority 4: Research Tooling (Weeks 4-7)
- Reasoning trace export (JSON-LD, GraphML, Mermaid)
- Strategy A/B testing framework
- RLFP annotation web UI

### Priority 5: Knowledge Portability (Weeks 5-8)
- Knowledge Book format (`.sbook` YAML)
- Import/export: Narsese, RDF/OWL, JSON-LD, Natural Language

### Priority 6: Flagship Demo — "Personal Logic Vault" (Weeks 6-10)
- Local-first personal knowledge base
- Obsidian/Markdown import
- Contradiction detection, gap finding
- Full derivation explanations

---

## 🧭 Positioning in AI Landscape

```
                    High Reasoning Depth
                           │
              SeNARS ──────┼──────── Expert Systems
         (hybrid, adaptive) │        (rigid, complete)
                           │
      Low Adaptability ────┼───────── High Adaptability
                           │
            Rule Engines ──┼────────── LLMs
           (fast, simple)  │         (flexible, shallow)
                           │
                    Low Reasoning Depth
```

**Unique Position:** Practical hybrid that works where both pure LLMs and pure logic systems fail.

---

## 📄 License

MIT License — see `LICENSE` for details.

---

## 🤝 Contributing

See `CONTRIBUTING.md` (to be created) and `AGENTS.md` for code guidelines.

**Code Principles:** Elegant • Consolidated • Consistent • Organized • DRY • Abstract • Modularized • Parameterized

---

## 📊 Quick Reference

| Category | Key Exports | Entry Points |
|----------|-------------|--------------|
| **Core NAR** | `NAR`, `createNAR`, `Reasoner`, `Memory`, `TaskManager` | `@senars/nar` |
| **Terms** | `TermBuilder`, `termParser`, `Truth`, `Stamp` | `@senars/nar/terms` |
| **Rules** | `NALRules`, `NALExtendedRules`, `RuleProcessor` | `@senars/nar/rules` |
| **Agent (NAR)** | `createAgent`, `Agent`, `NAREngine`, `MettaEngine` | `@senars/nar/agent` |
| **Cognitive** | `CognitiveController`, `Observer`, `RLFPLearner` | `@senars/nar/cognitive` |
| **Cognitive Params** | `CognitiveParameters`, `DEFAULT_COGNITIVE_PARAMETERS` | `@senars/nar/config` |
| **Strategies** | `SamplingStrategy`, `DerivationStrategy`, `AttentionModel` | `@senars/nar/strategies` |
| **NL** | `NLUnderstandingService`, `NLGenerationService` | `@senars/nar/nl` |
| **Tools** | `ToolManager`, `discoverTools`, `ExplainTool` | `@senars/nar/tools` |
| **MeTTa** | `createMeTTa`, `parseMeTTa`, `EGraph`, `MeTTaRuntime` | `@senars/metta` |
| **MeTTa Engine** | `MettaEngine`, `MettaCommandParser` | `@senars/metta/agent` |
| **Core Agent** | `Agent`, `createAgent`, `LLMCortex`, `MemoryService` | `@senars/core` |
| **Agent Subsystems** | `ToolRegistry`, `PolicyEngine`, `ApprovalService`, `KnowledgeManager` | `@senars/core` |
| **Event Logs** | `InMemoryEventLog`, `SqliteEventLog` | `@senars/core` |
| **Session Mgmt** | `InMemorySessionManager`, `JsonlSessionManager` | `@senars/core` |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | `@senars/core` |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp`, `CognitiveDelta` | `@senars/core/protocol` |
| **IO** | `ConnectionManager`, `bindAgentToConnection` | `@senars/io` |
| **API** | `HTTPAdapter`, `WebSocketAdapter`, `SeNARSMCPServer` | `@senars/api` |
| **UI** | `startAgentUI`, `UnifiedGraphProjection` | `@senars/ui` |
| **Config** | `loadConfig`, `loadConfigFromEnv` | `@senars/config` |
| **Shared Utils** | `EventBus`, `CommandRegistry`, `generateId`, `clamp`, `sleep` | `@senars/util` |
| **Shared Types** | `CognitiveEvent`, `Connection`, `LMService`, `Episode` | `@senars/util` |
| **Errors** | `SenarsError`, `ConfigError`, `TransportError`, `PolicyViolation` | `@senars/util` |

---

*SeNARS12 — Where symbolic rigor meets neural fluidity.* 🧠✨