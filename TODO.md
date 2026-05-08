# SeNARS12 Development Plan

## Phase 1: Fix Bugs & Complete Stubs

### 1.1 RuleProcessor Derivation History Bug
- **File**: `src/nar/rules/processor.ts:48`
- **Issue**: Uses `Stamp.createInput()` for derived stamps instead of `Stamp.derive()`
- **Fix**: Pass parent stamps to `Stamp.derive(p1.stamp, p2.stamp, ruleId)` to preserve derivation chain

### 1.2 CompositePremiseSource Stream Bug
- **File**: `src/nar/stream/pipeline.ts`
- **Issue**: `CompositePremiseSource.stream()` iterates over the array of iterators, not the async iterables themselves
- **Fix**: Merge async generators properly using `Promise.race` or `asyncIterator.merge()` pattern

### 1.3 SelfAnalyzer Empty Methods
- **File**: `src/nar/self/SelfAnalyzer.ts`
- **Implement**:
  - `applyPerformanceOptimizations()` — analyze metrics and adjust config (bag size, throttle, strategy)
  - `identifyIssues()` — detect low derivation rates, high error rates, memory pressure, LM failures
  - `applyCorrections()` — generate corrective actions based on identified issues
  - `analyzeTaskPatterns()` — compute real statistics from task history (distribution, success rate, complexity trends)

### 1.4 MetacognitiveMonitor Empty Setup
- **File**: `src/nar/self/MetacognitiveMonitor.ts:167`
- **Implement**: `setupMonitoring()` — register EventBus listeners for reasoning events, track throughput/latency/error rates, emit periodic performance snapshots

### 1.5 ReasoningAboutReasoning Hardcoded State
- **File**: `src/nar/self/ReasoningAboutReasoning.ts`
- **Fix**: `querySystemState()` should read from actual NAR memory, metrics, and monitor state
- **Fix**: Replace `(this.nar as any)?.isRunning` with proper lifecycle state check via `BaseComponent` state machine

### 1.6 NAR Query Filter Types
- **File**: `src/nar/nar.ts:158-162`
- **Issue**: `getBeliefs`, `getGoals`, `getQuestions`, `queryTerm`, `ask` use `any` for filter params
- **Fix**: Define `TermFilter`, `TruthFilter`, `QueryOptions` interfaces; type all filter parameters

### 1.7 CLI Stub Commands
- **File**: `src/cli/repl.ts:203-216`
- **Implement**:
  - `.query <term>` — use `QueryAPI` to find matching beliefs/goals/questions
  - `.trace <task-id>` — use `ReasoningTrace` to show derivation chain
  - `.explain <term>` — combine query + trace to produce human-readable explanation

### 1.8 TaskManager Enhancement
- **File**: `src/nar/task/manager.ts`
- **Add**:
  - Priority-based scheduling (respect task budget.priority)
  - Timeout handling for async/LM tasks
  - Retry logic with backoff for transient failures
  - Task lifecycle tracking (pending → running → completed/failed/expired)

---

## Phase 2: Core Engine Improvements

### 2.1 Parser Enhancements
- **Extend Narsese parser** to support:
  - Nested compound terms with mixed operators (e.g., `(&, A, (|, B, C))`)
  - Variable scoping validation (detect unbound `$X` vs `?X`)
  - Better error messages with position info and expected token hints
  - Comments (`;; comment line`)
  - Multi-statement input (batch parsing with `;` separator)

### 2.2 Truth Value System
- **Add missing truth functions**:
  - Expectation (`expectation(f, c)`)
  - Harshness (pessimistic projection)
  - Conversion chains (deduction → induction → abduction compositions)
- **Add truth value serialization/deserialization** for persistence
- **Add truth value comparison utilities** (equality with epsilon, ordering)

### 2.3 Term System
- **Add term serialization** — convert CompoundTerm to/from Narsese string round-trip
- **Add term complexity metrics** — depth, breadth, operator count, variable count
- **Add term similarity function** — structural overlap score for analogical reasoning
- **Add term substitution** — apply variable bindings to produce concrete terms
- **Improve normalization** — handle more edge cases in commutative operator canonicalization

### 2.4 Unifier Improvements
- **Add occurs check** — prevent infinite unification (`?X` in `(?X --> ?X)`)
- **Add multi-term unification** — unify sets of terms simultaneously with consistent bindings
- **Add binding set composition** — merge binding sets with conflict detection
- **Add unification result caching** — memoize common unification patterns

### 2.5 NAL Rule Coverage
- **Audit rule completeness** against NAL specification:
  - Verify all NAL-1 through NAL-7 rules are present and correct
  - Add missing rules: contraposition variants, higher-order inference patterns
  - Add NAL-6/NAL-7 rules for belief revision with conflicting evidence
- **Add rule metadata**:
  - Priority/weight per rule (some rules should fire less often)
  - Preconditions as declarative predicates (not just code guards)
  - Rule documentation strings for `.explain` output

### 2.6 RuleIndex Optimization
- **Add temporal indexing** — track recently-fired rule pairs to avoid redundant applications
- **Add rule hit statistics** — track which rules fire most often for optimization
- **Add rule dependency graph** — detect which rules produce inputs for other rules

---

## Phase 3: Memory System Enhancements

### 3.1 BoundedBag Improvements
- **Add configurable overflow behavior** — reject, replace-lowest, or merge on overflow
- **Add batch operations** — `addMany()`, `removeMany()` with single consolidation pass
- **Add bag statistics** — distribution of priorities, age histogram, throughput metrics
- **Add bag serialization** — save/restore bag state for persistence

### 3.2 Concept Enhancements
- **Add concept activation decay** — exponential decay based on time since last access
- **Add concept linkage** — track which concepts are frequently co-accessed (Hebbian learning)
- **Add concept merging** — detect near-duplicate concepts and merge with truth revision
- **Add concept splitting** — detect overloaded concepts and split by term structure

### 3.3 Memory Consolidation
- **Implement health check loop** — `checkHealth()` is defined but never called
- **Add memory compaction** — defragment concept map, remove orphaned references
- **Add memory pressure detection** — trigger aggressive forgetting when approaching limits
- **Add memory statistics API** — expose concept count, bag utilization, archive size, memory pressure

### 3.4 Forgetting Policies
- **Add adaptive forgetting** — adjust forgetting rate based on system load and concept importance
- **Add semantic forgetting** — prefer to forget concepts with low semantic connectivity
- **Add forgetting hooks** — allow external systems to intercept/override forgetting decisions

### 3.5 Memory Index Enhancements
- **Add inverse index** — given a term, find all concepts that contain it as a subterm
- **Add similarity index** — find concepts with structurally similar terms
- **Add temporal index** — query concepts by creation time, last access time, derivation depth

---

## Phase 4: Reasoning Engine

### 4.1 Strategy Enhancements
- **Add GoalDrivenStrategy** — backward chaining from goals to find supporting beliefs
- **Add AnalogicalStrategy** — cross-domain reasoning via structural mapping
- **Add ExhaustiveStrategy** — complete scan for debugging and verification
- **Add strategy switching** — allow runtime strategy changes based on task type

### 4.2 Reasoner Improvements
- **Add derivation depth enforcement** — stop deriving when `task.stamp.depth >= config.maxDerivationDepth`
- **Add circular derivation detection** — detect and break reasoning loops
- **Add reasoning budget** — limit derivations per step by CPU time, not just count
- **Add reasoning trace collection** — optional full trace capture for debugging/explanation

### 4.3 Premise Formation
- **Add premise quality filtering** — skip premise pairs with combined truth below threshold
- **Add premise diversity** — avoid repeatedly pairing the same concepts
- **Add premise formation strategies** — composable premise selection (term matching, decomposition, analogy)

---

## Phase 5: LM Integration

### 5.1 LM Client Enhancements
- **Add streaming LM responses** — process LM output token-by-token for incremental reasoning
- **Add LM response caching** — cache common LM responses to reduce API calls
- **Add LM fallback chain** — try primary model, fall back to cheaper model, fall back to mock
- **Add LM cost tracking** — track token usage and cost per LM rule invocation

### 5.2 LM Rule Improvements
- **Add dynamic LM rule generation** — generate LM rules from natural language descriptions
- **Add LM rule validation** — verify LM output is valid Narsese before processing
- **Add LM rule templates** — parameterized LM rules with configurable prompts
- **Add LM rule composition** — chain multiple LM rules in sequence

### 5.3 Model Registry
- **Add model capability discovery** — auto-detect model capabilities (context length, supported formats)
- **Add model benchmarking** — compare models on standard reasoning tasks
- **Add model selection strategy** — choose model based on task complexity and budget

---

## Phase 6: Tool System

### 6.1 Tool Enhancements
- **Add tool composition** — chain tools together (output of A → input of B)
- **Add tool sandboxing** — run tools with restricted permissions
- **Add tool result validation** — validate tool output against schema before use
- **Add tool usage statistics** — track which tools are used most, success rates, latency

### 6.2 New Built-in Tools
- **SearchTool** — search memory for matching concepts
- **ReasonTool** — invoke NAR reasoning on a specific term
- **ExplainTool** — generate explanation for a belief or derivation
- **LearnTool** — add new knowledge from external sources
- **TimerTool** — schedule delayed or recurring actions
- **ProcessTool** — spawn and manage subprocesses

### 6.3 Tool Manager
- **Add tool discovery protocol** — allow tools to advertise capabilities
- **Add tool conflict resolution** — handle when multiple tools match a request
- **Add tool lifecycle** — initialize, start, stop, dispose tools with the system

---

## Phase 7: Metacognition & Self-Awareness

### 7.1 Metacognition System
- **Implement full performance analysis** — throughput, latency, error rate, memory utilization trends
- **Implement self-belief generation** — create Narsese beliefs about system state
- **Implement self-goal setting** — generate goals to improve reasoning performance
- **Implement self-correction** — adjust parameters based on performance analysis

### 7.2 SelfAnalyzer
- **Implement pattern recognition** — detect reasoning patterns (loops, bottlenecks, successful strategies)
- **Implement optimization recommendations** — suggest config changes based on analysis
- **Implement historical comparison** — compare current performance to historical baselines
- **Implement anomaly detection** — flag unusual behavior for investigation

### 7.3 ReasoningAboutReasoning
- **Implement periodic self-analysis** — run metacognitive analysis at configurable intervals
- **Implement self-analysis reporting** — generate human-readable reports on system state
- **Implement self-improvement loop** — apply optimizations and measure their effect

---

## Phase 8: RLFP (Reinforcement Learning from Preferences)

### 8.1 RLFP System
- **Implement preference learning** — learn from human feedback on reasoning outputs
- **Implement trajectory logging** — log complete reasoning traces for training data
- **Implement reward modeling** — train reward model from preference data
- **Implement policy optimization** — adjust reasoning strategy based on learned rewards

### 8.2 Preference Collection
- **Implement active preference queries** — ask user to choose between alternative outputs
- **Implement implicit preference detection** — infer preferences from user behavior
- **Implement preference aggregation** — combine preferences from multiple sources

---

## Phase 9: Agent & Embodiment

### 9.1 Agent Enhancements
- **Add agent persistence** — save/load agent state (memory, config, learned preferences)
- **Add agent profiles** — pre-configured agent setups for different use cases
- **Add agent capabilities system** — declare and query agent capabilities
- **Add agent self-description** — generate description of what the agent can do

### 9.2 HTTP Server Embodiment
- **Add REST API** — full CRUD for beliefs, goals, questions, concepts
- **Add WebSocket streaming** — real-time reasoning output streaming
- **Add authentication** — API key or token-based auth
- **Add rate limiting** — prevent abuse of the reasoning engine
- **Add OpenAPI spec** — auto-generated API documentation

### 9.3 WebSocket Server
- **Add bidirectional communication** — send input, receive reasoning output
- **Add subscription system** — subscribe to specific term or concept updates
- **Add connection management** — handle reconnects, multiple clients, connection state

### 9.4 IRC Bot
- **Add multi-server support** — connect to multiple IRC servers simultaneously
- **Add channel management** — join/part channels, manage per-channel settings
- **Add message parsing** — distinguish between commands and natural language input
- **Add rate limiting** — prevent bot from flooding channels
- **Add personality system** — configurable bot personality and response style

---

## Phase 10: CLI & User Interface

### 10.1 REPL Enhancements
- **Add command history** — persistent history across sessions
- **Add tab completion** — complete commands, term names, concept names
- **Add syntax highlighting** — highlight Narsese syntax in input
- **Add multi-line input** — support multi-line Narsese input
- **Add session save/restore** — save REPL session to file, restore later
- **Add batch mode** — run commands from file non-interactively

### 10.2 New CLI Commands
- **`.stats [detail]`** — show detailed system statistics
- **`.concepts [filter]`** — list concepts with optional term filter
- **`.rules [filter]`** — list registered rules with descriptions
- **`.tools [filter]`** — list available tools with descriptions
- **`.config [key] [value]`** — view/modify configuration at runtime
- **`.save <file>`** — save memory state to file
- **`.load <file>`** — load memory state from file
- **`.reset`** — clear memory and restart
- **`.profile [start|stop]`** — performance profiling session
- **`.help [command]`** — contextual help

### 10.3 Query/Trace/Explain Integration
- **Implement `.query`** — full QueryAPI integration with term matching
- **Implement `.trace`** — show derivation trace for a specific task
- **Implement `.explain`** — human-readable explanation of a belief's origin

---

## Phase 11: Testing & Quality

### 11.1 Test Coverage
- **Add tests for all stubbed methods** — SelfAnalyzer, MetacognitiveMonitor, ReasoningAboutReasoning
- **Add tests for CLI commands** — test all REPL commands
- **Add tests for LM integration** — test LM clients, rules, routing with mocks
- **Add tests for tool system** — test all built-in tools, tool manager, composition
- **Add tests for agent embodiments** — test HTTP server, WebSocket, IRC bot
- **Add tests for memory operations** — serialization, consolidation, forgetting, indexing

### 11.2 Property-Based Testing
- **Add more property tests** for term system invariants
- **Add property tests** for truth value operations (commutativity, associativity, identity)
- **Add property tests** for NAL rules (soundness properties)
- **Add property tests** for memory operations (consistency, no data loss)

### 11.3 Benchmark Suite
- **Add reasoning benchmarks** — measure derivations/second under various configs
- **Add memory benchmarks** — measure concept throughput, consolidation time
- **Add LM benchmarks** — measure LM rule latency, throughput, cost
- **Add regression benchmarks** — track performance over time

### 11.4 E2E Tests
- **Add full reasoning cycle tests** — input → reason → verify output
- **Add LM integration tests** — test with mock LM end-to-end
- **Add agent embodiment tests** — test HTTP API, WebSocket, IRC bot
- **Add persistence tests** — save → load → verify state matches

---

## Phase 12: Documentation

### 12.1 API Documentation
- **Generate JSDoc documentation** — ensure all public APIs have complete JSDoc
- **Create API reference** — organized by module with examples
- **Create type documentation** — document all interfaces and types

### 12.2 User Guides
- **Getting Started** — installation, configuration, first reasoning session
- **Narsese Guide** — syntax, semantics, examples
- **Truth Values Guide** — frequency, confidence, truth functions
- **NAL Rules Guide** — each rule explained with examples
- **Memory System Guide** — concepts, bags, consolidation, forgetting
- **LM Integration Guide** — configuring LM providers, writing LM rules
- **Tool System Guide** — using built-in tools, writing custom tools
- **Agent Guide** — creating agents, embodiments, persistence
- **Metacognition Guide** — self-monitoring, self-improvement

### 12.3 Developer Guides
- **Architecture Overview** — system design, module relationships
- **Contributing Guide** — how to contribute, coding standards, testing
- **Plugin Development** — writing custom rules, tools, LM clients
- **Performance Tuning** — optimizing reasoning performance
- **Debugging Guide** — using trace, explain, profiling tools

### 12.4 Examples
- **Basic reasoning examples** — syllogisms, induction, abduction
- **LM integration examples** — natural language reasoning, knowledge extraction
- **Tool usage examples** — calculation, file I/O, HTTP requests
- **Agent examples** — HTTP server, WebSocket, IRC bot
- **Metacognition examples** — self-monitoring, self-improvement
- **Advanced examples** — complex reasoning scenarios, multi-step derivations

---

## Phase 13: Infrastructure & DevOps

### 13.1 Build System
- **Add build step** — compile TypeScript to JavaScript for production
- **Add type declarations** — generate `.d.ts` files for library consumers
- **Add bundle optimization** — tree-shaking, minification for browser use
- **Add multiple output formats** — ESM, CommonJS, UMD

### 13.2 CI/CD
- **Add GitHub Actions workflow** — lint, typecheck, test on push/PR
- **Add coverage reporting** — upload coverage to codecov or similar
- **Add release automation** — semantic versioning, changelog generation
- **Add npm publishing** — automated package publishing on release

### 13.3 Docker
- **Add Dockerfile** — containerized SeNARS instance
- **Add docker-compose** — multi-container setup (SeNARS + LM provider)
- **Add production config** — optimized Docker config for production

### 13.4 Configuration
- **Add config validation** — validate config at startup with helpful errors
- **Add config templates** — pre-built configs for common use cases
- **Add environment variable support** — override config with env vars
- **Add runtime config updates** — modify config without restart

---

## Phase 14: Advanced Features (Inspired by senars11)

### 14.1 MeTTa Integration
- **Add MeTTa parser** — parse MeTTa syntax into NAR terms
- **Add MeTTa-NAR bridge** — bidirectional translation between MeTTa and Narsese
- **Add MeTTa operations** — implement core MeTTa operations as NAR tools
- **Add MeTTa reduction engine** — MeTTa-style reduction within NAR

### 14.2 Tensor/Neural-Symbolic
- **Add tensor module** — multi-dimensional tensor operations
- **Add symbolic-tensor bridge** — map NAR terms to tensor representations
- **Add truth-tensor bridge** — map NAL truth values to tensor values
- **Add tensor-based reasoning** — use tensors for similarity, analogy, generalization

### 14.3 Advanced Reasoning Strategies
- **Add PrologStrategy** — backward chaining with unification and backtracking
- **Add ResolutionStrategy** — resolution-based inference
- **Add DecompositionStrategy** — term decomposition for complex reasoning
- **Add Strategy composition** — combine strategies with priority weighting

### 14.4 Knowledge Management
- **Add knowledge base connector** — connect to external knowledge bases
- **Add ontology management** — manage ontologies and taxonomies
- **Add semantic memory** — vector-based semantic similarity
- **Add knowledge validation** — check knowledge for consistency

### 14.5 Safety & Constraints
- **Add reasoning constraints** — prevent reasoning about certain topics
- **Add output filtering** — filter reasoning output based on safety rules
- **Add resource limits** — hard limits on CPU, memory, derivation depth
- **Add audit logging** — log all reasoning operations for auditing

---

## Phase 15: Performance & Optimization

### 15.1 Hot Path Optimization
- **Profile and optimize term hashing** — most frequent operation
- **Profile and optimize rule matching** — RuleIndex performance
- **Profile and optimize memory access** — concept lookup, bag operations
- **Profile and optimize truth operations** — truth value calculations

### 15.2 Caching
- **Add term cache improvements** — better eviction, size management
- **Add rule result caching** — cache common rule applications
- **Add query result caching** — cache frequent query results
- **Add LM response caching** — cache LM responses to reduce API calls

### 15.3 Parallelism
- **Add parallel rule application** — apply independent rules in parallel
- **Add parallel premise formation** — form premise pairs in parallel
- **Add parallel memory operations** — consolidate, forget in parallel
- **Add worker pool** — offload heavy computation to worker threads

### 15.4 Memory Efficiency
- **Reduce object allocation** — reuse objects where possible
- **Add object pooling** — pool frequently allocated objects (stamps, budgets)
- **Add structural sharing** — share structure between similar compound terms
- **Add compact representations** — use more compact data structures
