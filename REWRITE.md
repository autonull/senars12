# SeNARS12: A NARS-Inspired Cognitive Architecture for Agentic Systems

## Vision

A unified agentic kernel where **reasoning is not a component — it is the substrate**. The LM does not "call" a reasoning
engine; the system *is* a reasoning engine that delegates semantic fluency to an LM. Every cognitive operation
(attention, memory, inference, learning, action) follows NARS principles: non-axiomatic, resource-bounded,
priority-driven, and grounded in experience.

---

## Core Principles

### AIKR by Construction

| Principle | Meaning | Mechanism |
|---|---|---|
| **Anytime** | Produces best answer available given time constraints | Priority-gated inference; yield-to-event-loop on every cycle |
| **Insufficient Knowledge** | No closed-world assumption; truth is always frequency + confidence | NARS truth calculus: every belief has `(f, c)` not binary true/false |
| **Insufficient Resources** | Finite buffer, bounded bags, forgetting | `maxConcepts`, `priorityThreshold`, decay, consolidation |
| **Interruptible** | Cooperative yielding, AbortSignal throughout | Every `step()` and `runStream()` accepts `signal` |

### Experience-Grounded Semantics

All meaning derives from patterns of input/output, not from predefined models. The system does not start with a
knowledge base — it builds one through interaction. Concepts emerge from statistical regularities in the stream of
experience.

### Continuous Truth Maintenance

Every belief has a truth value `(frequency, confidence)` that updates via revision, deduction, abduction, induction,
and comparison — the five core NAL inference rules. No belief is ever "final"; all are revisable with new evidence.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Agent                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Cognitive Loop                           │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │ Input   │→ │ Attention│→ │Inference │→ │ Memory     │  │  │
│  │  │ Queue   │  │ Priming  │  │ Controller│  │ Update     │  │  │
│  │  └─────────┘  └──────────┘  └──────────┘  └────────────┘  │  │
│  │       │             │              │              │         │  │
│  │       ▼             ▼              ▼              ▼         │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │ Sense   │  │ LM       │  │ Strategy │  │ Consolidate│  │  │
│  │  │ Adapters│  │ Bridge   │  │ Adapter  │  │ & Forget   │  │  │
│  │  └─────────┘  └──────────┘  └──────────┘  └────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Connection Adapters                       │  │
│  │  (CLI / IRC / WebSocket / HTTP / MCP / File / Custom)     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### The Agent as Cognitive Kernel

The `Agent` class owns the full lifecycle. It is **not** a pipeline orchestrator — cognition is a single loop with
different phases:

```
CognitiveCycle:
  1. Sense(input)        → addTask(input)        [external or internal]
  2. PrimeAttention(term) → boost concept priority
  3. SelectTasks()       → sample by priority      [from task buffer]
  4. SelectPremises()    → find related beliefs    [strategy-driven]
  5. Derive()            → apply inference rules   [including LM rules]
  6. UpdateMemory()      → add derivations, consolidate, forget
  7. Act()               → emit response or action
```

No stages, no pipeline objects. Just a loop with pluggable strategies at each decision point.

### Memory Architecture (Three-Tier)

```
┌────────────────────────────────────────────────────────────┐
│             Working Memory (ephemeral context)              │
│  - Current conversation turns (last ~20)                   │
│  - Active goals & questions                                │
│  - Recently derived beliefs                                │
│  - Attention focus set (~50 concepts)                      │
├────────────────────────────────────────────────────────────┤
│             Conceptual Memory (NARS core)                   │
│  - Term-linked concepts with bags (belief, goal, question) │
│  - Priority-ranked, decay-cycled                           │
│  - Bounded by maxConcepts, with forgetting policy           │
│  - Derivation provenance via stamps                        │
├────────────────────────────────────────────────────────────┤
│             Episodic Memory (experience log)                │
│  - Ordered log of inputs, responses, derivations           │
│  - Time-indexed for retrieval                              │
│  - Used for self-analysis, RLFP, reflection                │
└────────────────────────────────────────────────────────────┘
```

Key property: **All three tiers share the same term space**. A concept in conceptual memory is the same term that
appears in working memory or an episodic log entry. This unification enables seamless cross-tier reasoning.

---

## Cognitive Loop Details

### 1. Input Processing (`input()`)

Every input — whether from a human user, a tool result, an internal clock tick, or a derived belief — enters through
the same path:

```
Input → Parse (Narsese / NL / structured) 
     → Create Task (term, type, truth, budget, stamp)
     → Add to Memory (concept.beliefBag / goalBag / questionBag)
     → Prime Attention (boost concept priority + related concepts)
     → Enqueue for inference cycle
```

There is no separate "pipeline" for user vs internal inputs. The system is **reactive**: everything is a task.

### 2. Attention System

Attention is not a separate module — it is the **priority field on every concept**, maintained continuously:

| Event | Effect |
|---|---|
| Direct term mention | `priority += directMentionBoost` (0.3) |
| Related term co-occurrence | `priority += relatedBoost` (0.15) |
| Derivation success | `priority += derivationBoost` (0.05) |
| Goal relevance | `priority += goalOverlap * 0.5` |
| Per-cycle decay | `priority *= (1 - decayRate)` |
| Forgetting threshold | Remove if `priority < threshold && tasks === 0` |

Priority governs everything: which tasks are selected for inference, which LM rules fire, which concepts survive
consolidation. It is the **universal resource allocation currency**.

Attention models are pluggable strategies:
- `SimpleAttention` — fixed boost, exponential decay
- `SpreadingActivation` — boost propagates through term links
- `GoalRelevanceAttention` — boost proportional to goal term overlap
- `CompositeAttention` — weighted combination of multiple models

### 3. Inference Cycle

Each cycle processes one task from the priority-sorted task buffer:

1. **Sample** — Select top-N concepts by priority from memory
2. **Select Premises** — For the primary task's concept, find related secondaries via:
   - Bag strategy (same bag, different tasks)
   - Term-link traversal
   - Structural decomposition
   - Goal-driven selection
3. **Derive** — Apply NAL inference rules (deduction, abduction, induction, comparison, revision) + LM rules
   - Each rule produces 0-N derived tasks
   - Derived tasks inherit stamp (provenance chain) from premises
   - Depth-limited (maxDerivationDepth) to prevent explosion
   - Circular detection via recent stamp set
4. **Add Results** — Derived tasks go to memory; boost priority of winners
5. **Consolidation** — Every N cycles: decay all priorities, evict low-priority concepts, archive candidates

### 4. LM Bridge

The LM is a **collaborative reasoning layer**, not an external oracle. It operates through two mechanisms:

#### A. LM Inference Rules (13 rules)

Registered alongside NAL rules in the processor. Each rule has:
- `activationCondition(primary, secondary, context) → boolean`
- `promptTemplate` with `{{primaryTerm}}`, `{{secondaryTerm}}` placeholders
- `responseProcessor` to parse Narsese from LM output
- `taskGenerator` to convert parsed output to tasks

Rules fire based on **priority gating** (not time cooldowns):
```
concept.priority >= 0.7 → may fire (check fire count)
concept.priority >= 0.8 → may fire (up to 3 times/cycle)
concept.priority >= 0.9 → always fires
```

Circuit breaker: 5 consecutive failures → skip for 60s.

#### B. Bidirectional Feedback Loop

- **Hypothesis generation**: LM suggests new beliefs from concept clusters
- **Validation**: NARS runs inference to confirm/deny LM suggestions
- **Enrichment**: Background cycle elaborates underconnected concepts

### 5. Strategy Adapters

Every decision point in the cognitive loop uses a pluggable strategy from the registry:

| Decision | Strategies |
|---|---|
| **Sampling** (which concepts to process) | `PrioritySampling`, `TopNSampling`, `AboveThresholdSampling`, `NoveltySampling`, `GoalBiasedSampling`, `DiverseSampling` |
| **Premise Selection** (which secondary task) | `BagStrategy`, `PrologStrategy`, `ResolutionStrategy`, `GoalDrivenStrategy`, `AnalogicalStrategy`, `TermLinkStrategy`, `TaskMatchStrategy`, `DecompositionStrategy`, `CompositeStrategy`, `AdaptiveStrategy` |
| **Derivation** (how to combine premises) | `DefaultDerivation` (all rules), `FocusedDerivation` (only high-priority rules), `SampledDerivation` (random subset), `AnytimeDerivation` (progressive) |
| **LM Rule Selection** (which LM rules fire) | `AllSelector`, `PrioritySelector`, `RotationSelector`, `DiverseSelector` |
| **Attention Model** (priority dynamics) | `SimpleAttention`, `SpreadingActivation`, `GoalRelevanceAttention`, `CompositeAttention` |

---

## Agent Capabilities

### Degradation Modes

The system detects runtime capability and adapts automatically:

| Mode | LM | NARS | Behavior |
|---|---|---|---|
| `full` | ✓ | ✓ | Neurosymbolic synergy |
| `lm-only` | ✓ | ✗ | Chatbot with tools |
| `nars-only` | ✗ | ✓ | Narsese REPL |
| `degraded` | ✗ | ✗ | Static fallback responses |

Transitions are event-driven: if the LM client fails N times, the `DegradationManager` emits a status change,
and the cognitive loop adjusts strategy selection accordingly.

### Self-Analysis & Metacognition

The `SelfAnalysisManager` runs periodically (default every 10 turns) and produces:

- **Success rate tracking**: `successCount / (successCount + failureCount)`
- **Knowledge gap detection**: low-confidence beliefs, missing concept connections
- **Coverage analysis**: concept utilization vs capacity
- **Failure pattern recognition**: repeated errors → adjust strategy weights
- **RLFP-based optimization**: preference learning adjusts cognitive parameters over time

### Background Cognition

The `AutonomousScheduler` runs idle-time cognitive cycles:

- **Activity-aware**: Skips if user input was recent (< sleepIntervalMs)
- **Proportional effort**: `effortLevel` (0-1) scales reasoning intensity
- **Configurable wake interval**: default 60s between background cycles
- **Supports enrichment**: runs LM concept elaboration during idle

### Connection Model

All inputs share the same unified entry point:

```typescript
class Agent {
  async processMessage(msg: IOMessage, ctx: ChannelContext): Promise<ChannelResponse>
}
```

Connection adapters (CLI, IRC, WS, HTTP, MCP) each implement a thin bridge that calls `processMessage` and
routes the response back through their transport. No connection has its own processing logic.

---

## System Configuration

### Cognitive Parameters (tunable hyperparameters)

All parameters live in `cognitive-parameters.ts` organized by subsystem:

**Priority** (`priority: PriorityConfig`):
- `initialPriority`, `threshold`, `maxPriority`
- `directMentionBoost`, `relatedConceptBoost`
- `decayRate`, `propagationStrength`
- `lmActivationThreshold` (minimum priority for LM rule firing)

**LM Integration** (`lm: LMConfig`):
- `enabled`, `singlePremiseEnabled`, `maxRulesPerCycle`
- `callTimeoutMs`, `selectionStrategy`
- Per-category toggles: `translation`, `explanation`, `metaReasoning`, etc.

**Attention** (`attention: AttentionConfig`):
- `autoPrime`, `primeBoost`, `relatedBoost`
- `structuralSimilarity`, `semanticRelatedness`
- `propagateActivation`, `propagationIterations`

**Inference** (`inference: InferenceConfig`):
- `maxDerivationsPerStep`, `maxDerivationDepth`
- `premiseQualityThreshold`, `enableCircularDetection`
- `cpuThrottleMs`, `maxSampledConcepts`

**Strategies** (`strategies`):
- `sampling.type`, `premise.type`, `derivation.type`
- `lmRule.type` + `maxRules`, `attention.type`

All parameters are validatable and mergeable with defaults. The parameter space is defined for optimization
(min/max/default) to support RLFP-based tuning.

### Preset Configurations

| Profile | Description |
|---|---|
| `DEFAULT_COGNITIVE_PARAMETERS` | Balanced general use |
| `FAST_COGNITIVE_CONFIG` | LM disabled, focused derivation, high activation threshold |
| `LM_HEAVY_CONFIG` | Low activation threshold, all rules enabled |
| `RESEARCH_COGNITIVE_CONFIG` | Trace collection enabled, reduced derivations for analysis |

---

## Type Safety Philosophy

The codebase treats TypeScript as a reasoning layer, not just a safety net:

- **Phantom types** track derivation depth at compile time
- **Discriminated unions** enforce exhaustive rule pattern matching
- **Required fields** (`Task.stamp`, `Task.truth`) crash early if missing — no silent fabrication
- **System boundary comments** mark the few legitimate `as any` sites (parser input, LM provider SDKs)
- **Result<T>** type annotates fallible operations with explicit success/failure

The key rule: **If a Task enters inference without a stamp or truth, something upstream is broken — crash, don't
fabricate.**

---

## Key Files

| File | Purpose |
|---|---|
| `src/nar/nar.ts` | Core NAR engine — composes memory, reasoner, IO, LM, cognitive controller |
| `src/nar/nar-execution.ts` | Cognitive cycle — task processing, inference, consolidation |
| `src/nar/nar-io.ts` | Input parsing, attention priming, serialization |
| `src/nar/nar-lm.ts` | LM integration — feedback loop, enrichment, streaming |
| `src/nar/cognitive/controller.ts` | Strategy orchestration and runtime adaptation |
| `src/nar/cognitive/registry.ts` | Strategy registry with initializeDefaults |
| `src/nar/cognitive/types.ts` | Strategy interfaces: SamplingStrategy, DerivationStrategy, etc. |
| `src/nar/cognitive/attention-models.ts` | Priority dynamics: Simple, Spreading, GoalRelevance, Composite |
| `src/nar/cognitive/sampling-strategies.ts` | Concept sampling: Priority, TopN, Novelty, GoalBiased, Diverse |
| `src/nar/cognitive/derivation-strategies.ts` | Derivation control: Default, Focused, Sampled, Anytime |
| `src/nar/cognitive/lm-selectors.ts` | LM rule selection: All, Priority, Rotation, Diverse |
| `src/nar/config/cognitive-parameters.ts` | All tunable parameters with defaults + validation |
| `src/nar/types/core.ts` | Core types: Task, Budget, Stamp, Truth, Error hierarchy |
| `src/nar/memory/memory.ts` | Three-tier memory: concepts, focus, archive, links, consolidation |
| `src/nar/reason/reasoner.ts` | Reasoner delegating to InferenceController |
| `src/nar/rules/processor.ts` | Rule processor: NAL rules + LM rules |
| `src/nar/lm/LMRule.ts` | LM rule with circuit breaker, prompt templating, response parsing |
| `src/nar/lm/lm-rule-factory.ts` | 13 LM rule definitions with factory and dynamic rule generator |
| `src/nar/factory.ts` | NAR factory: createDefault, createMinimal, createCognitiveDefault, etc. |
| `src/agent/AIAgent.ts` | Agent combining NARS + LM via AI SDK |
| `src/agent/DegradationManager.ts` | Runtime capability detection and mode switching |
| `src/agent/SelfAnalysisManager.ts` | Performance tracking, gap detection, improvement proposals |
| `src/agent/AutonomousScheduler.ts` | Background idle-time reasoning scheduler |
| `src/agent/ConversationState.ts` | Per-conversation state: history, summary, artifacts, working memory |

---

## What This Is Not

This is **not** a strict implementation of NARS (Non-Axiomatic Reasoning System) as defined by Pei Wang. NARS is a
specific theory with specific algorithms. This system is **NARS-inspired**: it borrows the core ideas (AIKR,
truth-value semantics, priority-based resource allocation, experience grounding, term-oriented memory) but adapts
them freely to the engineering constraints of a TypeScript-based agentic system integrated with modern LMs.

Key deviations from canonical NARS:

| NARS Canonical | SeNARS12 |
|---|---|
| Bag-based memory with probabilistic selection | Priority-sorted arrays with strategy-based selection |
| Fixed NAL rule set (1-9) | Extensible rule set with DSL-based definitions + LM rules |
| No LM integration | LM as collaborative reasoning layer (13 rules + feedback loop) |
| Procedural inference | Pluggable strategy architecture |
| Event-driven input only | Reactive + background (scheduler) |
| No persistent state | Three-tier memory (working/conceptual/episodic) |
| No type system | Phantom types for derivation depth at compile time |

---

## Getting Started

```bash
# Quick start
pnpm install
pnpm run dev

# Run tests
pnpm run test
pnpm run test:unit

# Type check
pnpm run typecheck
```

### Factory Quick Reference

```typescript
// Full cognitive NAR (default, balanced)
const nar = SeNARSFactory.createCognitiveDefault();

// Fast inference (no LM)
const nar = SeNARSFactory.createCognitiveFast();

// Research mode (all tracing)
const nar = SeNARSFactory.createCognitiveResearch();

// Minimal (testing)
const nar = SeNARSFactory.createMinimal();
```
