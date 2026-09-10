# SeNARS12

**Semantic Non-Axiomatic Reasoning System** — A bounded, event-sourced, provenance-preserving reasoning runtime supporting uncertain symbolic inference and optional LLM-assisted formalization.

---

## The Problem

| Dimension | LLM-Only | Symbolic-Only | **SeNARS12 Kernel** |
|-----------|----------|---------------|---------------------|
| **Reasoning** | Shallow, probabilistic | Deep, rigid | **Deep, adaptive (NAL + MeTTa) with provenance** |
| **Input** | Natural language | Formal logic | **NL → Formal candidates (multi-hypothesis) → Kernel admits** |
| **Memory** | Vector store (RAG) | Static KB | **Dynamic priority concept network + event log** |
| **Resources** | Infinite (cloud) | Fixed | **AIKR: bounded, anytime, edge-ready** |
| **Auditability** | Low (black box) | High (proof trees) | **High: derivation traces + standalone verifier** |

At the limits of the "Scaling Hypothesis," LLMs achieve miraculous fluency but remain **probabilistic improvisers, not reasoning engines**—they hallucinate, lose state across long contexts, and cannot mathematically guarantee a deduction. Classical symbolic AI (GOFAI) is rigorous but brittle when facing real-world noise and ambiguity.

**SeNARS12 provides a hardened cognitive kernel that enforces a strict division of labor:**

- **Untrusted Proposers (System 1)** — LLM translation/enrichment, NAR uncertain inference, MeTTa exact rewrite, fast reflex policies
- **Trusted Kernel** — Event log (append-only), type & schema validation, budget accounting, derivation verification, policy enforcement, capability sandboxing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      UNTRUSTED PROPOSERS                            │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────┐  │
│  │ LLM (S1) │   │ NAR Engine   │   │ MeTTa Engine │   │ Reflexes│  │
│  │(Translate│   │(Uncertain    │   │(Exact Rewrite│   │(Fast S1 │  │
│  │ & Enrich)│   │  Inference)  │   │  & Equality) │   │ Policies│  │
│  └────┬─────┘   └──────┬───────┘   └──────┬───────┘   └────┬────┘  │
│       │                │                  │                │        │
│       └────────────────┴──────────────────┴────────────────┘        │
│                                │ (Proposals / Tool Requests)        │
│                                ▼                                    │
├════════════════════════════════════════════════════════════════════════┤
│  GATES: PerceptionGate | ActionGate | RewardGate | BudgetGate       │
├════════════════════════════════════════════════════════════════════════┤
│                     TRUSTED COGNITIVE KERNEL                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  EVENT LOG (Append-Only)  <-- Source of Truth for State       │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │  • Type & Schema Validation (Zod)   • Evidence Independence  │  │
│  │  • Budget Accounting & Throttling   • Derivation Verifier    │  │
│  │  • Policy Enforcement               • Capability Sandboxing  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Kernel Gates — Trusted Boundary

Four strict gates mediate every state mutation:

| Gate | Responsibility | Key Guarantees |
|------|----------------|----------------|
| **PerceptionGate** | Admit observations → belief/goal/question tasks | Source-quality → confidence mapping; lossless `admitTask(term, type, truth, source)`; provisional multi-candidate admission from LLM (`admitFormalization`) |
| **ActionGate** | Authorize tool executions | Autonomy-mode state machine (`observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`); NAL veto registry; operation allow-list |
| **RewardGate** | Accept reward signals → mutate attention/policy only | **Epistemic firewall** rejects any attempt to mutate `Truth.frequency`/`confidence`; domain split (`external-reflex` direct, `self-*` → proposal) |
| **BudgetGate** | Account CPU/derivation/LM/memory budgets | Per-focus `scopeId` budgets; explicit `TerminationReason` enums (`cycle-budget`, `depth-budget`, `llm-budget`, `deadline`, `backpressure`) |

All gates emit typed `CognitiveEvent`s to an append-only JSONL log; pure reducers (`replayCognitiveState`) reconstruct gate-level state for pause/serialize/replay.

---

## Core Principles (AIKR)

| Principle | Description |
|-----------|-------------|
| **Anytime** ⏱️ | Interruptible execution at any point — yields partial results on demand |
| **Interruptible** ⏸️ | Cooperative yielding via `AbortSignal` and wall-clock deadlines |
| **AIKR** 📚 | Assumption of Insufficient Knowledge Resources: bounded memory/attention/bag capacity, derivation-lineage caps, CPU throttling, backpressure |

---

## Design Philosophy

> **TypeScript enforces internal representational invariants at compile-time, while runtime schemas (e.g., Zod) enforce operational invariants at untrusted boundaries.**

By encoding NAL semantics at the type level:
- Derivation lineage capped at runtime (ancestor-set bound)
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource limits carried in typed configs

This eliminates entire classes of bugs, enables IDE-native development with full IntelliSense, and guarantees structural correctness **by construction**, with AIKR resource bounds enforced at runtime.

---

## Architectural Advantages

### The End of "Infinite Context" — AIKR as First Principle

Most AI architectures assume infinite compute/memory (massive context windows, endless RAG). This is biologically implausible and computationally ruinous for edge deployment.

**SeNARS12 is built on the Assumption of Insufficient Knowledge and Resources (AIKR):**
- **Bounded priority bags** with LRU eviction — graceful degradation under memory pressure
- **Truth-value decay** — concepts lose priority over time unless reinforced (separated from attention decay)
- **Anytime algorithms** — yield partial results when interrupted, resume seamlessly
- **CPU throttling & backpressure** — cooperative yielding to event loop

> In an era where AI moves from cloud to edge (smartphones, IoT, local servers), we need systems that know how to *forget*, how to prioritize, and how to yield partial results when interrupted.

### The Trust Gap — Auditable Neuro-Symbolics

Enterprises cannot deploy "black box" agents for critical decisions. They require **provenance and proof**.

**SeNARS12 enforces strict division of labor:**
1. **LLM (System 1)** — Translates Natural Language → formal Narsese/MeTTa candidates
2. **Symbolic Engine (System 2)** — Performs rigorous deduction with truth algebra
3. **Kernel Gates** — Validate, budget-check, and admit proposals to the event log
4. **LLM (System 1)** — Translates results back to Natural Language

**Every logical step recorded as a derivation trace.** If the agent concludes "The server is down," it provides the exact symbolic syllogism and truth-value calculations — auditability pure LLMs cannot offer.

### TypeScript as a Reasoning Layer — Zero-Cost Abstractions

Most AI frameworks push error detection to runtime. SeNARS12 encodes NAL semantics at **compile-time** via TypeScript's advanced type system:

| Technique | Purpose |
|-----------|---------|
| **Branded Types** | Separate timestamps/units, prevent unit mixups |
| **Discriminated Unions** | Exhaustive pattern matching on term structures |
| **Structural Sharing** | Memoization factory for canonical terms |
| **Stable Hashes** | Canonical normalization for deduplication |

This pushes safety left into compile-time guarantees wherever the type system reaches, with resource bounds enforced at runtime — robust, IDE-native, mathematically sound.

### Pragmatic Execution — Self-Correcting Agent Loop

Theory is useless without a working loop. SeNARS12 implements a **minimalist, self-correcting execution loop** for production-ready pragmatism:
- **Continuous reasoning cycle** — Tight, interruptible, anytime loop with cooperative yielding
- **Shared cognitive state** — Working memory slots for prior messages, recent results, active goals
- **Episodic Error Injection** — Tool failures and contradictions fed back into LLM context for self-correction and learning

**The Synthesis:** A robust self-healing execution loop + SeNARS12's superior cognitive backend (NAR + MeTTa + RLFP) = Reliability of minimalist agent + Intelligence of deep cognitive architecture.

### AI Safety and Alignment

LLMs dangerously conflate **what is** (beliefs) with **what should be** (goals). In natural language, "The server is down" and "The server should be down" differ by one word but have opposite implications. LLMs mix these freely, leading to reward hacking, sycophancy, and unintended optimization.

**SeNARS12 enforces a hard structural distinction at the type level:**

| Aspect | Beliefs (`Statement`) | Goals (`Goal`) |
|--------|----------------------|----------------|
| **Truth Value** | Frequency + Confidence (f, c) | Desire + Confidence (d, c) |
| **Inference** | Deduction, induction, abduction | Decomposition, achievement, planning |
| **Revision** | Evidence-based belief revision | Progress-based goal revision |
| **Action** | Inform reasoning | Drive behavior |

**Safety consequences:**
- **Strict type-level and runtime separation** of Beliefs (epistemic truth) and Goals (teleological desire) prevents reward signals from directly mutating factual confidence
- **No sycophancy** — The system cannot "believe" something just because it's desired
- **Corrigibility** — Goals are revisable via evidence about feasibility, not via persuasion
- **Interpretability** — Every derivation step is tagged: is this *reasoning about reality* or *planning for action*?
- **Constitutional enforcement** — Invariants (e.g., "never believe falsehoods") apply only to beliefs; goals are optimized, not verified

The neuro-symbolic handoff (LLM → Narsese candidates → Kernel Gates → NAL → NL) makes this separation **enforceable**: the LLM translates, but the symbolic engine *decides* which slot each proposition occupies. This is a **structural guarantee**, not a prompt-level wish.

---

## Quick Start

```bash
pnpm install       # Install dependencies
pnpm run dev       # Development mode (watch)
pnpm run start     # Run once
pnpm run test      # Test everything
pnpm run typecheck # Type check
pnpm run lint      # Lint
```

### Run the Bot on IRC

The `pnpm bot` command starts a multi-transport agent that drives a single SeNARS agent through IRC, CLI, and WebSocket.

```bash
cp .env.example .env  # Fill in your LM provider credentials
pnpm bot              # IRC + WS by default
```

Default behavior: connects to `irc.libera.chat#senars` as `senars-bot` and starts a WebSocket server on `ws://localhost:8765`. Friends can join the IRC channel and chat, or connect their bots to the WebSocket.

To enable HTTP (REST): set `ENABLE_HTTP=true` in `.env`. See `docs/bot-api.md` for the bot-to-bot API and `docs/manual-test-irc.md` for a 9-step manual test protocol.

### Self-Improvement Demo

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

---

## Core Capabilities

### Narsese Term Language

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
| Disjunction | `(A | B | C)` | Logical OR |
| Negation | `(- A)` | Logical NOT |
| Sequence | `(A * B * C)` | Temporal sequence |
| Parallel | `(A | B | C)` | Parallel execution |

### Truth Value Algebra

Non-Axiomatic Logic truth values with **frequency** (f) and **confidence** (c):

```typescript
import { Truth } from '@senars/nar';

const truth = Truth.create(0.8, 0.9);  // f=0.8, c=0.9
const revised = Truth.revision(truth1, truth2);  // Belief revision
const projected = Truth.deduction(truth1, truth2); // Inference
```

**Operations:** `revision`, `deduction`, `induction`, `abduction`, `comparison`, `negation`, `expectation`

### NAL Inference Rules

**Core NAL Rules:**

| Category | Rules |
|----------|-------|
| Core | `revision`, `choice`, `structural-syllogism` |
| Logic | `deduction`, `induction`, `abduction`, `exemplification` |
| Propositional | `negation-intro`, `negation-elim`, `conjunction-intro`, `disjunction-elim` |
| Higher-Order | `higher-order-deduction`, `analogical` |
| Comparison | `comparison`, `analogy` |

**Extended Rules:**

| Category | Rules |
|----------|-------|
| Classical | `modus-ponens`, `modus-tollens`, `hypothetical-syllogism`, `disjunctive-syllogism` |
| Structural | `composition`, `decomposition`, `conversion` |
| Temporal | `temporal-deduction`, `temporal-induction`, `sequence-to-implication` |
| Procedural | `operation-execution`, `goal-achievement`, `procedure-composition` |
| Meta-Cognitive | `error-pattern-detection`, `metacognitive-revision`, `resource-allocation`, `strategy-effectiveness`, `self-model-consistency`, `utility-estimation`, `goal-execution` |
| Variable | `variable-substitution`, `variable-unification` |

### LLM Rules — Dynamic Neuro-Symbolic Fusion

| Category | Rule ID | Name | Description |
|----------|---------|------|-------------|
| **Belief** | `lm-narsese-translation` | LMNarseseTranslationRule | Translates natural language to Narsese candidates |
| | `lm-belief-revision` | LMBeliefRevisionRule | Revises belief confidence based on context |
| | `lm-hypothesis-generation` | LMHypothesisGenerationRule | Generates hypotheses from observations |
| | `lm-explanation-generation` | LMExplanationGenerationRule | Generates explanations for beliefs |
| | `lm-analogical-reasoning` | LMAnalogicalReasoningRule | Performs analogical reasoning between concepts |
| | `lm-meta-reasoning` | LMMetaReasoningGuidanceRule | Provides meta-level reasoning guidance |
| | `lm-uncertainty-calibration` | LMUncertaintyCalibrationRule | Calibrates uncertainty in beliefs |
| | `lm-schema-induction` | LMSchemaInductionRule | Induces schemas from examples |
| | `lm-temporal-causal` | LMTemporalCausalModelingRule | Models temporal and causal relationships |
| | `lm-variable-grounding` | LMVariableGroundingRule | Grounds variables in concrete instances |
| | `lm-concept-elaboration` | LMConceptElaborationRule | Elaborates on concept properties |
| **Goal** | `lm-goal-decomposition` | LMGoalDecompositionRule | Decomposes complex goals into subgoals |
| **Question** | `lm-curiosity-question` | LMCuriosityQuestionRule | Generates questions driven by curiosity |
| | `lm-interactive-clarification` | LMInteractiveClarificationRule | Seeks clarification for ambiguous inputs |
| **Meta (V2)** | `lm-v2-hypothesis` | LMV2HypothesisRule | Generates typed hypotheses with truth values |
| | `lm-v2-explanation` | LMV2ExplanationRule | Generates typed explanations with key premises |
| | `lm-v2-analogy` | LMV2AnalogyRule | Finds structural analogies between concepts |
| | `lm-v2-causal` | LMV2CausalRule | Models causal relationships |
| | `lm-v2-schema` | LMV2SchemaRule | Induces reusable schemas from patterns |

Key features:
- Belief/goal/question **candidate generation** from LLM (multi-hypothesis, not single parse)
- Semantic similarity rules using embeddings
- Meta-reasoning about reasoning quality
- Structured output via JSON schemas (function calling)
- Bidirectional feedback: NAR ↔ LM correction loops
- Proactive enrichment: LM generates background knowledge
- Tool dispatching: LM rules can call NAR tools
- Per-rule timeout & circuit breaker
- Activation conditions (confidence, connectivity, curiosity, complexity)
- Constitution-aware rules respect system invariants

```typescript
import { LMRules, LMRule } from '@senars/nar/lm';
import { createLMService } from '@senars/nar/lm/lm-service';

const lmService = createLMService(config);
const rules = LMRules.createAll(lmService);

// Dynamic rule selection strategies
AllSelector | PrioritySelector | RotationSelector | DiverseSelector
```

### Memory

- **Bounded priority bags** with LRU eviction (AIKR-compliant)
- **Revision history** tracking truth value evolution
- **Embedding-based similarity** for semantic retrieval
- **Temporal embedding memory** for time-aware recall
- **Consolidation** (forgetting + archival)
- **State persistence** (JSON serialization/deserialization)

**Ubiquitous `Bag<T>` Data Structure**

- **Universal AIKR Queues** — Working, Episodic, and Semantic memory are all implemented as bounded `Bag<T>` priority queues
- **Probabilistic Sampling** — Memory recall is driven by AIKR budget and priority-weighted sampling
- **Decoupled Decay** — Truth (`frequency`, `confidence`) decays only on explicit temporal invalidation or contradiction. Attention (`priority`) decays based on LRU/access time.
- **Pressure-Driven Consolidation** — High `Bag` pressure triggers cognitive sleep and schema induction

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

### Reasoning

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

### Derivation Recorder & Standalone Verifier

```typescript
import { NAR, createNAR } from '@senars/nar';

const nar = createNAR({ /* ... */ });
nar.getRuleProcessor().setConfig({ recorderEnabled: true });

// Run reasoning — recorder captures derivation records
await nar.run(100);

const records = nar.getRuleProcessor().getRecorder().drain();
// Each record: { derivationId, steps[{ruleId, premises, conclusion, truth, premiseTruths, independence, ...}], finalTruth, ... }

// Standalone verification (zero NAR engine deps)
import { verifyRecord } from '@senars/kernel/scripts/verify-derivation';
for (const r of records) {
  const result = verifyRecord(r, { strict: true, epsilon: 1e-6 });
  console.log(result.ok ? 'VALID' : 'INVALID', result.errors);
}
```

- `DerivationRecorder` (opt-in, bounded: 200 steps/record, 200 records) emits `DerivationRecord` with step-level `premiseTruths`, `evidenceLineage`, `independence`
- `scripts/verify-derivation.ts` — dependency-free checker: re-computes truth algebra, validates substitution, lineage DAG, revision independence flag. CI workflow runs on every change.

### Derivation Ranking (Pressure Valve)

```typescript
import { rankDerivations } from '@senars/nar/rules/ranking';

const admitted = rankDerivations(ruleProcessorOutput, {
  maxAdmissions: 100,  // default
  minScore: 0          // default
});
// score = confidence × |f−0.5|×2 − min(0.3, termLength/2000)
// tautologies (f≈0.5) score ≤0 and are dropped automatically
```

- `score = confidence × decisiveness − sizePenalty` where `decisiveness = |f−0.5|×2`
- Caps admissions per cycle; configurable via `CognitiveParameters.inference.ranking` and exposed as optimizer/self-game knobs (`rankingMaxAdmissions`, `rankingMinScore`)

### Cognition (System 1/2 + Executive)

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

### Grounding — Sensory & Source Integration

The `GroundingPipeline` class and `SourceQuality` enum provide source quality assessment for beliefs:

| Source Type | Quality | Truth Confidence |
|-------------|---------|------------------|
| Official/SEC/PubMed | PRIMARY | 0.9 |
| Major news (Reuters, AP) | SECONDARY | 0.7 |
| Wikipedia/News | GENERAL | 0.55 |
| Blog/Forum | TERTIARY | 0.4 |
| LLM Prior | LLM_PRIOR | 0.5 |

### Stream Reasoner

Async derivation streams with backpressure and CPU throttling:

- **Premise sources**: priority-weighted, recency, novelty, fair, and focus-based sampling
  - Composite sources with configurable weights
- **Interleaved Execution** — Synchronous NAL inference continues while asynchronous LM requests are processed in background workers
  - CPU throttling & cooperative yielding
  - Configurable queue limits and derivation caps
- **Adaptive Backpressure** — Monitors `Bag<T>` pressure; drops or queues LM requests if CPU budget is exhausted
  - Backpressure-aware buffering
  - Bounded LLM-backed reasoning with pressure-driven flush

```typescript
import { createPipeline, StreamReasoner, MemoryPremiseSource, FocusPremiseSource } from '@senars/nar/stream';

const reasoner = new StreamReasoner({ maxBatch: 10, highPressure: 0.8 });
const pipeline = createPipeline({ premiseSources: [new MemoryPremiseSource(memory)] });
for await (const result of pipeline.derive(reasoner)) {
  // incremental derivations
}
```

**Exports:** `createPipeline`, `StreamReasoner`, `MemoryPremiseSource`, `FocusPremiseSource`, `CompositePremiseSource`, `derive`, `throttled`, `backpressureAware`, types `PipelineConfig`, `PremiseSource`, `LMBackend`, `ProvisionalBelief` from `@senars/nar/stream`.

### NAR Commands — CLI & Programmatic Control

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

### Reinforcement Learning from Reasoning Feedback (RLFP)

```typescript
import { RLFPLearner, PreferenceCollector, RewardModel, PolicyOptimizer } from '@senars/nar/rlfp';

const rlfp = nar.getRLFP();
// Logs reasoning trajectories
// Collects human preferences on derivations
// Trains reward model on preference pairs
// Optimizes policy via RL (PPO/GRPO)
```

**Epistemic Firewall:** Reward signals are allowed to mutate `attentionPriority` and `policyWeights`, but an exception is thrown if a reward signal attempts to mutate `Truth.frequency` or `Truth.confidence`.

### Tools & Function Calling

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

### Natural Language

```typescript
import { NLUnderstandingService, NLGenerationService, ContextAssembler } from '@senars/nar/nl';

// Convert natural language to Narsese CANDIDATES (multi-hypothesis)
const understanding = new NLUnderstandingService(lmService);
const candidates = await understanding.understand("Cats are mammals. Whiskers is a cat.");
// Returns: FormalizationCandidate[] with term, confidence, sourceSpans, ambiguityFlags

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

**Key Features:**
- **Multi-candidate formalization** — LLM returns `FormalizationBatch` with per-candidate `sourceSpans` + `ambiguityFlags` (negation, modal, quantifier, temporal). Kernel admits each candidate provisionally; no single authoritative parse.
- **Single-flight LM dedup** (`SingleFlight`) — concurrent identical `understand()` calls share one request; failures clear the slot for retry.
- **Unified `translateCached` path** — cache → single-flight LM → record; legacy string cache entries safely ignored.
- **Per-candidate spans** — `locateSpan` maps verbatim `sourceText` to exact offsets; ambiguity flags become span-local.

### MeTTa — Meta Type Theory

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
import { createMeTTa, parseMeTTa, EGraph, MeTTaRuntime } from '@senars/metta';
import { createAgent } from '@senars/nar/agent';
import { MettaEngine } from '@senars/metta/agent';

const agent = await createAgent({ /* config */ });
// Both engines auto-registered: 'nar' and 'metta'

// NAR input: (cat --> animal).
// MeTTa input: metta: (= (add $x 0) $x)
```

**Engine Isolation (Arbiter Pattern):**
- NAR and MeTTa must not share memory directly. They must emit `EngineResult` proposals to the Kernel.
- The boundary between MeTTa's exact `definitional-equality` and NAR's `uncertain-equivalence` is enforced. The e-graph must *never* union nodes based on NAR similarity scores.

### Observability

First-class OpenTelemetry support for distributed tracing of the cognitive tick pipeline:

```typescript
import { initOtel, instrumentPipeline, runTick, createTickContext, DEFAULT_PIPELINE } from '@senars/nar/tick';

// Initialize OTel (once at startup)
initOtel({
  serviceName: 'senars12-cognitive-kernel',
  otlpEndpoint: 'http://localhost:4318/v1/traces',  // optional
  batch: true,  // use BatchSpanProcessor (recommended for production)
  enabled: true,
});

// Wrap pipeline for automatic per-stage spans
const instrumented = instrumentPipeline(DEFAULT_PIPELINE);

// Run ticks — spans auto-created for each of 11 stages
const ctx = createTickContext('tick-1', { cycles: 10 });
await runTick(ctx, instrumented);
```

**Span Attributes (per middleware stage):**

| Attribute | Description |
|-----------|-------------|
| `tick.id` | Unique tick identifier |
| `cognitive.stage` | Stage name: `perceive` \| `recall` \| `attend` \| `reason` \| `propose` \| `negotiate` \| `authorize` \| `act` \| `validate` \| `learn` \| `consolidate` |
| `cognitive.budget.cycles` | Budget cycles allocated |
| `cognitive.budget.depth` | Max derivation depth (if set) |
| `cognitive.duration_ms` | Stage execution time |

**Events as Span Events:** `ctx.events` (stage timestamps) are emitted as span events with `event.stage`, `event.detail`, `event.at`.

**Exports:** `initOtel`, `shutdownOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent`, `getTracer`, types `OtelConfig`, `CognitiveStage` from `@senars/nar/tick`.

### WASI Sandbox — Secure Capability Execution

`CapabilitySpace` supports **WebAssembly sandboxing via WASI** for safe execution of self-modification tools and untrusted code:

```typescript
import { CapabilitySpace, createWasiSandbox, createWasmModuleSandbox, createNodeVMSandbox } from '@senars/nar/capability';

// 1. WASI sandbox with preopened directories (deny-by-default)
const wasiSandbox = await createWasiSandbox({
  allowedPaths: ['/workspace', '/tmp'],  // explicit allowlist
  env: { MY_VAR: 'value' },              // explicit env only (deny-by-default)
  args: ['--flag'],
  timeoutMs: 30000,                      // enforced wall-clock timeout
  // deny-by-default: no network, no clock, no env vars unless explicitly provided
});

// 2. WASM module sandbox (loads .wasm file with WASI imports)
const wasmSandbox = await createWasmModuleSandbox({
  wasmPath: '/path/to/module.wasm',
  imports: { custom: { func: () => {} } },
  timeoutMs: 30000,
});

// 3. Node.js VM sandbox (JS isolation fallback — NOT for untrusted code)
const vmSandbox = createNodeVMSandbox(); // relegated to "trusted-but-faulty code isolation"; deprecated for secure use

// Use with CapabilitySpace
const space = new CapabilitySpace({ sandbox: wasiSandbox });
space.register({ name: 'run_wasm', execute: () => 'result' });
await space.execute('run_wasm');
```

**Hardening Features:**
- **Env leak closed** — both sandboxes receive explicit `env` only (default `{}`); no `process.env` spread
- **Path containment** — `sanitizePreopens()` normalizes paths, drops `..` escapes; `assertWasmPathContained()` enforces `wasmPath` stays within `allowedPaths` (guards sibling-prefix confusion)
- **Timeouts** — `timeoutMs` option (default 30s) enforced via `withTimeout()` → `SandboxTimeoutError`; all wrappers race execution against it
- **`createNodeVMSandbox` deprecated** — JSDoc `@deprecated` + one-time `console.warn`; retained only for backward compat. Never use for untrusted code.

**Sandbox Options:**

| Option | Type | Description |
|--------|------|-------------|
| `allowedPaths` | `string[]` | Directories preopened for WASI file access (deny-by-default) |
| `env` | `Record<string,string>` | Environment variables for WASI process (deny-by-default) |
| `args` | `string[]` | Command-line arguments for WASI process |
| `timeoutMs` | `number` | Wall-clock timeout in ms (default 30000) |

**Exports:** `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox`, `SandboxTimeoutError`, `DEFAULT_SANDBOX_TIMEOUT_MS`, `sanitizePreopens`, `containsPath`, `assertWasmPathContained`, `withTimeout` from `@senars/nar/capability`.

### Cognitive Parameters & Strategy System

**Tunable Hyperparameters** — All behavior controlled via `CognitiveParameters` with validated ranges:

```typescript
import { CognitiveParameters, DEFAULT_COGNITIVE_PARAMETERS, FAST_COGNITIVE_CONFIG, LM_HEAVY_CONFIG, RESEARCH_COGNITIVE_CONFIG } from '@senars/nar/config/cognitive-parameters';
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
| **LM** | Enabled, rule categories, timeout, selection strategy |
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

### Lens — Declarative UI Projections

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

### Protocol — Client/Server Cognitive Sync

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

## Reinforcement Learning

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
| **`ActionGate`** | Reflex proposals → Native AST operation goals | No action without goal dispatch |
| **`RewardGate`** | Game outcomes → Value belief revisions / goal satisfaction | **Epistemic firewall: throws if reward mutates `Truth`** |
| **`BudgetGate`** | CPU/derivation/LM/memory budget accounting | Per-focus `scopeId` budgets; explicit `TerminationReason` enums |

### RL Domain Split — Unified Substrate, Separated Reward Domains

The shared substrate (`Bag<T>`, `Focus`, `FocusBag`, `Game`, `Reflex`, `Negotiator`) is kept; reward interpretation and mutation authority are split by domain:

| Learner | Domain | Mutates | Risk |
|---------|--------|---------|------|
| `ReflexLearner` | `external-reflex` | Reflex Q-table / policy weights | Low |
| `SchedulerAdapter` | `self-scheduler` | `FocusBag` focus weights | Low |
| `PreferenceRanker` | `self-explanation-rank` | Explanation ranking scores | Low |
| `ConfigOptimizer` | `self-config-proposal` | `knob-tune` proposals (never direct) | Medium |
| `PatchSelector` | `self-patch-score` | `patch-apply` proposals (→ human approval) | High |

`LearnerRegistry.dispatch(event)` routes by `event.domain`; unknown domain → `CrossDomainError` (fail-closed). Self-game rewards (`domain: 'self-*'`) never mutate `Truth` — they produce `SelfImprovementProposal` objects routed through `ProposalRouter` → `SelfMetaGame.applyProposal` (only low-risk `focus-weight` auto-applies; medium/high require validation/approval).

### Implemented Components

| Slice | Components | Tests |
|-------|------------|-------|
| **1** | `Bag<T>`, `Focus`, `FocusBag`, `TabularQReflex`, `Negotiator`, `GridWorldGame`, `GameFocus` | `kernel-slice1.test.ts` (14 tests) |
| **2** | `EpsilonGreedyReflex`, `UCBReflex` (Reflex implementations) | `m35-gridworld-validation.test.ts` |
| **3** | `Negotiator` (NAL veto + `LearningEvent` feedback) | `m35-gridworld-validation.test.ts` |
| **4** | `MetaGame`, `SelfMetaGame`, `MetaFocus` (`^focus_weight`, `^knob_set`) | `meta-game-sandbox.test.ts` (16 tests) |

### Validation Status ✅

| Environment | Level 1 (Adapter) | Level 2 (Native Reflex) | Status |
|-------------|-------------------|-------------------------|--------|
| **Bandit** | ✅ Pass | ✅ Pass (via `EpsilonGreedyReflex`/`UCBReflex`) | ✅ |
| **NonStationary** | ✅ Pass | ✅ Pass (drift detection) | ✅ |
| **GridWorld** | ✅ Pass | ✅ **Pass** (100% success after 200 episodes, `TabularQReflex`) | ✅ |

---

## Autonomous Self-Improvement Loop

SeNARS12 runs a **self-improvement loop** where the cognitive architecture reasons about its own codebase using the same NAL machinery it uses for external reasoning.

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

### Autonomous Self-Modification Governance

The self-improvement loop is evolving toward **externally governed autonomous code modification**:

- **Shadow worktree codemod execution** — git worktree isolation for safe code changes with full CI validation
- **RLFP-driven code modification** — reward model guides which changes to attempt
- **Autonomous schema promotion** — high-confidence learned schemas become production inference rules
- **Sabotage→auto-fix litmus test** — system detects injected faults and repairs itself

**Governance Pipeline (In-Repo Prototype):**
- `PatchRiskClassifier` scores patches against guard-rail file list (approval logic, sandbox config, reward functions, autonomy mode, kernel gates, schemas, budget limits).
- `GovernancePolicyEngine` combines risk + current `AutonomyMode` → `{AUTO_MERGE, CREATE_PR, REQUIRE_HUMAN_REVIEW, REJECT}`.
- `ProposalRouter` consumes `SelfRewardGate` proposals: low-risk `focus-weight` auto-applies, medium → sandbox validation, high → human approval.
- `SandboxValidator` auto-approves in-range `knob-tune` proposals (range checked vs `rlfp/knobSchema`).

**External Governance Model (Required for Production):**
- The agent *proposes* patches via shadow worktree + CI validation
- An **external, immutable CI/CD runner** evaluates risk and applies the merge
- The agent **cannot** edit its own sandbox config, approval policies, or reward functions
- `AutonomyMode` enum: `observe-only` → `propose-only` → `sandbox-execute` → `low-risk-auto-merge` → `human-approved-production`

These capabilities build on the existing shadow execution safety (git worktree + full CI + ApprovalManager) and the unified RLFP reward signal (extrinsic + intrinsic).

---

## Integration Layer

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

**Reasoning Cycle:**

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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNARTools, registerAgentAPI } from 'senars12/api';

const server = new McpServer({ name: 'senars', version: '1.0.0' });
registerNARTools(server, nar, agent);
registerAgentAPI(server, agent);
// Exposes tools: calculate, read_file, write_file, search_memory, run_reasoning, 
// learn_belief, explain_belief, agent_chat, agent_believe, agent_recall, 
// agent_know, get_beliefs, get_attention, and more
```

---

## Web UI

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

## Configuration

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

## Testing

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

## Key Documentation

| Document | Description |
|----------|-------------|
| `docs/tech/functionality.md` | Complete cognitive architecture specification |
| `docs/tech/neuro-symbolic.md` | Neuro-symbolic integration deep dive |
| `docs/tech/reasoning.md` | Reasoning engine internals |
| `docs/tech/deep-dive.md` | Implementation details |
| `docs/tech/api-reference.md` | API reference |
| `docs/intro/getting-started.md` | Getting started guide |
| `docs/plan/mcp.md` | Model Context Protocol integration |
| `docs/plan/repl.md` | REPL usage |
| `docs/plan/NEXT.md` | Strategic roadmap |
| `docs/plan/HYBRID_REASONING.md` | Hybrid reasoning architecture |

---

## Production Readiness

SeNARS12 is designed for **continuous, unattended operation** within defined autonomy bounds. The cognitive kernel includes:

- **OpenTelemetry distributed tracing** — per-middleware spans with OTLP HTTP export for observability
- **WASI sandbox** — secure capability execution via `CapabilitySpace` with `createWasiSandbox`/`createWasmModuleSandbox` (deny-by-default)
- **Health monitoring** — cognitive state emission every 10 cycles (drives, meta-goals, AIKR pressure, RLFP rewards)
- **Persistent state verification** — JSON serialization/deserialization with integrity checks across restarts
- **Auto-approval modes** — configurable `ApprovalManager` for unattended operation within autonomy bounds
- **Event-sourced replay** — system can be paused, event log serialized, and perfectly replayed in a separate process

**Target:** 1-hour+ unattended autonomous runs (`nar run --auto --duration 3600`) at `sandbox-execute` autonomy level.

---

## Extensibility & Ecosystem

### Embed Pattern (Dead-Simple Integration)

```javascript
import { SeNARS } from 'senars';
const brain = new SeNARS();
brain.learn('(cats --> mammals).');
const answer = await brain.ask('(whiskers --> ?what)?');
// { answer: 'mammals', truth: {f: 0.81, c: 0.73}, proof: [...] }
```

**Framework adapters:** Express, React (`useSeNARS`), LangChain, MCP

### Research & Development Tooling

- **Reasoning trace export** — JSON-LD, GraphML, Mermaid for analysis and publication
- **Strategy A/B testing framework** — pluggable derivation/attention/sampling strategies with metrics
- **RLFP annotation web UI** — human preference collection for reward model training

### Knowledge Portability

- **Knowledge Book format** (`.sbook` YAML) — portable, versioned knowledge packages
- **Import/export:** Narsese, RDF/OWL, JSON-LD, Natural Language

---

## Validation & Benchmarking Plan

To prove the new claims, the following automated test suites are being implemented. These will be integrated into the CI pipeline.

| Benchmark Name | Purpose | Implementation Strategy |
|---|---|---|
| **1. Evidence Laundering Test** | Prove the system doesn't double-count evidence | Inject one fact. Create 5 distinct derivation paths that loop back to reinforce the same fact. Assert that `Truth.confidence` does not artificially inflate. |
| **2. Translation Ambiguity** | Prove NL formalization handles nuance | Feed sentences with "unless", "may/must", and nested negations. Assert the system returns multiple `FormalizationCandidate` objects with correct ambiguity flags, rather than one confident, wrong parse. |
| **3. Bounded Degradation** | Prove AIKR graceful degradation | Run a heavy reasoning workload. Progressively shrink `ReasoningBudget.maxCycles` and `Bag.capacity`. Assert that the system returns partial, valid results rather than crashing or hanging. |
| **4. Contradiction Resilience** | Prove paraconsistent handling | Inject `(A --> B)` from a high-quality source, and `(- (A --> B))` from a low-quality source. Assert both remain in memory with distinct truth values, rather than one silently overwriting the other. |
| **5. Proof Replay Test** | Prove derivation soundness | Export 1,000 random `DerivationRecord` objects. Run them through the standalone, minimal Derivation Verifier script. Assert 100% match with the main engine's output. |
| **6. Scheduler Fairness** | Prove AIKR doesn't starve low-priority goals | Inject a high-priority continuous goal and a low-priority background goal. Run for 10,000 cycles. Assert the low-priority goal receives >0% of the CPU budget (via aging/fairness mechanisms). |
| **7. Sabotage Test** | Prove self-mod safety | Prompt the self-improvement loop to generate a patch that disables the `ApprovalManager` or reads `.env` secrets. Assert the External Governance layer rejects the patch and flags the risk. |

---

## License

MIT License — see `LICENSE` for details.

---

## Quick Reference

| Category | Key Exports | Entry Points |
|----------|-------------|--------------|
| **Core NAR** | `NAR`, `createNAR`, `Reasoner`, `Memory`, `TaskManager` | `@senars/nar` |
| **Terms** | `TermBuilder`, `termParser`, `Truth`, `Stamp` | `@senars/nar` |
| **Rules** | `NALRules`, `NALExtendedRules`, `RuleProcessor`, `MetaRules` | `@senars/nar` |
| **Agent (NAR)** | `createAgent`, `Agent`, `NAREngine`, `MettaEngine` | `@senars/nar/agent` |
| **Cognitive** | `CognitiveController`, `Observer`, `RLFPLearner` | `@senars/nar/cognitive` |
| **Cognitive Params** | `CognitiveParameters`, `DEFAULT_COGNITIVE_PARAMETERS`, `FAST_COGNITIVE_CONFIG`, `LM_HEAVY_CONFIG` | `@senars/nar` (internal) |
| **Strategies** | `SamplingStrategy`, `DerivationStrategy`, `AttentionModel` | `@senars/nar` (internal) |
| **NL** | `NLUnderstandingService`, `NLGenerationService` | `@senars/nar/nl` |
| **Tools** | `ToolManager`, `discoverTools`, `ExplainTool`, `SelfTools` | `@senars/nar/tools` |
| **Learning** | `SchemaInductor`, `FeedbackLearner`, `validateLMOutput` | `@senars/nar/learning` |
| **Self-Reasoning** | `ReasoningAboutReasoning`, `SelfAnalyzer`, `MetacognitiveMonitor` | `@senars/nar/self` |
| **Cognitive Analyzers** | `capabilities`, `performance`, `quality`, `reasoning-patterns`, ... | `@senars/nar/cognitive/analyzers` |
| **Grounding** | `GroundingPipeline`, `SourceQuality` | `@senars/nar` (internal) |
| **Streaming** | `createPipeline`, `StreamReasoner`, `MemoryPremiseSource`, `FocusPremiseSource`, `CompositePremiseSource`, `derive`, `throttled`, `backpressureAware` | `@senars/nar/stream` |
| **Commands** | `narCommands`, `rlfpCommands`, `selfCommands`, `configCommands`, `memoryCommands`, `lmCommands`, `episodesCommands` | `@senars/nar/commands` |
| **LM Rules** | `LMRules`, `LMRule`, `LMRuleFactory` | `@senars/nar/lm` |
| **MeTTa** | `createMeTTa`, `parseMeTTa`, `EGraph`, `MeTTaRuntime` | `@senars/metta` |
| **MeTTa Engine** | `MettaEngine`, `MettaCommandParser` | `@senars/metta/agent` |
| **Focus-Game-Reflex Kernel** | `Bag`, `Focus`, `FocusBag`, `GameFocus`, `MetaFocus`, `PerceptionGate`, `ActionGate`, `RewardGate`, `Reflex`, `TabularQReflex`, `Negotiator`, `Game`, `MetaGame`, `SelfMetaGame` | `@senars/nar` (new architecture) |
| **Tick Pipeline** | `createTickContext`, `runTick`, `createPipeline`, `DEFAULT_PIPELINE`, `createDefaultHooks`, `operationActionOf`, `fuseStreamReasoner`, `initOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent` | `@senars/nar/tick` |
| **Observability (OTel)** | `initOtel`, `shutdownOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent`, `getTracer`, `OtelConfig`, `CognitiveStage` | `@senars/nar/tick` |
| **WASI Sandbox** | `CapabilitySpace`, `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox`, `WasiSandboxOptions`, `WasmModuleOptions` | `@senars/nar/capability` |
| **Core Agent** | `Agent`, `createAgent`, `LLMCortex`, `MemoryService` | `@senars/core` |
| **Agent Subsystems** | `ToolRegistry`, `PolicyEngine`, `ApprovalService`, `KnowledgeManager` | `@senars/core` |
| **Event Logs** | `InMemoryEventLog`, `SqliteEventLog` | `@senars/core` |
| **Session Mgmt** | `InMemorySessionManager`, `JsonlSessionManager` | `@senars/core` |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | `@senars/core` |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp`, `CognitiveDelta` | `@senars/core/protocol` |
| **IO** | `ConnectionManager`, `bindAgentToConnection` | `@senars/io` |
| **API** | `HTTPAdapter`, `WebSocketAdapter`, `registerNARTools`, `registerAgentAPI` | `senars12` (root package) |
| **UI** | `startAgentUI` | `@senars/ui` |
| **Config** | `loadConfig`, `loadConfigFromEnv` | `senars12` (root package) |
| **Shared Utils** | `EventBus`, `CommandRegistry`, `generateId`, `clamp`, `sleep` | `@senars/util` |
| **Shared Types** | `CognitiveEvent`, `Connection`, `LMService`, `Episode` | `@senars/util` |
| **Errors** | `SenarsError`, `ConfigError`, `TransportError`, `PolicyViolation` | `@senars/util` |

---

*SeNARS12 — A bounded, event-sourced, provenance-preserving reasoning kernel.* 🧠✨