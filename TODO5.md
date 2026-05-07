# SeNARS TODO5: From Foundation to Intelligence

> **"The architecture is solid. Now make it think."**
>
> **Philosophy**: Every line of code should either produce intelligence or enable it. No dead infrastructure.
>
> **Design Principle**: Elegant abstractions that compose. Redesign freely, no backwards compatibility needed.

---

## Retrospective: What senars12 Got Right

- ✅ TypeScript strict mode, zero errors
- ✅ Clean 4-layer separation (Config → Factory → NAR → Apps)
- ✅ Discriminated union terms with structural hashing
- ✅ 18 NAL rules with pattern-matched indexing
- ✅ LM integration with circuit breakers
- ✅ 92 tests passing
- ✅ Memory system with bounded bags, forgetting, consolidation

## What senars12 Is Missing (Learned from senars11)

- ❌ **Stream reasoning pipeline** — senars11 had async generator pipelines with backpressure; senars12 has a simple loop
- ❌ **Strategy diversity** — senars11 had 17 premise-pairing strategies; senars12 has only `BagStrategy`
- ❌ **Proper Narsese parsing of LM outputs** — LM rules create `{kind: 'atom', symbol: response, hash: 0}` instead of parsing Narsese
- ❌ **Immutable data foundation** — senars11 used `Object.freeze()` on Term/Truth/Stamp/Task; senars12 is mutable
- ❌ **BaseComponent lifecycle** — standardized initialize/start/stop/dispose with scoped logging and metrics
- ❌ **Formation framework** — senars11 had extensible premise-pairing with semantic, analogical, goal-driven strategies
- ❌ **Pattern-compiled NAL rules** — senars11 had declarative NAL4/NAL5 definitions compiled to decision trees
- ❌ **BloomStamp** — memory-efficient circularity detection for deep derivations
- ❌ **Proper error hierarchy** — senars12 has error types but inconsistent usage
- ❌ **Logging/introspection** — no structured logging, no reasoning trace visibility
- ❌ **Serialization depth** — export/import loses beliefs, goals, questions, stamps, truth values
- ❌ **Query API** — no `getBeliefs()`, `query()`, `ask()` methods
- ❌ **Tool execution** — no external tool/action execution framework
- ❌ **Metacognition** — no self-referential reasoning about reasoning state

---

## Architecture Vision

```
┌──────────────────────────────────────────────────────────┐
│                    Applications                           │
│  CLI  │  Bot  │  Web API  │  Stream Server  │  Custom    │
├──────────────────────────────────────────────────────────┤
│                    Capabilities                           │
│  Tools │  Embodiments  │  Commands  │  Persistence       │
├──────────────────────────────────────────────────────────┤
│                    NAR Engine                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Premise     │  │ Rule         │  │ LM              │ │
│  │ Source      │→ │ Processor    │← │ Rules           │ │
│  │ (stream)    │  │ (sync+async) │  │ (async)         │ │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘ │
│         │                │                    │          │
│  ┌──────▼────────────────▼────────────────────▼───────┐ │
│  │              Strategy Layer                         │ │
│  │  Bag │ GoalDriven │ Analogical │ Semantic │ Custom  │ │
│  └──────────────────────┬─────────────────────────────┘ │
│                         │                               │
│  ┌──────────────────────▼─────────────────────────────┐ │
│  │              Memory System                          │ │
│  │  Concepts │ Focus │ Archive │ TermLayer │ GC       │ │
│  └────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                    Data Foundation                        │
│  Term (frozen) │ Truth (frozen) │ Stamp (frozen) │ Task  │
├──────────────────────────────────────────────────────────┤
│                    Infrastructure                         │
│  EventBus │ Logger │ CircuitBreaker │ Metrics │ Config   │
└──────────────────────────────────────────────────────────┘
```

---

## Phases

### Phase 1: Data Foundation — Immutability & Correctness

**Goal**: Make core data structures immutable, correct, and traceable.

#### 1.1 Immutable Core Types
- [ ] `Term` — immutable, `Object.freeze()`, canonical representation
- [ ] `Truth` — immutable value object, all operations return new instances
- [ ] `Stamp` — immutable derivation history, support both `ArrayStamp` and `BloomStamp`
- [ ] `Task` — immutable, frozen on creation
- [ ] Verify: no mutation paths exist in hot code paths

#### 1.2 BloomStamp for Deep Derivations
- [ ] Implement Bloom filter-based stamp for depth > threshold
- [ ] Automatic switch from `ArrayStamp` to `BloomStamp` at configurable depth
- [ ] Collision probability analysis and documentation
- [ ] Tests: circularity detection accuracy, memory savings

#### 1.3 Narsese Parser Enhancement
- [ ] Parse LM outputs through existing `termParser` instead of creating raw atoms
- [ ] Support compound terms in LM responses (inheritance, implication, conjunction)
- [ ] Graceful fallback: if parsing fails, create atomic term with warning event
- [ ] Tests: parse all Narsese forms from LM-generated strings

#### 1.4 Error Hierarchy Consolidation
- [ ] Unified error types: `NARError` → `ParseError | MemoryError | InferenceError | LMError | ConfigError`
- [ ] Each error carries context: `{term?, rule?, concept?, config?}`
- [ ] Consistent error handling: no empty catches, specific error types, context logging
- [ ] Tests: error propagation, context preservation, recovery paths

---

### Phase 2: Stream Reasoning Pipeline

**Goal**: Replace the simple `run(steps)` loop with an async generator pipeline.

#### 2.1 PremiseSource
- [ ] Async generator that streams tasks from memory/focus
- [ ] Configurable: from memory bag, from focus set, from external stream
- [ ] Backpressure-aware: respects CPU throttle, yields to event loop
- [ ] Tests: streaming behavior, backpressure, interruption

#### 2.2 Pipeline Architecture
```typescript
// New reasoning loop
async *reason(): AsyncGenerator<Derivation> {
  for await (const premise of premiseSource) {
    for (const pair of strategy.pair(premise, memory)) {
      yield* processor.apply(pair);
    }
  }
}
```
- [ ] `PremiseSource` — async generator interface
- [ ] `PipelineRunner` — orchestrates source → strategy → processor → output
- [ ] Keep `SimpleRunner` as fallback for synchronous use cases
- [ ] Tests: pipeline composition, backpressure, cancellation

#### 2.3 Backpressure & Resource Management
- [ ] CPU throttle: `cpuThrottleMs` between steps
- [ ] Derivation budget: max derivations per cycle
- [ ] Memory pressure: slow down when memory is full
- [ ] Cooperative yielding: `await setImmediate()` or `setTimeout(0)`
- [ ] Tests: resource bounds enforced under load

---

### Phase 3: Strategy Framework

**Goal**: Multiple premise-pairing strategies, not just `BagStrategy`.

#### 3.1 Strategy Interface
```typescript
interface Strategy {
  name: string;
  pair(premise: Task, memory: Memory): Iterable<[Task, Task?]>;
}
```
- [ ] Clean interface, composable strategies
- [ ] Strategy registry with runtime switching
- [ ] Per-concept strategy selection

#### 3.2 Core Strategies
- [ ] `BagStrategy` — priority-sampled from memory bag (existing, refactor)
- [ ] `ExhaustiveStrategy` — all pairs with a concept (existing, refactor)
- [ ] `GoalDrivenStrategy` — backward-chaining from goals to beliefs
- [ ] `AnalogicalStrategy` — cross-domain pairing by structural similarity
- [ ] `SemanticStrategy` — embedding-based pairing (optional, needs LM)
- [ ] `ResolutionStrategy` — resolution theorem proving (negation elimination)
- [ ] Tests: each strategy produces correct pairings, performance characteristics

#### 3.3 Strategy Composition
- [ ] `CompositeStrategy` — run multiple strategies in sequence or parallel
- [ ] `WeightedStrategy` — probabilistic selection based on weights
- [ ] `AdaptiveStrategy` — learns which strategy works best (meta-reasoning)
- [ ] Tests: composition behavior, weight distribution

---

### Phase 4: NAL Rule Completeness & Compilation

**Goal**: Complete NAL rule set with pattern-compiled matching.

#### 4.1 Missing NAL Rules
- [ ] `ModusPonensRule` — detachment for implications
- [ ] `ConversionRule` — conversion and contraposition
- [ ] `VariableIntroductionRule` — introduce variables from patterns
- [ ] `MetacognitionRules` — self-referential reasoning
- [ ] `NAL6` — higher-order inference rules
- [ ] Tests: each rule produces correct conclusions with proper truth values

#### 4.2 Rule Compilation
- [ ] Declarative rule definitions (data, not code)
- [ ] Compile to decision tree for efficient matching
- [ ] Pattern-matching engine with unification
- [ ] Fallback to direct rule application for complex rules
- [ ] Tests: compiled rules match hand-coded behavior, performance improvement

#### 4.3 Rule Composition
- [ ] `compose(rules)` — chain rules into composite inference
- [ ] `pipe(rule1, rule2, rule3)` — sequential rule application
- [ ] `branch(rule1, rule2)` — parallel rule application, merge results
- [ ] Tests: composition correctness, error propagation

---

### Phase 5: Memory System Enhancement

**Goal**: Dual memory with formation, attention, and proper serialization.

#### 5.1 Focus System
- [ ] Multiple focus sets with attention scoring
- [ ] Attention decay and refresh
- [ ] Focus set promotion/demotion
- [ ] Tests: attention dynamics, focus set management

#### 5.2 TermLayer (Associative Links)
- [ ] Bag-backed associative link layer between terms
- [ ] Capacity-limited, priority-based
- [ ] Link types: similarity, implication, temporal, causal
- [ ] Tests: link creation, decay, retrieval

#### 5.3 Archive (Long-term Memory)
- [ ] Move consolidated concepts to archive
- [ ] Archive retrieval on demand
- [ ] Archive compression (optional)
- [ ] Tests: archive operations, retrieval accuracy

#### 5.4 Serialization
- [ ] Full serialization: terms, beliefs, goals, questions, stamps, truth values
- [ ] JSON format with versioning
- [ ] Import validation and repair
- [ ] Tests: round-trip serialization, corrupted data handling

---

### Phase 6: LM Integration Redesign

**Goal**: LM rules that produce real Narsese, not raw strings.

#### 6.1 LM Rule Output Pipeline
- [ ] LM response → Narsese parser → structured Task
- [ ] Response validation: check Narsese syntax before creating tasks
- [ ] Confidence assignment: LM assigns truth values to its outputs
- [ ] Tests: LM output parsing, validation, truth assignment

#### 6.2 LM Rule Prompts Redesign
- [ ] Structured prompts with Narsese context
- [ ] System prompt: "You are a reasoning assistant. Respond in Narsese format."
- [ ] Few-shot examples in prompts
- [ ] Response format specification in prompts
- [ ] Tests: prompt quality, response format compliance

#### 6.3 LM Rule Selection
- [ ] Dynamic rule enable/disable based on context
- [ ] Rule priority adjustment based on success rate
- [ ] Circuit breaker per rule (existing, enhance)
- [ ] Tests: rule selection logic, circuit breaker behavior

#### 6.4 Multi-Model Support
- [ ] Model registry with capabilities
- [ ] Route rules to appropriate models (fast vs smart)
- [ ] Fallback chain: smart → fast → mock
- [ ] Tests: model routing, fallback behavior

---

### Phase 7: Query & Introspection API

**Goal**: Make reasoning visible, measurable, and queryable.

#### 7.1 Query API
```typescript
class NAR {
  getBeliefs(filter?: TermFilter): Task[];
  getGoals(filter?: TermFilter): Task[];
  getQuestions(filter?: TermFilter): Task[];
  query(term: Term): { beliefs: Task[]; questions: Task[] };
  ask(question: string): Promise<Answer>;
}
```
- [ ] `getBeliefs()` — filter by term pattern, truth range, recency
- [ ] `getGoals()` — filter by status, priority, deadline
- [ ] `getQuestions()` — filter by answered/unanswered
- [ ] `query(term)` — find related beliefs and questions
- [ ] `ask(question)` — natural language query, returns best answer
- [ ] Tests: query accuracy, filter behavior, performance

#### 7.2 Reasoning Trace
- [ ] `getDerivationHistory(task)` — full derivation tree via stamps
- [ ] `trace(term)` — how did this concept enter memory?
- [ ] `explain(conclusion)` — why was this derived?
- [ ] Tests: trace completeness, cycle detection in traces

#### 7.3 Metrics & Statistics
- [ ] Rule execution counts, success rates, average duration
- [ ] Memory statistics: concept count, activation distribution, forgetting rate
- [ ] LM statistics: token usage, cost estimation, model performance
- [ ] Throughput: derivations per second, tasks processed
- [ ] Tests: metric accuracy, aggregation correctness

#### 7.4 Structured Logging
- [ ] `Logger` interface with levels: debug, info, warn, error
- [ ] Scoped loggers per component
- [ ] JSON log output for machine parsing
- [ ] Log sampling for high-frequency events
- [ ] Tests: log output, filtering, sampling

---

### Phase 8: Tool Execution Framework

**Goal**: Allow NAR to execute external tools and actions.

#### 8.1 Tool Interface
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: Schema;
  execute(args: Record<string, any>): Promise<Result>;
}
```
- [ ] Tool registry with discovery
- [ ] Parameter validation via schema
- [ ] Result handling: success, error, partial
- [ ] Tool composition: chain, parallel, conditional
- [ ] Tests: tool registration, execution, error handling

#### 8.2 Built-in Tools
- [ ] `search` — web search (API-based)
- [ ] `calculate` — mathematical computation
- [ ] `readFile` / `writeFile` — file system access
- [ ] `exec` — command execution (sandboxed)
- [ ] `sleep` — delay execution
- [ ] Tests: each tool works correctly, error cases

#### 8.3 Tool-Guided Reasoning
- [ ] LM rules can suggest tool usage
- [ ] NAL rules can reason about tool results
- [ ] Tool results become beliefs in memory
- [ ] Tests: tool-guided inference chains

---

### Phase 9: Lifecycle & Component System

**Goal**: Standardized component lifecycle with BaseComponent.

#### 9.1 BaseComponent
```typescript
abstract class BaseComponent {
  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract dispose(): Promise<void>;

  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly eventBus: EventBus;

  readonly state: 'created' | 'initialized' | 'started' | 'stopped' | 'disposed';
}
```
- [ ] State machine: created → initialized → started → stopped → disposed
- [ ] Scoped logger per component
- [ ] Metrics collection per component
- [ ] Event bus integration
- [ ] Tests: lifecycle transitions, error handling, cleanup

#### 9.2 NAR as BaseComponent
- [ ] Refactor NAR to extend BaseComponent
- [ ] Proper initialization sequence
- [ ] Graceful shutdown: save state, close connections
- [ ] Resource cleanup: clear timers, close files
- [ ] Tests: full lifecycle, interruption at each stage

#### 9.3 Component Registry
- [ ] Register components by name
- [ ] Dependency injection
- [ ] Lifecycle orchestration
- [ ] Tests: component wiring, dependency resolution

---

### Phase 10: Applications & Usability

**Goal**: Make SeNARS useful and delightful to use.

#### 10.1 CLI REPL Enhancement
- [ ] `.query <term>` — query memory
- [ ] `.trace <term>` — show derivation history
- [ ] `.stats` — detailed statistics
- [ ] `.tools` — list available tools
- [ ] `.strategy <name>` — switch reasoning strategy
- [ ] `.export` / `.import` — save/load state
- [ ] Tab completion for commands and terms
- [ ] History search
- [ ] Tests: command behavior, edge cases

#### 10.2 Stream Server
- [ ] WebSocket server for real-time reasoning
- [ ] Subscribe to derivation events
- [ ] Send beliefs/goals/questions via WebSocket
- [ ] Query API over WebSocket
- [ ] Tests: connection handling, message parsing, event streaming

#### 10.3 HTTP API
- [ ] REST API for beliefs, goals, questions
- [ ] SSE for derivation events
- [ ] Query endpoint
- [ ] Health check endpoint
- [ ] Tests: API correctness, error responses, performance

#### 10.4 Demo Scenarios
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
- [ ] Term hashing: optimize hash computation
- [ ] Memory operations: reduce object creation in hot paths
- [ ] LM rule lazy loading: load prompts only when needed
- [ ] Tests: benchmark before/after, no regression

#### 11.2 Memory Optimization
- [ ] Structural sharing: reuse term instances via memoization
- [ ] Weak references: allow GC of unused concepts
- [ ] Bag optimization: reduce allocation in priority queue
- [ ] Tests: memory usage under load, no leaks

#### 11.3 Parallel Reasoning
- [ ] Parallel rule application for independent rules
- [ ] Worker threads for CPU-intensive operations
- [ ] Async LM rule execution without blocking NAL rules
- [ ] Tests: parallelism correctness, speedup measurement

---

### Phase 12: Testing & Quality

**Goal**: Comprehensive, fast, reliable test suite.

#### 12.1 Property-Based Testing
- [ ] Term invariants: normalization, hashing, structural sharing
- [ ] Truth value invariants: frequency ∈ [0,1], confidence ∈ [0,1]
- [ ] Stamp invariants: no cycles, depth bounded
- [ ] Rule invariants: conclusions follow from premises
- [ ] Tests: fast-check generators, shrinking, edge cases

#### 12.2 Integration Tests
- [ ] Multi-step inference chains (3, 5, 10 steps)
- [ ] Truth value stability over derivations
- [ ] Memory bounds enforcement under load
- [ ] LM rule circuit breaker behavior
- [ ] Full pipeline: input → reason → query
- [ ] Tests: end-to-end behavior, timeout handling

#### 12.3 Performance Tests
- [ ] Rule dispatch benchmark
- [ ] Memory operations benchmark
- [ ] Throughput: derivations per second
- [ ] Latency: input to first derivation
- [ ] Tests: benchmark stability, regression detection

---

## Deferred (Not Blocking Intelligence)

- Web UI visualization
- Plugin system
- Distributed reasoning
- TUI dashboard
- Multiple model benchmarking
- Tensor bridge (neural-symbolic)
- RL framework integration
- MeTTa interpreter integration

---

## Success Metrics

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| NAL rules | 18 | 28+ | 4 |
| Strategies | 1 | 6+ | 3 |
| Test count | 92 | 150+ | 12 |
| Rule dispatch | 52μs | <10μs | 11 |
| Immutability | partial | full | 1 |
| Query API | none | full | 7 |
| Tools | 0 | 5+ | 8 |
| Serialization | partial | full | 5 |
| Logging | none | structured | 7 |
| Lifecycle | none | full | 9 |

---

## Effort vs Impact

| Priority | Phase | Impact | Effort | Notes |
|----------|-------|--------|--------|-------|
| **P0** | 1: Data Foundation | High | Medium | Enables all correctness guarantees |
| **P0** | 2: Stream Pipeline | High | Medium | Core reasoning architecture |
| **P0** | 6: LM Redesign | High | Low | Makes LM outputs actually useful |
| **P1** | 3: Strategy Framework | High | Medium | Enables diverse reasoning modes |
| **P1** | 7: Query API | High | Low | Makes reasoning visible |
| **P1** | 4: NAL Completeness | Medium | Medium | More inference power |
| **P2** | 5: Memory Enhancement | Medium | Medium | Better memory management |
| **P2** | 8: Tool Framework | Medium | Medium | External action capability |
| **P2** | 9: Lifecycle | Medium | Low | Professional-grade architecture |
| **P3** | 10: Applications | Medium | Medium | User-facing improvements |
| **P3** | 11: Performance | Medium | Medium | Speed without sacrificing correctness |
| **P3** | 12: Testing | Medium | Low | Quality assurance |

---

## Quick Wins (High Impact, Low Effort)

1. **Parse LM outputs through Narsese parser** — Phase 1.3
2. **Add query API** — Phase 7.1
3. **Structured logging** — Phase 7.4
4. **Error hierarchy consolidation** — Phase 1.4
5. **LM rule prompt redesign** — Phase 6.2
6. **CLI commands: .query, .trace, .stats** — Phase 10.1
7. **Full serialization** — Phase 5.4
8. **BaseComponent lifecycle** — Phase 9.1

---

## Philosophy

> **From senars11**: *"Stop building infrastructure. Start generating intelligence."*
>
> **For senars12**: *"The infrastructure is built. Now generate intelligence elegantly."*

**Guiding Principles**:
1. Every component should either produce intelligence or enable it
2. Immutability by default, mutation only when necessary
3. Stream processing over batch processing
4. Visibility: reasoning should be observable, measurable, traceable
5. Composability: small parts that combine into complex behavior
6. AIKR: resource constraints are features, not limitations
7. Type safety: TypeScript as a reasoning layer, not just a safety net

---

**Last Updated**: 2026-05-07
**Version**: 5.0 (From Foundation to Intelligence)
**Status**: Planning Phase
**MVI Progress**: Foundation complete, intelligence in progress
