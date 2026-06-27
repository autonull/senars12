# SeNARS Design Document

> **Semantic Non-Axiomatic Reasoning System** — A cognitive kernel fusing fluid LLM creativity with rigorous symbolic logic.

---

## 1. Vision & Purpose

SeNARS is a **general-purpose cognitive architecture** for building AI systems that think like humans: fluidly, adaptively, and resourcefully, while maintaining mathematical rigor. It is not a chatbot wrapper—it is a **cognitive kernel** that can be embedded in agents, services, and autonomous systems requiring explainable, auditable reasoning under uncertainty.

**Core thesis:** Intelligence emerges from the *synergistic integration* of two complementary processing modes:
- **System 1 (Neural/Intuitive):** Fast, parallel, context-aware, creative — powered by LLMs
- **System 2 (Symbolic/Analytical):** Slow, systematic, explainable, rigorous — powered by NAL (Non-Axiomatic Logic)

SeNARS implements this dual-process architecture *natively*, not as a post-hoc orchestration layer. The symbolic reasoner *controls* the neural services, invoking them precisely when logical reasoning reaches its boundaries (gaps, contradictions, creative needs).

---

## 2. High-Level Architecture (Implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│                        SeNARS CORE                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   MEMORY     │  │  REASONER    │  │   CYCLE      │          │
│  │  (Hypergraph)│  │  (NAL Rules) │  │  (Orchestr.) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 NEURO-SYMBOLIC BRIDGE                     │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │  │
│  │  │Proactive    │ │Bidirectional│ │ LMRule      │ ...     │  │
│  │  │Enricher     │ │FeedbackLoop │ │ Services    │         │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  META-COG   │    │  TOOLS/     │    │  AGENT I/O  │        │
│  │  (Self-     │    │  ACTIONS    │    │  (IRC,WS,   │        │
│  │   Monitor)  │    │             │    │   HTTP,MCP) │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Component Overview (Implementation Status)

| Component | Status | Key Files |
|-----------|--------|-----------|
| **Memory** | ✅ Implemented | `src/nar/memory/` — dual-store hypergraph, focus/archive, priority bags, LinkManager, forgetting, consolidation |
| **Reasoner** | ✅ Implemented | `src/nar/reason/`, `src/nar/rules/` — 50+ NAL rules via DSL, derivation depth tracking, CPU throttling |
| **Cycle** | ✅ Implemented | `src/nar/nar-execution.ts` — 7-phase AIKR-compliant loop |
| **LM Bridge** | ✅ Implemented | `src/nar/lm/`, `src/nar/nar-lm.ts` — ProactiveEnricher, BidirectionalFeedbackLoop, LMRule services |
| **Meta-Cognition** | ✅ Framework | `src/nar/cognitive/`, `src/nar/self/` — CognitiveController, ReasoningAboutReasoning, contradiction detection |
| **RLFP** | ✅ Skeleton | `src/nar/rlfp/` — RewardModel, PolicyOptimizer, PreferenceCollector, ReasoningTrajectoryLogger |
| **Planner** | ❌ Not implemented | See §13.2 |
| **Agent Layer** | ✅ Implemented | `src/agent/` — multi-transport (IRC, WS, HTTP, MCP, CLI), autonomy, tools, sessions |

---

## 3. Foundational Concepts (Implemented)

### 3.1 The Three Pillars

| Pillar | Type | Description |
|--------|------|-------------|
| **Term** | Immutable | Concept representation: `(cat --> animal)`, `(&, furry, pet)`, `(see_lightning =/> hear_thunder)` |
| **Task** | Stateful | Unit of cognitive work: belief, goal, or question with truth value, priority, budget, stamp |
| **Memory** | Hypergraph | Central knowledge store: concepts linked by semantic/term/similarity edges, with bags of tasks |

**Key insight:** Terms are *values* (immutable, structural sharing via memoization). Tasks are *events* (stateful, prioritized, decaying). This separation enables compile-time guarantees on term structure while allowing dynamic cognitive dynamics.

### 3.2 Narsese: The Language of Cognition (Implemented Grammar)

| Category | Syntax | Example | Purpose |
|----------|--------|---------|---------|
| Inheritance | `(S --> P)` | `(cat --> mammal)` | Taxonomic "is-a" |
| Implication | `(P ==> Q)` | `(raining ==> wet)` | Conditional/causal |
| Predictive | `(P =/> Q)` | `(lightning =/> thunder)` | Temporal prediction |
| Retrospective | `(Q =\\> P)` | `(wet =\\> rained)` | Diagnostic reasoning |
| Concurrent | `(P <=> Q)` | `(lightning <=> thunder)` | Simultaneous events |
| Conjunction | `(&, A, B)` | `(&, cat, furry)` | Logical AND |
| Disjunction | `(\\|, A, B)` | `(\\|, cat, dog)` | Logical OR |
| Negation | `(--, T)` | `(--, (cat --> bird))` | Contradiction |
| Instance | `(x {-- C)` | `(fluffy {-- cat)` | Specific instance |
| Property | `(O --} P)` | `(cat --} furry)` | Attribute |
| Operation | `(&/, act, cond)` | `(&/, clean, dirty)` | Conditional action |

**Advanced features implemented:** Nested expressions, higher-order relations, variable binding, truth values (frequency + confidence), temporal intervals.

---

## 4. Neuro-Symbolic Integration (Implemented)

### 4.1 Architecture Principle: *Symbolic Control, Neural Service*

The symbolic reasoner **maintains control**. It detects gaps (unanswerable questions, failed plans, contradictions) and *selectively invokes* neural services with precise context. Neural outputs are validated, traced, and integrated into the symbolic knowledge base—not treated as opaque completions.

### 4.2 Implemented Neural Services

| Service | Class | Role | Trigger |
|---------|-------|------|---------|
| **ProactiveEnricher** | `ProactiveEnricher` | Discovers latent connections in knowledge graph | Periodic consolidation, underconnected concepts |
| **BidirectionalFeedbackLoop** | `BidirectionalFeedbackLoop` | Validates hypotheses, explains contradictions, extracts patterns | New hypotheses, detected contradictions, derivation chains |
| **LMRule Services** | `LMRule` subclasses | Domain-specific LM calls as inference rules | Rule processor matches premise patterns |

### 4.3 Bidirectional Feedback Loop (Implemented)

1. **Symbolic → Neural:** Reasoner sends structured context (premises, goal, constraints)
2. **Neural → Symbolic:** LM returns structured output (hypotheses, revisions, explanations)
3. **Validation:** Symbolic layer checks logical consistency, truth revision, contradiction
4. **Integration:** Accepted insights become Tasks with stamps tracing neural origin
5. **Learning:** RLFP framework exists for tuning service selection (skeleton)

---

## 5. Cognitive Cycle: How SeNARS "Thinks" (Implemented)

The system operates in discrete, interruptible cycles (AIKR-compliant: **Assumption of Insufficient Knowledge Resources**):

```
┌────────────────────────────────────────────────────────────────┐
│                    COGNITIVE CYCLE                              │
├──────────────────┬─────────────────────────────────────────────┤
│ 1. PERCEPTION    │ Ingest input → Tasks via TaskFactory        │
│    & INGESTION   │ (belief/goal/question/command)              │
├──────────────────┼─────────────────────────────────────────────┤
│ 2. PRIORITIZATION│ Economic attention: recalculate all Task    │
│                  │ priorities (truth, goal-relevance, urgency, │
│                  │ novelty, connectivity, resource cost)       │
├──────────────────┼─────────────────────────────────────────────┤
│ 3. META-COGNITION│ Scan for contradictions, reasoning failures,│
│                  │ knowledge gaps → generate repair goals      │
├──────────────────┼─────────────────────────────────────────────┤
│ 4. SYMBOLIC      │ Apply NAL inference rules to focus set      │
│    REASONING     │ (non-overlapping, CPU-throttled, anytime)   │
├──────────────────┼─────────────────────────────────────────────┤
│ 5. NEURAL        │ Invoke LM services for gaps, enrichment,    │
│    ENRICHMENT    │ explanation, pattern extraction             │
├──────────────────┼─────────────────────────────────────────────┤
│ 6. LEARNING &    │ Belief revision, consolidation, forgetting, │
│    INTEGRATION   │ RLFP policy update, drive decay             │
└──────────────────┴─────────────────────────────────────────────┘
```

**Key properties (enforced):**
- **Anytime:** Interruptible at any phase; partial results always valid
- **Interruptible:** Cooperative yielding to event loop (CPU throttling via `cpuThrottleMs`)
- **Resource-bounded:** Bag capacities, derivation depth (`maxDerivationDepth`), CPU limits enforced by types

---

## 6. Memory Architecture: Dual-Store Hypergraph (Implemented)

```
┌────────────────────────────────────────────────────────────┐
│                       MEMORY                                │
├────────────────────────────────────────────────────────────┤
│  FOCUS (Working Memory)          │  ARCHIVE (Long-term)     │
│  ─────────────────────           │  ─────────────────────   │
│  • Top-N concepts by priority    │  • Evicted concepts      │
│  • Active task bags              │  • Compressed representation│
│  • Fast retrieval (O(1) index)   │  • Retrievable on demand │
│  • Capacity: ~50 concepts        │  • Capacity: ~1000       │
└──────────────────────────────────┴──────────────────────────┘
```

### Implemented Features

| Feature | Implementation |
|---------|----------------|
| **Priority-based retrieval** | `Bag` with priority-ordered heap; sampling strategies (priority/recency/novelty/composite) |
| **Semantic links** | `LinkManager` with typed layers (term/semantic), decay, capacity limits |
| **Intelligent forgetting** | Configurable policies (FIFO, priority, LRU); scorer combines priority, age, connectivity |
| **Consolidation** | Periodic: decay, archive low-priority, LM-assisted abstraction (creates category concepts) |
| **Pressure detection** | Monitors utilization; triggers compaction/forgetting at 80%/90% thresholds |
| **Serialization** | Full state export/import (beliefs, goals, questions, drives, LM rules) |

---

## 7. Reasoning Engine: NAL Inference Rules (Implemented)

SeNARS implements **50+ formal inference rules** organized in a DSL (`rules-dsl.ts`), registered at startup with metadata (priority, truth function, pattern).

### Rule Categories (Implemented)

| Class | Key Rules | Purpose |
|-------|-----------|---------|
| **Deduction** | `deduction`, `modusPonens`, `modusTollens`, `higherOrderDeduction` | Derive specifics from generals |
| **Induction** | `induction`, `temporalInduction`, `propertyInduction` | Generalize from examples |
| **Abduction** | `abduction`, `causalAbduction`, `higherOrderAbduction` | Generate explanations |
| **Analogy** | `analogy`, `instantiation`, `exemplification`, `comparison` | Cross-domain transfer |
| **Temporal** | `sequenceIntro`, `parallelIntro`, `predictiveImplication`, `temporalDeduction` | Time/causality reasoning |
| **Structural** | `intersection`, `union`, `decompose`, `conjunctionIntro` | Set/composite operations |
| **Negation** | `negationIntro`, `negationElim`, `contraposition`, `contrapositive` | Contradiction handling |
| **Meta-cognitive** | `strategyEffectiveness`, `resourceAllocation`, `errorPatternDetection`, `metacognitiveRevision` | Self-monitoring |

### Truth Value System (Implemented)

Every derived Task carries a **Truth** `{ frequency: [0,1], confidence: [0,1] }`:
- **Frequency** = positive evidence / total evidence
- **Confidence** = evidence / (evidence + k) — saturates with more evidence
- **Revision** combines multiple sources: `f = (f1*c1 + f2*c2)/(c1+c2)`, `c = (c1+c2)/(c1+c2+k)`

This enables **uncertainty propagation** through multi-step inference chains.

### Derivation Control (Implemented)

| Mechanism | Implementation |
|-----------|----------------|
| **CPU throttling** | `cpuThrottleMs` yields to event loop per N derivations |
| **Focus set** | Reasoner samples from focus concepts (priority-weighted) |
| **Circular detection** | Stamp-based loop detection prevents infinite derivation |
| **Trace collection** | Optional full derivation trees for explanation/debugging |

---

## 8. Meta-Cognition & Self-Improvement (Framework Implemented)

### 8.1 Contradiction Detection & Resolution (Framework)

| Detection Layer | Resolution Strategy (Pluggable) |
|-----------------|--------------------------------|
| Logical (direct negation) | Bayesian revision, priority-based |
| Temporal (conflicting predictions) | Temporal analysis, evidence gathering |
| Causal (conflicting mechanisms) | Causal analysis, root-cause ID |
| Contextual (context-dependent) | Contextual reconciliation |
| Probabilistic | Consensus integration, learning-based |

### 8.2 Self-Monitoring (`ReasoningAboutReasoning` — Implemented)

- **Quality assessment** every N cycles (coherence, consistency, goal progress)
- **Self-correction** when quality < threshold: triggers contradiction resolution, strategy switch
- **Strategy adaptation** via `CognitiveController` + RLFP: learns optimal sampling/derivation/LM-selector configs

### 8.3 RLFP: Reinforcement Learning from Proof Feedback (Skeleton)

```
Reasoning Trajectory → Reward Model → Policy Optimizer → Strategy Selection
       │                    │                │                  │
       ▼                    ▼                ▼                  ▼
   (steps,stamp,depth, (validity,       (PPO on            (sampling,
    contradictions,     novelty,         trajectory         derivation,
    goal achievement)    efficiency)      space)            LM selector)
```

Learns *which cognitive strategies work* for which problem types—meta-learning at the architecture level. Core classes exist (`RLFPLearner`, `RewardModel`, `PolicyOptimizer`, `PreferenceCollector`, `ReasoningTrajectoryLogger`) but integration is minimal.

---

## 9. Agent Layer: Multi-Transport Cognitive Interface (Implemented)

The `agent` package wraps the NAR core for deployment:

| Capability | Implementation |
|------------|----------------|
| **Transports** | IRC, WebSocket, HTTP/REST, MCP, CLI (pluggable via `ConnectionManager`) |
| **Session management** | Conversation history, context building, truncation (`ConversationSession`, `SessionManager`) |
| **Autonomy** | `AutonomousLoop`: perceive → reason → act → reflect (configurable drives) |
| **Tools** | External tool calling with approval, streaming, error boundaries (`ToolManager`, adapters) |
| **Authentication** | JWT, API keys, rate limiting |
| **Observability** | Structured logging, metrics, event bus, tracing |

**Bot mode** (`pnpm bot`): Single NAR instance driven by IRC + WebSocket + optional HTTP, enabling multi-user interaction and bot-to-bot communication.

---

## 10. TypeScript as a Reasoning Layer (Implemented)

SeNARS leverages **TypeScript's type system** to enforce NAL semantics *at compile time*:

| Technique | Application |
|-----------|-------------|
| **Discriminated unions** | `Term.kind` — exhaustive pattern matching on term structure |
| **Structural sharing** | `TermMap`/`TermSet` with memoization factory — canonical terms |
| **Stable hashes** | Structural hash = identity — O(1) equality, deduplication |
| **Branded primitives** | `Timestamp`, `Duration`, `Hash` — prevent unit confusion |
| **Const assertions** | `DEFAULT_CONFIG` — immutable configuration |

**Result:** Entire classes of bugs (invalid term construction, depth overflow, circular rules) become *type errors*. IDE IntelliSense becomes a reasoning assistant.

---

## 11. Technical Justifications

### Why NAL (Non-Axiomatic Logic)?
- **AIKR-native:** Designed for insufficient knowledge/resources — matches real-world constraints
- **Uncertainty-first:** Truth values (frequency + confidence) are *primitive*, not bolted on
- **Unified representation:** Beliefs, goals, questions, commands = same `Task` structure
- **Temporal primitives:** Prediction, retrospection, concurrency built into grammar
- **Meta-reasoning:** NAL rules can reason *about* reasoning (self-monitoring)

### Why TypeScript?
- **Compile-time reasoning layer** (see §10)
- **Ecosystem:** Excellent tooling, AI SDK integration, WASM/Edge deployment
- **Gradual typing:** Can prototype dynamically, harden incrementally
- **Self-hosting:** The cognitive kernel can reason *about* TypeScript code
- **Vibe-Coding:** Amenable to vibe coding: popularity, avoids compile step for rapid development

### Why Dual-Store Memory?
- **Cognitive plausibility:** Matches working/long-term memory distinction
- **Performance:** Focus set = O(1) access for reasoning; archive = unbounded knowledge
- **Forgetting as feature:** Prevents combinatorial explosion, enables lifelong learning

### Why RLFP?
- **Reward from proof traces** — no external reward function needed
- **Sample efficient:** Learns from *every* reasoning cycle, not just episodes
- **Interpretable:** Policy = strategy selection, not neural weights

---

## 12. Configuration & Extensibility (Implemented)

### 12.1 Core Configuration (`NARConfig`)

```typescript
interface NARConfig {
  // Memory
  maxConcepts: 1000;
  activationDecayRate: 0.01;
  consolidationInterval: 10;
  
  // Reasoning
  maxDerivationDepth: 10;
  maxDerivationsPerStep: 1000;
  cpuThrottleMs: 10;
  
  // Neuro-symbolic
  lmService?: LMService;
  enableLMRules: true;
  enableBidirectionalFeedback: true;
  enableProactiveEnrichment: true;
  
  // Meta-cognition
  enableSelf: true;
  enableRLFP: false;
  
  // Persistence
  persistState: false;
  statePath: '.cache/nar-state';
}
```

### 12.2 Cognitive Parameters (Runtime-Adaptable via `CognitiveController`)

```typescript
interface CognitiveParameters {
  strategies: {
    sampling: { type: 'priority' | 'novelty' | 'goal-biased' | 'diverse' | 'composite' };
    premise: { type: 'bag' | 'prolog' | 'resolution' | 'goal-driven' | 'analogical' };
    derivation: { type: 'default' | 'anytime' | 'focused' | 'sampled' };
    lmRule: { type: 'all' | 'priority' | 'rotation' | 'diverse'; maxRules: 3 };
  };
  inference: { maxDerivationsPerStep, maxDerivationDepth, cpuThrottleMs, ... };
  lm: { enabled, singlePremiseEnabled, ... };
}
```

### 12.3 Extension Points (Implemented Interfaces)

| Extension Point | Interface | Example |
|-----------------|-----------|---------|
| **Custom Rules** | `RuleFn`, `RulePattern` | Domain-specific inference |
| **LM Services** | `LMService`, `LMRule` | Specialized providers, fine-tuned models |
| **Attention Models** | `AttentionModel` | Domain-specific salience |
| **Tools** | `Tool` schema + handler | External API integrations |
| **Drives** | `DriveSpec` | Custom intrinsic motivations |
| **Forgetting Policies** | `ForgettingPolicy` | Domain-specific retention |


---

## 13. Development Philosophy (Implemented)

| Principle | Practice |
|-----------|----------|
| **Elegant** | Clean, readable code; minimize ceremony |
| **Consolidated** | Single source of truth; DRY via DSL (rules, strategies) |
| **Consistent** | Naming, patterns, error handling across packages |
| **Organized** | Feature-based structure; clear public APIs |
| **Abstract** | Interfaces over implementations; strategy pattern throughout |
| **Modularized** | Independent packages (nar, agent, io, config) |
| **Parameterized** | Config over hardcoding; runtime adaptation |
| **Type-First** | Types as documentation; compile-time guarantees |
| **Test-Real** | Avoid mocks; test objects directly; integration smoke tests |

---

## 14. Summary: What Makes SeNARS Unique (Current Implementation)

| Differentiator | Status |
|----------------|--------|
| **Parser-less symbolic foundation** | ✅ Narsese terms are typed values, not strings — structure guaranteed by TS |
| **AIKR by construction** | ✅ Resource bounds in types, not runtime checks |
| **Symbolic-controlled neural** | ✅ LM as *service*, not *brain* — creativity with guardrails |
| **Meta-cognitive loop** | ✅ Self-monitoring, contradiction resolution, strategy learning framework |
| **Unified belief/goal/question** | ✅ Single `Task` type with punctuation — seamless reasoning/planning |
| **Temporal reasoning primitives** | ✅ Prediction, diagnosis, concurrency in core grammar |
| **Explainable by default** | ✅ Full derivation traces, natural language explanations (via LM) |
| **Constitutional core** | 🟡 Immutable safety/motive layer (`setConstitution` — minimal) |
| **Pluggable at every layer** | ✅ Memory, reasoner, attention, LM, tools — all swappable |

---

## 15. Getting Started

```bash
# Install
pnpm install

# Development (watch mode)
pnpm run dev

# Run tests
pnpm run test

# Type check
pnpm run typecheck

# Start bot (IRC + WebSocket)
cp .env.example .env  # configure LM provider
pnpm bot
```

**Core API:**
```typescript
import { createNAR } from 'senars12';

const nar = await createNAR({ 
  lmService: createLMService(),
  enableLMRules: true,
  enableSelf: true 
});

await nar.believe('(cat --> animal)');
await nar.believe('(animal --> living)');
await nar.question('(cat --> living)?');
await nar.run(10);

const answer = nar.ask('(cat --> living)');
console.log(answer); // { truth: { f: 1.0, c: 0.9 }, derivation: [...] }
```
