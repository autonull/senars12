# SeNARS: An Introduction to the Cognitive Architecture

SeNARS (Self-modifying Neuro-Symbolic Architecture for Real-time Systems) represents a groundbreaking approach to
artificial intelligence that seamlessly integrates the precision of symbolic reasoning with the creativity and
adaptability of neural networks. This advanced cognitive architecture emulates human-like thinking processes through an
integrated system that balances rigorous logical inference with intuitive, creative problem-solving.

The system's intelligence emerges from the sophisticated interplay of integrated cognitive processes that mirror the
dual-process ("System 1" and "System 2") theory of human cognition. By combining these complementary approaches, SeNARS
achieves both explainable reasoning and adaptive learning capabilities, providing a powerful mental model for
understanding how advanced AI systems can think, learn, and act in complex environments.

---

## I. The Intuitive-Associative Core (System 1)

*Principle: From Sensation to Situation*

The intuitive-associative core represents SeNARS' fast, automatic, and parallel processing system, primarily embodied by
the **`lm` (Language Model) module**. This system grounds the agent in its environment by processing unstructured data,
providing rapid assessments, and retrieving relevant context through sophisticated semantic understanding.

**Core Capabilities:**

* **Perceptual Grounding:** The **`Perception`** module serves as the primary gateway for external information. It
  transforms raw inputs from various sources into structured internal `Task` objects. For natural language processing,
  the **`NLP`** class within the `lm` module handles the initial parsing, converting text into the formal Narsese
  representation that can be processed by the symbolic reasoning system.

* **Sub-symbolic Association:** This represents the core strength of the `lm` module, operating on high-dimensional
  vector embeddings to understand nuance, context, and semantic relationships. The system leverages state-of-the-art
  transformer architectures to process complex semantic information.

* **Contextual Retrieval:** Through vector similarity calculations, including **`cosineSimilarity`** between term
  embeddings, the system can intuitively fetch relevant knowledge from `Memory` based on conceptual closeness rather
  than simple keyword matching. This enables sophisticated analogical reasoning and creative problem-solving.

* **Creative & Analogical Belief:** The **`HypothesisGenerator`** service exemplifies the system's intuitive leap
  capability, generating novel ideas and potential explanations when formal logic encounters limitations. The *
  *`ProactiveEnricher`** leverages this capability to actively discover new connections in existing knowledge, enriching
  the cognitive system's understanding.

* **Pattern Matching & Heuristics:** The underlying pre-trained models within the `lm` (such as `XenovaLLM`) provide a
  powerful, built-in heuristic engine for understanding common patterns, relationships, and conceptual structures in
  language and concepts.

**Realizable Potential:**
This component enables SeNARS to handle ambiguity, uncertainty, and incomplete information in ways that purely symbolic
systems cannot. It provides the creative spark that leads to innovation and the intuitive understanding that allows the
system to navigate complex, real-world scenarios with human-like adaptability.

---

## II. The Analytical-Reasoning Engine (System 2)

*Principle: From Situation to Solution*

The analytical-reasoning engine represents SeNARS' slow, deliberate, and logically rigorous cognitive system, embodied
by the comprehensive **`reasoner` module**. This system is engaged to perform complex analysis, formal planning, and
abstract inference with complete transparency and explainability.

**Core Capabilities:**

* **Formal & Symbolic Modeling:** SeNARS constructs precise, structured models of the world using its robust core data
  structures.
    * **Symbolic Representation:** Knowledge is encoded in the **`Term`** and **`Task`** objects, which are parsed and
      validated by the **`narseseParser`**. This creates a formal language for representing concepts (`cat`), complex
      relationships (`(cat --> animal)`), logical statements, and temporal implications.
    * **Temporal & Causal Modeling:** The **`TemporalReasoner`** is a specialized component that builds explicit
      timelines and infers cause-and-effect chains from the sequence and relationship of events. This enables
      sophisticated understanding of how situations evolve over time.

* **Deliberative Inference:** The `reasoner` executes rigorous, step-by-step inference using an extensive library of
  formal rules defined in `core/reasoner/rules`. This ensures logical consistency and provides transparent reasoning
  paths.
    * **Logical Deduction:** Fundamental inference rules like `modus-ponens` and `inheritance` allow the system to
      derive necessary conclusions from established premises with mathematical precision.
    * **Abductive & Inductive Reasoning:** Advanced inference rules such as `abduction` and `induction` enable the
      system to generate plausible explanations for observations and form general principles from specific examples,
      enhancing its ability to learn and adapt.

* **Problem-Solving & Simulation:** The sophisticated **`Planner`** module formulates and evaluates solutions to complex
  problems using multiple strategic approaches.
    * **Goal Decomposition & Planning:** The `Planner` can utilize multiple strategies, including the powerful *
      *`HTNPlanner`** (Hierarchical Task Network), to break down high-level goals into concrete sequences of executable
      steps.
    * **Optimized Pathfinding:** For problems requiring optimal solutions, the planner can switch to advanced *
      *`AStarPlanner`** strategies that find the most efficient paths through complex solution spaces.
    * **Plan Repair & Adaptation:** When logical plans encounter failures, the **`PlanRepairer`** service within the
      `lm` module is invoked to analyze failures and suggest alternative solutions, combining symbolic logic with
      creative neural insights.

**Realizable Potential:**
This component ensures that all decisions and reasoning paths are traceable and auditable. It enables SeNARS to solve
complex problems with mathematical precision while maintaining complete transparency about its decision-making process.
This makes it ideal for applications requiring regulatory compliance and trustworthiness.

---

## III. The Executive Controller (Metacognition)

*Principle: From Thought to Strategy*

The executive controller represents SeNARS' self-regulatory and strategic system, implemented through the sophisticated
interplay of the **`System`**, **`Cycle`**, and **`MetaCognition`** modules. This system monitors the entire cognitive
process, strategically allocates resources, and aligns the agent's behavior with its core objectives and values.

**Core Capabilities:**

* **Attention & Prioritization:** SeNARS manages its finite cognitive resources through an advanced mechanism of "
  economic attention" that optimizes computational efficiency.
    * **Dynamic Focus Management:** The **`PriorityManager`** dynamically calculates priority scores for every `Task`,
      considering multiple factors including relevance, urgency, and potential impact. In each cognitive `Cycle`, the
      system uses these scores to create an optimized `focusSet`—a carefully selected subset of the most relevant tasks
      to which it will dedicate its reasoning resources.
    * **System Arbitration:** The architecture intelligently manages the interaction between System 1 (neural) and
      System 2 (symbolic), determining when to rely on fast intuitive processing versus engaging the more effortful
      analytical reasoning.

* **Goal & Drive Management:** The agent's autonomous motivation is defined in **`Constitution.js`**, which specifies
  the core, intrinsic drives of the system such as `AcquireKnowledge` and `MaintainCoherence`. These drives are
  represented as top-level `Task`s that guide the `Planner`'s activities and ensure alignment with the system's
  fundamental objectives.

* **Self-Regulation & Control:** The comprehensive **`MetaCognition`** module handles introspection, self-improvement,
  and strategic self-management.
    * **Contradiction & Anomaly Detection:** The sophisticated **`ContradictionAnalyzer`** continuously monitors the
      knowledge base for inconsistencies, logical conflicts, and unexpected patterns. When conflicts are identified,
      advanced **`ResolutionStrategy`** mechanisms are engaged to handle them, ensuring the integrity and consistency of
      the system's beliefs.
    * **Performance Monitoring:** The system tracks the effectiveness of different reasoning strategies and adapts its
      approach over time, continuously improving its cognitive performance.
    * **Strategic Action:** The **`ActionExecutor`** serves as the bridge between abstract thought and concrete action,
      translating the outputs of the `Planner` into executable operations in the external world.

**Realizable Potential:**
This component provides the strategic oversight that ensures SeNARS operates as a coherent, goal-oriented agent. It
enables the system to maintain focus on important objectives while adapting its cognitive strategies based on
effectiveness, creating a truly autonomous and self-improving AI system.

---

## IV. The Adaptive Substrate (Memory & Learning)

*Principle: From Experience to Expertise*

The adaptive substrate represents the foundational fabric of learning and memory that enables the entire cognitive
architecture to continuously improve and evolve over time. Implemented through the sophisticated **`memory` module**,
this component provides the essential infrastructure for knowledge management and cognitive growth.

**Core Capabilities:**

* **Knowledge Lifecycle Management:** The comprehensive `Memory` module governs the complete lifecycle of information
  acquisition, retention, consolidation, and updating.
    * **Dual-Store Memory Architecture:** The memory system is organized into `shortTermTasks` for immediate processing
      and `longTermTasks` for consolidated knowledge. Important and frequently accessed knowledge is intelligently
      consolidated from short-term to long-term storage through sophisticated consolidation mechanisms.
    * **Belief Revision & Updating:** The advanced **`TruthValueManager`** continuously updates the `confidence` and
      `frequency` of beliefs based on new evidence, using sophisticated revision strategies including `bayesianRevision`
      to maintain accurate and current knowledge.
    * **Dynamic Forgetting & Pruning:** To prevent knowledge overload and maintain efficiency, intelligent *
      *`TimeBasedForgettingStrategy`** mechanisms gracefully prune old and irrelevant information while preserving
      valuable knowledge, ensuring the knowledge base remains efficient and relevant.

* **Uncertainty Quantification:** Every `Task` (whether representing a belief, goal, or question) is encoded with a
  sophisticated **`TruthValue`** that includes both `frequency` (evidential support) and `confidence` (certainty). This
  enables effective reasoning under uncertainty and incomplete information.

* **Value Representation & Prioritization:** Every `Task` is assigned a dynamic **`priority`** score that reflects its
  relevance and urgency to the system's current goals, enabling rational allocation of cognitive resources.

**Realizable Potential:**
This component enables SeNARS to function as a truly learning system that improves over time. It provides the foundation
for continuous adaptation, knowledge accumulation, and expertise development, allowing the system to become more
effective and valuable through experience while maintaining cognitive efficiency.

---

## Synergistic Integration: The Power of Neuro-Symbolic Fusion

The true power of SeNARS emerges from its seamless integration of these complementary cognitive systems. Rather than
operating as separate entities, these components work in harmony to provide capabilities that exceed the sum of their
individual parts.

The neuro-symbolic synergy enables:

- **Explainable Creativity:** Neural components generate creative insights while symbolic components provide logical
  validation and explanation
- **Robust Learning:** Symbolic structures provide stable foundations while neural components enable adaptive learning
- **Scalable Reasoning:** Efficient neural processing handles complex pattern recognition while precise symbolic
  reasoning ensures logical consistency
- **Transparent Decision-Making:** All decisions follow traceable paths while incorporating sophisticated neural
  insights

This integration represents a significant advancement in AI architecture, providing a foundation for truly intelligent
systems that can think, learn, and adapt while maintaining complete transparency and reliability.
