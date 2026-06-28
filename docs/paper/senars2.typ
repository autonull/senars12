// SeNARS: A Neuro-Symbolic Cognitive Architecture
// Merged Final Draft - compile with: typst compile senars2.typ

#set document(
  title: "Semantic Non-Axiomatic Reasoning System (SeNARS)",
  author: "SeNARS Developers",
)

#set page(
  paper: "us-letter",
  margin: 0.75in,
  columns: 2,
  header: context {
    let page-num = counter(page).get().first()
    if page-num > 1 [
      #text(size: 9pt, fill: gray)[SeNARS: Neuro-Symbolic Cognitive Architecture #h(1fr) #page-num]
    ]
  },
)

#set text(font: "New Computer Modern", size: 10pt)
#set par(justify: true)
#set heading(numbering: "1.")

// Color definitions
#let primary = rgb("#173f5f")
#let secondary = rgb("#3c6e8c")
#let accent = rgb("#20b2aa")

// Custom styling
#show link: it => text(fill: secondary, it)
#show heading.where(level: 1): it => block(above: 2em, below: 1em)[
  #text(fill: primary, weight: "bold", size: 14pt, it)
]
#show heading.where(level: 2): it => block(above: 1.5em, below: 0.8em)[
  #text(fill: primary, weight: "bold", size: 11pt, it)
]

// Abbreviations
#let senars = smallcaps[SeNARS]
#let nal = smallcaps[NAL]
#let nars = smallcaps[NARS]

// ==============================================================================
// TITLE
// ==============================================================================

#place(top + center, float: true, scope: "parent")[
  #block(width: 100%)[
    #align(center)[
      #v(0.5em)
      #text(size: 16pt, weight: "bold", fill: primary)[
        Semantic Non-Axiomatic Reasoning System (#senars)
      ]
      #v(0.3em)
      #text(size: 11pt)[
        A Hybrid Neuro-Symbolic Platform for Cognitive Architecture Research
      ]
      #v(0.8em)
      #text(size: 10pt)[SeNARS Developers]
      #h(1em)
      #text(size: 9pt)[#link("https://github.com/automenta/senars11")[github.com/automenta/senars11]]
      #v(0.3em)
      #text(size: 8pt, style: "italic")[
        Preprint • CC-BY-4.0 • Source: AGPL-3.0
      ]
      #v(0.8em)
    ]
  ]
]

// ==============================================================================
// ABSTRACT
// ==============================================================================

#block(fill: luma(248), inset: 1em, radius: 4pt, width: 100%)[
  *Abstract.* #senars is a hybrid neuro-symbolic reasoning system that integrates Non-Axiomatic Logic (NAL) with large language models (LLMs) to create an observable, stream-based platform for cognitive architecture research. Unlike pure symbolic systems that struggle with real-world ambiguity, or pure neural approaches that lack interpretability and consistency, #senars combines the formal rigor of NAL with the pattern recognition capabilities of modern language models.

  The architecture implements a continuous, non-blocking dataflow pipeline that processes streams of premises into conclusions while maintaining epistemic stability through explicit truth values and evidence tracking. Symbolic NAL rules execute synchronously with rigorous truth-value propagation; LLM queries dispatch asynchronously through circuit-breaker-protected channels. Dual memory separates short-term attention from long-term storage with automated consolidation.

  Crucially, this paper describes a _deliberately incomplete_ system---designed as substrate for an ecosystem of cognitive architectures rather than a finished application. We argue that minimal, extensible foundations enable more diverse and innovative applications than complete but rigid systems.

  #v(0.5em)
  #text(size: 9pt)[
    *Keywords:* neuro-symbolic AI, cognitive architecture, non-axiomatic logic, hybrid reasoning, stream processing, deliberate incompleteness, epistemic uncertainty
  ]
]

#v(1em)

// ==============================================================================
// 1. INTRODUCTION
// ==============================================================================

= Introduction and Motivation

The field of artificial intelligence faces a fundamental tension between two dominant paradigms: symbolic AI systems that provide formal guarantees and interpretability but struggle with real-world complexity, and neural network approaches that excel at pattern recognition but lack transparency and consistency. This paper introduces #senars (Semantic Non-Axiomatic Reasoning System), a hybrid architecture designed to bridge this divide.

#v(0.5em)

== Limitations of Pure Symbolic NARS

The Non-Axiomatic Reasoning System (NARS), developed by Pei Wang, represents a significant departure from classical logic systems. Rather than assuming complete and consistent knowledge, NARS operates under the Assumption of Insufficient Knowledge and Resources (AIKR)---recognizing that any real-world system must reason with incomplete, uncertain, and potentially contradictory information under finite computational resources.

Despite its theoretical elegance, pure symbolic NARS implementations face practical limitations:

- *Knowledge Acquisition*: Converting natural language knowledge into formal Narsese representations requires significant manual effort.
- *Grounding Problem*: Atomic terms lack inherent semantic content, relying entirely on structural relationships.
- *Scaling Challenges*: Building comprehensive knowledge bases with controlled vocabularies is labor-intensive.
- *Natural Language Interface*: Users must learn Narsese syntax to interact effectively.

#v(0.5em)

== Limitations of Pure LLM Approaches

Large language models have demonstrated remarkable capabilities in natural language understanding, generation, and even reasoning tasks. However, they exhibit fundamental limitations for autonomous agent applications:

- *Epistemic Instability*: LLMs produce different outputs for semantically equivalent queries, making them unreliable for maintaining consistent beliefs.
- *Lack of Persistence*: Without external memory, LLMs have no mechanism for accumulating and revising knowledge over time.
- *No Intrinsic Goals*: LLMs are purely reactive, completing patterns without autonomous drives or objectives.
- *Hallucination*: LLMs confidently generate plausible but false statements, with no mechanism for uncertainty quantification.
- *Opacity*: The reasoning process within LLMs remains largely uninterpretable.

#v(0.5em)

== The SeNARS Solution

#senars addresses these complementary weaknesses through a hybrid architecture where:

+ *NAL provides the skeleton*---persistent memory, formal truth values, goal-directed behavior, and epistemic consistency.

+ *LLMs provide the flesh*---natural language processing, semantic grounding, world knowledge, and pattern recognition.

#v(0.5em)

== Vision: An Ecosystem of Minds

Imagine a future where cognitive architectures are as diverse as biological species. A medical diagnostic system might emphasize caution and explanation; an educational tutor might favor Socratic questioning; a creative assistant might embrace exploratory leaps. All would share common primitives---truth values, memory consolidation, hybrid inference---while diverging in strategy, domain knowledge, and personality.

#senars aspires to be the common ancestor: a minimal, coherent substrate from which this ecosystem can evolve. Not a product to be consumed, but a seed to be grown.

// ==============================================================================
// 2. BACKGROUND
// ==============================================================================

= Background

== Non-Axiomatic Logic and NARS

Non-Axiomatic Logic (NAL) is a formal logic system designed for reasoning under uncertainty with finite resources. Unlike classical logics that assume complete knowledge and unlimited computational resources, NAL embraces the Assumption of Insufficient Knowledge and Resources (AIKR).

NAL represents knowledge through *terms* connected by *copulas*, with associated *truth values*:

- *Inheritance (→)*: "A → B" means A is a specialization of B
- *Similarity (↔)*: Bidirectional similarity relationship
- *Implication (⇒)*: Conditional relationship between statements

Additional copulas and connectors exist and may be added in future extensions. *Truth values* consist of two components:
- *Frequency (f)*: The proportion of positive evidence (range 0--1)
- *Confidence (c)*: The reliability of the frequency estimate (range 0--1)

This representation, written as {f, c}, enables principled reasoning through truth value revision rules that combine evidence while accounting for overlapping sources through *evidential stamps*.

NARS distinguishes task types by punctuation: *Beliefs (.)* for declarative knowledge, *Goals (!)* for desired states, and *Questions (?)* for queries.

OpenNARS demonstrated these principles in research settings. ANSNA explored a minimal implementation for embedded systems. #senars continues this lineage, reimagining the architecture for modern streaming systems and neural integration.

#v(0.5em)

== The AIKR Principle

The *Assumption of Insufficient Knowledge and Resources* (AIKR) is the foundational premise of NAL. Unlike classical logics that assume complete, consistent knowledge, AIKR acknowledges that any real intelligent agent operates under fundamental constraints:

#block(inset: (left: 0.5em))[
  *Insufficient Knowledge.* The agent never has complete information. Facts may be unknown, uncertain, or contradictory. No closed-world assumption is valid.

  *Insufficient Resources.* Computation, memory, and time are always finite. Exhaustive search is impossible.

  *Real-time Demands.* Decisions must be made before complete analysis is possible. Waiting for certainty means missing opportunities.
]

AIKR has profound implications for system design:
- *Graded truth*: Beliefs carry explicit uncertainty rather than binary true/false
- *Evidence accumulation*: New observations revise rather than replace existing beliefs
- *Anytime reasoning*: Inference produces useful partial results at any interruption
- *Resource-bounded*: Computation allocated by importance, not exhaustive search
- *Graceful degradation*: Quality degrades smoothly under resource pressure

Every architectural decision in #senars reflects AIKR: truth values quantify uncertainty, priority-based sampling allocates attention, bounded Focus forces consolidation, streaming produces conclusions continuously, and circuit breakers ensure responsiveness.

#v(0.5em)

== LLM Reasoning Advances

Recent work has shown that Large Language Models can approximate structured reasoning when properly prompted. Chain-of-Thought elicits step-by-step reasoning; ReAct interleaves reasoning with actions; Reflexion introduces verbal self-critique; Toolformer teaches models to invoke external APIs.

These techniques demonstrate that LLMs can _simulate_ structured reasoning. But they lack formal grounding: no explicit uncertainty quantification, no persistent memory across sessions, no guarantee of logical consistency. #senars provides the missing infrastructure, using NAL as the backbone and LLMs as a knowledge-rich oracle.

// ==============================================================================
// 3. ARCHITECTURE
// ==============================================================================

= Architecture

#senars implements a *streaming dataflow architecture* that continuously transforms observations and queries into conclusions and actions. The design emphasizes immutability for correctness, non-blocking execution for responsiveness, and explicit extension points for adaptability.

#v(0.5em)

== Design Principles

+ *Immutable Data Foundation*: Core data structures (Terms, Tasks, Truth, Stamps) are immutable, ensuring consistency and enabling efficient caching.
+ *Component-Based Architecture*: All major components inherit from a common base with standardized lifecycle (initialize, start, stop, dispose).
+ *Pipeline-Based Processing*: Continuous stream architecture for processing premises into conclusions.
+ *Resource Awareness*: CPU throttling, backpressure handling, and derivation depth limits.
+ *Observable Reasoning*: Complete visibility into reasoning processes through event-driven communication.

#v(0.5em)

== Core Data Structures

*Terms.* The fundamental unit of knowledge representation. A Term may be atomic (a symbol like `bird`) or compound (a relation like `bird → animal`). The `TermFactory` normalizes equivalent terms and caches them for reuse.

*Truth Values.* Every statement carries a truth value comprising frequency (how often true) and confidence (evidential strength). Truth values propagate through inference according to NAL semantics.

*Stamps.* Evidence tracking for cyclicity detection, revision, and provenance. Each Stamp records a unique identifier, occurrence time, and source.

*Tasks.* The unit of processing. A Task contains a Term, truth value, stamp, priority, and punctuation indicating its type.

#v(0.5em)

== The Streaming Pipeline

The reasoning pipeline operates as a continuous dataflow system. Tasks enter through a *PremiseSource* that samples from memory according to configurable objectives: priority-based sampling favors high-importance tasks, recency-based sampling prefers recently updated information, punctuation-focused sampling prioritizes goals or questions, and novelty sampling favors tasks with fewer derivation steps. Selected tasks flow to a *Strategy* component that creates premise pairs---combining the primary premise with relevant secondary premises from memory. These pairs proceed to the *RuleProcessor*, which executes both synchronous NAL rules and asynchronous LM rules in parallel. Results merge into a unified output stream that feeds back into memory, completing the cycle.

#v(0.5em)

== Stream Reasoner Strategies

The Strategy component is responsible for pairing primary premises with appropriate secondary premises. #senars provides four distinct strategies, each suited to different reasoning scenarios:

*BagStrategy* implements NARS-style priority-sampled reasoning. It maintains an internal bag of limited capacity, adding new tasks and evicting lowest-priority items when the bag overflows. This approach supports "anytime" reasoning under resource constraints---the system produces useful partial results regardless of when computation is interrupted. Priority-based sampling ensures that more important tasks receive preferential treatment without starving lower-priority items entirely.

*ExhaustiveStrategy* performs comprehensive search for all related beliefs. For each primary premise, it scans available tasks looking for common variables, structural similarity, or term inclusion. This strategy is thorough but computationally expensive, making it suitable for situations where complete analysis is preferred over speed. It identifies tasks that share predicates, have overlapping term structures, or contain/are contained by the primary premise.

*PrologStrategy* implements goal-driven backward chaining with full unification and backtracking. Unlike strategies that merely approximate Prolog behavior, PrologStrategy is designed to achieve *complete computational parity* with the Prolog programming language. It maintains a knowledge base of facts and rules, standardizes variables to prevent collisions during recursion, and implements the full unification algorithm including occurs-check. Built-in predicates for arithmetic evaluation (`is`, comparison operators) and correct handling of rule body conjunction enable expressing arbitrary Prolog programs. The strategy supports configurable depth limits and maximum solution counts to bound computation while preserving semantic correctness.

*ResolutionStrategy* provides goal-driven backward chaining specifically optimized for question answering. When processing goals or questions (tasks with `!` or `?` punctuation), it searches for supporting premises that could help achieve the goal---either directly matching beliefs or implications whose consequent matches the goal. For non-goal premises, it falls back to standard premise selection. This hybrid approach efficiently handles mixed workloads.

*RuleProcessor* executes inference rules in a hybrid manner:
- Synchronous NAL rules execute immediately with rigorous truth propagation
- Asynchronous LM rules dispatch without blocking the reasoning cycle
- Results merge into a unified output stream

#v(0.5em)

== LM Integration Rules

#figure(
  caption: [Language Model Integration Rules],
  table(
    columns: (auto, 1fr),
    inset: 5pt,
    align: (left, left),
    stroke: 0.5pt + luma(200),
    fill: (_, y) => if y == 0 { luma(240) },
    [*Rule*], [*Function*],
    [Concept Elaboration], [Generate properties/classifications using commonsense knowledge],
    [Narsese Translation], [Convert natural language to formal Narsese syntax],
    [Hypothesis Generation], [Generate related hypotheses from existing beliefs],
    [Uncertainty Calibration], [Map qualitative uncertainty to quantitative truth values],
    [Temporal/Causal Modeling], [Infer time order and causal relationships from text],
    [Explanation Generation], [Generate natural language explanations from derivations],
    [Belief Revision], [Update beliefs based on new evidence via LM reasoning],
    [Goal Decomposition], [Break complex goals into achievable subgoals],
    [Interactive Clarification], [Request clarification for ambiguous inputs],
    [Meta-Reasoning Guidance], [Guide reasoning strategy selection],
    [Schema Induction], [Discover patterns and schemas from examples],
    [Variable Grounding], [Ground abstract variables to concrete instances],
    [Analogical Reasoning], [Find and apply analogies between domains],
  )
)

#pagebreak(weak: true)

== Dual Memory Architecture

#senars implements a biologically-inspired dual memory system:

*Focus (Short-term).* High-priority, limited-capacity memory for immediate processing. The Focus system implements attention: selecting which tasks receive reasoning resources based on priority, recency, and diversity constraints.

*Long-term Memory.* Persistent storage for all Concepts (collections of Tasks sharing a common Term) with specialized indexes for efficient retrieval.

*Consolidation.* Intelligent movement between memory types based on priority and usage. Configurable forgetting policies manage memory pressure.

#v(0.5em)

== Layer System

The Layer system manages semantic connections between concepts, providing infrastructure for both explicit and implicit relationships:

*TermLayer.* Explicit connections between terms with priority-based management. Connections are typed (inheritance, similarity, implication) and carry weights that decay over time without reinforcement.

*EmbeddingLayer.* Vector embeddings for semantic similarity computation. Enables approximate matching when exact term matches fail, bridging the gap between symbolic precision and neural flexibility.

#v(0.5em)

== Hybrid NAL-LLM Integration

The key architectural innovation is *non-blocking hybrid execution*:

- *NAL rules* execute synchronously with rigorous truth-value propagation.
- *LM rules* execute asynchronously; results integrate with assigned confidence values reflecting source reliability.
- *Circuit breakers* detect LM failures (timeouts, rate limits, errors) and automatically fall back to pure symbolic reasoning.
- *Validation gates* allow NAL constraints to filter or adjust LM outputs before integration, maintaining epistemic consistency.

*Epistemic Anchoring*: When the LM generates information that contradicts established high-confidence beliefs, the NAL system can reject or down-weight the LM output. For example, if #senars holds the belief "(fire → hot) {1.0, 0.9}", an LM hallucination suggesting fire is cold would be rejected.

#v(0.5em)

== The Cognitive Operating System Analogy

We conceptualize the NAL-LLM relationship through an "operating system" analogy: the LLM functions as a powerful *CPU/ALU* that can rapidly process symbols and patterns but has no persistent state. The NAL system acts as the *kernel*:

- *Scheduler*: The reasoning pipeline determines which "processes" receive LLM compute time.
- *Filesystem*: Memory and Term structures provide persistent storage of beliefs and goals.
- *Permissions*: Truth values and evidence stamps determine what information is trusted.
- *Goals*: The belief/goal distinction provides intentionality that reactive LLMs lack.

Where LLMs are fluid and context-dependent, #senars provides the _anchor_---stable beliefs that persist across sessions and constrain ephemeral neural outputs.

// ==============================================================================
// 4. IMPLEMENTATION
// ==============================================================================

= Prototype Implementation

The current #senars prototype is implemented in JavaScript (Node.js), emphasizing accessibility and rapid iteration.

#v(0.5em)

== Codebase Architecture

#figure(
  caption: [Source Code Directory Structure],
  table(
    columns: (auto, 1fr),
    inset: 4pt,
    align: (left, left),
    stroke: 0.5pt + luma(200),
    fill: (_, y) => if y == 0 { luma(240) },
    [*Directory*], [*Purpose*],
    table.cell(colspan: 2, fill: luma(230))[_Core Library (core/src/)_],
    [`reason/`], [Reasoner, RuleProcessor, Strategy, PremiseSource],
    [`  rules/`], [NAL inference rules (deduction, induction, etc.)],
    [`  strategy/`], [BagStrategy, PrologStrategy, ExhaustiveStrategy],
    [`memory/`], [Memory, Focus, Bag, Concept, MemoryIndex],
    [`  indexes/`], [Specialized term/task indexes],
    [`lm/`], [LM providers, NarseseTranslator, EmbeddingLayer],
    [`term/`], [Term, TermFactory, normalization],
    [`task/`], [Task, priority, punctuation],
    [`parser/`], [Narsese tokenizer, parser, AST],
    [`util/`], [Logging, EventBus, CircuitBreaker, metrics],
    table.cell(colspan: 2, fill: luma(230))[_External Interfaces_],
    [`ui/`], [React web UI for visualization],
    [`repl/`], [Interactive command-line interface],
    [`tests/`], [Unit, integration, e2e tests],
    [`examples/`], [Usage examples and demos],
  )
)

#v(0.5em)

== User Interfaces

#senars provides multiple interfaces for different use cases:

+ *TUI (Text User Interface)*: Command-line REPL for direct system interaction
+ *Web UI*: React/Vite-based visualization with graph visualization of concepts, reasoning trace panels, task flow diagrams, priority histograms, and real-time concept activation monitoring
+ *WebSocket Monitor*: Real-time system monitoring through web connections

#v(0.5em)

== Performance Metrics

#figure(
  caption: [Key metrics for evaluating #senars deployments.],
  table(
    columns: (auto, 1fr),
    inset: 4pt,
    align: (left, left),
    stroke: 0.5pt + luma(200),
    fill: (_, y) => if y == 0 { luma(240) },
    [*Metric*], [*Relevance*],
    table.cell(colspan: 2, fill: luma(235))[_Reasoning Efficiency_],
    [Inferences/sec], [Raw symbolic reasoning throughput],
    [Rule match rate], [Fraction yielding valid conclusions],
    [Derivation depth], [Average chain length],
    table.cell(colspan: 2, fill: luma(235))[_Memory Management_],
    [Concept count], [Knowledge breadth in long-term memory],
    [Focus utilization], [Attention efficiency],
    [Term cache hit ratio], [Term normalization effectiveness],
    table.cell(colspan: 2, fill: luma(235))[_Hybrid Integration_],
    [LM query latency], [Neural responsiveness],
    [LM success rate], [Query reliability],
    [Circuit breaker trips], [External service stability],
    table.cell(colspan: 2, fill: luma(235))[_System Responsiveness_],
    [End-to-end latency], [Time from input to first output],
    [Memory footprint], [Deployment constraints],
  )
)

#v(0.5em)

== Validation

The prototype includes comprehensive testing:
- Unit tests for all core data structures (Term, Task, Memory, RuleEngine)
- Integration tests for component interaction and system behavior
- Property-based tests for verification of system invariants
- End-to-end reasoning chain validation

#v(0.5em)

== Operational Capabilities

What works today:
- Complete NAL inference with truth propagation across all copula types
- Multiple reasoning strategies with configurable selection
- Priority-based sampling with recency, novelty, and punctuation objectives
- Resource management: CPU throttling, backpressure, derivation depth limits
- LM integration with automatic failover and circuit breaker protection
- Real-time visualization of reasoning traces and concept activation
- Bidirectional natural language ↔ Narsese translation
- WebSocket-based monitoring for remote observation

#v(0.5em)

// ==============================================================================
// 5. DELIBERATE INCOMPLETENESS
// ==============================================================================

= Deliberate Incompleteness

This section presents what we believe to be a novel contribution to AI system design philosophy: the principle of *deliberate incompleteness*.

#v(0.5em)

#block(inset: (left: 1.5em, right: 1.5em), fill: luma(248), radius: 4pt)[
  _"This is not being built to be a finished application. It is being built to be substrate---the common seed for a future industrial ecosystem of cognitive architectures. The less complete it is right now, the more possibilities it can grow into."_
]

This philosophy represents a deliberate inversion of typical software development practices. Rather than maximizing features before release, #senars intentionally leaves aspects "rough, partial, or missing" to enable diverse applications.

History shows that "finished" systems tend to ossify. Once a platform presents itself as complete, the friction required to modify it increases dramatically:
- Users depend on specific behaviors
- Documentation hardens into dogma
- Communities fragment over backward compatibility
- Innovation migrates to workarounds rather than foundations

Consider the most generative platforms in computing history. Early Unix succeeded precisely because it was _unfinished_---minimal primitives that invited completion. The Linux kernel remains perpetually incomplete. The web browser was deliberately underspecified, spawning an ecosystem of frameworks.

In AI specifically, the most influential contributions are often frameworks rather than finished products. OpenAI Gym provided minimal abstractions for RL environments. Transformers provided attention mechanisms without prescribing applications. Each enabled diverse completions while preserving a common core.

#v(0.5em)

== The Stability Contract

Deliberately incomplete doesn't mean arbitrary. #senars maintains stability in three core areas:

+ *Core Reasoning Stream*: The pipeline architecture is stable and well-defined
+ *Observation Contract*: The event system and visibility mechanisms are consistent
+ *Hybrid Integration*: The NAL-LM collaboration pattern is established

These stable foundations provide the "skeleton" upon which diverse "flesh" can grow.

#v(0.5em)

== Invitation to Fork

We envision multiple #senars lineages, each completed differently:

/ Minimal Edge Reasoners: Stripped-down implementations for embedded/IoT
/ High-Agency Planners: Extensions for autonomous goal pursuit
/ Educational Sandboxes: Interactive environments for teaching AI reasoning
/ Personal Memory Layers: Lifelong persistent context for individual users
/ Multi-Agent Societies: Distributed reasoning across networks of agents
/ Alternative Logics: Entirely new formal systems beyond NAL

All would share the core pipeline, enabling cross-pollination: a performance optimization from one fork could benefit others; a novel strategy could migrate across applications.

#v(0.5em)

== Extension Points

/ Strategy: New premise-pairing algorithms via Strategy interface
/ LM Providers: Custom integrations via provider registry
/ Memory Policies: Configurable forgetting, consolidation, indexing
/ Rule Sets: Dynamic registration of custom NAL and LM rules
/ Truth Functions: Alternative uncertainty representations
/ Layers: Custom connection types (TermLayer, EmbeddingLayer)

_If something you need is not here yet, that is by design. Fork it and grow it into the species you need._

// ==============================================================================
// 6. FUTURE DIRECTIONS
// ==============================================================================

= Future Directions

== Technical Challenges

*Performance Optimization:*
- Achieving sub-1ms targets across complete reasoning cycles
- Optimizing memory consolidation for larger knowledge bases
- Reducing latency for LLM integration without sacrificing robustness

*Scaling:*
- Distributed reasoning across multiple nodes
- Horizontal scaling for large knowledge bases
- Efficient serialization for knowledge transfer between agents

*Integration Depth:*
- Deeper semantic grounding through embedding layers
- Bidirectional learning between NAL and LM components
- Automatic translation quality improvements between Narsese and natural language

#v(0.3em)

== RLFP: Reinforcement Learning from Preferences

#senars incorporates a Reinforcement Learning from Preferences (RLFP) framework that enables the system to learn _how_ to think, not just _what_ to think. This approach optimizes the discretionary choices made during reasoning: which task to select from focus memory, which inference rule to apply, whether to invoke symbolic or neural reasoning, and how to allocate attention across active goals.

The architecture introduces four modular components. The *ReasoningTrajectoryLogger* listens to the event bus and records complete reasoning episodes---sequences of state-action pairs from problem to conclusion---with metadata including cycle counts and LM invocations. The *PreferenceCollector* gathers both explicit feedback (users comparing reasoning traces side-by-side) and implicit signals (accepted conclusions, rejected LM outputs, high-confidence revisions). The *RLFPLearner* trains a preference model that predicts expected preference scores for candidate actions, effectively internalizing human standards of "good thinking." The *ReasoningPolicyAdapter* bridges learning and execution, querying the preference model for action distributions and blending learned policies with heuristic baselines at configurable weights.

Training proceeds in three phases. *Bootstrapping* creates initial training data by perturbing heuristic choices and having a teacher LM or domain expert label trajectory comparisons. *Online Learning* integrates real user preferences, gradually increasing the learned policy's influence. *Meta-Reasoning Optimization* extends the framework to optimize the learning process itself---when to reflect on past reasoning, when to adjust policy weights, when to request user feedback.

The RLFP framework preserves core #senars principles: components are modular and testable; all activity is logged and observable; circuit breakers ensure graceful degradation to heuristic-only operation; core data structures remain immutable. The result is a system that learns to reason in ways aligned with human preferences for clarity, efficiency, and insight.

#v(0.3em)

== Embodied Grounding

Formal reasoning about "fire → hot" differs from _experiencing_ heat. Future work might integrate with robotics platforms or simulation environments to ground symbols in sensorimotor experience, enabling perceptual learning and situated reasoning.

#v(0.3em)

== Lifelong Learning

Open questions: How should retention balance against forgetting as knowledge accumulates? How can new learning integrate without catastrophic interference? How should the system detect and adapt to distributional shift?

#v(0.3em)

== Formal Verification

For safety-critical applications: Can we prove that inferences preserve consistency? Can we bound computation for specific query types? Formal methods could provide guarantees that neither symbolic nor neural systems offer alone.

#v(0.3em)

== Alternative Implementations

The architecture is language-agnostic: *Rust* for performance, *WebAssembly* for browsers, *GPU kernels* for accelerated reasoning.

#v(0.3em)

== Call for Collaborators

We explicitly invite collaboration from:
- *Researchers* interested in formal foundations of hybrid AI
- *Engineers* building practical reasoning systems
- *Educators* developing AI curricula with transparent systems
- *Domain experts* applying reasoning to specific fields
- *Philosophers* examining questions of machine cognition

Clone the repository and explore `examples/`. The Web UI provides immediate visibility into reasoning traces.

#v(0.5em)

== Research Opportunities

*Theoretical:*
- Formal semantics for NAL-LM hybrid truth values
- Convergence properties under mixed symbolic-neural inference
- Information-theoretic bounds on hybrid reasoning

*Empirical:*
- Benchmarking against pure symbolic and pure neural baselines
- Human studies on reasoning transparency and trust
- Long-term stability studies for persistent agents

*Application Domains:*
- Personal knowledge management assistants
- Educational tutoring systems with explainable reasoning
- Scientific hypothesis generation and testing
- Autonomous agents with documented decision rationale
- Medical diagnostic systems with uncertainty quantification

// ==============================================================================
// 7. CONCLUSION
// ==============================================================================

= Conclusion

#senars represents a practical approach to hybrid neuro-symbolic AI that addresses the complementary weaknesses of pure symbolic and pure neural systems. By combining the formal rigor and consistency of Non-Axiomatic Logic with the pattern recognition and natural language capabilities of large language models, we provide a foundation for cognitive architectures that are both powerful and transparent.

The system's stream-based architecture, dual memory system, multiple reasoning strategies, and robust LM integration offer a flexible platform for exploring advanced AI reasoning. Importantly, our principle of deliberate incompleteness positions #senars not as a finished product but as a _substrate_---a seed for an ecosystem of cognitive architectures tailored to diverse applications.

// ==============================================================================
// REFERENCES
// ==============================================================================

#v(1em)

= References

#set par(hanging-indent: 1.5em)
#set text(size: 9pt)

Brown, T. B. et al. (2020). Language models are few-shot learners. _Advances in Neural Information Processing Systems_, 33:1877--1901.

Gabriel, R. P. (1991). The rise of "worse is better." In _Lisp: Good News, Bad News, How to Win Big_.

Hammer, P. and Lofthouse, T. (2020). ANSNA: An attention-driven non-axiomatic semantic navigation architecture. _AGI_.

Marcus, G. and Davis, E. (2020). Rebooting AI: Building artificial intelligence we can trust. Vintage.

Schick, T. et al. (2023). Toolformer: Language models can teach themselves to use tools. _NeurIPS_.

Shinn, N. et al. (2023). Reflexion: Language agents with verbal reinforcement learning. _NeurIPS_.

Wang, P. (1995). Non-axiomatic reasoning system: Exploring the essence of intelligence. PhD thesis, Indiana University.

Wang, P. (2006). _Rigid Flexibility: The Logic of Intelligence_. Springer.

Wang, P. (2013). _Non-Axiomatic Logic: A Model of Intelligent Reasoning_. World Scientific.

Wei, J. et al. (2022). Chain-of-thought prompting elicits reasoning in large language models. _NeurIPS_.

Yao, S. et al. (2023). ReAct: Synergizing reasoning and acting in language models. _ICLR_.
