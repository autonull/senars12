Based on the completed state of the codebase (TODO20–25), the architectural debt has been paid, and the substrate is highly stable. At this stage, refactoring should not be about fixing seams, but about **structural generalization**—taking monolithic or tightly-coupled subsystems and abstracting them just enough to unlock latent capabilities that the current architecture implicitly forbids.

Here are four high-leverage refactorings that preserve all existing behavior (passing all current benches) while unlocking significant new cognitive and operational capabilities.

---

### 1. `SystemOneRuntime` $\rightarrow$ Composable `JudgmentPipeline`s
**The Current State:** `SystemOneRuntime` (in `nar/src/nar/system-one.ts`) is a monolithic container. It wires the `Manifold`, `ContrastiveMemory`, `Dispatcher`, and `Decider` together in a single, fixed topology for the entire NAR instance. Every judgment, whether for ingress parsing or reflex selection, routes through this same global configuration.

**The Refactoring:** 
Extract an `IJudgmentPipeline` interface and a `PipelineRegistry`. Decompose `SystemOneRuntime` so that it no longer owns a single manifold/decider state, but rather manages a registry of named pipelines (e.g., `ingress-strict`, `reflex-fast`, `hypothesis-divergent`). The existing `Decider` and `Chooser` become pipeline-scoped rather than runtime-scoped.

**The Unlocked Capability: Context-Dependent Epistemic Mode**
Currently, the agent applies the same epistemic rigor to translating a user's greeting as it does to evaluating a safety-critical tool execution. With composable pipelines, the agent can dynamically route tasks through different modes:
*   **Strict:** High abstain thresholds, heavy contrastive penalties, safety-floor heads enabled (used for `PerceptionGate` ingress and `ActionGate` authorization).
*   **Divergent:** Lower abstain thresholds, curiosity-drive weighting, disabled safety vetoes (used for `LMHypothesisGenerationRule` and brainstorming).
*   **Multi-Tenant Profiles:** If the bot is connected to IRC and MCP simultaneously, it can route different `correlationId`s through entirely different judgment profiles, effectively giving the agent multiple "personas" with distinct cognitive biases.

### 2. `correlationId` $\rightarrow$ First-Class `CognitiveThread`
**The Current State:** `Agent.chat()` mints a `correlationId` string and passes it through `TraceGradeInput`, `DialogueTurn`, and `EpisodicMemory`. It is an opaque join key. Meanwhile, heavy state like `EmbeddingCache`, `ContrastiveMemory`, and `FocusBag` budgets are global to the NAR instance.

**The Refactoring:**
Elevate the `correlationId` into a `CognitiveThread` context object. A `CognitiveThread` owns its ID, but also scopes a local `EmbeddingCache` slice, a thread-local `ContrastiveMemory` buffer, and a dedicated AIKR `BudgetGate` allocation. The kernel's micro-tick and the agent's macro-cycle accept the `CognitiveThread` as an explicit `AsyncLocalStorage` context.

**The Unlocked Capability: Concurrent Multi-Threading & Isolation**
Right now, if the bot is talking to two users simultaneously, User A's corrections (via TODO24's `.react`) immediately alter the global `ContrastiveMemory`, which subtly shifts the manifold judgments for User B. By scoping state to the `CognitiveThread`:
*   **Zero Context Bleed:** The agent can handle 50 concurrent WebSocket/MCP connections with perfect cognitive isolation.
*   **Thread-Specific Forgetting:** AIKR pressure can prune a specific thread's embedding cache without affecting the agent's global semantic memory.
*   **Forking Cognition:** The agent can "fork" a thread to run a counterfactual simulation (e.g., "What if I had answered differently?") without polluting the main thread's event log.

### 3. `Negotiator` $\rightarrow$ Generalized `ConsensusEngine`
**The Current State:** The `Negotiator` (in `nar/src/reflex/Negotiator.ts`) arbitrates between System 1 (`Reflex` proposals) and System 2 (NAL derivations). It has a hardcoded structural bias: NAL retains absolute veto authority over reflexes.

**The Refactoring:**
Generalize the `Negotiator` into a `ConsensusEngine` that accepts an array of `IProposer` interfaces. Each proposer yields a `Proposal` with a declared `confidence`, `sourceQuality`, and `domain`. The veto logic becomes a pluggable `ArbitrationStrategy` (e.g., `NALVetoStrategy` for the current behavior, `WeightedQuorum`, or `BordaCount`).

**The Unlocked Capability: Multi-Agent Swarm Arbitration & MeTTa Cross-Checking**
This breaks the binary System 1 / System 2 paradigm and opens the door to arbitrary cognitive consensus:
*   **Peer Delegation:** When `CognitiveTaskDelegation` receives a result from a remote SeNARS peer, it enters the `ConsensusEngine` as just another `IProposer`. The agent can weigh local NAL against remote Peer consensus.
*   **MeTTa as a Voter:** The MeTTa exact-computation engine can act as a proposer with `confidence: 1.0` for algebraic facts. If MeTTa and NAL disagree, the `ConsensusEngine` can flag a `Contradiction` event and route it to the `SelfMetaGame` for resolution, rather than NAL silently overriding the exact proof.

### 4. `DerivationRecorder` $\rightarrow$ Live `ProofStream`
**The Current State:** The `DerivationRecorder` is an opt-in, bounded ring buffer. It captures `DerivationRecord`s silently, and they are drained post-hoc by `scripts/verify-derivation.ts` for batch verification.

**The Refactoring:**
Transform the recorder from a passive buffer into an active, subscribable `ProofStream` (an `AsyncIterable<DerivationRecord>` or typed `EventEmitter`). Every time the `RuleProcessor` admits a derivation step through the kernel gates, it emits to the stream in real-time.

**The Unlocked Capability: Real-Time Explainability & Live Critic Reflexes**
*   **Streaming Chain-of-Thought:** The Web UI (Lens) or an MCP client can subscribe to the `ProofStream` and render the agent's Narsese syllogisms *as they are discovered*, providing a live, transparent window into the System 2 black box before the final answer is even generated.
*   **The "Critic" Reflex:** You can attach a new type of reflex—a `CriticReflex`—that subscribes to the `ProofStream`. Instead of proposing actions, it watches the live derivation chain for logical fallacies, circular dependencies, or low-confidence leaps, and injects `^doubt` or `^re-evaluate` goals back into the `FocusBag` mid-reasoning, allowing the agent to catch its own errors before it finishes speaking.

---

### 5. `Bag<T>` → Pluggable Sampling Strategies

**The Current State:** `Bag<T>` is the universal AIKR priority queue used everywhere — working memory, focus task bags, concept bags, game focus bags. Sampling is probabilistic and priority-weighted, with a single fixed algorithm (`sample()` draws proportional to priority, `evict('Random')` removes a random low-priority item). The `RandomSource` injection (TODO20 T1) made sampling deterministic, but the *strategy* for sampling is hardcoded.

**The Refactoring:**
Extract a `SamplingStrategy<T>` interface with a `select(items: T[], budget: number): T[]` method. `Bag<T>` accepts a `samplingStrategy` option. Ship several implementations: `PrioritySampling` (current behavior), `RecencySampling` (favor recently-added items), `NoveltySampling` (favor items dissimilar to recently-sampled ones), `DiversitySampling` (maximize coverage across item categories), `FairnessSampling` (guarantee minimum allocation to low-priority items via aging). The `FocusBag` that allocates budget across focuses uses the same interface.

**The Unlocked Capability: Cognitive Modes**
The sampling strategy *is* the attention mode. A focused reasoning session uses `PrioritySampling` (exploit high-priority items). A creative brainstorming session uses `NoveltySampling` (explore unexpected connections). A fairness-critical session uses `FairnessSampling` (ensure low-priority background goals aren't starved — directly addressing Proof Obligation #6 from the README). The `CognitiveController` can switch sampling strategies per-focus at runtime, giving the agent genuinely different cognitive postures without changing any other machinery.

---

### 6. Event Log → Queryable Cognitive Timeline

**The Current State:** The event log is append-only JSONL, optimized for write throughput and sequential replay (`replayCognitiveState`). Querying it requires replaying from genesis or scanning the full file. There is no indexed access by time range, event type, correlation ID, or concept.

**The Refactoring:**
Add a read-optimized query layer over the event log. This does not change the write path (append-only JSONL stays as the source of truth). A `CognitiveTimeline` facade provides indexed queries: `queryByTimeRange(from, to)`, `queryByType(eventType)`, `queryByCorrelationId(id)`, `queryByConcept(term)`. Implementation can be as simple as an in-memory index rebuilt at startup from the JSONL, or as sophisticated as a SQLite overlay (the `SqliteEventLog` in `@senars/core` already exists as an alternative backend).

**The Unlocked Capability: Time-Travel Debugging & Cognitive Analytics**
The developer (or the agent itself via self-tools) can ask: "What was the agent thinking at cycle 4,203?" and get the full cognitive state at that point — active focuses, bag contents, pending derivations, gate decisions — without replaying from genesis. The `retrospect()` function from TODO24 becomes dramatically more powerful: instead of aggregating over episodes, it can query the full event timeline for a session. The self-improvement loop can identify *when* a strategy change degraded performance by correlating parameter changes with quality metrics across the timeline.

---

### 7. `Focus` → Hierarchical Focus Tree

**The Current State:** `Focus` is a flat, isolated reasoning vessel. Each focus has its own `Bag<Task>` and `Bag<Concept>`, a weight in the `FocusBag`, and optionally attached games and reflexes. The `FocusBag` samples focuses by weight and allocates budget. There is no parent-child relationship between focuses — they are all peers.

**The Refactoring:**
Allow focuses to have children. A `Focus` gains an optional `children: Focus[]` and a `parent?: Focus`. Budget allocation becomes hierarchical: the `FocusBag` allocates to root focuses, and each parent focus distributes its budget among its children (using the same `Bag<T>` sampling mechanism). Attention propagation can flow up (child success boosts parent priority) and down (parent goals prime child concepts). The existing `GameFocus` and `MetaFocus` become special cases of a general hierarchical focus.

**The Unlocked Capability: Delegated & Structured Reasoning**
A "research" focus can contain child focuses for "literature review", "experiment design", and "analysis", each with its own budget, games, and reflexes. The parent focus coordinates, the children execute. This enables genuine multi-agent reasoning within a single SeNARS instance — the children can be different cognitive configurations (different strategies, different LM rules, different reflexes) working on sub-problems. The `SelfMetaGame` can observe the entire tree and propose restructuring (merge underperforming children, split overloaded ones).

---

### 8. Derivation Strategies → Strategy Composition Algebra

**The Current State:** Derivation strategies (`BagStrategy`, `SampledDerivation`, `FocusedDerivation`, `AnytimeDerivation`, `ExhaustiveStrategy`) are selected via config. One strategy is active at a time per focus. The `CognitiveController` can switch strategies via `adapt()`, but strategies cannot be composed — you can't say "try focused for 3 cycles, then fall back to sampled."

**The Refactoring:**
Define a strategy composition algebra. A `StrategyExpression` is either a primitive strategy name, or a composition: `sequence(a, b)` (try a, then b), `parallel(a, b)` (run both, take the first result), `conditional(pred, a, b)` (if pred, use a, else b), `loop(a, n)` (repeat a up to n times), `timeout(a, ms)` (run a with a time limit, fall back on timeout). The `DerivationStrategy` interface gains a `compose(expr: StrategyExpression): DerivationStrategy` factory. The existing strategies become primitives in the algebra.

**The Unlocked Capability: Adaptive Reasoning**
The agent can express reasoning plans like: "Try focused derivation on this goal for 5 cycles. If no result, broaden to sampled derivation. If still no result after 10 cycles, escalate to exhaustive." The `CognitiveController` or `SelfMetaGame` can propose strategy compositions based on retrospective evidence (TODO25's `adaptFromRetrospective` currently switches strategy by name; with composition, it could propose "the focused strategy works for entailment queries but fails for temporal queries — use `conditional(isTemporal, sampled, focused)`"). The strategy audit from retrospectives becomes directly actionable.

---

### 9. `EpisodicMemory` → Temporal Causal Graph

**The Current State:** `EpisodicMemory` stores episodes as flat records: `{ type, content, context, timestamp }`. Episodes have no explicit relationships to each other. The `retrospect()` function joins episodes by `correlationId` and `turnId`, but there is no causal or temporal ordering beyond timestamp.

**The Refactoring:**
Add optional `causes: string[]` (episode IDs that caused this episode), `consequences: string[]` (episode IDs that this episode caused), and `context: string[]` (episode IDs that provide context) to the `Episode` type. These edges form a temporal causal graph over the episodic memory. The existing `getEpisodes({ type })` filter is extended with `getEpisodes({ causedBy: episodeId })` and `getEpisodes({ leadingTo: episodeId })` traversals. Edges are populated automatically where possible (e.g., a `reaction` episode caused by a `dialogue` episode) and can be annotated by the `SchemaInductor` or `ReasoningAboutReasoning` analyzer.

**The Unlocked Capability: Causal Reasoning Over Experience**
The agent can answer "why did this happen?" by traversing the causal graph backward. The retrospective can identify causal chains: "The user corrected the agent (episode 42), which caused a reaction label (episode 43), which led to a contrastive memory update (episode 44), which improved the groundedness score on the next similar query (episode 51)." The self-improvement loop can identify which interventions actually caused improvements, rather than just correlating them temporally. This directly feeds the `ReasoningAboutReasoning` analyzer's gap detection: "I corrected X but the correction didn't propagate to Y — the causal chain is broken."

---

### 10. LM Rules → Declarative Rule Graph with Conditional Activation

**The Current State:** 20+ LM rules (belief, goal, question, meta categories) are independently registered. Rule selection uses strategies (`AllSelector`, `PrioritySelector`, `RotationSelector`, `DiverseSelector`). Each rule has activation conditions (confidence, connectivity, curiosity, complexity), but rules don't reference each other. The output of one rule doesn't feed the input of another within a single reasoning cycle.

**The Refactoring:**
Model LM rules as nodes in a directed graph. Each rule node declares its inputs (what it consumes: observations, beliefs, prior rule outputs) and outputs (what it produces: candidates, hypotheses, explanations). Edges between rules carry data. Add conditional edges: "if `hypothesis-generation` produces output with confidence < 0.5, activate `uncertainty-calibration`." The `LMRule` class gains optional `dependsOn: string[]` and `feeds: string[]` declarations. The `RuleProcessor` executes the graph in topological order within each cycle, respecting AIKR budget bounds.

**The Unlocked Capability: Multi-Step LM Reasoning Chains**
The agent can perform multi-step LM-assisted reasoning within a single cycle: "observe → hypothesize → calibrate uncertainty → generate explanation → validate against beliefs." Currently, each of these is a separate rule that fires independently; with the rule graph, they compose into a pipeline. The `SchemaInductor` can induce common rule chains as schemas ("when hypothesis-generation is followed by uncertainty-calibration, the combined output quality is higher than either alone"). The self-improvement loop can propose new rule edges based on retrospective evidence of which rule combinations produce the best-graded outputs.

---

Continuing the series, here are six more refactoring opportunities, each targeting a different subsystem and unlocking a distinct capability class.

---

### 11. `ParameterTable` → Parameter History with Outcome Correlation

**The Current State:** `ParameterTable` holds ~50+ tunable knobs across priority, LM, attention, inference, and strategy categories. `setMany(scope, entries)` batches writes and actuates only changed parameters. `RLFPLearner` and `SelfMetaGame` can tune parameters, and TODO25's `RetrospectiveAdapter` can switch strategies based on retrospective evidence. But there is no record of *which parameter changes correlated with which outcomes*. The system tunes blindly — it can change a knob but cannot learn which changes helped and which hurt.

**The Refactoring:**
Add a `ParameterHistory` append-only ledger alongside `ParameterTable`. Every `setMany` call records `{ scope, parameter, oldValue, newValue, trigger, timestamp }`. A `ParameterOutcomeLinker` correlates parameter changes with downstream quality signals (trace grades, groundedness scores, retrospective correction rates, Brier scores from the flywheel) over a configurable lag window. The history is queryable: `history.query({ parameter: 'maxDerivationDepth', improvedOnly: true })` returns only changes that correlated with measurable improvement.

**The Unlocked Capability: Online Cognitive Configuration Learning**
The agent can answer "which of my settings actually help?" by correlating its own tuning history with outcome data. The `CognitiveController.adapt()` method, instead of applying heuristic adjustments, can query the history for the parameter configuration that historically produced the best outcomes for the current task type. The `SelfMetaGame` can propose parameter changes backed by empirical evidence rather than drive-based heuristics. Over time, the agent builds a per-task-type profile of optimal cognitive parameters — a form of meta-learning about its own configuration space.

---

### 12. Tick Pipeline → Composable Stage Graph with Conditional Branching

**The Current State:** The kernel micro-tick is a fixed linear sequence of 11 stages: `perceive | recall | attend | reason | propose | negotiate | authorize | act | validate | learn | consolidate`. The pipeline is constructed via `createPipeline()` and instrumented via `instrumentPipeline()`. Stages always run in order, even when some are unnecessary (e.g., running `perceive` when no new observations have arrived, or running `consolidate` when bag pressure is low).

**The Refactoring:**
Replace the fixed stage array with a `StageGraph` — a directed acyclic graph where each node is a stage and edges carry activation conditions. A stage runs only if its incoming edge conditions are satisfied. Conditions can reference cognitive state: bag pressure, pending task count, last perception timestamp, drive intensities, AIKR budget remaining. The existing `DEFAULT_PIPELINE` becomes the default graph with all edges unconditionally active (behavior-identical). New graphs can skip stages, repeat stages (e.g., run `consolidate` twice under high pressure), or reorder them (e.g., `recall` before `perceive` when the agent is in a reflective mode).

**The Unlocked Capability: Adaptive Cognitive Cycles**
The agent's inner loop becomes context-sensitive. Under high bag pressure, the cycle automatically prioritizes `consolidate` and `learn` over `reason`. When no new perceptions are pending, `perceive` is skipped entirely. When the agent is in a goal-directed mode (high drive intensity), `propose` and `negotiate` run before `reason` to prioritize action. The `CognitiveController` can switch between stage graphs the same way it switches derivation strategies — making the *shape of the cognitive cycle itself* a tunable, learnable parameter.

---

### 13. `ToolManager` → Capability Ontology with Automatic Composition

**The Current State:** Tools are registered individually with schemas (`ToolSpecSchema`). Tool selection is done by the LM via function calling or by NAR goal matching (`executeToolGoal`). Tools don't know about each other — there's no way to express "tool A requires tool B" or "tool C is an alternative to tool D" or "tools E and F can be chained to accomplish G." The `ToolRegistry` is a flat catalog.

**The Refactoring:**
Introduce a `CapabilityOntology` layer on top of `ToolManager`. Each tool declares its capabilities (what it can do), prerequisites (what it needs), alternatives (what can substitute for it), and compositions (what sequences of tools achieve a higher-level capability). The ontology is a graph: capabilities are nodes, tools are edges. A `CapabilityResolver` can answer "what tool sequence achieves capability X?" by searching the graph. The existing `executeToolGoal` path is unchanged — the ontology is a query layer, not an execution layer.

**The Unlocked Capability: Automatic Tool Composition & Gap Detection**
The agent can plan multi-step tool use: "to answer this question, I need to `web-fetch` the page, then `code-exec` to parse it, then `remember` to store the result." The `CapabilityResolver` finds this chain automatically. The `SelfMetaGame` can detect capability gaps: "I need a tool that can do X but don't have one — propose scaffolding it." The `SchemaInductor` can induce common tool chains as reusable schemas: "the sequence `web-fetch → code-exec → remember` is frequently used together — promote it as a composite tool."

---

### 14. `GroundingPipeline` → Dynamic Source Reputation with Track-Record Learning

**The Current State:** `SourceQuality` is a fixed enum: `PRIMARY (0.9)`, `SECONDARY (0.7)`, `GENERAL (0.55)`, `TERTIARY (0.4)`, `LLM_PRIOR (0.5)`. The `GroundingPipeline` maps source types to confidence ceilings at the `PerceptionGate`. Quality is static — a source that has been wrong 90% of the time still gets the same confidence ceiling as one that has been right 90% of the time.

**The Refactoring:**
Add a `SourceReputation` tracker alongside `GroundingPipeline`. Each source (identified by a stable key — URL domain, peer agent ID, LM provider) accumulates a track record: how many of its claims were subsequently confirmed vs. contradicted by higher-quality evidence. The source's effective confidence ceiling becomes a function of its base quality *and* its track record: `effectiveConfidence = baseQuality * reputationMultiplier`. The `RewardGate` already processes reward signals without mutating beliefs — the reputation update follows the same pattern: it adjusts *trust*, not *truth*.

**The Unlocked Capability: Adaptive Trust & Source Reliability Learning**
The agent learns which sources to trust over time. A peer agent that consistently provides accurate delegations gets its `PEER_AGENT` confidence ceiling raised; one that provides inaccurate results gets lowered. An LLM provider whose formalizations are frequently corrected gets its `LLM_PRIOR` ceiling reduced. The `SourceReputation` is queryable: `.sources` CLI shows the reputation table. The `Retrospective` can include a source audit: "which sources contributed the most corrections this session?" This directly feeds TODO25's curriculum — probes can target low-reputation sources for verification.

---

### 15. Memory Subsystems → Unified Cross-Memory Query Interface

**The Current State:** Working memory (`Memory` with concept bags), episodic memory (`EpisodicMemory` with JSONL episodes), and semantic memory (concept associations, embedding similarity) are separate subsystems with separate APIs. There is no way to ask a question that spans all three: "find all episodes related to concept X, including working memory activations and semantic associations." The `retrospect()` function in TODO24 already needs to join dialogue turns (episodic) with trace grades (working memory context) — it does this manually via `correlationId`.

**The Refactoring:**
Introduce a `MemoryQuery` facade that accepts a query expression and fans out to all three memory subsystems. The query language is simple: `{ concept?: Term, episodeType?: EpisodeType, timeRange?: [number, number], minPriority?: number, embedding?: Float32Array, similarityThreshold?: number }`. The facade returns a unified `MemoryResult` that merges episodes, concept activations, and semantic associations, ranked by relevance. The existing subsystem APIs are unchanged — the facade is a read-only query layer.

**The Unlocked Capability: Cross-Memory Reasoning & Analogical Retrieval**
The agent can perform memory-spanning queries: "what do I know about X across all my experience?" This enables analogical reasoning ("find past situations similar to the current one"), context-aware consolidation ("consolidate episodes related to the currently active concepts"), and memory-guided attention ("boost priority of concepts that have recent episodic support"). The `SchemaInductor` can use cross-memory queries to find derivation patterns that span multiple sessions. The `Retrospective` can use it to produce richer session analyses that include not just dialogue turns but also the semantic context they activated.

---

# AIKR-Bounded Processing: The Bag Pattern for Schema Induction and Beyond

## The SchemaInductor Revision

The current `SchemaInductor` processes derivation chains in an unbounded, batch-oriented manner: it receives all available chains, proposes schemas (via LM or pattern matching), and stores them. This violates AIKR — no capacity pressure, no graceful degradation, no anytime semantics, no attention economy.

The revision replaces the batch pipeline with two `Bag<T>` instances participating in the existing AIKR attention economy:

- **Input Bag** (`Bag<SchemaInput>`, capacity 256): Incoming derivation chains are admitted with priority computed from novelty × chain length. When bag pressure exceeds threshold (0.7), induction is triggered. Lowest-priority inputs are evicted on overflow. Decay reduces priority each cycle.

- **Candidate Bag** (`Bag<SchemaCandidate>`, capacity 128): Induced schemas live here with priority = frequency × confidence. Candidates decay if not reinforced. When priority crosses promotion threshold AND frequency ≥ minimum, the candidate is promoted to `SchemaStore`. Below-floor candidates are evicted (forgotten).

Induction itself becomes budget-bounded and interruptible: `induce({ budget, signal })` samples chains from the input bag (priority-weighted, probabilistic), extracts structural patterns, optionally queries the LM, and yields `SchemaCandidate`s. It respects `AbortSignal`, returns partial results if interrupted, and cooperative-yields between steps. A `induceIfPressured()` wrapper makes it a no-op below the pressure threshold — suitable for calling from the kernel micro-tick's `consolidate` stage.

The LM path is optional and degrades gracefully: on LM failure, symbolic structural induction still produces candidates. Determinism is preserved via injectable `RandomSource` (the TODO20 T1 pattern).

## The Abstract Pattern

This revision isn't specific to schema induction. It instantiates a general pattern: **AIKR-Bounded Candidate Processing** — the universal shape of any cognitive process that accumulates items over time and must process them under insufficient knowledge and resources.

The pattern has six stages:

```
1. ADMIT     — items enter with computed priority (novelty, relevance, source quality)
2. ACCUMULATE — bag fills; pressure rises; low-priority items evicted
3. TRIGGER   — pressure > threshold activates processing (or explicit budget grant)
4. PROCESS   — sample(budget) from bag; process sampled items; yield partial results
5. EMIT      — results enter a downstream bag or store with their own priority
6. DECAY     — priorities erode per cycle; stale items are forgotten
```

Every stage is bounded. Every stage is interruptible. Every stage degrades gracefully. The `Bag<T>` provides the data structure; the pattern provides the cognitive discipline.

## Where Else This Pattern Applies

The codebase has at least seven processes that currently operate in batch or unbounded mode and would benefit from the same revision:

**1. Memory Consolidation.** Episodes accumulate in `EpisodicMemory`. Currently, consolidation triggers on bag pressure but processes episodes sequentially without priority-weighted selection. A `Bag<Episode>` with priority = recency × emotional salience × connection count would let the system consolidate the most important experiences first, forget the least relevant, and yield partial consolidation under interruption.

**2. LM Rule Firing.** Rules have activation conditions (confidence, connectivity, curiosity, complexity) and selection strategies (`AllSelector`, `PrioritySelector`, `RotationSelector`, `DiverseSelector`). But once selected, all activated rules fire. A `Bag<RuleActivation>` with priority = activation score × expected utility would let the system fire the highest-value rules first, skip low-value ones under budget pressure, and decay stale activations.

**3. Distillation Training.** Labels accumulate in `JudgmentDataset` from conversations, reflexes, corrections, and arcade play. Training currently runs as a batch job (`train.ts`). A `Bag<DistillationLabel>` with priority = novelty × disagreement × source quality would let the system train on the most informative labels first, skip redundant ones, and trigger training when label pressure exceeds threshold — closing the flywheel continuously rather than in batch runs.

**4. Self-Improvement Proposals.** `SelfMetaGame` emits `SelfImprovementProposal`s that route through `ProposalRouter`. Currently, proposals are processed in arrival order. A `Bag<SelfImprovementProposal>` with priority = expected impact × risk-inverse × drive-alignment would let the system address the highest-leverage improvements first, defer low-impact ones, and forget proposals that have been superseded.

**5. Hard Negative Mining.** `mineHardNegatives` extracts negatives from NARS contradictions and episodic errors. Currently it processes all available sources. A `Bag<HardNegativeCandidate>` with priority = discrimination margin × recency × rubric relevance would let the system mine the most informative negatives first, skip low-margin ones, and trigger mining when contradiction pressure rises.

**6. Contrastive Calibration.** `ContrastiveMemory` maintains per-rubric exemplars with a 40/60 replay cap. Currently, calibration processes all exemplars. A `Bag<CalibrationExemplar>` with priority = informativeness × recency × diversity would let the system calibrate on the most discriminative exemplars first, skip redundant ones, and trigger recalibration when exemplar pressure exceeds threshold.

**7. Tool Execution.** `ToolManager` executes tools requested by NAR goals or LM rules. Currently, tools execute in request order subject to budget gates. A `Bag<ToolRequest>` with priority = goal priority × expected utility × cost-inverse would let the system execute the highest-value tools first, defer expensive ones under budget pressure, and forget stale requests.

## The Unifying Interface

All seven processes (plus SchemaInductor) share the same structural interface:

```typescript
interface AIKRProcessor<TInput, TOutput> {
  admit(item: TInput, priority: number): void;
  pressure(): number;
  process(opts?: { budget?: number; signal?: AbortSignal }): Promise<TOutput[]>;
  processIfPressured(opts?: { signal?: AbortSignal }): Promise<TOutput[]>;
  decay(): void;
}
```

Each concrete implementation provides:
- A priority function (domain-specific: novelty, utility, informativeness, impact)
- A processing function (domain-specific: induction, consolidation, training, mining)
- A promotion/emission criterion (domain-specific: frequency threshold, confidence threshold, impact threshold)
- Capacity and decay configuration

The `Bag<T>` provides the bounded queue mechanics. The `AIKRProcessor` interface provides the cognitive contract. Concrete implementations provide the domain logic.

## Why This Matters

The pattern converts batch processes into **cognitive processes**. The difference is not merely performance — it's epistemic:

- A batch process assumes it can see everything, process everything, and remember everything. This violates AIKR.
- A cognitive process assumes it will see too much, can process only some, and must forget most. This is AIKR.

The Bag pattern makes AIKR operational: bounded capacity forces prioritization, probabilistic sampling forces attention allocation, decay forces forgetting, pressure triggers action, and interruptibility forces anytime semantics. Every process that adopts this pattern becomes a proper cognitive process — one that knows how to forget, how to prioritize, and how to yield partial results under interruption.

SchemaInductor is the first candidate because it's the simplest and most isolated. But the pattern is the real deliverable: once proven on schema induction, it becomes the standard revision for every batch process in the codebase.

---


### 22. `Agent` Macro-Cycle → Pluggable Phase Pipeline

**The Current State:** The Agent macro-cycle is `Perceive → Recall → Reason → Narrate → Act → Consolidate`, hardcoded in the `Agent` class. The kernel micro-tick (11 stages) already uses a pluggable pipeline (`createPipeline()`, `instrumentPipeline()`). But the macro-cycle does not. Adding a new phase (e.g., a `Reflect` phase for metacognitive analysis, or a `Consult` phase for multi-agent delegation) requires modifying the `Agent` class. The dialogue flywheel's capture is a hook (`DialogueCapture.onExchange`) bolted onto the message funnel, not a phase in the cycle.

**The Refactoring:**
Make the macro-cycle a pluggable pipeline of phases, using the same middleware pattern as the kernel micro-tick. Each phase is a function `(context: MacroCycleContext) => Promise<MacroCycleContext>`. The default pipeline preserves the current six phases. New phases can be inserted: a `Reflect` phase after `Reason` that runs `ReasoningAboutReasoning.performMetaCognitiveReasoning()`, a `Capture` phase after `Narrate` that runs `DialogueCapture.onExchange()`, a `Consolidate` phase that runs schema induction and memory compression. The pipeline is configured via `AgentOptions.macroPipeline` and can be different per agent instance.

**The Unlocked Capability: Configurable Cognitive Architectures**
Different agent configurations can have different macro-cycles. A "reflective" agent adds a `Reflect` phase for self-analysis. A "collaborative" agent adds a `Consult` phase for multi-agent delegation. A "learning" agent adds a `Capture` phase for dialogue flywheel integration. The dialogue flywheel becomes a first-class cognitive phase rather than a bolt-on hook. The kernel micro-tick and the agent macro-cycle share the same pipeline abstraction, unifying the two levels of cognitive control. The `CognitiveController` can switch macro-pipelines the same way it switches derivation strategies.

---


### 20. `ContrastiveMemory` → Self-Maintaining Exemplar Pool

**The Current State:** `ContrastiveMemory` maintains per-rubric positive and negative exemplars with a 40/60 replay cap. Exemplars are seeded manually via `refreshSystemOneContrastive(episodic?)` or `seedContrastiveMemory`. The InfoNCE calibration (`fitInfoNCE`) trains on whatever exemplars are present. Hard negatives are mined from NARS contradictions and episodic errors via `mineHardNegatives`. But the exemplar pool is static between manual refresh calls — it does not grow, prune, or rebalance on its own.

**The Refactoring:**
Make the exemplar pool self-maintaining by participating in the AIKR attention economy. Each exemplar carries a priority score based on: discrimination margin (how well it separates positives from negatives), recency, and rubric coverage. When a new judgment is resolved with high confidence (via `decide()`), it is automatically considered for promotion to an exemplar if it improves rubric coverage or discrimination. When the pool exceeds capacity, the lowest-priority exemplars are evicted. The 40/60 ratio becomes a target, not a hard cap — the pool self-balances. The `ContrastiveMemory` gains a `decay()` method called per cognitive cycle, reducing priority of stale exemplars.

**The Unlocked Capability: Continuous Contrastive Improvement**
The contrastive layer improves continuously from the agent's own experience without manual intervention. The flywheel closes: judgments → exemplars → better judgments → better exemplars. The groundedness gate, dispatcher routing, and LMReflex verification all benefit from an exemplar pool that adapts to the agent's actual reasoning patterns. The dialogue flywheel's correction embeddings (TODO24 I6) become automatic contrastive exemplars when they improve discrimination, closing the loop from human corrections to manifold calibration.

