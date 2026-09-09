# 🧠 SeNARS12

> **Semantic Non-Axiomatic Reasoning System** — Next-generation cognitive architecture fusing fluid LLM creativity with
> rigorous symbolic logic 🚀

---

## 🌟 Vision

**SeNARS12** is more than a reasoning engine—it's a **cognitive kernel** for the AI-native future. We're building a
system that thinks like humans do: fluidly, adaptively, and resourcefully, while maintaining mathematical rigor.

### 🎯 Why SeNARS12 Exists: Bridging the System 1 / System 2 Gap

We are witnessing the limits of the "Scaling Hypothesis." LLMs achieve miraculous fluency but remain **probabilistic
improvisers, not reasoning engines**—they hallucinate, lose state across long contexts, and cannot mathematically
guarantee a deduction. Classical symbolic AI (GOFAI) is rigorous but brittle when facing real-world noise and ambiguity.

**SeNARS12 fuses fluid LLM creativity (System 1) with rigorous, resource-bounded logic (System 2):**

| Problem             | LLM-Only               | Symbolic-Only      | **SeNARS12**                                 |
|---------------------|------------------------|--------------------|----------------------------------------------|
| **Reasoning Depth** | Shallow, probabilistic | Deep, rigid        | **Deep, adaptive (NAL + MeTTa)**             |
| **Input Modality**  | Natural language       | Formal logic       | **NL → Formal → NL**                         |
| **Memory**          | Vector store (RAG)     | Static KB          | **Dynamic priority concept network**         |
| **Resource Mgmt**   | Infinite (cloud API)   | Fixed              | **AIKR: bounded, anytime, edge-ready**       |
| **Auditability**    | Low (black box)        | High (proof trees) | **High: derivation traces + NL explanation** |

**Wedge Use Cases where pure LLMs fail:**

- **Personal Logic Vault** — Local-first KB that detects contradictions in your thinking and suggests resolutions
- **Autonomous DevOps** — Monitors logs, forms hypotheses via NAL, executes repairs via MeTTa, full audit trail
- **Explainable Compliance** — Ingests regulations, answers with formal logical proofs, not just text retrieval

---

## ✨ What Makes SeNARS12 Special

### 🔮 Parser-less Symbolic Foundation

### 🧩 Core Principles (AIKR)

| Principle           | Description                                                                                                                                     |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| **Anytime** ⏱️       | Interruptible execution at any point — yields partial results on demand                                                                         |
| **Interruptible** ⏸️ | Cooperative yielding to event loop — never blocks indefinitely                                                                                  |
| **AIKR** 📚         | Assumption of Insufficient Knowledge Resources: Memory/attention/bag capacity, derivation-lineage caps, CPU throttling, backpressure |

### 🎨 Zero-Cost Abstractions

TypeScript metaprogramming shifts correctness checks from runtime to compile-time:

- **Branded types** keep timestamps and durations distinct from plain numbers
- **Discriminated unions** ensure exhaustive pattern matching
- **Structural sharing** via memoization factory
- **Canonical normalization** with stable hashes

### 🎯 Design Philosophy

> **TypeScript is not just a safety net—it's a reasoning layer.** 🎓

By encoding NAL semantics at the type level:

- Derivation lineage capped at runtime (ancestor-set bound)
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource limits carried in typed configs

This eliminates entire classes of bugs, enables IDE-native development with full IntelliSense, and guarantees structural
correctness **by construction**, with AIKR resource bounds enforced at runtime.

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

## 🏛️ Architectural Advantages

### 1. The End of "Infinite Context" — AIKR as First Principle

Most AI architectures assume infinite compute/memory (massive context windows, endless RAG). This is biologically
implausible and computationally ruinous for edge deployment.

**SeNARS12 is built on the Assumption of Insufficient Knowledge and Resources (AIKR):**

- **Bounded priority bags** with LRU eviction — graceful degradation under memory pressure
- **Truth-value decay** — concepts lose priority over time unless reinforced
- **Anytime algorithms** — yield partial results when interrupted, resume seamlessly
- **CPU throttling & backpressure** — cooperative yielding to event loop

> In an era where AI moves from cloud to edge (smartphones, IoT, local servers), we need systems that know how to
> *forget*, how to prioritize, and how to yield partial results when interrupted.

### 2. The Trust Gap — Auditable Neuro-Symbolic Handoffs

Enterprises cannot deploy "black box" agents for critical decisions. They require **provenance and proof**.

**SeNARS12 enforces strict division of labor:**

1. **LLM (System 1)** — Translates Natural Language → formal Narsese/MeTTa
2. **Symbolic Engine (System 2)** — Performs rigorous deduction with truth algebra
3. **LLM (System 1)** — Translates results back to Natural Language

**Every logical step recorded as a derivation trace.** If the agent concludes "The server is down," it provides the
exact symbolic syllogism and truth-value calculations — auditability pure LLMs cannot offer.

### 3. TypeScript as a Reasoning Layer — Zero-Cost Abstractions

Most AI frameworks push error detection to runtime. SeNARS12 encodes NAL semantics at **compile-time** via TypeScript's
advanced type system:

| Technique                | Purpose                                          |
|--------------------------|--------------------------------------------------|
| **Branded Types**         | Separate timestamps/units, prevent unit mixups           |
| **Discriminated Unions** | Exhaustive pattern matching on term structures   |
| **Structural Sharing**   | Memoization factory for canonical terms          |
| **Stable Hashes**        | Canonical normalization for deduplication        |

This pushes safety left into compile-time guarantees wherever the type system reaches, with resource bounds enforced
at runtime — robust, IDE-native, mathematically sound.

### 4. Pragmatic Execution — Self-Correcting Agent Loop

Theory is useless without a working loop. SeNARS12 implements a **minimalist, self-correcting execution loop** for
production-ready pragmatism:

- **Continuous reasoning cycle** — Tight, interruptible, anytime loop with cooperative yielding
- **Shared cognitive state** — Working memory slots for prior messages, recent results, active goals
- **Episodic Error Injection** — Tool failures and contradictions fed back into LLM context for self-correction and
  learning

**The Synthesis:** A robust self-healing execution loop + SeNARS12's superior cognitive backend (NAR + MeTTa + RLFP) =
Reliability of minimalist agent + Intelligence of deep cognitive architecture.

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

### 🧪 Run Self-Improvement Demo

```bash
# Autonomous self-improvement loop (10 cycles)
pnpm exec tsx scripts/self-improve-demo.ts

# Cognitive state report
pnpm exec tsx src/bin/self-report.ts

# RL Parity experiments (Focus-Game-Reflex kernel)
pnpm exec tsx scripts/rl-parity.ts --env bandit --mode native --seeds 5
pnpm exec tsx scripts/rl-parity.ts --env gridworld --mode native --seeds 5
pnpm exec tsx scripts/rl-parity.ts --env nonstationary --mode native --seeds 5
```

Default behavior: connects to `irc.libera.chat#senars` as `senars-bot` and starts a WebSocket server on
`ws://localhost:8765`. Friends can join the IRC channel and chat, or connect their bots to the WebSocket.

To enable HTTP (REST) too: set `ENABLE_HTTP=true` in `.env`. See `docs/bot-api.md` for the bot-to-bot API and
`docs/manual-test-irc.md` for a 9-step manual test protocol.

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
| Meta-Cognitive | `error-pattern-detection`, `metacognitive-revision`, `resource-allocation`, `strategy-effectiveness`,
`self-model-consistency`, `utility-estimation`, `goal-execution` |
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
- Configurable derivation strategies: `BagStrategy`, `ExhaustiveStrategy`, `SampledDerivation`, `FocusedDerivation`,
  `AnytimeDerivation`

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
import { CognitiveController } from '@senars/nar/cognitive';
import { CognitiveParameters } from '@senars/nar/config/cognitive-parameters';

const controller = new CognitiveController(registry, memory, processor, metrics, rlfp, params);
controller.adapt();  // Auto-tune strategies based on performance

// Attention models
SimpleAttention | SpreadingActivation | GoalRelevanceAttention | CompositeAttention

// Drives (intrinsic motivation)
CuriosityDrive | CompetenceDrive | CoherenceDrive | SocialDrive
```

**Self-Optimizer — Automated Hyperparameter Tuning:**

```typescript
import { CognitiveOptimizer, GridSampler, RandomSampler } from '@senars/nar/cognitive';

const optimizer = new CognitiveOptimizer(parameterSpace, evaluator);
const result = await optimizer.optimize(new GridSampler(), 100);
// Finds optimal CognitiveParameters via grid/random/Bayesian search
```

**Cognitive Analyzers (8 specialized monitors):**
| Analyzer | Purpose |
|----------|---------|
| `capabilities` | Tracks reasoning capability metrics |
| `corrections` | Detects and logs reasoning errors |
| `performance` | Monitors throughput, latency, resource usage |
| `policy` | Validates actions against guardrails |
| `quality` | Assesses coherence, relevance, completeness |
| `reasoning-patterns` | Identifies recurring derivation structures |
| `resources` | Tracks memory/CPU pressure, bag utilization |
| `term-patterns` | Analyzes term usage and concept relationships |

**Schema Induction — Learning Reusable Patterns:**

```typescript
import { SchemaInductor, createSchemaInductor } from '@senars/nar/learning';

// LM proposes schemas from successful derivation chains
// NARS validates and adopts as higher-order concepts
const inductor = createSchemaInductor(memory, lmService);
const schemas = await inductor.induceFromDerivations(derivations);
// e.g. "(?A --> ?B) & (?B --> ?C) ==> (?A --> ?C)" [transitivity]
```

**Feedback Learning — Continuous Improvement:**

```typescript
import { FeedbackLearner, validateLMOutput } from '@senars/nar/learning';

const learner = new FeedbackLearner();
learner.onCorrection("cats are mammals", "(cat --> animal)", "(cat --> mammal)");
learner.onDerivationOutcome(derivation, 'accepted');  // Tracks rule performance
const adjustedPriority = learner.getAdjustedPriority(ruleId, basePriority);
```

**Reasoning About Reasoning (Metacognitive Self-Analysis):**

```typescript
import { ReasoningAboutReasoning } from '@senars/nar/self';

const self = nar.getSelfAnalyzer();
await self.performMetaCognitiveReasoning();  // Analyzes own reasoning quality
await self.performSelfCorrection();          // Applies optimizations
const gaps = await self.analyzeReasoningGaps();  // Missing rules, low-confidence beliefs
const quality = await self.assessQuality();  // { coherence, relevance, completeness }
const state = self.querySystemState();       // Full system snapshot
```

### 7. Grounding Pipeline — Sensory & Source Integration

The `GroundingPipeline` class and `SourceQuality` enum are available in `@senars/nar/src/grounding.ts` but not yet publicly exported. They provide source quality assessment for beliefs:

| Source Type              | Quality   | Truth Confidence |
|--------------------------|-----------|------------------|
| Official/SEC/PubMed      | PRIMARY   | 0.9              |
| Major news (Reuters, AP) | SECONDARY | 0.7              |
| Wikipedia/News           | GENERAL   | 0.55             |
| Blog/Forum               | TERTIARY  | 0.4              |
| LLM Prior                | LLM_PRIOR | 0.5              |

### 8. Streaming Pipeline — Async Derivation Streams (Internal)

The streaming pipeline (`@senars/nar/src/stream`) is used internally by `NARExecution` but not yet publicly exported. It provides:

- Multiple premise sources: priority-weighted, recency, novelty, fair, focus-based
- Composite sources with configurable weights
- CPU throttling & cooperative yielding
- Backpressure-aware buffering
- Configurable queue limits and derivation caps

### 9. NAR Command System — CLI & Programmatic Control

```typescript
import { narCommands, rlfpCommands, selfCommands, configCommands, memoryCommands } from '@senars/nar/commands';

// Built-in command categories
narCommands      // believe, goal, question, run, stats, export, import
rlfpCommands     // trajectory logging, preference collection, policy optimization
selfCommands     // metacognitive analysis, quality assessment, gap detection
configCommands   // get/set cognitive parameters, strategy switching
memoryCommands   // concept inspection, belief/goal/question queries, attention report
lmCommands       // LM rule management, enrichment triggering
episodesCommands // episodic memory queries
```

### 10. LLM-Enhanced Rules — Dynamic Neuro-Symbolic Fusion

```typescript
import { LMRules, LMRule } from '@senars/nar/lm';
import { createLMService } from '@senars/nar/lm/lm-service';

const lmService = createLMService(config);
const rules = LMRules.createAll(lmService);

// Rule categories (each with specialized prompt templates):
// - Belief Rules: semantic similarity, analogy, concept elaboration
// - Goal Rules: goal decomposition, subgoal generation, planning
// - Question Rules: question refinement, answer synthesis, clarification
// - Meta Rules: error detection, strategy evaluation, resource estimation

// Dynamic rule selection strategies
AllSelector | PrioritySelector | RotationSelector | DiverseSelector
```

**LM Rule Features:**

- Structured output via JSON schemas (function calling)
- Bidirectional feedback: NAR ↔ LM correction loops
- Proactive enrichment: LM generates background knowledge
- Tool dispatching: LM rules can call NAR tools
- Per-rule timeout & circuit breaker

---

### 11. Reinforcement Learning from Reasoning Feedback (RLFP)

```typescript
import { RLFPLearner, PreferenceCollector, RewardModel, PolicyOptimizer } from '@senars/nar/rlfp';

const rlfp = nar.getRLFP();
// Logs reasoning trajectories
// Collects human preferences on derivations
// Trains reward model on preference pairs
// Optimizes policy via RL (PPO/GRPO)
```

### 12. Tools & Function Calling

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

### 13. Natural Language Interface

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

### 14. MeTTa — Meta Type Theory Engine

A **second reasoning engine** running alongside NAR, providing equality saturation, pattern matching, and dependent type
theory:

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

| Feature                | Description                                                            |
|------------------------|------------------------------------------------------------------------|
| **E-Graphs**           | Equality saturation for algebraic simplification, program optimization |
| **Pattern Matching**   | Structural matching with variables, guards, and multi-match            |
| **Rewrite Rules**      | User-defined ` (= lhs rhs )` rules with conditional guards             |
| **Multi-Space**        | Independent fact spaces (contexts) with merge/fork/clone               |
| **Skill Execution**    | MeTTa programs as callable skills from NAR/agent                       |
| **Dependent Types**    | Full type theory with Π/Σ types, type inference, unification           |
| **JIT Compiler**       | Hot path compilation to native code via Effect JIT                     |
| **Parallel Execution** | `parallelReduce`, `parallelMap` for batch operations                   |
| **Persistent Spaces**  | Serializable spaces with incremental persistence                       |
| **IPC/Shared Memory**  | Cross-process space sharing via shared memory queues                   |

**Integration with Agent:**

The agent registers both engines and routes stimuli by prefix:

```typescript
import { createMeTTa, parseMeTTa, EGraph, MeTTaRuntime } from '@senars/metta';
import { createAgent } from '@senars/nar/agent';
import { MettaEngine } from '@senars/metta/agent';

const agent = await createAgent({ /* config */ });
// Both engines auto-registered: 'nar' and 'metta'

// NAR input: (cat --> animal).
// MeTTa input: metta: (= (add $x 0) $x)
```

### 15. Cognitive Parameters & Strategy System

**Tunable Hyperparameters** — All behavior is controlled via `CognitiveParameters` with validated ranges:

```typescript
import { CognitiveParameters, DEFAULT_COGNITIVE_PARAMETERS, FAST_COGNITIVE_CONFIG, LM_HEAVY_CONFIG, RESEARCH_COGNITIVE_CONFIG } from '@senars/nar/config/cognitive-parameters';
```

| Preset                         | Use Case                          |
|--------------------------------|-----------------------------------|
| `DEFAULT_COGNITIVE_PARAMETERS` | Balanced general use              |
| `FAST_COGNITIVE_CONFIG`        | Minimal LM, max speed             |
| `LM_HEAVY_CONFIG`              | Maximum LM enhancement            |
| `RESEARCH_COGNITIVE_CONFIG`    | Full tracing, limited derivations |

| Preset                         | Use Case                          |
|--------------------------------|-----------------------------------|
| `DEFAULT_COGNITIVE_PARAMETERS` | Balanced general use              |
| `FAST_COGNITIVE_CONFIG`        | Minimal LM, max speed             |
| `LM_HEAVY_CONFIG`              | Maximum LM enhancement            |
| `RESEARCH_COGNITIVE_CONFIG`    | Full tracing, limited derivations |

**Parameter Categories:**
| Category | Controls |
|----------|----------|
| **Priority** | Initial/max priority, mention boosts, decay rate, propagation |
| **LM** | Enabled, rule categories (translation, meta-reasoning, uncertainty, schema induction, ...), timeout,
selection strategy |
| **Attention** | Auto-prime, structural/semantic similarity, activation propagation |
| **Inference** | Max derivations/depth, circular detection, trace collection, CPU throttle, sampling limits |

**Pluggable Strategies** (configurable via `strategies` object):

| Strategy Type         | Options                                                         |
|-----------------------|-----------------------------------------------------------------|
| **Sampling**          | `priority`, `top-n`, `novelty`, `goal-biased`, `diverse`        |
| **Premise Formation** | `default-formation`, `sample`, `focused`                        |
| **Derivation**        | `default`, `anytime`, `sampled`, `focused`, `exhaustive`        |
| **LM Rule Selection** | `all`, `priority`, `rotation`, `diverse`                        |
| **Attention**         | `simple`, `spreading-activation`, `goal-relevance`, `composite` |

**Optimization-Ready** — `PARAMETER_SPACE` defines min/max/default for every tunable, enabling:

- Grid/random search via `CognitiveOptimizer`
- RL-based policy optimization (RLFP)
- Evolutionary parameter tuning

### 16. Lens System — Declarative UI Projections

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

### 17. Protocol — Client/Server Cognitive Sync

Real-time WebSocket protocol for UI synchronization:

| Message Type                        | Direction     | Purpose                                   |
|-------------------------------------|---------------|-------------------------------------------|
| `chat.user` / `chat.agent.complete` | ↔             | Chat streaming                            |
| `cognitive.delta`                   | Server→Client | Graph ops (add/update/remove nodes/edges) |
| `config.schema` / `config.set`      | ↔             | Live parameter tuning                     |
| `lens.list` / `lens.define`         | ↔             | Lens management                           |
| `sync.request` / `state.snapshot`   | ↔             | Full state sync                           |
| `viewport.set` / `focus.set`        | Client→Server | Camera/selection                          |
| `history.request`                   | ↔             | Node derivation history                   |

**Graph Node Types:**
| Type | Source | Fields |
|------|--------|--------|
| `NarConceptNode` | NAR | term, truth, priority, revision history |
| `MettaAtomNode` | MeTTa | atom, type, space |
| `MettaSkillNode` | MeTTa | skill name, code, I/O schema |

---

## 🏗️  Reinforcement Learning

Isolated reasoning vessels, explicit environment interfaces, pluggable reflex accelerators, and a system-wide attention economy.

### Core Primitives

| Primitive | Purpose | Key Types |
|-----------|---------|-----------|
| **`Bag<T>`** | Universal AIKR priority queue (capacity-bounded, probabilistic sampling, decay) | `Bag<Item>`, `add()`, `sample()`, `decay()`, `capacity` |
| **`Focus`** | Isolated reasoning vessel with local `Bag<Task>` + `Bag<Concept>` | `step(budget)`, `weight`, bound `Gates`, bound `Games`/`Reflexes` |
| **`FocusBag`** | System-wide attention economy — samples `Focus` by weight | `allocateBudget()`, `rebalanceWeights()`, `sample()` |
| **`Game`** | Environment interface (external or internal) | `observe()`, `step(action)`, `legalActions(state)` |
| **`Reflex`** | Fast System-1 policy/value engine (Q-learning, UCB, heuristics) | `propose(state)`, `learn(event)` |
| **`Negotiator`** | Arbitrates Reflex proposals vs NAL derivations (NAL retains veto) | `resolve(proposals, nalDerivations)`, `createLearningEvent()` |

### Gates (Boundary Contracts)

All Game↔Focus interactions pass through strict gates preventing architectural bypasses:

| Gate | Function | Enforcement |
|------|----------|-------------|
| **`PerceptionGate`** | Observations → Belief tasks (sensor confidence → `truth.c`) | No direct policy mutation |
| **`ActionGate`** | Reflex proposals → Native AST operation goals (`Inheritance(Product, Atom('^op'))`) | No action without goal dispatch |
| **`RewardGate`** | Game outcomes → Value belief revisions / goal satisfaction | No hidden value updates |

### Unified Execution Loop

```typescript
while (running) {
  // 1. ATTENTION: System Bag samples Focus by weight
  const focus = systemFocusBag.sample();
  const budget = allocateBudget(focus);

  // 2. PERCEPTION: Bound Games inject observations
  for (const game of gamesBoundTo(focus)) {
    const perception = game.observe();
    focus.tasks.addAll(perceptionGate.toBeliefs(perception));
  }

  // 3. PROPOSAL: Reflexes inject goals
  for (const reflex of reflexesBoundTo(focus)) {
    const proposals = reflex.propose(game.state(), game.legalActions());
    focus.tasks.addAll(actionGate.toGoals(proposals));
  }

  // 4. REASONING & NEGOTIATION: Process tasks, resolve conflicts
  const decision = negotiator.resolve(focus.tasks, nalDerivations);

  // 5. EXECUTION: Dispatch winning goal
  if (decision.action) {
    const outcome = game.step(decision.action);
    focus.tasks.addAll(rewardGate.toBeliefs(outcome));

    // 6. LEARNING: Reflexes update on actual execution (or veto)
    for (const reflex of reflexesBoundTo(focus)) {
      reflex.learn({ ...outcome, overriddenBy: decision.vetoedBy });
    }
  }

  // 7. AIKR: Decay priorities, enforce capacity
  focus.tasks.decay();
  systemFocusBag.decay();
}
```

### Implemented Components (Slices 1–5 Complete)

| Slice | Components | Tests |
|-------|------------|-------|
| **1** | `Bag<T>`, `Focus`, `FocusBag`, `TabularQReflex`, `Negotiator`, `GridWorldGame`, `GameFocus` | `kernel-slice1.test.ts` (14 tests) |
| **2** | `EpsilonGreedyReflex`, `UCBReflex` (Reflex implementations) | `m35-gridworld-validation.test.ts` |
| **3** | `Negotiator` (NAL veto + `LearningEvent` feedback) | `m35-gridworld-validation.test.ts` |
| **4** | `MetaGame`, `SelfMetaGame`, `MetaFocus` (`^focus_weight`, `^knob_set`) | `meta-game-sandbox.test.ts` (16 tests) |

### M3.5 Validation in New Architecture ✅

| Environment | Level 1 (Adapter) | Level 2 (Native Reflex) | Status |
|-------------|-------------------|-------------------------|--------|
| **Bandit** | ✅ Pass | ✅ Pass (via `EpsilonGreedyReflex`/`UCBReflex`) | ✅ |
| **NonStationary** | ✅ Pass | ✅ Pass (drift detection) | ✅ |
| **GridWorld** | ✅ Pass | ✅ **Pass** (100% success after 200 episodes, `TabularQReflex`) | ✅ |

---

## 🤖 Autonomous Self-Improvement Loop (M3 Complete)

SeNARS12 now runs a **fully autonomous self-improvement loop** where the cognitive architecture reasons about its own codebase using the same NAL machinery it uses for external reasoning.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAR REASONER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  BELIEFS    │  │   GOALS     │  │  QUESTIONS  │              │
│  │  (incl.     │  │  (incl.     │  │  (incl.     │              │
│  │   self-     │  │   self-     │  │   self-     │              │
│  │   beliefs)  │  │   goals)    │  │   questions)│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌─────────────────────┐                            │
│              │   RULE PROCESSOR    │  ← 5 meta-rules + AIKR bounds│
│              │                     │  ← sync rules + LMRules      │
│              └──────────┬──────────┘                            │
│                         │                                        │
│    ┌────────────────────┼────────────────────┐                  │
│    ▼                    ▼                    ▼                  │
│ ┌─────────┐       ┌─────────┐        ┌─────────┐              │
│ │ TOOLS   │       │ MEMORY  │        │ RLFP    │              │
│ │(self-ops)│       │(self-epi)│        │(task rwd)│             │
│ └─────────┘       └─────────┘        └─────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**Single Loop** (runs in `NARExecution.run()`):
```
Perceive → Recall → Reason (meta-rules + drives) → Act (tools) → Validate → Consolidate
```

### Self-Concept Vocabulary

```narsese
<!-- Components -->
(system_component --> knob).
(system_component --> strategy).
(system_component --> tool).
(system_component --> rule).
(system_component --> test).
(system_component --> scenario).
(system_component --> concept).
(system_component --> schema).
(system_component --> capability).

<!-- Causal/functional relations -->
(knob_maxLoops --> affects_modelRunner_maxLoops).
(strategy_focused --> reduces_derivations).
(tool_codemod --> modifies_source_code).
(rule_transitivity --> derives_implication).
(test_fix_test --> requires_codemod).
(scenario_induction --> tests_induction_capability).
(schema --> promotes_to_rule).
(capability --> implemented_by_tool).

<!-- Fix patterns (semantic concepts) -->
(fix_pattern_null_check --> applies_to_null_pointer_error).
(fix_pattern_type_annotation --> applies_to_type_mismatch_error).
(fix_pattern_boundary_check --> applies_to_out_of_bounds_error).
(fix_pattern_assertion --> applies_to_assertion_failure).
(fix_pattern_undefined_check --> applies_to_undefined_variable).
(fix_pattern_empty_check --> applies_to_empty_collection_error).
(fix_pattern_division_by_zero --> applies_to_division_by_zero_error).
(fix_pattern_async_handling --> applies_to_unhandled_promise_rejection).

<!-- Self-model: the system knows it can self-modify -->
(self --> can_modify_own_code).
(self --> can_tune_own_knobs).
(self --> can_add_own_rules).
(self --> can_generate_own_tests).
(self --> can_run_own_scenarios).
```

### Meta-Rules with AIKR Bounds (5 Rules)

| Rule | Trigger | Action | AIKR Bounds |
|------|---------|--------|-------------|
| **Strategy Select** | `drive:competence --> low` | `^switch_strategy($s)!` | depth=2, budget=5/step, priority=0.1, threshold=0.6 |
| **Knob Tune** | `rlfp:reward --> below_threshold` | `^tune_knob($k, $v)!` | depth=2, budget=5/step |
| **Test Repair** | `test_failed & error_pattern & fix_pattern` | `^apply_fix($fix)!` | depth=2, budget=5/step |
| **Schema Promote** | `confidence > 0.9 & frequency > 10` | `^promote_rule($s)!` | depth=2, budget=5/step |
| **Capability Scaffold** | `capability & template` | `^scaffold($tmpl, $c)!` | depth=2, budget=5/step |

### Homeostatic Drives (4 Drives)

| Drive | Goal | Decay | Replenished By |
|-------|------|-------|----------------|
| `curiosity` | `(self --> curious)!` | 0.02/cycle | `generate_scenarios`, `coverage_concepts` on low-coverage |
| `competence` | `(self --> competent)!` | 0.015/cycle | `run_tests` (green), `tune_knob` (reward ↑) |
| `coherence` | `(self --> coherent)!` | 0.01/cycle | `resolve_contradiction`, schema promotion |
| `social` | `(self --> social)!` | 0.05/cycle | Human interaction (CLI/IRC) |

### Self-Tools (8 Tools, Shadow Execution)

| Tool | Self-Operation | Implementation |
|------|----------------|----------------|
| `register_rule` | `(^promote_rule($schema))!` | Add schema to RuleRegistry |
| `register_tool` | `(^add_capability($cap))!` | ToolManager.register() |
| `scaffold_capability` | `(^scaffold($tmpl, $cap))!` | Fill template → `codemod` in shadow worktree |
| `apply_fix` | `(^apply_fix($fix))!` | Lookup fix pattern → `codemod` in shadow worktree |
| `tune_knob` | `(^apply_tuning($knob, $val))!` | RLFPLearner.applyTuningUpdate() |
| `switch_strategy` | `(^select_strategy($strat))!` | CognitiveController / StrategyRegistry |
| `run_tests_shadow` | Validation | Full CI (`pnpm test && pnpm typecheck && pnpm lint`) in shadow |
| `run_scenario_shadow` | Validation | Cognitive scenarios in shadow |

**Shadow Execution Safety:**
1. Create git worktree: `git worktree add .shadow/fix-42`
2. Apply codemod in `.shadow/fix-42`
3. Run **full CI** (test + typecheck + lint) in shadow
4. If green: present diff to ApprovalManager
5. If approved: merge worktree → main
6. Cleanup: `git worktree remove .shadow/fix-42`

### RLFP on Task Outcomes (Unified + Intrinsic Rewards)

```typescript
interface TaskOutcome {
  taskType: 'test' | 'scenario' | 'contradiction' | 'schema' | 'capability' | 'knob_tune' | 'meta_reasoning';
  success: boolean;
  metrics: Record<string, number>;
}

// Extrinsic (existing)
reward_extrinsic = 0.5 * passRate + 0.3 * clamp(baseline/current, 0, 2)/2 + 0.2 * coverageDelta - AIKR penalties;

// Intrinsic (new)
reward_intrinsic = 
  0.4 * derivationDepthReduction +    // schema promotion → fewer steps
  0.3 * selfModelAccuracy +           // predicted vs actual capability
  0.3 * contradictionReduction;       // coherence improvement

reward = clamp(reward_extrinsic + 0.3 * reward_intrinsic, -1, 1);
```

### Goal→Tool Dispatch (Semantic, Native AST)

```typescript
// Narsese operation goal: ^apply_fix(fix_pattern:null_check)
// Parses to: Inheritance(Product(Atom('fix_pattern:null_check')), Atom('^apply_fix'))
async executeToolGoal(goalTerm: Term): Promise<ToolResult> {
  // AST traversal extracts operator from predicate, args from Product subject
  const op = goalTerm.predicate;        // Atom('^apply_fix')
  const args = goalTerm.subject;        // Product([Atom('fix_pattern:null_check')])
  return this.execute(op.symbol.slice(1), resolveSemanticArgs(args));
}
```

### Observability

Structured cognitive state emitted every 10 cycles:

```json
{
  "timestamp": "2026-09-08T...",
  "cycle": 128,
  "active_drives": { "competence": 0.8, "curiosity": 0.2, "coherence": 0.9, "social": 0.1 },
  "active_meta_goals": ["^apply_fix(fix_pattern:null_check)", "^promote_rule(schema_42)"],
  "pending_tool_executions": ["apply_fix (shadow worktree .shadow/fix-42)"],
  "aikr_pressure": "low",
  "rlfp_reward_avg": 0.34,
  "meta_derivation_budget_used": "2/5",
  "self_quality": 0.85
}
```

CLI: `pnpm exec tsx src/bin/self-report.ts`

---

## 🔌 Integration Layer

### Core Agent Runtime (`@senars/core`)

The **Agent** class is the central orchestrator — a multi-engine cognitive runtime with a 6-phase reasoning cycle:

```typescript
import { Agent, LLMCortex, createCortexFromLM, SqliteEventLog, JsonlSessionManager } from '@senars/core';
import { createAgent } from '@senars/nar/agent';
import { NAREngine } from '@senars/nar/engine';
import { createMeTTa, MettaEngine, MettaCommandParser } from '@senars/metta';
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

| Subsystem         | Exports                                                          | Purpose                          |
|-------------------|------------------------------------------------------------------|----------------------------------|
| **Agent**         | `Agent`, `createAgent`, `AgentOptions`                           | Main runtime                     |
| **Engines**       | `BaseEngine`, `NAREngine`, `MettaEngine`                         | Reasoning backends               |
| **Cortex**        | `LLMCortex`, `createCortexFromLM`                                | LLM narrative synthesis          |
| **Memory**        | `MemoryService`, `InMemorySessionManager`, `JsonlSessionManager` | Working + episodic + sessions    |
| **Event Log**     | `InMemoryEventLog`, `SqliteEventLog`                             | Persistent cognitive audit trail |
| **Tools**         | `ToolRegistry`, `BUILTIN_TOOLS`, `buildAgentTools`               | Function calling + skills        |
| **Policy**        | `PolicyEngine`, `PolicyRule`                                     | Guardrails / HITL approval       |
| **Approval**      | `ApprovalService`, `PendingApproval`                             | Human-in-the-loop                |
| **Model Runner**  | `ModelRunner`, `ToolCall`, `ModelEvent`                          | LLM orchestration                |
| **Knowledge**     | `KnowledgeManager`                                               | Structured knowledge CRUD        |
| **Stats**         | `StatsManager`, `AgentStats`                                     | Telemetry                        |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp`                               | UI projection types              |
| **Utils**         | `makeId`, `generateId`, `clamp`, `sleep`, ...                    | Shared utilities                 |

---

### Multi-Transport Agent (The "Bot")

A single SeNARS agent accessible via multiple transports simultaneously:

| Transport     | Protocol               | Use Case                 |
|---------------|------------------------|--------------------------|
| **CLI**       | stdin/stdout           | Local REPL, scripting    |
| **IRC**       | IRC                    | Chat rooms, multi-user   |
| **WebSocket** | WS                     | Real-time web clients    |
| **HTTP**      | REST                   | API integration          |
| **MCP**       | Model Context Protocol | AI assistant integration |

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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNARTools, registerAgentAPI } from 'senars12/api'; // or import from 'senars12'

const server = new McpServer({ name: 'senars', version: '1.0.0' });
registerNARTools(server, nar, agent);
registerAgentAPI(server, agent);
// Exposes tools: calculate, read_file, write_file, search_memory, run_reasoning, 
// learn_belief, explain_belief, agent_chat, agent_believe, agent_recall, 
// agent_know, get_beliefs, get_attention, and more
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

| Document                        | Description                                   |
|---------------------------------|-----------------------------------------------|
| `docs/tech/functionality.md`    | Complete cognitive architecture specification |
| `docs/tech/neuro-symbolic.md`   | Neuro-symbolic integration deep dive          |
| `docs/tech/reasoning.md`        | Reasoning engine internals                    |
| `docs/tech/deep-dive.md`        | Implementation details                        |
| `docs/tech/api-reference.md`    | API reference                                 |
| `docs/intro/getting-started.md` | Getting started guide                         |
| `docs/plan/mcp.md`              | Model Context Protocol integration            |
| `docs/plan/repl.md`             | REPL usage                                    |
| `docs/plan/NEXT.md`             | Strategic roadmap                             |
| `docs/plan/HYBRID_REASONING.md` | Hybrid reasoning architecture                 |

---

## 🔮 Future Functionality (Roadmap)

### ✅ Completed Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| **M0** | Green CI | ✅ |
| **M1** | Self-test loop | ✅ |
| **M1.5** | Cognitive scenarios | ✅ |
| **M2** | Self-tune (knob optimization) | ✅ |
| **M2.5** | Imagination engine (cognitive treadmill) | ✅ |
| **M3** | **Autonomous self-improvement loop** | ✅ **COMPLETE** |
| **M3.5** | **Cognitive grounding & RL parity** (Focus-Game-Reflex kernel) | ✅ **COMPLETE** |

### 🎯 Active: M4 — Production Loop (Next)

```bash
# Target: 1-hour unattended autonomous operation
nar run --auto --duration 3600
```

- Stability hardening for long-running loops
- Workload definition for unattended runs
- Auto-approval mode for ApprovalManager
- Health monitoring + auto-restart
- Persistent state verification across restarts

### 📅 Planned: M5 — Autonomous Self-Modification (Post-M4)

- Shadow worktree codemod execution enabled
- RLFP-driven code modification
- Autonomous schema promotion to production rules
- Full sabotage→auto-fix litmus test

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

### Detailed Ecosystem Comparison

| Feature           | Pure LLM Agents (LangChain, AutoGen) | Pure Symbolic (Prolog, Expert Systems) | **SeNARS12 (Cognitive Kernel)**               |
|-------------------|--------------------------------------|----------------------------------------|-----------------------------------------------|
| **Reasoning**     | Shallow, Probabilistic               | Deep, Rigid                            | **Deep, Adaptive (NAL + MeTTa)**              |
| **Input**         | Natural Language                     | Formal Logic                           | **Natural Language → Formal Logic**           |
| **Memory**        | Vector Store (RAG)                   | Static Database                        | **Dynamic, Priority-Based Concept Network**   |
| **Resource Mgmt** | Infinite (Cloud API)                 | Fixed                                  | **AIKR (Bounded, Anytime, Edge-Ready)**       |
| **Auditability**  | Low (Black Box)                      | High (Proof Trees)                     | **High (Derivation Traces + NL Explanation)** |
| **Learning**      | In-context / Fine-tune               | Manual KB update                       | **RLFP + Schema Induction + Episodic**        |
| **Type Safety**   | Runtime / None                       | Compile-time (limited)                 | **Discriminated Unions + NAL Semantics**          |

---

## 🏁 The Verdict

**SeNARS12 is necessary because the current AI paradigm is incomplete.** We have mastered the "System 1" of AI (fast,
intuitive, linguistic), but we have neglected the "System 2" (slow, logical, deliberative).

By building a system that:

- **Respects the limits of computation** (AIKR)
- **Leverages modern type systems for safety** (TypeScript as reasoning layer)
- **Adopts pragmatic, self-correcting loops** (minimalist agent architecture)

SeNARS12 is not just a research project — it is the blueprint for the next generation of **Sovereign, Auditable, and
Truly Intelligent Agents.**

The code is the foundation. The next step is building the bridge — the tight, robust agent loop — that allows this
cognitive engine to run continuously in the real world.

---

## 📄 License

MIT License — see `LICENSE` for details.

---

## 🤝 Contributing

See `CONTRIBUTING.md` (to be created) and `AGENTS.md` for code guidelines.

**Code Principles:** Elegant • Consolidated • Consistent • Organized • DRY • Abstract • Modularized • Parameterized

---

## 📊 Quick Reference

| Category                      | Key Exports                                                                                                                                  | Entry Points                            |
|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| **Core NAR**                  | `NAR`, `createNAR`, `Reasoner`, `Memory`, `TaskManager`                                                                                      | `@senars/nar`                           |
| **Terms**                     | `TermBuilder`, `termParser`, `Truth`, `Stamp`                                                                                                | `@senars/nar`                           |
| **Rules**                     | `NALRules`, `NALExtendedRules`, `RuleProcessor`, `MetaRules`                                                                                 | `@senars/nar`                           |
| **Agent (NAR)**               | `createAgent`, `Agent`, `NAREngine`, `MettaEngine`                                                                                           | `@senars/nar/agent`                     |
| **Cognitive**                 | `CognitiveController`, `Observer`, `RLFPLearner`                                                                                             | `@senars/nar/cognitive`                 |
| **Cognitive Params**          | `CognitiveParameters`, `DEFAULT_COGNITIVE_PARAMETERS`, `FAST_COGNITIVE_CONFIG`, `LM_HEAVY_CONFIG`                                           | `@senars/nar` (internal, not exported)  |
| **Strategies**                | `SamplingStrategy`, `DerivationStrategy`, `AttentionModel`                                                                                   | `@senars/nar` (internal, not exported)  |
| **NL**                        | `NLUnderstandingService`, `NLGenerationService`                                                                                              | `@senars/nar/nl`                        |
| **Tools**                     | `ToolManager`, `discoverTools`, `ExplainTool`, `SelfTools`                                                                                   | `@senars/nar/tools`                     |
| **Learning**                  | `SchemaInductor`, `FeedbackLearner`, `validateLMOutput`                                                                                      | `@senars/nar/learning`                  |
| **Self-Reasoning**            | `ReasoningAboutReasoning`, `SelfAnalyzer`, `MetacognitiveMonitor`                                                                            | `@senars/nar/self`                      |
| **Cognitive Analyzers**       | `capabilities`, `performance`, `quality`, `reasoning-patterns`, ...                                                                          | `@senars/nar/cognitive/analyzers`       |
| **Grounding**                 | `GroundingPipeline`, `SourceQuality`                                                                                                         | `@senars/nar` (internal, not exported)  |
| **Streaming**                 | `createPipeline`, `MemoryPremiseSource`, `FocusPremiseSource`, `derive`                                                                      | `@senars/nar` (internal, not exported)  |
| **Commands**                  | `narCommands`, `rlfpCommands`, `selfCommands`, `configCommands`, `memoryCommands`, `lmCommands`, `episodesCommands`                          | `@senars/nar/commands`                  |
| **LM Rules**                  | `LMRules`, `LMRule`, `LMRuleFactory`                                                                                                         | `@senars/nar/lm`                        |
| **MeTTa**                     | `createMeTTa`, `parseMeTTa`, `EGraph`, `MeTTaRuntime`                                                                                        | `@senars/metta`                         |
| **MeTTa Engine**              | `MettaEngine`, `MettaCommandParser`                                                                                                          | `@senars/metta/agent`                   |
| **Focus-Game-Reflex Kernel**  | `Bag`, `Focus`, `FocusBag`, `GameFocus`, `MetaFocus`, `PerceptionGate`, `ActionGate`, `RewardGate`, `Reflex`, `TabularQReflex`, `Negotiator`, `Game`, `MetaGame`, `SelfMetaGame` | `@senars/nar` (new architecture)        |
| **Core Agent**                | `Agent`, `createAgent`, `LLMCortex`, `MemoryService`                                                                                         | `@senars/core`                          |
| **Agent Subsystems**          | `ToolRegistry`, `PolicyEngine`, `ApprovalService`, `KnowledgeManager`                                                                        | `@senars/core`                          |
| **Event Logs**                | `InMemoryEventLog`, `SqliteEventLog`                                                                                                         | `@senars/core`                          |
| **Session Mgmt**              | `InMemorySessionManager`, `JsonlSessionManager`                                                                                              | `@senars/core`                          |
| **Model Runner**              | `ModelRunner`, `ToolCall`, `ModelEvent`                                                                                                      | `@senars/core`                          |
| **Lens/Protocol**             | `Lens`, `GraphNodeData`, `GraphOp`, `CognitiveDelta`                                                                                         | `@senars/core/protocol`                 |
| **IO**                        | `ConnectionManager`, `bindAgentToConnection`                                                                                                 | `@senars/io`                            |
| **API**                       | `HTTPAdapter`, `WebSocketAdapter`, `registerNARTools`, `registerAgentAPI`                                                                    | `senars12` (root package)               |
| **UI**                        | `startAgentUI`                                                                                                                               | `@senars/ui`                            |
| **Config**                    | `loadConfig`, `loadConfigFromEnv`                                                                                                            | `senars12` (root package)               |
| **Shared Utils**              | `EventBus`, `CommandRegistry`, `generateId`, `clamp`, `sleep`                                                                                | `@senars/util`                          |
| **Shared Types**              | `CognitiveEvent`, `Connection`, `LMService`, `Episode`                                                                                       | `@senars/util`                          |
| **Errors**                    | `SenarsError`, `ConfigError`, `TransportError`, `PolicyViolation`                                                                            | `@senars/util`                          |

---

*SeNARS12 — Where symbolic rigor meets neural fluidity.* 🧠✨
