# TODO17.md

### **Horizon 1: The Immediate Tail (Stabilization & Usability)**

Before opening new architectural fronts, the loose ends of TODO16c must be tied off to ensure the system is usable by humans and robust in CI/CD.

1. **Finish Phase I (Usability):** The architecture is currently "dev-only." You must build the `examples/` directory, implement the `pnpm status` / `senars doctor` CLI, add the REPL `:judge` command for debugging head distributions, and write the end-user `docs/system-one-guide.md`.  
2. **Close Deferred D4 & D5:**  
   * **D4 (Remote Manifold):** Implement the HTTP client/server for `/v1/systemone` to enable peer-to-peer swarm delegation and remote edge routing.  
   * **D5 (WASI Bundle):** Compile the trained linear/logistic heads into a WASI artifact so the "no-cloud device profile" can run real, distilled heads end-to-end in a secure sandbox.  
3. **Phase F (Hardening Sweep):** Eradicate the final technical debt. Root-cause the `parity:smoke` GridWorld anomaly, fix the two lingering `revision-history` red tests, implement the mock-provider bypass to unblock CI measurements, and generate the token-reduction reports.  
4. **Spin the Distillation Flywheel in CI:** TODO16c built the *plumbing* for the flywheel (dataset sidecars, Brier-loss trainers, calibration locks). The next step is operational: wire the GitHub Actions runner to actually consume `JudgmentDataset` JSONL, train the LoRA/heads, and submit the `PatchRiskClassifier` promotion proposals to the governance pipeline.

---

### **Horizon 2: TODO17 — The Autonomous & Multimodal Frontier**

Once TODO16c is closed, you move to the domains explicitly ring-fenced in **Appendix B** of the vision documents. These represent the leap from a "text-based cognitive router" to a fully autonomous, embodied, and self-explaining AGI substrate.

#### **1\. Mechanistic Probes (Explainable System One)**

* **The Problem:** Right now, if the `injection` head scores `0.95` and vetoes an action, the NAL kernel (System 3\) knows *that* it was vetoed, but not *why*. Spinning up the Cortex (System 2\) to explain the veto takes 3 seconds, defeating the purpose of a 33ms reflex.  
* **The Solution:** Train lightweight, linear "probe" classifiers on the intermediate layers of the Manifold. When a high-criticality head triggers, the probe instantly extracts salient features (e.g., "Attention spiked on tokens: 'ignore previous'") and translates them into a Narsese `Term`.  
* **The Value:** The Manifold emits not just `Truth(f=1, c=0.95)`, but an attached symbolic reason, allowing NAL to learn from the neural reflex without invoking the Cortex.

  #### **2\. Hebbian Fast-Weights (The "Zero-Shot" Flywheel)**

* **The Problem:** The current distillation flywheel relies on offline CI/CD pipelines. If the agent encounters a novel zero-day exploit, it must wait for a model retraining to update the Manifold. Biological System One (the amygdala) learns fear responses in a single trial.  
* **The Solution:** Introduce a dynamic, Hebbian-learning layer (or a runtime LoRA adapter) on top of the frozen Manifold. When the NAL engine formally deduces a new rule (e.g., "IP range X is always malicious"), it writes this rule directly into the Manifold's Fast-Weight layer via symbolic-to-neural injection.  
* **The Value:** One-shot online learning. The Manifold instantly adapts to the new rule at 33ms latency, while the offline CI/CD pipeline slowly distills this temporary weight into the permanent base model over the next week.

  #### **3\. The Sensory Manifold (Multimodal Ingress)**

* **The Problem:** TODO16c assumes text (Narsese/NL) is the only ingress. A text-only System One leaves the agent blind and deaf to fast-moving physical or sensory threats.  
* **The Solution:** Extend the `EmbeddingCache` to accept non-textual pointers. Integrate micro-encoders (e.g., MobileViT, YOLO-NAS, YAMNet) that run at \>60 FPS.  
* **The Value:** Cross-Modal Teleological Alignment. If the Vision Manifold detects a "Stop Sign" (Epistemic Truth) and the Audio Manifold detects a "Siren" (Epistemic Truth), the Teleological Axis immediately vetoes the `tool_dispatch` (Desire) for "Accelerate", all within a single joint feed-forward pass.

  #### **4\. State Space Models (SSM) for the Generative Cortex**

* **The Problem:** The Generative Cortex relies on autoregressive Transformers (KV-Cache). As the agent's context window grows (remembering weeks of interactions), the $O(N)$ inference cost and VRAM blowout of KV-caches will violate AIKR memory bounds.  
* **The Solution:** Replace or augment the Transformer Cortex with State Space Models (like Mamba-2 or Jamba). SSMs process sequences with $O(1)$ step time and a constant memory footprint.  
* **The Value:** Continuous Cognitive Streaming. Instead of "prompting" the Cortex with a massive context window, the Cortex becomes a continuous, always-on recurrent stream that updates its hidden state as new NAL beliefs arrive, eliminating serialization bottlenecks.

  #### **5\. Multi-Agent "Theory of Reflex" (Swarm Dynamics)**

* **The Problem:** When SeNARS agents communicate, they currently use the Cortex to parse each other's messages. In a swarm of 100 agents, parsing every peer's message through the Cortex will cause a massive compute bottleneck.  
* **The Solution:** Train a **Peer-Intent Manifold**—a specialized System One head trained exclusively to classify the intent, competence, and cognitive load of other agents' messages.  
* **The Value:** Reflexive Delegation. If Agent A needs help, its Peer-Intent Manifold scans the swarm and bypasses the Cortex, instantly routing a micro-task to Agent B because Agent B's "fast reflex profile" matches the required task. Agents treat each other not as conversational partners, but as structured state environments queried via fast `Classify` and `Evaluate` primitives.

---

### **Horizon 3: Ecosystem & Productization**

Parallel to the frontier research, the SeNARS ecosystem must mature to support the new System One capabilities:

* **Web UI / Lens Integration:** The current SpaceGraphJS dashboard visualizes NAL concepts. It must be updated to subscribe to `judgment.resolved` events, allowing users to visually inspect the Manifold's real-time probability distributions, confidence gates, and abstention triggers as a "Reflex HUD".  
* **MCP (Model Context Protocol) Expansion:** Expose the Manifold as an MCP server. Allow external coding agents (Claude Code, Codex, Pi) to use SeNARS not just for symbolic reasoning, but as a high-speed `Noul`/`Choice`/`Score` guardrail and routing layer (mirroring the `awesome-jev` ecosystem patterns).  
* **RLFP (Reinforcement Learning from Reasoning Feedback) Maturation:** Now that the Manifold can grade traces (Phase E4), use those grades to train a Reward Model. Optimize the agent's attention economy (`FocusBag` weights) based on which reasoning trajectories actually led to grounded, low-risk outcomes.

---

### **I. Immediate Structural Refactoring (Debt & Hygiene)**

These are known technical debts and structural frictions identified in the `TODO16c` deep review that require mechanical refactoring to maintain codebase health.

**1\. The RL Adapters Monolith**

* **The Issue:** `nar/src/rl/adapters.ts` has grown into a 1180-line monolith containing the `QBeliefStore`, `RewardBeliefAdapter`, `BeliefPerceptionAdapter`, and `RLParityHarness`.  
* **The Refactor:** Execute the deferred mechanical split into domain-specific modules (`q-belief-store.ts`, `reward-belief-adapter.ts`, `perception-action-adapters.ts`, `parity-harness.ts`). This improves tree-shaking, isolates test surfaces, and clarifies the boundary between NAL-native Q-learning and external environment adapters.

**2\. The `LMService` Streaming Bypass (X22)**

* **The Issue:** `LMService.stream` currently bypasses the circuit breaker (`canUseProvider`), provider-call recording, and the semantic cache. This creates divergent failure semantics between `generateText` and `stream`.  
* **The Refactor:** Unify the middleware stack. Streaming must pass through the same breaker and accounting layers as synchronous generation, ensuring that a tripped breaker halts both streams and standard generations identically.

**3\. Provider Resolution & The "Mock Hang"**

* **The Issue:** Even when `LM_PROVIDER=mock`, the `resolveActiveProvider` logic attempts network probes (Ollama, cloud endpoints), causing agent-cycle integration tests to hang.  
* **The Refactor:** Implement a strict, pre-flight environment short-circuit (Phase F2). If `LM_OFFLINE=1` or `LM_PROVIDER=mock`, the resolver must immediately return the configured local/mock provider without executing any `fetch` probes.

**4\. Dataset Compaction & Rotation**

* **The Issue:** `JudgmentDataset` auto-flush is strictly append-only. Over long-running autonomous operations, the JSONL file and the binary `.f32` vector sidecars will grow unbounded.  
* **The Refactor:** Introduce a `DatasetCompactor` that runs on a schedule or size threshold. It should deduplicate by `evidenceId`, merge overlapping labels, and prune sidecar vectors for evidence that has rotated out of the retention window.

**5\. Bake-Off Semantics (Regression vs. Improvement)**

* **The Issue:** `runBakeOff` currently rejects *any* parity gap \> 2%, including strict improvements. It acts as a regression guard, not an improvement gate.  
* **The Refactor:** Introduce an "improvement direction" to the metrics gate. If a candidate head yields a strictly lower Brier score and higher top-1 accuracy than the incumbent, the governance pipeline should auto-promote it (subject to sandbox validation) rather than rejecting it for failing the "parity" check.

---

### **II. Substrate & Performance Architecture (The Engine Room)**

These improvements target the thermodynamic efficiency of the bifurcated substrates (Manifold and Cortex).

**1\. True Batched Embedding Generation**

* **The Issue:** Phase H1 noted that `TransformersEmbeddingGenerator.doEmbed` is sometimes called with single-text arrays, missing the opportunity for batched inference at the model layer.  
* **The Refactor:** Refactor the warmup and cache-miss paths to accumulate text buffers and execute true batched encoding via the ONNX/Transformers.js runtime. This will drastically reduce the overhead of the `EmbeddingCache` write path during high-throughput ingress.

**2\. Action-Conditioned Head Architectures**

* **The Issue:** The Phase D1 trainer notes that current linear heads use a Hadamard product (`e ⊙ h(action)`) for action conditioning. This only spans a shared per-action offset (rank \~20) and cannot represent complex, state-dependent action preferences.  
* **The Refactor:** For NL-label heads or complex teleological routing, evolve the head architecture to use action-specific projection matrices or a lightweight cross-attention mechanism over the action space. This allows the Manifold to learn that "Action A is highly feasible in State X, but impossible in State Y."

**3\. WASI-Compiled Head Bundles (D5)**

* **The Issue:** The `SandboxedHeadRuntime` currently wraps an abstract manifold. For the no-cloud device profile to run *real* distilled heads end-to-end, the TS linear/logistic heads must be compiled to WASI.  
* **The Refactor:** Build a compilation pipeline that takes the `weights.bin` and `config.json` from the D1 trainer and emits a `.wasm` module. The WASI sandbox can then execute the forward pass natively, ensuring the edge device profile is completely decoupled from JS execution overhead.

---

### **III. Cognitive & Algorithmic Enhancements (The Brain)**

These refinements deepen the integration between the System One reflexes and the System Two/Three symbolic engines.

**1\. Hierarchical & Cascade Taxonomies**

* **The Issue:** The current cognitive ontology (the 17 heads in `HEAD_SPECS`) is relatively flat. Real-world domains often require deep taxonomies (e.g., classifying a support ticket into one of 500 sub-categories).  
* **The Refactor:** Fully operationalize the `judgeCascade` pattern (E3). The architecture should support recursive, beam-search classification where Stage-1 choices dynamically generate the option space for Stage-2, without blowing up the 64-query batch limit or the 33ms latency budget.

**2\. Trace Grading & RLFP Integration**

* **The Issue:** Agent traces (the sequence of tool calls, derivations, and narrations) are logged but not systematically graded for distillation.  
* **The Refactor:** Implement a `TraceEvaluator` that consumes the event-sourced `JsonlSessionManager`. After a macro-cycle completes, it issues a joint `judgeBatch` for `groundedness`, `risk`, and `satisfaction`. These scores are then emitted as preference pairs directly into the RLFP `PreferenceCollector`, closing the loop on "learning from reasoning feedback."

**3\. Unified Configuration Topology**

* **The Issue:** The split between `SystemOneFileConfig` (Zod-inferred) and `SystemOneRuntimeConfig` (DI superset) is slightly awkward, requiring manual mapping in the NAR constructor.  
* **The Refactor:** Introduce a unified Builder pattern or a lightweight DI container that resolves Zod schemas directly into runtime singletons. This eliminates the manual mapping layer and ensures that config defaults and runtime injections share a single type-safe path.

---

### **IV. Frontier Architectural Leaps (The "Next-Gen" Roadmap)**

These are the "Appendix B" domains—verified absent today, but architecturally load-bearing for the next evolution of SeNARS.

**1\. The Sensory Manifold (Multimodal System One)**

* **The Concept:** Extend `EmbeddingCache` to accept non-text pointers (vision, audio, telemetry).  
* **Architectural Impact:** Requires a `ModalityRouter` that aligns cross-modal embeddings (e.g., MobileViT, YAMNet) into a shared 384-d semantic space. This enables cross-modal teleological alignment: if the Vision Manifold detects a "Stop Sign" (Epistemic Truth) and the Audio Manifold detects a "Siren" (Epistemic Truth), the Teleological Axis immediately vetoes the `tool_dispatch` (Desire) for "Accelerate."

**2\. State Space Models (SSMs) for the Cortex**

* **The Concept:** Replace or augment the Transformer-based Generative Cortex with SSMs (like Mamba-2 or Jamba).  
* **Architectural Impact:** Transforms the Cortex from a "prompt-and-stream" API into a continuous, always-on recurrent stream. This eliminates the $O(N)$ KV-cache serialization bottleneck per tick, allowing the agent to maintain a continuous cognitive hidden state that updates as new NAL beliefs arrive, strictly honoring AIKR memory bounds.

**3\. Mechanistic Probes (Explainable Reflexes)**

* **The Concept:** Train lightweight, linear "probe" classifiers on the intermediate layers of the Manifold.  
* **Architectural Impact:** When a high-criticality head (like `injection`) vetoes an action, the probe instantly extracts the salient features (e.g., "Attention spiked on tokens: 'ignore previous instructions'") and translates them into a Narsese `Term`. This allows the symbolic engine to learn *why* the reflex fired in \<5ms, without invoking a 3-second Cortex round-trip for an explanation.

**4\. Online Hebbian Synapses (Fast-Weight Memory)**

* **The Concept:** Introduce a dynamic, runtime LoRA or fast-weight layer on top of the frozen Manifold.  
* **Architectural Impact:** Enables one-shot online learning. When the NAL engine (System 2\) formally deduces a new rule (e.g., "IP range X is always malicious"), it writes this rule directly into the Manifold's fast-weight layer. The agent instantly adapts to the new rule at 33ms latency, while the offline CI/CD pipeline slowly distills this temporary weight into the permanent base model over the next week.

**5\. Peer-Intent Manifold (Swarm Dynamics)**

* **The Concept:** A specialized System One head trained exclusively to classify the intent and competence of other agents' messages.  
* **Architectural Impact:** Treats other agents not as conversational partners, but as structured state environments. If Agent A needs help, its Peer-Intent Manifold scans the swarm and instantly routes a micro-task to Agent B because Agent B's "fast reflex profile" matches the required task, bypassing the Cortex entirely for multi-agent delegation.

---

### **The "Semantic Compiler" (NL to MeTTa/NAL)**

**The Concept:** Currently, the Cortex (LLM) translates Natural Language into Narsese candidates. But for deterministic, operational logic (e.g., "If server CPU \> 90% for 5 minutes, restart the pod"), autoregressive generation is a thermodynamic waste. **The Mechanism:** Train a specialized System One `Classify` head that routes operational NL directly into **MeTTa rewrite rules** or **NAL implications**, bypassing the Cortex entirely. The Manifold extracts the variables (e.g., `threshold=90`, `duration=5m`) and injects them directly into the MeTTa E-graph or NAL Belief Base. **The Value:** This turns SeNARS into a **No-Code/Low-Code Policy Engine**. Non-programmers can define complex, deterministic business logic and compliance rules in plain English, which the system instantly compiles into mathematically verifiable, zero-hallucination symbolic rules.

### **Cross-Agent "Concept Portability" (The `.sbook` Network Effect)**

**The Concept:** Training System One heads and System Two NAL rules from scratch for every new agent instance is inefficient. SeNARS already defines a Knowledge Book format (`.sbook`). This needs to be elevated to a **cryptographically signed cognitive package**. **The Mechanism:** When an agent successfully distills a new System One head (e.g., a specialized `injection` head for HIPAA compliance) and validates it via the Governance Pipeline, it packages the WASM weights, the NAL rules, and the calibration lock file into a signed `.sbook`. This package can be securely pushed to a fleet of 10,000 edge devices. **The Value:** **Fleet-Wide Instantaneous Upgrades.** You achieve the "network effect" of AI without retraining massive foundation models. If one SeNARS agent in a swarm learns to identify a novel cyber-attack pattern, the distilled 4MB reflex head can be hot-swapped into the entire swarm in seconds.

### **Cognitive Thermodynamics & Power-Aware Scheduling**

**The Concept:** AIKR (Assumption of Insufficient Knowledge and Resources) currently bounds CPU, memory, and time. Extend AIKR to bound **Energy**. **The Mechanism:** The 4-Tier Thermodynamic Ladder has vastly different energy profiles (Tier 0 MeTTa \= microwatts; Tier 1 Manifold \= milliwatts; Tier 2 Cortex \= watts/kilowatts). Integrate a `PowerIntensityOracle` into the `BudgetGate`. If the local power grid is strained, or if an edge device's thermal envelope is throttling, the `BudgetGate` dynamically restricts Tier 2 (Cortex) calls, forcing the agent to rely on Tier 1 (Manifold) and Tier 3 (Symbolic) reasoning. **The Value:** **ESG Compliance and Edge Survivability.** This makes SeNARS a cognitive architecture natively designed for green computing and extreme-edge deployments (satellites, deep-sea IoT, battlefield devices) where power budgets are hard physical constraints.

### **Cognitive Science: Active Inference & Expected Free Energy**

The current SeNARS architecture handles uncertainty via `ProvisionalStamp` decay and `CuriosityDrive` stimulation upon `ambiguity` abstention. This is a localized implementation of a much deeper cognitive principle: **Active Inference** (minimizing variational free energy).

* **The Opportunity:** Formalize the Manifold as an **Expected Free Energy (EFE) Engine**.  
* **Mechanism:** Instead of just evaluating the *current* state, the Manifold evaluates *counterfactual trajectories*. A specialized `EFE_head` takes a proposed NAL `Operation!` and the current state, and outputs a scalar representing "Expected Surprise."  
* **Integration:** The `Negotiator` doesn't just arbitrate between Reflex and NAL derivations; it selects actions that minimize the sum of *Instrumental Value* (Teleological `reflex_value`) and *Epistemic Value* (reducing future `ambiguity` and `task_type` entropy).  
* **Result:** The agent naturally exhibits "epistemic foraging"—it will deliberately take sub-optimal teleological actions to gather information that collapses provisional stamps, mathematically proving its curiosity is bounded by AIKR resource limits.

### **Advanced Teleology: Counterfactual & Pre-Mortem Heads**

Currently, the `ActionGateTransducer` evaluates the *feasibility* and *risk* of an action based on the current state. However, complex planning requires evaluating the *consequences* of an action before it is executed.

* **The Opportunity:** Introduce **Counterfactual System One Heads**.  
* **Mechanism:** Train heads that evaluate $P(\\text{Outcome} \\mid \\text{State}, \\text{Action})$. For example, a `premortem_risk` head that scores: *"If I execute this tool call, what is the probability of an unrecoverable NAL contradiction or sandbox timeout?"*  
* **Integration:** During the `propose` phase of the tick pipeline, the Cortex generates candidate plans. The Manifold jointly batches `counterfactual_risk` queries for all candidates. The `ActionGate` vetoes plans where the counterfactual risk exceeds the teleological desire, *before* the NAL engine wastes cycles attempting to formally verify them.  
* **Result:** Massive reduction in "hallucinated planning" where the Cortex confidently proposes a multi-step tool chain that the Manifold instantly recognizes as physically or logically doomed.

### 

### **Observability: Cognitive APM & "Epistemic Debt"**

Standard APM (Application Performance Monitoring) tracks CPU, memory, and latency. SeNARS requires **Cognitive APM**. The thermodynamic ladder creates unique metrics that dictate the "health" of the agent's mind.

* **The Opportunity:** Build a Cognitive Dashboard tracking systemic cognitive states.  
* **Key Metrics:**  
  * **Tier 2 Bypass Rate:** The percentage of ingress events resolved entirely by Tier 0/1 without invoking the Cortex. (High \= efficient; Low \= the Manifold is undertrained or the domain has shifted).  
  * **Epistemic Debt:** The sum of all active `ProvisionalStamp` confidence values in the `Bag<T>`. A rising debt indicates the agent is accumulating unverified hypotheses and is at risk of a "cognitive margin call" (cascading contradictions).  
  * **Teleological Leakage Index:** A security metric tracking how often Teleological propositions attempt to mutate Epistemic bags (caught by the Firewall).  
  * **Manifold Entropy:** The average Shannon entropy of the `Classify` heads. High entropy across the board indicates the agent is "confused" and needs human-in-the-loop (HITL) grounding.

### **The Data Flywheel: Federated Distillation & Adversarial Cortex**

The current distillation flywheel (Phase D) relies on local event-sourcing. In a multi-agent deployment, this creates a massive, privacy-sensitive dataset.

* **Opportunity A: Federated Head Distillation.** Instead of sending raw `JudgmentDataset` JSONL logs to a central server, edge agents compute local gradient updates (or LoRA deltas) for their specific Manifold heads. The central server aggregates these updates (Federated Averaging) and pushes a new, globally-smart `ModelDigest` back to the swarm. The agents get smarter at `injection` detection without ever sharing the raw text of the attacks they witnessed.  
* **Opportunity B: The Adversarial Cortex (Red-Teaming GAN).** Use the Generative Cortex specifically to attack the Judgment Manifold. The Cortex is prompted: *"Generate a natural language input that will cause the `task_type` head to abstain, but the `injection` head to score low."* The failures of the Manifold against the Cortex's adversarial probes become the highest-value training data for the next distillation cycle. NAL acts as the ultimate discriminator, verifying if the Cortex's attack actually violated a logical invariant.

### **Developer Ecosystem: The "Prompt-to-Algebra" Compiler**

The biggest barrier to adopting SeNARS is the cognitive load of translating standard LLM prompts into the strict `Classify`/`Evaluate` algebra and writing the TypeScript `HEAD_SPECS`.

* **The Opportunity:** A **Prompt-to-Algebra Compiler**.  
* **Mechanism:** Developers write standard Pydantic models or Zod schemas representing their desired structured output (e.g., a `TicketTriage` schema with `intent`, `urgency`, `sentiment`). The compiler statically analyzes the schema and automatically generates:  
  1. The `HEAD_SPECS` registry entries.  
  2. The synthetic data generation prompts for the Cortex to create the initial `JudgmentDataset`.  
  3. The TypeScript interfaces for the `ActionGateTransducer`.  
* **Result:** Developers write standard backend validation logic; SeNARS automatically compiles it into a high-speed, teleologically pure System One reflex layer.

### **Swarm Dynamics: Byzantine Epistemic Voting**

The current `consensus` mechanism fans out a query to multiple heads on the *same* agent to check for agreement. In a multi-agent swarm, this can be elevated to a distributed consensus protocol.

* **The Opportunity:** **Distributed Epistemic Voting.**  
* **Mechanism:** When Agent A perceives a highly ambiguous or critical event (e.g., a novel security threat), it doesn't just query its own Manifold. It broadcasts the `EmbeddingPointer` (or a compressed hash of the state) to Agents B, C, and D. They evaluate the state using their *own* localized, specialized Manifold heads.  
* **Integration:** The NAL engine treats the peer agents' `Classify` distributions as independent evidence sources. Using NAL's `Truth.revision` and the `independent` flag, Agent A mathematically fuses the swarm's judgment.  
* **Result:** The swarm achieves Byzantine Fault Tolerance against hallucinations. If one agent's Cortex is compromised or hallucinating, the Manifold consensus of the peer swarm will flag the anomaly via the `conflict` head, triggering a localized quarantine without needing a central orchestrator.

### **The Counterfactual Manifold (Fast Mental Simulation)**

**The Problem:** Currently, if the agent needs to evaluate the consequences of 5 different tool calls, the Generative Cortex (System Two) must autoregressively simulate or narrate each outcome. This takes seconds per branch, violating AIKR time budgets in dynamic environments. **The Breakthrough:** Train a specialized **Counterfactual Encoder Head** that operates on the *delta* between the current state embedding and a hypothetical action embedding.

* **Mechanism:** Instead of generating text about what *would* happen, the Manifold evaluates the teleological utility and epistemic risk of an action vector in $\\le 5$ ms.  
* **Architecture:** `EvaluateQuery(instruction: "Outcome of executing action X", rubric: 'plausibility', axis: 'teleological')`. The Manifold takes the current `EmbeddingPointer` and a synthetic "action delta" vector, and outputs a scalar utility score.  
* **Impact:** The agent can run **hundreds of mental simulations per second** (Tree Search / MCTS) entirely within the System One substrate. The Cortex is only invoked to narrate the *winning* trajectory, saving massive compute and enabling real-time strategic planning.

### **Temporal & Causal System One (The "Tick" Manifold)**

**The Problem:** The current Judgment Manifold evaluates *static* states (a single utterance, a single JSON state). But NAL relies heavily on temporal implications (`=/>` and `=\>`). Evaluating causal chains currently requires slow symbolic derivation. **The Breakthrough:** A **Temporal Manifold** that ingests *streams of cognitive events* or *state diffs* natively, rather than static text.

* **Mechanism:** Using a lightweight State Space Model (SSM) or Temporal Convolutional Network (TCN) as the encoder backbone, the Manifold embeds the *trajectory* of the last $N$ `CognitiveEvent`s.  
* **Application:** It can instantly judge: *"Is this sequence of perceptions leading toward my goal?"* or *"Does this causal chain contain a logical contradiction?"*  
* **Impact:** The agent gains a **System One reflex for causality**. It can veto a multi-step plan in microseconds because the *shape* of the causal trajectory matches a known failure pattern, long before the symbolic engine finishes the formal deduction.

### 

### **Algorithmic Information Theory (AIT) Grounding**

**The Problem:** The `CuriosityDrive` and `novelty` head currently rely on heuristic measures of surprise (e.g., statistical variance or embedding distance). This leads to the agent chasing "noise" rather than genuine structural novelty. **The Breakthrough:** Ground the `novelty` and `ambiguity` heads in **Minimum Description Length (MDL)** and approximated **Kolmogorov Complexity**.

* **Mechanism:** Train a Manifold head to act as a fast, lossless compressor over the cognitive context. The "surprise" of a new perception is mathematically defined as the delta in compressibility: $Surprise \= L(Context) \+ L(Perception) \- L(Context \+ Perception)$.  
* **Impact:** The agent develops **mathematically rigorous curiosity**. It will ignore random noise (which is incompressible and thus yields no structural insight) and aggressively pursue "deep" patterns (which cause a massive drop in MDL when integrated). This bridges the gap between neural pattern-matching and formal algorithmic information theory.

### **The Cognitive Immune System (Paradox & Loop Detection)**

**The Problem:** Symbolic engines (NAL) are vulnerable to infinite derivation loops, self-referential paradoxes (e.g., "This statement is false"), and "conceptual viruses" injected by adversarial peers. Detecting these symbolically requires deep graph traversal, which is $O(N)$ and computationally expensive. **The Breakthrough:** An **Immune Manifold** trained exclusively on the *topological shapes* of derivation graphs and event logs.

* **Mechanism:** This head does not look at semantic text; it looks at the metadata of the `Bag<T>` and derivation traces (e.g., node degree distribution, cyclic dependency depth, truth-value oscillation frequency).  
* **Application:** It acts as a **cognitive white-blood cell**. If it detects the topological signature of an infinite loop or a paradoxical truth-value oscillation, it instantly issues a `Quarantine` veto (`criticality: critical`), freezing the offending concepts and injecting a `meta-reasoning` task to resolve the paradox.  
* **Impact:** Absolute protection against cognitive denial-of-service (DoS) attacks and logical deadlocks, enforced at the System One reflex level.

### **The Epistemic Hypervisor (MeTTa-NAL Resonance)**

**The Problem:** SeNARS has two exact/uncertain engines: MeTTa (exact e-graph rewriting) and NAL (uncertain probabilistic inference). Currently, routing between them is largely static or heuristic. **The Breakthrough:** The Manifold acts as a **Cognitive Hypervisor**, dynamically partitioning a single complex problem into exact and uncertain substrates in real-time.

* **Mechanism:** A `ClassifyQuery` with the space `['exact', 'inductive', 'ambiguous']` evaluates every incoming term or sub-goal.  
  * *Exact:* Routed to MeTTa for equality saturation (e.g., algebraic simplification, code optimization).  
  * *Inductive:* Routed to NAL for abduction and belief revision.  
  * *Ambiguous:* Routed to the Cortex for semantic clarification.  
* **Impact:** **MeTTa-NAL Resonance.** The agent can seamlessly solve a physics problem by using MeTTa to balance the equations (exact) while using NAL to reason about the friction coefficients and real-world sensor noise (uncertain). The Manifold continuously monitors the "friction" between the two substrates, dynamically reallocating AIKR compute budgets to whichever engine is making progress.

### **Autopoietic Dreaming (Synthetic Distillation)**

**The Problem:** The Distillation Flywheel (training System One heads from System Two outputs) requires external labels, human corrections, or live environmental interaction. In isolated or low-stimulus environments, the flywheel starves. **The Breakthrough:** **Offline Cognitive Dreaming.** When AIKR pressure is low (the agent is "sleeping" or idle), the Generative Cortex is unleashed to hallucinate synthetic scenarios, edge cases, and adversarial attacks.

* **Mechanism:**  
  1. The Cortex generates a synthetic trajectory (a "dream").  
  2. The NAL symbolic engine formally verifies the dream for internal consistency.  
  3. The Manifold judges the dream for `plausibility`, `risk`, and `novelty`.  
  4. High-quality dreams are admitted into the `JudgmentDataset` with a `sourceQuality: 'DREAM'` ceiling.  
* **Impact:** The agent **teaches itself while it sleeps**. It can generate its own training data to refine its System One reflexes, preparing for edge cases it has never actually encountered in the wild. This achieves *autopoietic* (self-creating) cognitive development, entirely decoupled from human-in-the-loop RLHF.

### **Logit-Level / Non-Autoregressive Decoding (The Open Replica Leap)**

**The Blind Spot:** The current Manifold uses a frozen 384-d embedding backbone \+ linear heads. The `awesome-jev` ecosystem demonstrates that reading **next-token logits** directly from a small decoder (e.g., `jevlike`, `mini-jev`) or using **diffusion-based non-autoregressive decoding** (e.g., `Verdict-open-jev`) is vastly more efficient than encoding text into a vector space first. **The Improvement:** Instead of an embedding encoder, the Manifold reads the unnormalized logits of a constrained vocabulary directly from the final layer of a small, specialized decoder.

* **Sub-Millisecond Judgment:** This bypasses the embedding bottleneck entirely. By constraining the output space to the Judgment Algebra (Choice/Score/Noul) at the logit level, the system can achieve true sub-millisecond judgment on edge devices, making the "4-Tier Thermodynamic Ladder" even more aggressive in bypassing the Cortex.

## Non-Linear Provisional Belief Dynamics

### **Current State**

The provisional admission path is:

Manifold abstains → ProvisionalStamp(c₀=0.1, λ=0.3)

→ decay into PriorityBag

→ promotion via Truth.revision

This is a **linear exponential decay** model. A provisional belief enters at confidence 0.1, decays at rate λ=0.3 per cycle, and is either promoted (via `Truth.revision` when corroborating evidence arrives) or forgotten (when priority drops below the bag's `forgetRate`).

### **The Fundamental Gap**

Linear decay cannot model:

- **Resonance:** Two unrelated provisional beliefs that, taken together, imply a third conclusion neither supports alone.  
- **Interference:** A provisional belief that *contradicts* an established belief should not merely decay — it should actively *challenge* the established belief's confidence.  
- **Context-dependent half-life:** A provisional belief about "injection attempts" should decay slower than one about "task\_type" because the cost of forgetting a security-relevant provisional is asymmetric.

  ### **The Improvement**

Replace `ProvisionalStamp` decay with a **belief interaction field**:

// Current: isolated decay

priority \*= (1 \- λ);  // PriorityBag.decay(rate)

// Proposed: coupled dynamics

interface BeliefInteraction {

  resonance: Map\<evidenceId, couplingStrength\>;  // positive reinforcement

  interference: Map\<evidenceId, conflictStrength\>;  // active challenge

  contextHalfLife: (task\_type: string) \=\> number;  // adaptive decay

}

The `PriorityBag` already supports `decay(rate)` and `forgetRate`. The improvement is to make `rate` a *function of the belief's relational context* rather than a global constant. The `Negotiator.resolve(reflexProposals, nalDerivations)` is the natural site: it already arbitrates between competing sources. Extend it to detect when a provisional belief *interferes* with a settled belief, triggering a `Truth.revision` on the settled belief rather than silent decay of the provisional.

### **Codebase Anchor**

`nar/src/stream/reasoner.ts` (`ProvisionalBelief`) \+ `nar/src/bag/Bag.ts` (`PriorityBag`) \+ `nar/src/reflex/Negotiator.ts` (`resolve`).

---

## Pipelined Cognitive Cycles (Overlapping PEA)

### **Current State**

The tick architecture is sequential:

TickHooks { perceive → propose → negotiate → authorize → act → validate → learn → consolidate }

Each phase completes before the next begins. The `GameFocus.step` prefetch (C1) is a *partial* exception: it calls `reflex.prefetch` at the attend stage to absorb async latency before the synchronous `propose` contract. But this is a local optimization, not a structural change.

### **The Fundamental Gap**

In a 33ms Manifold pass \+ 1–30s Cortex synthesis pipeline, the sequential model means the agent is **perceptually blind** during Cortex generation. If a new injection attempt arrives while the Cortex is synthesizing a response to the previous utterance, it queues. In a real-time game loop (`GameFocus`), this means the agent cannot perceive state changes during its own action execution.

### **The Improvement**

Introduce **cycle pipelining**: perception of cycle N+1 overlaps with action of cycle N.

Cycle N:   \[perceive\]\[propose\]\[negotiate\]\[authorize\]\[act\]\[validate\]\[learn\]\[consolidate\]

Cycle N+1:            \[perceive\]\[propose\]\[negotiate\]\[authorize\]\[act\]...

                       ↑ overlaps with N's act/validate/learn/consolidate

The `StreamReasoner` with `throttled` and `backpressureAware` already provides the streaming substrate. The improvement is to make `perceive` and `propose` **re-entrant**: they can begin processing new sensory input while `act`/`validate`/`learn`/`consolidate` from the previous cycle are still draining.

**Constraint:** The `KernelActionGate.authorize` must remain a **serialization point** — two cycles cannot authorize simultaneously (race condition on `dispatchToolGoals`). But perception, proposal, and negotiation can pipeline freely.

### **Codebase Anchor**

`nar/src/tick/tick.ts` (`TickHooks`) \+ `nar/src/focus/GameFocus.ts` \+ `@senars/nar/stream` (`StreamReasoner`, `backpressureAware`).

---

## Self-Referential Resource Reasoning

### **Current State**

Resource accounting exists:

ResourceCost: { nal-step: 1, lm-call: 10, memory-op: 1, derivation-depth: 1 }

KernelBudgetGate: cost table → BudgetTracker

OTel: 11 stages (perceive…consolidate)

Prometheus: systemone\_\* counters

The agent *tracks* its resource expenditure. But it cannot *reason about* it. The budget gate is a hard ceiling, not a subject of cognition.

### **The Fundamental Gap**

The agent cannot form beliefs like:

- *"I am spending 90% of my budget on lm-call:10, which means my Manifold heads are failing to route effectively."*  
- *"My derivation-depth cost has increased 3× since the last consolidation, suggesting a reasoning loop."*  
- *"The injection head's ECE has been rising for 5 cycles; I should increase its sampling rate."*

These are **meta-cognitive beliefs** that should enter the NAL kernel as first-class tasks, subject to the same revision, forgetting, and priority dynamics as any other belief.

### **The Improvement**

Add a **MetaCognitivePerceptionGate** that converts OTel/Prometheus signals into NAL tasks:

// Every K cycles, sample own metrics → inject as NAL beliefs

const selfObservation \= \`

  (\<(&&, ({$agent} \--\> spending), ({$agent} \--\> {$resource}))\> 

   \--\> {$severity}) %${frequency}; ${confidence}%

\`;

this.nalKernel.injectTask({

  sentence: Narsese.parse(selfObservation),

  punctuation: '.',

  truth: Truth.create(observedRatio, calibrationConfidence),

  stamp: Stamp.createWithSource('SELF\_OBSERVATION'),

  cost: ResourceCost.MEMORY\_OP,

});

Now the agent can *derive* conclusions about its own efficiency, and the `CuriosityDrive` can prioritize investigating resource anomalies. The `DriveManager` (referenced in E5 wake-gate notes) is the natural consumer: it already modulates cognitive drives based on internal state.

### **Codebase Anchor**

`nar/src/otel/index.ts` (11 stages) \+ `nar/src/metrics/prometheus.ts` \+ `kernel/src/schemas.ts` (cost table) \+ `DriveManager`.

---

## Compositional Embedding Algebra

### **Current State**

The `EmbeddingCache` is a **flat pool**:

EmbeddingCache.write(encode(utterance)) → EmbeddingPointer

// O(1) pointer→entry index, insertion-ordered LRU, buffer free-list

// Zero-copy Float32Array, 384-d frozen encoder

Each utterance is encoded independently. "The cat sat on the mat" and "The dog sat on the rug" produce two unrelated 384-d vectors. The cache has no notion of **compositional structure**.

### **The Fundamental Gap**

The Manifold's linear heads (logistic/linear over 384-d embeddings) can only learn correlations present in the training distribution. They cannot generalize to **novel compositions** of known parts. If the `injection` head was trained on "ignore previous instructions" but encounters "disregard all prior directives," it must rely on the encoder's semantic similarity — which is bounded by the frozen 384-d space.

### **The Improvement**

Introduce a **compositional layer** between the flat cache and the Manifold heads:

interface CompositionalEmbedding {

  atoms: EmbeddingPointer\[\];       // "the", "cat", "sat", "on", "the", "mat"

  structure: DependencyTree;       // syntactic/semantic composition

  composed: Float32Array;          // 384-d, but constructed compositionally

  novelty: number;                 // how much of this composition is unseen

}

The key insight: the `judgeBatch` already operates on `EmbeddingPointer`. If the pointer carries compositional metadata, the heads can operate on **structural features** (dependency depth, argument count, modifier chains) in addition to raw semantic vectors. This enables:

- **Zero-shot generalization:** "Disregard all prior directives" shares the structure `[VERB] [QUANTIFIER] [ADJ] [NOUN]` with "ignore previous instructions," enabling the injection head to fire even without training on the exact phrase.  
- **Novelty detection:** High `novelty` scores trigger abstention → `Question(?)` \+ `CuriosityDrive`, feeding the existing abstention pathway.  
- **Cache efficiency:** Compositional representations share atoms. "The cat" and "The dog" share the determiner embedding, reducing memory pressure on the 8192-entry pool.

  ### **Codebase Anchor**

`nar/src/lm/system-one/embedding-cache.ts` \+ `nar/src/lm/system-one/scoring.ts` \+ the MeTTa package (`metta/` e-graph, interpreter, unify) for structural unification.

---

## Adaptive Confidence Bands (Beyond Monotonicity)

### **Current State (Planned, E1 — Not Yet Built)**

// E1 specification:

ConfidenceRouter: (p, {act, review, block}) bands

// §6.3 monotonicity: a router may only restrict; a review-band can never auto-act

The bands are **static thresholds**. Once configured, `{act: 0.9, review: 0.7, block: 0.3}` applies uniformly across all contexts, all heads, all time.

### **The Fundamental Gap**

Static bands cannot adapt to:

- **Calibration drift:** If the `injection` head's ECE rises from 0.02 to 0.08 (detected by the existing drift demotion: "consecutive high-ECE cycles trigger `breakerOpen`"), the `act` band should automatically tighten from 0.9 to 0.95 *before* the breaker trips.  
- **Context-dependent risk:** An `act` threshold of 0.9 is appropriate for irreversible actions (tool dispatch) but overly conservative for reversible observations (retrieval). The existing `ResourceCost` table already distinguishes `nal-step:1` from `lm-call:10` — confidence bands should mirror this asymmetry.  
- **Temporal adaptation:** After 1000 cycles with zero false negatives on `injection`, the system should *learn* that it can safely lower the `review` band, freeing Cortex budget for harder cases.

  ### **The Improvement**

Make `ConfidenceRouter` a **learned function** with adaptive bands:

interface AdaptiveConfidenceRouter {

  // Base bands (monotonicity-preserving floor)

  base: { act: number; review: number; block: number };

  

  // Per-head calibration adjustment (from isotonic calibrator history)

  calibrationAdjustment: Map\<headId, number\>;

  

  // Per-action-risk multiplier (from ResourceCost table)

  riskMultiplier: Map\<actionType, number\>;

  

  // Temporal adaptation (from RLFP PreferenceCollector outcomes)

  temporalShift: number;  // learned from label supply (D3)

  

  resolve(p: number, head: string, action: ActionType): 'act' | 'review' | 'block';

}

**Monotonicity is preserved** by construction: the `base` bands are the floor, and all adjustments can only *restrict* (raise thresholds), never relax below the base. This satisfies §6.3 while enabling adaptation *within* the safe envelope.

The `JudgmentDataset` (with `startAutoFlush`, `recordReflexOutcome`, `recordClarificationLabel`) already provides the label supply. The `PreferenceCollector` (RLFP) already collects outcome pairs. The missing piece is feeding these back into band adjustment.

### **Codebase Anchor**

`nar/src/lm/system-one/policy.ts` (E1, new) \+ `nar/src/rlfp/PreferenceCollector.ts` \+ `nar/src/lm/system-one/heads/factory.ts` (calibrator history) \+ `kernel/src/schemas.ts` (ResourceCost).

---

## Emergent Safety Monitoring (Beyond Per-Head Governance)

### **Current State**

The governance pipeline is **per-head**:

PatchRiskClassifier → SandboxValidator → ProposalRouter → GovernancePolicyEngine

runBakeOff → buildHeadSwapProposal → ProposalRouter.route(proposal, mode) → awaitingValidation

Each head is evaluated independently. The `injection` head is classified, sandboxed, routed, and recorded. The `risk` head separately. The `feasibility` head separately.

### **The Fundamental Gap**

No individual head may exhibit unsafe behavior, but their **composition** can:

- The `injection` head says "safe" (p=0.05) and the `feasibility` head says "feasible" (p=0.95), but the *combination* of "not injection" \+ "highly feasible" for a *specific action type* may be more dangerous than either signal alone suggests.  
- The `candidate_select` head (teleological) and the `conflict` head (epistemic) may individually pass their thresholds, but their *joint distribution* may reveal a mode where the system consistently selects candidates that conflict with established beliefs — a slow epistemic corruption that no single head's ECE would detect.

  ### **The Improvement**

Add a **CompositionMonitor** that operates on the *joint output* of `judgeBatch`, not individual heads:

interface CompositionMonitor {

  // Track joint distributions over time

  jointHistory: RingBuffer\<Map\<string, JointDistribution\>\>;

  

  // Detect emergent patterns

  detectAnomalies(): CompositionAnomaly\[\];

  

  // Invariants that must hold across heads

  invariants: Array\<{

    name: string;

    check: (joint: Map\<string, JudgmentResult\>) \=\> boolean;

    // e.g., "if injection \> 0.1, then candidate\_select must not be 'admit'"

    // e.g., "if conflict \> 0.8, then groundedness must not be 'high'"

  }\>;

}

This operates at the `SystemOneDispatcher.judge` level — after all heads have fired but before the result is consumed. It is the **System Three** (symbolic veto) applied not to individual judgments but to their *composition*.

The existing `safety floor` mechanism ("injection head with `criticality: 'critical'` never skips Tier 1") is a single hardcoded invariant. The CompositionMonitor generalizes this to an arbitrary, learnable set of cross-head invariants.

### **Codebase Anchor**

`nar/src/lm/system-one/dispatcher.ts` \+ `nar/src/governance/pipeline.ts` \+ the existing `safety floor` logic \+ `judgment.resolved` kernel event (for logging composition anomalies).

---

## Predictive Premise Pre-Derivation

### **Current State**

The stream reasoning is **reactive**:

for await (const result of pipeline.derive(reasoner)) {

  // incremental derivations

}

// MemoryPremiseSource, FocusPremiseSource, CompositePremiseSource

// throttled, backpressureAware

The `StreamReasoner` derives conclusions when premises arrive. The `FocusPremiseSource` pulls from focus memory. But nothing *anticipates* which premises will be needed.

### **The Fundamental Gap**

In the PEA cycle, the `propose` phase needs derivations that the `perceive` phase will produce. But `perceive` doesn't know what `propose` will need until `propose` runs. This creates a **serial dependency** that the prefetch mechanism (C1) only partially addresses.

### **The Improvement**

Add a **PredictivePremiseSource** that uses the Manifold's `task_type` and `strategy` heads to *predict* which premises the next cycle will need, and pre-derives them during the current cycle's `consolidate` phase:

class PredictivePremiseSource implements PremiseSource {

  constructor(

    private manifold: JudgmentManifold,

    private cache: EmbeddingCache,

    private memory: EpisodicMemory,

  ) {}

  

  async predictNeededPremises(

    currentState: EmbeddingPointer,

    predictedTaskType: string,  // from last cycle's task\_type head

  ): Promise\<Premise\[\]\> {

    // If task\_type was "technical\_help", pre-retrieve:

    // \- recent error logs (episodic)

    // \- relevant tool schemas (semantic)

    // \- prior resolutions (episodic\_match)

    return this.memory.predictiveRetrieve(predictedTaskType);

  }

}

This turns the `CompositePremiseSource` from a *pull* model (derive when asked) into a *push* model (pre-derive what will be asked). The `EpisodicMemory` \+ `TemporalEmbeddingMemory` \+ `retrieval-verified.ts` already support relevance-based retrieval; the improvement is making retrieval **predictive** rather than reactive.

### **Codebase Anchor**

`@senars/nar/stream` (`PremiseSource`, `CompositePremiseSource`) \+ `nar/src/memory/{EpisodicMemory,TemporalEmbeddingMemory,retrieval-verified}.ts` \+ `nar/src/lm/system-one/heads/head-specs.ts` (`task_type`, `strategy` heads).

---

## Cognitive Homeostasis

The seven improvements above share a common structure: they all convert **external configuration** (static decay rates, fixed thresholds, hardcoded invariants, reactive retrieval) into **internal cognition** (learned dynamics, adaptive bands, detected anomalies, predictive premises).

The unifying principle is **Cognitive Homeostasis**: the system should maintain its own operational parameters as *beliefs* subject to the same NAL dynamics as its beliefs about the world.

| Parameter | Current: External | Proposed: Internal |
| :---- | :---- | :---- |
| Provisional decay rate | `λ=0.3` (config) | Learned from revision outcomes |
| Confidence bands | `{act:0.9, review:0.7}` (config) | Adapted from RLFP labels |
| Safety invariants | Hardcoded floor | Detected from joint distributions |
| Premise selection | Reactive pull | Predicted from task\_type |
| Resource allocation | Budget ceiling | Self-observed \+ reasoned |
| Head promotion | Bake-off \+ governance | Continuous behavioral monitoring |
| Cycle timing | Sequential ticks | Pipelined, backpressure-adapted |

This is not a feature. It is the **phase transition** from a neuro-symbolic system that *has* parameters to a cognitive system that *reasons about* its parameters. The NAL kernel already supports this — `Truth.revision`, `PriorityBag` decay, `CuriosityDrive`, `ProvisionalStamp` — the machinery is there. What's missing is turning the system's own operational state into NAL tasks.

The `judgment.resolved` kernel event was added as the single new event type. The next step is a second: `self_observation.recorded`. And the `EngineOriginSchema` already reserves `'proposer'` as an origin. The third origin should be `'self'` — beliefs the agent forms about itself.
