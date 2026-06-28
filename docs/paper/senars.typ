// SeNARS: A Neuro-Symbolic Cognitive Architecture
// Typst format - compile with: typst compile senars.typ

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
        A Neuro-Symbolic Cognitive Architecture for Reasoning Under Uncertainty
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

#place(top + center, float: true, scope: "parent")[
  #block(fill: luma(248), inset: 1em, radius: 4pt, width: 100%)[
    *Abstract.* #senars is a hybrid neuro-symbolic cognitive architecture that integrates Non-Axiomatic Logic (NAL) with Large Language Models through a streaming dataflow pipeline. The system implements epistemic grounding: all beliefs carry explicit uncertainty (frequency and confidence) that propagates through inference and revises as evidence accumulates. LLMs contribute pattern recognition and world knowledge through asynchronous, circuit-breaker-protected queries.

    The architecture processes continuous premise streams into conclusion streams, executing symbolic NAL rules synchronously while dispatching neural queries asynchronously---enabling real-time responsiveness without sacrificing formal rigor. Dual memory separates short-term attention from long-term storage with automated consolidation.

    Yet #senars is _deliberately incomplete_: designed as substrate rather than product, it provides stable primitives while inviting diverse forks. This incompleteness is the central innovation---finished systems calcify; open substrates enable ecosystems.

    #v(0.5em)
    #text(size: 9pt)[
      *Keywords:* neuro-symbolic AI, cognitive architecture, non-axiomatic logic, streaming inference, hybrid reasoning, epistemic uncertainty, language model integration
    ]
  ]
]

#v(1em)

// ==============================================================================
// 1. INTRODUCTION
// ==============================================================================

= Introduction

Artificial intelligence has long been split between two paradigms. *Symbolic AI* offers transparency: conclusions trace to premises, logical soundness is verifiable, and decisions explain themselves in human terms. But symbolic systems prove brittle when knowledge is incomplete, ambiguous, or contradictory---the everyday condition of intelligent agents navigating uncertain worlds. *Neural AI*, epitomized by large language models, offers fluid adaptability and astonishing breadth, recognizing patterns across vast corpora and generating plausible responses to almost any prompt. But neural systems hallucinate, lack persistent memory, and cannot explain their reasoning.

Neither paradigm alone suffices for autonomous agents that must reason continuously, learn incrementally, and act reliably under uncertainty.

#v(0.5em)

== The Neuro-Symbolic Opportunity

The core insight of neuro-symbolic AI is that these paradigms are _complementary_: symbolic reasoning can constrain and validate neural outputs; neural pattern recognition can inform and accelerate symbolic inference. But effective integration demands more than bolting components together. It requires a coherent architecture where both modalities contribute to a unified reasoning stream.

#senars realizes this vision through three architectural commitments:

+ *Epistemic Grounding*: All beliefs carry explicit truth values---frequency and confidence---that propagate through inference and revise as evidence accumulates. The system _knows what it knows_ and _how much it trusts what it knows_.

+ *Streaming Dataflow*: Rather than batch processing, #senars continuously transforms premise streams into conclusion streams, enabling real-time responsiveness and non-blocking hybrid execution.

+ *Deliberate Incompleteness*: The architecture provides a stable, extensible core while leaving higher-level decisions open for specialization, enabling diverse forks rather than one-size-fits-all solutions.

#v(0.5em)

== Vision: An Ecosystem of Minds

Imagine a future where cognitive architectures are as diverse as biological species. A medical diagnostic system might emphasize caution and explanation; an educational tutor might favor Socratic questioning; a creative assistant might embrace exploratory leaps. All would share common primitives---truth values, memory consolidation, hybrid inference---while diverging in strategy, domain knowledge, and personality.

#senars aspires to be the common ancestor: a minimal, coherent substrate from which this ecosystem can evolve. Not a product to be consumed, but a seed to be grown.

// ==============================================================================
// 2. BACKGROUND
// ==============================================================================

= Background

== Non-Axiomatic Logic

#senars builds on Pei Wang's foundational work on Non-Axiomatic Logic (NAL). NARS was designed for reasoning under the _Assumption of Insufficient Knowledge and Resources_ (AIKR)---the premise that any real agent faces incomplete information and limited computation.

Where classical logics require complete, consistent axiom sets, NAL operates on partial evidence. Every statement carries a _truth value_ comprising frequency (how often true) and confidence (evidential strength). Truth values propagate through inference: conclusions inherit uncertainty from premises, and new evidence revises existing beliefs.

OpenNARS demonstrated these principles in research settings. ANSNA explored a minimal implementation for embedded systems. #senars continues this lineage, reimagining the architecture for modern streaming systems and neural integration.

#v(0.5em)

== The AIKR Principle

The *Assumption of Insufficient Knowledge and Resources* (AIKR) is the foundational premise of NAL. Unlike classical logics that assume complete, consistent knowledge, AIKR acknowledges that any real intelligent agent operates under fundamental constraints:

#block(inset: (left: 0.5em))[
  *Insufficient Knowledge.* The agent never has complete information. Facts may be unknown, uncertain, or contradictory.

  *Insufficient Resources.* Computation, memory, and time are always finite. Exhaustive search is impossible.

  *Real-time Demands.* Decisions must be made before complete analysis is possible.
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

== Core Data Structures

All foundational data structures are *immutable* and *canonically normalized*, ensuring referential transparency, safe concurrent access, and efficient caching.

*Terms.* The fundamental unit of knowledge representation. A Term may be atomic (a symbol like `bird`) or compound (a relation like `bird → animal`). The `TermFactory` normalizes equivalent terms and caches them for reuse.

*Truth Values.* Every statement carries a truth value comprising frequency (how often true) and confidence (evidential strength). Truth values propagate through inference according to NAL semantics.

*Stamps.* Evidence tracking for cyclicity detection, revision, and provenance. Each Stamp records a unique identifier, occurrence time, and source.

*Tasks.* The unit of processing. A Task contains a Term, truth value, stamp, priority, and punctuation indicating its type: *Belief* (`.`), *Goal* (`!`), or *Question* (`?`).

#v(0.5em)

== The Streaming Pipeline

The reasoning engine operates as a continuous pipeline:

/ 1. PremiseSource: Samples Tasks from Memory according to configurable objectives: _priority_, _recency_, _novelty_, _punctuation_, or _dynamic_ (adaptive).

/ 2. Strategy: Pairs primary premises with secondary premises. Implementations: *BagStrategy* (NARS-style priority sampling), *PrologStrategy* (goal-driven backward chaining), *ExhaustiveStrategy* (comprehensive search), *ResolutionStrategy* (Prolog-like resolution).

/ 3. RuleProcessor: Executes inference rules. Synchronous NAL rules execute immediately; asynchronous LM rules dispatch without blocking. A `RuleExecutor` indexes rules by guard conditions for efficient matching.

/ 4. Output Stream: Unified stream merging results from both rule types. Conclusions feed back to Memory for further inference.

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
    [Elaboration], [Generate related beliefs from a concept],
    [WorldKnowledge], [Query factual knowledge to fill gaps],
    [Translation], [Convert natural language to Narsese],
    [Explanation], [Generate natural language from derivations],
    [Disambiguation], [Resolve ambiguous terms using context],
  )
)

#v(0.5em)

== Dual Memory Architecture

Inspired by cognitive science, #senars separates short-term attention from long-term storage:

*Focus (Short-term).* A bounded-capacity priority queue holding tasks for immediate processing based on priority, recency, and diversity constraints.

*Long-term Memory.* Persistent storage for all Concepts (collections of Tasks sharing a common Term) with specialized indexes for efficient retrieval.

*Consolidation.* Background process that migrates high-value tasks between Focus and long-term storage as attention shifts.

#v(0.5em)

== Hybrid NAL-LLM Integration

The key architectural innovation is *non-blocking hybrid execution*:

- *NAL rules* execute synchronously with rigorous truth-value propagation.
- *LM rules* execute asynchronously; results integrate with assigned confidence values.
- *Circuit breakers* detect LM failures and fall back to pure symbolic reasoning.
- *Validation gates* filter or adjust LM outputs before integration.

#v(0.5em)

== The Cognitive Operating System Analogy

Think of an LLM as a powerful *ALU*---fast at processing symbols but stateless. #senars acts as the *kernel*:
- *Scheduler*: The Reasoner pipeline determines which "processes" get LM time
- *Filesystem*: Memory and Term structures provide persistent state
- *Permissions*: Truth values and stamps determine what information is trusted
- *Goals*: The belief/goal distinction provides intentionality

Where LLMs are fluid and context-dependent, #senars provides the _anchor_---stable beliefs that persist across sessions.

// ==============================================================================
// 4. IMPLEMENTATION
// ==============================================================================

= Prototype Implementation

The current #senars prototype is implemented in JavaScript (Node.js), chosen for cross-platform portability, web integration, and rapid iteration.

#v(0.5em)

== Technology Stack

/ Core Engine: Stream-based reasoning pipeline with configurable components
/ Memory System: Dual-layer architecture with automated consolidation
/ LM Integration: Provider registry supporting OpenAI, Anthropic, Ollama, HuggingFace
/ Parser: Complete Narsese parser for NAL syntax
/ Web UI: React-based visualization for reasoning traces
/ Monitoring: WebSocket-based event streaming

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
    [`config/`], [Configuration management],
    [`util/`], [Logging, EventBus, CircuitBreaker, metrics],
    table.cell(colspan: 2, fill: luma(230))[_External Interfaces_],
    [`ui/`], [React web UI for visualization],
    [`repl/`], [Interactive command-line interface],
    [`tests/`], [Unit, integration, e2e tests],
    [`examples/`], [Usage examples and demos],
  )
)

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
    [Cache hit ratio], [Term normalization effectiveness],
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

The prototype includes a comprehensive test suite:
- Unit tests for all core data structures
- Integration tests for component interaction
- Property-based tests for normalization invariants
- End-to-end reasoning chain validation

#v(0.5em)

== Operational Capabilities

What works today:
- Complete NAL inference with truth propagation
- Multiple reasoning strategies
- Configurable sampling and resource management
- LM integration with circuit breaker protection
- Real-time visualization of reasoning traces
- Bidirectional natural language ↔ Narsese translation

#v(0.5em)

== Example: Transitive Inference

```
Input:  (bird --> animal){0.90, 0.90}.
Input:  (robin --> bird){0.95, 0.90}.

Derived: (robin --> animal){0.855, 0.81}.
  Rule: Deduction
```

The derived truth value reflects the frequency and confidence of the premises, reduced through inference to reflect the evidential chain.

#v(0.5em)

== Example: Knowledge Discovery

```
Input:  (salmon --> fish){0.95, 0.90}.
Input:  (fish --> aquatic){0.90, 0.85}.
Input:  (salmon --> pink){0.80, 0.70}.
Query:  (salmon --> ?what)?

Derived: (salmon --> aquatic){0.855, 0.77}.
LM Elaboration: (salmon --> edible){0.85, 0.60}.
LM Elaboration: (salmon --> migratory){0.90, 0.55}.
```

The system combines deductive inference (salmon is aquatic) with LM-derived knowledge (edible, migratory). LM contributions carry lower confidence, reflecting their external source---they can be revised as direct evidence accumulates.

// ==============================================================================
// 5. DELIBERATE INCOMPLETENESS
// ==============================================================================

= Deliberate Incompleteness

This section articulates the central innovation of #senars: *deliberate incompleteness is a feature, not a bug*.

#v(0.5em)

== The Calcification Problem

History shows that "finished" systems tend to ossify. Once a platform presents itself as complete, the friction required to modify it increases dramatically. Users depend on specific behaviors; documentation hardens into dogma; innovation migrates to workarounds rather than foundations.

Early Unix succeeded precisely because it was _unfinished_---minimal primitives that invited completion. The Linux kernel remains perpetually incomplete, enabling everything from supercomputers to embedded devices. In AI, the most influential contributions are often frameworks rather than finished products: OpenAI Gym, Transformers, JAX---each enabled diverse completions while preserving a common core.

#v(0.5em)

== The SeNARS Approach

#senars is explicitly designed as *substrate rather than product*:

#block(inset: (left: 1.5em, right: 1.5em), fill: luma(248), radius: 4pt)[
  _"This is not being built to be a finished application. It is being built to be substrate---the common seed for a future ecosystem of cognitive architectures."_
]

We stabilize the _essential_: streaming dataflow, immutable data, truth-value semantics, hybrid execution.

We leave open the _contingent_: memory parameters, application-specific rules, domain strategies, deployment patterns.

#v(0.5em)

== Invitation to Fork

We envision multiple #senars lineages:

/ Minimal Edge Reasoners: Stripped-down implementations for embedded/IoT
/ High-Agency Planners: Extensions for autonomous goal pursuit
/ Educational Sandboxes: Interactive environments for teaching AI
/ Personal Memory Layers: Lifelong persistent context
/ Multi-Agent Societies: Distributed reasoning across agent networks
/ Alternative Logics: New formal systems building on the stream architecture

All would share the core pipeline, enabling cross-pollination.

#v(0.5em)

== Extension Points

/ Strategy: New premise-pairing algorithms via Strategy interface
/ LM Providers: Custom integrations via provider registry
/ Memory Policies: Configurable forgetting, consolidation, indexing
/ Rule Sets: Dynamic registration of custom NAL and LM rules
/ Truth Functions: Alternative uncertainty representations
/ Layers: Custom connection types (TermLayer, EmbeddingLayer)

_Fork it and grow it into the species you need._

// ==============================================================================
// 6. FUTURE DIRECTIONS
// ==============================================================================

= Future Directions

== RLFP and Embodiment

The belief/goal distinction naturally supports *Reinforcement Learning from Preferences*. Rather than hand-crafted reward functions, the system could learn from qualitative comparisons. Future work might integrate with robotics platforms to ground symbols in sensorimotor experience.

#v(0.3em)

== Lifelong Learning

Open questions: How should retention balance against forgetting? How can new learning integrate without catastrophic interference? How should the system detect and adapt to distributional shift?

#v(0.3em)

== Scaling and Verification

How does reasoning quality scale with memory capacity and LM size? Can we prove that inferences preserve consistency for safety-critical applications?

#v(0.3em)

== Alternative Implementations

The architecture is language-agnostic: *Rust* for performance, *WebAssembly* for browsers, *GPU kernels* for accelerated reasoning.

#v(0.3em)

== Call for Collaborators

We invite contributions: novel strategies, domain extensions, formal analysis, benchmarking, documentation.

Clone the repository and explore `examples/`.

// ==============================================================================
// 7. CONCLUSION
// ==============================================================================

= Conclusion

#senars demonstrates that hybrid neuro-symbolic integration can be _streaming_, _non-blocking_, and _epistemically grounded_. The architecture processes continuous premise streams into conclusion streams, executing symbolic rules synchronously while dispatching neural queries asynchronously.

But the deeper contribution is philosophical. By designing #senars as incomplete substrate rather than finished product, we aim to _enable_ rather than _constrain_ the future of neuro-symbolic AI.

We release #senars as a public good.

#align(center)[
  #text(style: "italic")[
    Fork it, strip it, break it, grow it. \
    Build the species you need.
  ]
]

// ==============================================================================
// REFERENCES
// ==============================================================================

#v(1em)

= References

#set par(hanging-indent: 1.5em)
#set text(size: 9pt)

Gabriel, R. P. (1991). The rise of "worse is better." In _Lisp: Good News, Bad News, How to Win Big_.

Hammer, P. and Lofthouse, T. (2020). ANSNA: An attention-driven non-axiomatic semantic navigation architecture. _AGI_.

Schick, T. et al. (2023). Toolformer: Language models can teach themselves to use tools. _NeurIPS_.

Shinn, N. et al. (2023). Reflexion: Language agents with verbal reinforcement learning. _NeurIPS_.

Wang, P. (2006). _Rigid Flexibility: The Logic of Intelligence_. Springer.

Wang, P. (2013). _Non-Axiomatic Logic: A Model of Intelligent Reasoning_. World Scientific.

Wei, J. et al. (2022). Chain-of-thought prompting elicits reasoning in large language models. _NeurIPS_.

Yao, S. et al. (2023). ReAct: Synergizing reasoning and acting in language models. _ICLR_.
