# SeNARS TODO5: Total Architecture & Functionality

> **"Every line of code should either produce intelligence or enable it. No dead infrastructure."**
>
> **Design Principle**: Elegant abstractions that compose. Redesign freely — no backwards compatibility needed.
>
> **Truth Principle**: Derived beliefs must carry computed truth values, not NEUTRAL. If we can't compute truth, we can't reason.

---

## Retrospective

### What senars12 Got Right
- ✅ TypeScript strict mode, zero errors
- ✅ Clean 4-layer separation (Config → Factory → NAR → Apps)
- ✅ Discriminated union terms with structural hashing
- ✅ 18 NAL rules with pattern-matched indexing
- ✅ LM integration with circuit breakers
- ✅ 92 tests passing
- ✅ Memory system with bounded bags, forgetting, consolidation

### Critical Bugs Found (Must Fix First)

| # | Bug | Location | Impact | Severity |
|---|-----|----------|--------|----------|
| 1 | **Rule results always `Truth.NEUTRAL`** — truth computation never wired into rule application pipeline | `nar.ts:70-85`, `processor.ts:48-53` | All derived beliefs have identical truth regardless of premise quality | 🔴 Critical |
| 2 | **LM rule results are fire-and-forget** — emitted via EventBus but nothing listens; LM-derived beliefs are lost | `processor.ts:89-105` | LM reasoning produces no memory effects | 🔴 Critical |
| 3 | **Derived terms have `hash: 0`** — breaks hash-based identity, lookups, deduplication | `nal.ts`, `nal-extended.ts` | Memory corruption, duplicate concepts | 🔴 Critical |
| 4 | **Hash sorts arg hashes** — makes `(A --> B)` and `(B --> A)` collide for non-commutative operators | `hash.ts:24` | Incorrect term equality, false matches | 🔴 Critical |
| 5 | **`ConfigLoader.findConfigFile()` doesn't await `fs.access`** — always returns first path | `loader.ts:180` | Config loading silently broken | 🟡 High |
| 6 | **`structuralGC` object identity bug** — `Set.delete({ref, meta})` creates new object, never matches | `gc.ts:37,71` | GC never removes dead terms | 🟡 High |
| 7 | **`Archive.unarchive()` == `retrieve()`** — doesn't remove from archive | `archive.ts:58-60` | Archive grows unbounded | 🟡 High |
| 8 | **`MemoryConsolidation.consolidate()` is stub** — only increments counter | `consolidation.ts:44` | No real consolidation | 🟡 High |
| 9 | **`SelfAnalyzer` methods are stubs** — return empty data | `SelfAnalyzer.ts:97-115` | Metacognition non-functional | 🟡 High |
| 10 | **`ReasoningAboutReasoning` starts `setInterval` in constructor** — runs even when NAR stopped | `ReasoningAboutReasoning.ts:34` | Resource leak, spurious activity | 🟡 High |
| 11 | **13 of 19 extended NAL rules defined but never registered** | `nal-extended.ts:191-237` | Missing inference power | 🟡 High |
| 12 | **`TaskManager` unused** — `processPending()` never called, tasks added directly to memory | `manager.ts`, `nar.ts:145-150` | Dead code, bypassed scheduling | 🟢 Medium |
| 13 | **`MemoryIndex`, `Focus`, `Archive`, `MemoryScorer` are dead code** — exported but never integrated into `Memory` | Multiple | Dead infrastructure | 🟢 Medium |
| 14 | **Duplicate `TaskType` definitions** — `'belief' | 'goal' | 'question' | 'command'` vs `'BELIEF' | 'GOAL' | 'QUESTION' | 'QUEST'` | `types/core.ts:29`, `terms/task.ts:3` | Type confusion | 🟢 Medium |
| 15 | **`EventBus.off()` reference equality** — can't unsubscribe anonymous functions | `events.ts:33` | Memory leak potential | 🟢 Medium |
| 16 | **`VercelLMClient` ignores `provider: 'openai'`** — always Anthropic | `vercel-client.ts:17` | Config option non-functional | 🟢 Medium |

---

## Architecture Vision

```
┌──────────────────────────────────────────────────────────────────┐
│                        Applications                               │
│   CLI REPL  │  IRC Bot  │  WebSocket Server  │  HTTP API  │  SDK  │
├──────────────────────────────────────────────────────────────────┤
│                        Agent Layer                                │
│   Embodiments  │  Commands  │  Tools  │  Input Processor          │
├──────────────────────────────────────────────────────────────────┤
│                        NAR Engine                                 │
│                                                                  │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────────┐     │
│  │ Premise    │    │ Rule         │    │ LM               │     │
│  │ Source     │───▶│ Processor    │◀───│ Rules            │     │
│  │ (stream)   │    │ (sync+async) │    │ (async, parsed)  │     │
│  └─────┬──────┘    └──────┬───────┘    └────────┬─────────┘     │
│        │                  │                      │               │
│  ┌─────▼──────────────────▼──────────────────────▼──────────┐   │
│  │                  Strategy Layer                           │   │
│  │  Bag │ GoalDriven │ Analogical │ Resolution │ Composite  │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐   │
│  │                  Memory System                            │   │
│  │  Concepts(beliefs│goals│questions) │ Focus │ Archive     │   │
│  │  TermLayer(associative) │ Index │ Consolidation │ GC     │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                    Immutable Data Foundation                     │
│   Term(frozen) │ Truth(frozen) │ Stamp(frozen) │ Task(frozen)   │
├──────────────────────────────────────────────────────────────────┤
│                    Infrastructure                                │
│   EventBus │ Logger │ CircuitBreaker │ Metrics │ Config │ DI    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phases

### Phase 0: Critical Bug Fixes — Correctness First

**Goal**: Fix all 🔴 Critical bugs that make reasoning incorrect. These are not features — they are broken fundamentals.

#### 0.1 Wire Truth Value Computation into Rules
**Problem**: `RuleProcessor` creates `RuleResult` with `Truth.NEUTRAL` for every derivation. The 30+ truth functions in `Truth` namespace are never called.

**Design**:
```typescript
// Each NAL rule declares which truth function it uses
interface NALRule {
  id: string;
  pattern: RulePattern;
  truthFn: (p1: Truth, p2: Truth) => Truth;  // NEW
  apply: (p1: Term, p2: Term) => Term | null;
}

// In processor:
const resultTruth = rule.truthFn(p1.truth, p2.truth);
yield { term: derivedTerm, truth: resultTruth, stamp: derivedStamp };
```

- [ ] Add `truthFn` to each registered NAL rule
- [ ] Wire truth computation in `RuleProcessor.processSync()`
- [ ] Wire truth computation in `RuleProcessor.process()` (async generator)
- [ ] Wire truth computation in `Reasoner.step()` derived task creation
- [ ] Tests: each rule produces correct truth values from known premises

#### 0.2 Wire LM Rule Results into Memory
**Problem**: `processLMRules()` fires `lmRule.apply()` and emits EventBus events, but nothing consumes them.

**Design**:
```typescript
// Option A: Return LM results alongside NAL results
async *process(premises): AsyncGenerator<RuleResult> {
  // ... NAL results
  const lmResults = await Promise.all(lmRules.map(r => r.apply(p1, p2)));
  for (const tasks of lmResults) {
    for (const task of tasks) {
      yield { term: task.term, truth: task.truth, stamp: task.stamp };
    }
  }
}

// Option B: LM results flow through same pipeline as NAL results
// (preferred — single derivation path)
```

- [ ] Refactor `processLMRules()` to yield results, not fire-and-forget
- [ ] Ensure LM-derived tasks flow through same memory addition path as NAL tasks
- [ ] Tests: LM rule output appears in memory after reasoning step

#### 0.3 Fix Term Hash Computation
**Problem**: `computeHash()` sorts arg hashes, causing `(A --> B)` and `(B --> A)` to collide.

**Design**:
```typescript
function computeHash(kind: string, argHashes: number[]): number {
  // For commutative operators (conjunction, disjunction, similarity, equivalence): sort
  // For non-commutative operators (inheritance, implication, negation): preserve order
  const needsSorting = COMMUTATIVE_OPS.has(kind);
  const hashes = needsSorting ? [...argHashes].sort((a, b) => a - b) : argHashes;
  return hashes.reduce(fnv1aCombine, fnv1a(kind));
}
```

- [ ] Add `COMMUTATIVE_OPS` set: `{'similarity', 'conjunction', 'disjunction', 'equivalence'}`
- [ ] Conditional sorting based on operator commutativity
- [ ] Tests: `(A --> B).hash !== (B --> A).hash`, `(A & B).hash === (B & A).hash`

#### 0.4 Fix Derived Term Hashes
**Problem**: All NAL rules create terms with `hash: 0` via `TermBuilder` helpers.

**Design**:
- [ ] Fix `TermBuilder` to compute proper hashes (not `hash: 0`)
- [ ] Or: use `termFactory` (cached factory) instead of inline term creation in rules
- [ ] Tests: all derived terms have non-zero, correct hashes

#### 0.5 Fix Remaining Critical Bugs
- [ ] `ConfigLoader.findConfigFile()` — await `fs.access` properly
- [ ] `structuralGC` — fix object identity in `Set.delete` (use term hash as key)
- [ ] `Archive.unarchive()` — actually remove from archive after retrieval
- [ ] `MemoryConsolidation.consolidate()` — implement real consolidation or remove stub
- [ ] `SelfAnalyzer` — implement or remove stub methods
- [ ] `ReasoningAboutReasoning` — move `setInterval` to `start()`, clear in `stop()`
- [ ] Register all 19 extended NAL rules (or remove unregistered ones)

---

### Phase 1: Data Foundation — Immutability & Type Correctness

**Goal**: Core data structures are immutable, type-safe, and traceable.

#### 1.1 Immutable Core Types
- [ ] `Term` — `Object.freeze()` on creation, all fields `readonly`
- [ ] `Truth` — immutable value object, all operations return new instances
- [ ] `Stamp` — immutable derivation history
- [ ] `Task` — `Object.freeze()` on creation
- [ ] Verify: no mutation paths in hot code paths (audit all `term.* =` assignments)

#### 1.2 BloomStamp for Deep Derivations
- [ ] Implement Bloom filter-based stamp for depth > threshold (configurable, default 6)
- [ ] Automatic switch from `ArrayStamp` to `BloomStamp`
- [ ] Configurable false-positive rate vs memory tradeoff
- [ ] Tests: circularity detection accuracy, memory savings vs ArrayStamp

#### 1.3 Type System Consolidation
- [ ] Single `TaskType` definition: `'belief' | 'goal' | 'question'`
- [ ] Remove duplicate `terms/task.ts`
- [ ] Unify `Task` interface across all modules
- [ ] Fix `RuleFn` type: `(premises: [Task, Task?]) => RuleResult | null`
- [ ] Fix `MetacognitiveMonitor` to use typed NAR reference
- [ ] Fix `BoundedBag.sample` to avoid `(as any)` casts
- [ ] Fix `LMRuleConfigInternal` to use typed function signatures

#### 1.4 Narsese Parser Enhancement
- [ ] Parse LM outputs through `termParser` instead of creating raw atoms
- [ ] Support compound terms in LM responses (inheritance, implication, conjunction)
- [ ] Graceful fallback: if parsing fails, create atomic term with warning event
- [ ] Tests: parse all Narsese forms from LM-generated strings

#### 1.5 Error Hierarchy Consolidation
- [ ] Unified error types: `NARError` → `ParseError | MemoryError | InferenceError | LMError | ConfigError | LifecycleError`
- [ ] Each error carries context: `{term?, rule?, concept?, config?}`
- [ ] Consistent error handling: no empty catches, specific error types, context logging
- [ ] Tests: error propagation, context preservation, recovery paths

---

### Phase 2: Stream Reasoning Pipeline

**Goal**: Replace the simple `run(steps)` loop with an async generator pipeline with adaptive control.

#### 2.1 PremiseSource
```typescript
abstract class PremiseSource {
  abstract stream(signal?: AbortSignal): AsyncIterable<Task>;
}

class MemoryPremiseSource extends PremiseSource {
  constructor(
    private memory: Memory,
    private sampling: SamplingStrategy = 'priority-weighted'
  ) {}

  async *stream(signal?: AbortSignal): AsyncIterable<Task> {
    while (!signal?.aborted) {
      const concepts = this.memory.sample(100);
      for (const concept of concepts) {
        const topBelief = concept.beliefs.peek();
        if (topBelief) yield this.taskFromConcept(concept, topBelief);
      }
      await this.yieldToEventLoop();
    }
  }
}
```
- [ ] `PremiseSource` abstract class with async generator interface
- [ ] `MemoryPremiseSource` — streams from memory bag with configurable sampling
- [ ] `FocusPremiseSource` — streams from focus set (high-attention concepts)
- [ ] `CompositePremiseSource` — multiplexes multiple sources with priority weights
- [ ] Multi-strategy sampling: priority-weighted, recency, novelty, fair roulette
- [ ] Tests: streaming behavior, backpressure, interruption, sampling distribution

#### 2.2 Pipeline Architecture
```typescript
class PipelineRunner {
  async *run(signal?: AbortSignal): AsyncGenerator<Derivation> {
    for await (const premise of this.source.stream(signal)) {
      for (const pair of this.strategy.pair(premise, this.memory)) {
        yield* this.processor.process(pair);
      }
    }
  }
}

class SimpleRunner {
  async step(): Derivation[] {
    const premise = this.source.next();
    const pairs = this.strategy.pair(premise, this.memory);
    return this.processor.processSync(pairs);
  }
}
```
- [ ] `PipelineRunner` — async generator: source → strategy → processor → output
- [ ] `SimpleRunner` — synchronous step for CLI/testing/fallback
- [ ] `AdaptiveController` — monitors throughput, memory, consumer speed; adjusts throttle/backpressure dynamically
- [ ] Keep backward-compatible `NAR.run(steps)` using `SimpleRunner`
- [ ] Tests: pipeline composition, backpressure, cancellation, adaptive behavior

#### 2.3 Backpressure & Resource Management
- [ ] CPU throttle: `cpuThrottleMs` between steps (existing, wire into pipeline)
- [ ] Derivation budget: max derivations per cycle, stop when exceeded
- [ ] Memory pressure: slow down when memory is >80% full, stop at 100%
- [ ] Cooperative yielding: `await setImmediate()` or `setTimeout(0)` between batches
- [ ] Consumer feedback: pause source if derivation queue is full
- [ ] Tests: resource bounds enforced under load, no OOM, no CPU starvation

---

### Phase 3: Strategy Framework

**Goal**: Multiple composable premise-pairing strategies with adaptive selection.

#### 3.1 Strategy Interface
```typescript
interface Strategy {
  readonly name: string;
  pair(premise: Task, memory: Memory): Iterable<[Task, Task?]>;
  stats?: StrategyStats;
}

interface StrategyStats {
  pairsGenerated: number;
  successfulDerivations: number;
  effectiveness: number;  // successfulDerivations / pairsGenerated
}
```
- [ ] Clean interface with optional statistics tracking
- [ ] Strategy registry with runtime switching
- [ ] Per-concept or per-task strategy selection

#### 3.2 Core Strategies
- [ ] `BagStrategy` — priority-sampled from memory bag (refactor existing)
- [ ] `ExhaustiveStrategy` — all pairs with a concept (refactor existing)
- [ ] `TaskMatchStrategy` — finds tasks with syllogistic compatibility (shared middle term)
- [ ] `DecompositionStrategy` — extracts subterms from compound statements for pairing
- [ ] `GoalDrivenStrategy` — backward-chaining from goals to matching beliefs
- [ ] `AnalogicalStrategy` — cross-domain pairing by structural similarity
- [ ] `ResolutionStrategy` — resolution theorem proving (negation elimination)
- [ ] Tests: each strategy produces correct pairings, performance characteristics

#### 3.3 Strategy Composition
- [ ] `CompositeStrategy` — run multiple strategies in sequence or parallel
- [ ] `WeightedStrategy` — probabilistic selection based on weights
- [ ] `AdaptiveStrategy` — adjusts weights based on strategy effectiveness stats
- [ ] Tests: composition behavior, weight distribution, adaptation convergence

---

### Phase 4: NAL Rule Completeness

**Goal**: All NAL rules produce correct conclusions with proper truth values.

#### 4.1 Truth-Value-Aware Rule Registration
```typescript
interface RegisteredNALRule {
  id: string;
  pattern: RulePattern;
  truthFn: (p1: Truth, p2: Truth) => Truth;
  apply: (p1: Term, p2: Term) => Term | null;
  sync: boolean;
  priority: number;
}
```
- [ ] Add `truthFn` to every registered rule
- [ ] Map each rule to its correct NARS truth function
- [ ] Tests: each rule's truth function matches NARS specification

#### 4.2 Register All Defined Rules
- [ ] Register remaining 13 unregistered extended rules:
  - `structuralInheritance`, `structuralReduction`, `intersectionComposition`, `unionComposition`
  - `difference`, `implicationDeduction`, `equivalence`, `variableIntroduction`
  - `decomposition`, `variableDependency`, `sameness`, `revisionWeak`, `exemplification`
- [ ] Remove rules that are stubs or duplicates
- [ ] Tests: all registered rules fire correctly

#### 4.3 Missing NAL Rules
- [ ] `NAL-5`: Intensional inheritance, compound term operators (product, image)
- [ ] `NAL-6`: Variable-based reasoning with unification in pipeline
- [ ] `NAL-7`: Belief desirability and goal-directed reasoning
- [ ] Tests: new rules produce correct conclusions

#### 4.4 Declarative Rule Definitions (Optional Enhancement)
- [ ] Declarative pattern definitions (data, not code) for simple rules
- [ ] Compile to decision tree for efficient matching
- [ ] Pattern-matching engine with unification
- [ ] Fallback to direct rule application for complex rules
- [ ] Tests: compiled rules match hand-coded behavior, performance improvement

---

### Phase 5: Memory System — Integration & Enhancement

**Goal**: Integrate dead code into Memory, add associative linking, proper serialization.

#### 5.1 Integrate Dead Infrastructure
- [ ] Integrate `MemoryIndex` into `Memory` — atomic/temporal/activation indexes
- [ ] Integrate `Focus` into `Memory` — replace ad-hoc `focusConcepts` Set
- [ ] Integrate `Archive` into `Memory` — automatic archival during consolidation
- [ ] Integrate `MemoryScorer` into `Memory` — use for concept selection
- [ ] Integrate `MemoryConsolidation` into `Memory` — real multi-phase consolidation
- [ ] Remove standalone singleton exports; make them internal to Memory
- [ ] Tests: all integrated components work correctly within Memory

#### 5.2 TermLayer (Associative Links)
- [ ] Bag-backed associative link layer between terms
- [ ] Capacity-limited, priority-based
- [ ] Link types: similarity, implication, temporal, causal
- [ ] Auto-create links when rules derive relationships between terms
- [ ] Tests: link creation, decay, retrieval, usage by strategies

#### 5.3 Multi-Phase Consolidation
- [ ] Phase 1: Activation propagation between related concepts (via TermLayer)
- [ ] Phase 2: Enhanced decay (usage, activation, complexity, recency, quality)
- [ ] Phase 3: Forgetting evaluation with configurable policy
- [ ] Phase 4: Removal with archive compilation
- [ ] Tests: consolidation reduces memory usage, preserves important concepts

#### 5.4 Full Serialization
- [ ] Serialize: terms, beliefs, goals, questions, stamps, truth values, activation, links
- [ ] JSON format with versioning (`{ version: 1, concepts: [...] }`)
- [ ] Import validation and repair (handle corrupted/old data)
- [ ] Binary format option (optional, for large memories)
- [ ] Tests: round-trip serialization, corrupted data handling, version migration

#### 5.5 Belief Revision & Deduplication
- [ ] When a derived belief matches an existing one, apply truth revision
- [ ] Deduplicate tasks before adding to memory
- [ ] Track evidence count per belief
- [ ] Tests: revision produces correct truth values, no duplicate beliefs

---

### Phase 6: LM Integration — Real Narsese Output

**Goal**: LM rules produce parsed Narsese with truth values, not raw string atoms.

#### 6.1 LM Rule Output Pipeline
- [ ] LM response → Narsese parser → structured Task
- [ ] Response validation: check Narsese syntax before creating tasks
- [ ] Confidence assignment: LM assigns truth values (or default based on rule priority)
- [ ] Structured output format: JSON with `{narsese: string, truth?: {f, c}, confidence?: number}`
- [ ] Tests: LM output parsing, validation, truth assignment, error handling

#### 6.2 LM Rule Prompts Redesign
- [ ] System prompt: "You are a reasoning assistant. Respond in Narsese format."
- [ ] Structured prompts with Narsese context (show related beliefs)
- [ ] Few-shot examples in prompts for each rule type
- [ ] Response format specification in prompts
- [ ] Tests: prompt quality, response format compliance rate

#### 6.3 LM Rule Selection & Routing
- [ ] Dynamic rule enable/disable based on context (term type, memory state)
- [ ] Rule priority adjustment based on success rate
- [ ] Circuit breaker per rule (existing, enhance with adaptive thresholds)
- [ ] Tests: rule selection logic, circuit breaker behavior, priority adaptation

#### 6.4 Multi-Model Support
- [ ] Model registry with capabilities (speed, cost, quality, context window)
- [ ] Route rules to appropriate models (fast for translation, smart for hypothesis)
- [ ] Fallback chain: smart → fast → mock
- [ ] Fix `VercelLMClient` to support multiple providers (OpenAI, Anthropic, etc.)
- [ ] Tests: model routing, fallback behavior, provider switching

---

### Phase 7: Query, Introspection & Visibility

**Goal**: Make reasoning visible, measurable, and queryable.

#### 7.1 Query API
```typescript
class NAR {
  getBeliefs(filter?: TermFilter): Task[];
  getGoals(filter?: TermFilter): Task[];
  getQuestions(filter?: TermFilter): Task[];
  query(term: Term): { beliefs: Task[]; questions: Task[] };
  ask(question: string | Term): Promise<Answer>;
}

interface TermFilter {
  pattern?: Term;       // structural match
  truthRange?: [number, number];  // [minConfidence, maxConfidence]
  recency?: number;     // last N milliseconds
  type?: TaskType;
  limit?: number;
}
```
- [ ] `getBeliefs()` — filter by term pattern, truth range, recency
- [ ] `getGoals()` — filter by status, priority, deadline
- [ ] `getQuestions()` — filter by answered/unanswered
- [ ] `query(term)` — find related beliefs and questions via TermLayer
- [ ] `ask(question)` — natural language query, returns best answer with confidence
- [ ] Tests: query accuracy, filter behavior, performance

#### 7.2 Reasoning Trace
- [ ] `getDerivationHistory(task)` — full derivation tree via stamps
- [ ] `trace(term)` — how did this concept enter memory?
- [ ] `explain(conclusion)` — why was this derived? (which rule, which premises)
- [ ] Export trace as JSON for external visualization
- [ ] Tests: trace completeness, cycle detection in traces, explainability

#### 7.3 Metrics & Statistics
- [ ] Rule execution counts, success rates, average duration
- [ ] Memory statistics: concept count, activation distribution, forgetting rate
- [ ] LM statistics: token usage, cost estimation, model performance per rule
- [ ] Throughput: derivations per second, tasks processed
- [ ] Strategy effectiveness: which strategies produce most derivations
- [ ] Tests: metric accuracy, aggregation correctness, no performance regression

#### 7.4 Structured Logging
- [ ] `Logger` interface with levels: debug, info, warn, error
- [ ] Scoped loggers per component (e.g., `logger.child('memory')`)
- [ ] JSON log output for machine parsing
- [ ] Log sampling for high-frequency events
- [ ] Tests: log output, filtering, sampling, scoped loggers

---

### Phase 8: Tool Execution & Action Framework

**Goal**: Allow NAR to execute external tools and reason about results.

#### 8.1 Tool Interface
```typescript
interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Schema;
  execute(args: Record<string, unknown>): Promise<Result>;
}

interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  execute(name: string, args: Record<string, unknown>): Promise<Result>;
}
```
- [ ] Tool registry with discovery
- [ ] Parameter validation via schema (JSON Schema or similar)
- [ ] Result handling: success, error, partial
- [ ] Tool composition: chain, parallel, conditional
- [ ] Tests: tool registration, execution, error handling, composition

#### 8.2 Built-in Tools
- [ ] `calculate` — mathematical computation
- [ ] `readFile` / `writeFile` — file system access
- [ ] `search` — web search (API-based, optional)
- [ ] `sleep` — delay execution
- [ ] `http` — HTTP request (sandboxed)
- [ ] Tests: each tool works correctly, error cases, sandboxing

#### 8.3 Tool-Guided Reasoning
- [ ] LM rules can suggest tool usage (generate tool call as Narsese)
- [ ] NAL rules can reason about tool results (results become beliefs)
- [ ] Tool execution feedback loop: goal → tool → result → new belief → next step
- [ ] Tests: tool-guided inference chains, error recovery

---

### Phase 9: Lifecycle & Component System

**Goal**: Standardized component lifecycle with proper resource management.

#### 9.1 BaseComponent
```typescript
abstract class BaseComponent {
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly eventBus: EventBus;

  get state(): ComponentState;

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract dispose(): Promise<void>;
}

type ComponentState = 'created' | 'initialized' | 'started' | 'stopped' | 'disposed';
```
- [ ] State machine: created → initialized → started → stopped → disposed
- [ ] Scoped logger per component
- [ ] Metrics collection per component
- [ ] Event bus integration
- [ ] State transition validation (can't start if not initialized, etc.)
- [ ] Tests: lifecycle transitions, error handling, cleanup, state validation

#### 9.2 NAR as BaseComponent
- [ ] Refactor NAR to extend BaseComponent
- [ ] `initialize()`: set up memory, processor, reasoner, strategies
- [ ] `start()`: begin reasoning loop, start PremiseSource
- [ ] `stop()`: pause reasoning, save state
- [ ] `dispose()`: clear timers, close connections, free memory
- [ ] Tests: full lifecycle, interruption at each stage, resource cleanup

#### 9.3 Dependency Injection
- [ ] Simple DI container for component wiring
- [ ] Register components by name, resolve dependencies
- [ ] Lifecycle orchestration: initialize in dependency order, dispose in reverse
- [ ] Tests: component wiring, dependency resolution, circular dependency detection

---

### Phase 10: Agent Layer & Applications

**Goal**: End-user interaction layer with multiple embodiments.

#### 10.1 Agent Layer
```typescript
class Agent {
  constructor(
    private nar: NAR,
    private embodiments: Embodiment[],
    private tools: ToolRegistry,
    private commands: CommandRegistry
  ) {}

  async start(): Promise<void>;
  async stop(): Promise<void>;
}

interface Embodiment {
  readonly name: string;
  start(agent: Agent): Promise<void>;
  stop(): Promise<void>;
  send(message: string): Promise<void>;
  onMessage(handler: (message: string) => void): void;
}
```
- [ ] `Agent` wraps NAR with higher-level capabilities
- [ ] `Embodiment` interface: IRC, CLI, WebSocket, HTTP, Virtual
- [ ] `CommandRegistry` — extensible command system (`.help`, `.stats`, etc.)
- [ ] `InputProcessor` — Narsese + natural language input handling
- [ ] Tests: agent lifecycle, embodiment switching, command execution

#### 10.2 CLI REPL Enhancement
- [ ] `.query <term>` — query memory
- [ ] `.trace <term>` — show derivation history
- [ ] `.explain <term>` — why was this derived?
- [ ] `.stats` — detailed statistics (rules, memory, LM, throughput)
- [ ] `.tools` — list available tools
- [ ] `.strategy <name>` — switch reasoning strategy
- [ ] `.strategy list` — show available strategies
- [ ] `.export` / `.import` — save/load state
- [ ] Tab completion for commands and terms
- [ ] History search
- [ ] Tests: command behavior, edge cases

#### 10.3 WebSocket Server
- [ ] Real-time derivation event streaming
- [ ] Subscribe/unsubscribe to event types
- [ ] Send beliefs/goals/questions via WebSocket
- [ ] Query API over WebSocket
- [ ] Tests: connection handling, message parsing, event streaming, reconnection

#### 10.4 HTTP API
- [ ] REST API: `POST /beliefs`, `GET /beliefs`, `POST /goals`, `GET /goals`
- [ ] `POST /query` — query memory
- [ ] `POST /ask` — natural language question
- [ ] SSE endpoint for derivation events
- [ ] `GET /stats` — system statistics
- [ ] `GET /health` — health check
- [ ] Tests: API correctness, error responses, performance, rate limiting

#### 10.5 Demo Scenarios
- [ ] Knowledge base reasoning: load facts, query conclusions
- [ ] Goal achievement: set goal, watch decomposition and planning
- [ ] Analogical reasoning: cross-domain transfer
- [ ] Tool-guided reasoning: use tools to answer questions
- [ ] Multi-agent: two NAR instances communicating
- [ ] Tests: each demo runs end-to-end, produces expected results

---

### Phase 11: Performance & Optimization

**Goal**: Make it fast without sacrificing correctness.

#### 11.1 Hot Path Optimization
- [ ] Rule dispatch: target <10μs (currently 52μs)
  - Inline hot path code
  - Avoid object creation in rule matching
  - Use integer comparison instead of string comparison for operator matching
- [ ] Term hashing: cache hash computation, avoid redundant work
- [ ] Memory operations: reduce object creation in hot paths
  - Pre-allocate arrays
  - Use object pools for frequently created objects
- [ ] LM rule lazy loading: generate prompts only when rule fires
- [ ] Tests: benchmark before/after, no regression

#### 11.2 Memory Optimization
- [ ] Structural sharing: reuse term instances via memoization (existing factory, verify usage)
- [ ] Weak references: allow GC of unused concepts
- [ ] Bag optimization: use heap instead of sorted array for O(log n) operations
- [ ] Tests: memory usage under load, no leaks, GC behavior

#### 11.3 Parallel Reasoning
- [ ] Parallel rule application for independent rules (no shared state)
- [ ] Worker threads for CPU-intensive operations (optional)
- [ ] Async LM rule execution without blocking NAL rules
- [ ] Tests: parallelism correctness, speedup measurement, no race conditions

---

### Phase 12: Testing & Quality

**Goal**: Comprehensive, fast, reliable test suite.

#### 12.1 Property-Based Testing
- [ ] Term invariants: normalization, hashing, structural sharing
- [ ] Truth value invariants: frequency ∈ [0,1], confidence ∈ [0,1]
- [ ] Stamp invariants: no cycles, depth bounded
- [ ] Rule invariants: conclusions follow from premises, truth values correct
- [ ] Tests: fast-check generators, shrinking, edge cases

#### 12.2 Integration Tests
- [ ] Multi-step inference chains (3, 5, 10 steps) with correct truth propagation
- [ ] Truth value stability over derivations
- [ ] Memory bounds enforcement under load
- [ ] LM rule circuit breaker behavior
- [ ] Full pipeline: input → reason → query
- [ ] Tests: end-to-end behavior, timeout handling, error recovery

#### 12.3 Performance Tests
- [ ] Rule dispatch benchmark (target: <10μs)
- [ ] Memory operations benchmark
- [ ] Throughput: derivations per second
- [ ] Latency: input to first derivation
- [ ] Tests: benchmark stability, regression detection, CI integration

#### 12.4 AIKR Compliance Tests
- [ ] Anytime: interruptible at any point, partial results valid
- [ ] Interruptible: cooperative yielding, respects CPU throttle
- [ ] Knowledge-limited: derivation depth enforced
- [ ] Resource-constrained: bounded bags, memory limits, forgetting
- [ ] Tests: each AIKR property verified under load

---

## Deferred (Not Blocking Intelligence)

These are valuable but not required for a functioning cognitive reasoning system:

- Web UI visualization
- Plugin system
- Distributed reasoning
- TUI dashboard
- Multiple model benchmarking
- Tensor bridge (neural-symbolic truth values)
- RL framework integration
- MeTTa interpreter integration
- Episodic memory (event/episode storage)
- Procedural memory (action schemas)
- Self-concept (`(SELF --> ...)`)
- Emotion/affect system (desirability)

---

## Success Metrics

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| **Critical bugs fixed** | 0/16 | 16/16 | 0 |
| **NAL rules with truth functions** | 0/37 | 37/37 | 4 |
| **LM rules producing Narsese** | 0/13 | 13/13 | 6 |
| **Strategies** | 2 (basic) | 7+ | 3 |
| **Test count** | 92 | 200+ | 12 |
| **Rule dispatch** | 52μs | <10μs | 11 |
| **Immutability** | partial | full | 1 |
| **Query API** | none | full | 7 |
| **Tools** | 0 | 5+ | 8 |
| **Serialization** | partial (loses truth/stamps) | full | 5 |
| **Logging** | none | structured | 7 |
| **Lifecycle** | none | full state machine | 9 |
| **Dead code eliminated** | ~15 modules | 0 | 5 |
| **AIKR compliance** | partial | verified | 12 |

---

## Effort vs Impact

| Priority | Phase | Impact | Effort | Notes |
|----------|-------|--------|--------|-------|
| **P0** | 0: Critical Bug Fixes | Critical | Low | Reasoning is broken without these |
| **P0** | 1: Data Foundation | High | Medium | Enables all correctness guarantees |
| **P0** | 2: Stream Pipeline | High | Medium | Core reasoning architecture |
| **P1** | 4: NAL Completeness | High | Medium | Truth values + more rules = real reasoning |
| **P1** | 5: Memory Integration | High | Medium | Eliminate dead code, add associative links |
| **P1** | 6: LM Redesign | High | Low | Makes LM outputs actually useful |
| **P2** | 3: Strategy Framework | High | Medium | Enables diverse reasoning modes |
| **P2** | 7: Query API | High | Low | Makes reasoning visible |
| **P2** | 9: Lifecycle | Medium | Low | Professional-grade architecture |
| **P3** | 8: Tool Framework | Medium | Medium | External action capability |
| **P3** | 10: Applications | Medium | Medium | User-facing improvements |
| **P3** | 11: Performance | Medium | Medium | Speed without sacrificing correctness |
| **P3** | 12: Testing | Medium | Low | Quality assurance |

---

## Quick Wins (High Impact, Low Effort)

Do these first after Phase 0:

1. **Wire truth functions into rules** — Phase 0.1 (reasoning becomes correct)
2. **Wire LM results into memory** — Phase 0.2 (LM reasoning becomes effective)
3. **Fix term hash computation** — Phase 0.3 (term identity becomes correct)
4. **Fix derived term hashes** — Phase 0.4 (memory lookups work)
5. **Register all extended NAL rules** — Phase 0.5 (more inference power)
6. **Parse LM outputs through Narsese parser** — Phase 1.4 (LM outputs become structured)
7. **Add query API** — Phase 7.1 (reasoning becomes visible)
8. **Full serialization** — Phase 5.4 (state persistence works)
9. **Structured logging** — Phase 7.4 (debugging becomes possible)
10. **BaseComponent lifecycle** — Phase 9.1 (resource management works)

---

## Philosophy

> **From senars11**: *"Stop building infrastructure. Start generating intelligence."*
>
> **For senars12**: *"The infrastructure exists but is broken. Fix it, complete it, then generate intelligence elegantly."*

**Guiding Principles**:
1. **Correctness first** — broken truth values mean broken reasoning. Fix Phase 0 before anything else.
2. **Immutability by default** — frozen data structures prevent subtle bugs in reasoning traces.
3. **Stream processing over batch** — async generators enable anytime, interruptible reasoning.
4. **Visibility** — reasoning should be observable, measurable, traceable. If you can't see it, you can't trust it.
5. **Composability** — small parts that combine into complex behavior. Strategies compose, rules compose, tools compose.
6. **AIKR** — resource constraints are features, not limitations. Bounded bags, forgetting, throttling are core to the architecture.
7. **Type safety** — TypeScript as a reasoning layer, not just a safety net. Phantom types for derivation depth, discriminated unions for term structure.
8. **No dead code** — every module must be integrated and tested. If it's not used, remove it.

---

## Implementation Order

```
Phase 0 (Critical Bugs) ──────────────────────────────────────────┐
  0.1 Truth wiring    ──┐                                         │
  0.2 LM memory wiring  ├─ These three make reasoning CORRECT     │
  0.3 Hash fix        ──┘                                         │
  0.4-0.5 Other fixes ────────────────────────────────────────────┘
    │
    ▼
Phase 1 (Data Foundation) ── Immutability, types, parser
    │
    ▼
Phase 5 (Memory Integration) ── Integrate dead code, add TermLayer
    │
    ▼
Phase 4 (NAL Completeness) ── Truth functions on all rules, register all
    │
    ▼
Phase 6 (LM Redesign) ── Narsese output, multi-model
    │
    ▼
Phase 2 (Stream Pipeline) ── Async generators, adaptive control
    │
    ▼
Phase 3 (Strategy Framework) ── Multiple strategies, composition
    │
    ▼
Phase 7 (Query & Visibility) ── Make reasoning observable
    │
    ▼
Phase 9 (Lifecycle) ── Component system, DI
    │
    ▼
Phase 8 (Tools) ── External action capability
    │
    ▼
Phase 10 (Applications) ── CLI, WebSocket, HTTP, demos
    │
    ▼
Phase 11 (Performance) ── Optimize hot paths
    │
    ▼
Phase 12 (Testing) ── Property tests, AIKR compliance, benchmarks
```

---

**Last Updated**: 2026-05-07
**Version**: 5.0 (Total Architecture & Functionality)
**Status**: Planning Phase
**MVI Progress**: Foundation exists but has critical bugs; intelligence blocked on correctness
