# GROW: Autonomous Evolution of Neuro-Symbolic Cognition

## Mission Statement
**Transform SeNARS from a static reasoning engine into a self-improving cognitive architecture accessible to everyone.**

The ultimate goal is **Cognitive Democracy**: A system where complex neuro-symbolic reasoning, memory management, attention control, and creative synthesis are available to any user through natural language alone, without requiring knowledge of NAL syntax or logic.

---

## Core Directive: The Evolution Loop
> **"Discover Limitation → Hypothesize Cause → Implement Fix → Adversarial Verification → Integrate → Repeat"**

Do not merely demonstrate capabilities. Actively seek where the system fails, breaks, or produces inconsistencies. Then, engineer robust, automated solutions.

---

## Phase 1: The "Natural Language First" Imperative
*Goal: Erase the barrier between human intent and system action.*

Currently, users must know NAL syntax (`<A --> B>.`) to interact precisely. This must change. The system must accept **ergonomic natural language** for all cognitive operations.

### 1.1 Ergonomic NL Control of Cognitive Processes
The system must interpret natural language commands as direct control structures for its internal state.

| User Intent (Natural Language) | System Action (Internal) | Cognitive Domain |
| :--- | :--- | :--- |
| "Remember that cats are mammals" | `nar.believe('<cat --> mammal>.')` | **Memory Injection** |
| "Forget everything about birds" | `nar.memory.forgetPattern('bird')` | **Memory Pruning** |
| "Focus on animals right now" | `nar.attention.setTopic('animal')` | **Attention Control** |
| "Why do you think cats are animals?" | `nar.explain('<cat --> animal>')` | **Explanation** |
| "What if cats weren't mammals?" | `nar.counterfactual('<cat --> mammal>', false)` | **Creative Reasoning** |
| "Find connections between dogs and cats" | `nar.discoverRelations(['dog', 'cat'])` | **Analogy/Discovery** |
| "Save this thought for later" | `nar.episodic.save(currentContext)` | **Episodic Memory** |
| "What were we talking about?" | `nar.episodic.recallRecent()` | **Context Retrieval** |

**Action Item:** Implement a **Natural Language Command Parser** (`NLCommandParser`) that maps these intents to internal API calls. It should sit *before* the NAL translation layer.

### 1.2 Bidirectional NL ↔ NAL Interoperability
The system must seamlessly translate between human concepts and symbolic logic in both directions.

*   **Input Pipeline:**
    `Natural Language` → `Intent Classifier` → `NL-to-NAL Translator (LM)` → `NAL Validator` → `Memory/Reasoning`
*   **Output Pipeline:**
    `NAL Derivation` → `Truth Value Interpreter` → `NAL-to-NL Generator (LM)` → `Human Readable Explanation`

**Critical Requirement:** The user should *never* see raw Narsese unless they explicitly ask for "debug mode." All interaction should be in natural language.

---

## Phase 2: Cognitive Stress Testing & Limitation Discovery
*Goal: Break the system to find its true limits.*

### 2.1 Adversarial Scenario Generation
Generate 50+ complex inputs designed to trigger specific failure modes:
*   **Infinite Loops:** Inputs that cause cyclic derivations (A→B, B→C, C→A).
*   **Memory Explosions:** Inputs that trigger exponential belief generation.
*   **Confidence Oscillation:** Contradictory inputs that cause truth values to flip-flop indefinitely.
*   **Semantic Paradoxes:** "This statement is false" equivalents in NAL.

**Automation:** Create `scripts/adversarial-generator.ts` to auto-generate and run these scenarios, logging crashes or logical invalidities.

### 2.2 Cognitive Inconsistency Audit
*   **Contradiction Injection:** Inject `<A --> B>. :1.0:0.9` and `<A --> B>. :0.0:0.9`.
    *   *Hypothesis:* Current revision may fail to converge or produce nonsensical confidence.
    *   *Fix:* Trace `Truth.revision` and implement robust conflict resolution (e.,g., discounting low-quality sources).
*   **Long-Horizon Decay:** Construct deep chains (A→B→C...→Z).
    *   *Hypothesis:* Truth values decay to noise too quickly.
    *   *Fix:* Adjust confidence deduction functions to preserve signal over longer chains.

---

## Phase 3: Structural Repair & Rule Synthesis
*Goal: Fix root causes, not symptoms.*

### 3.1 Dynamic Rule Adjustment (Meta-Learning)
*   **Problem:** Static rule priorities (e.g., `deduction` > `induction`) may not fit all contexts.
*   **Solution:** Implement a feedback mechanism where rule priorities are adjusted based on "derivation utility."
    *   If a rule's output is consistently used/validated, increase its priority.
    *   If a rule's output is consistently contradicted/ignored, decrease its priority.

### 3.2 Intelligent Memory Consolidation
*   **Problem:** Bag replacement may discard high-priority concepts too early (thrashing).
*   **Solution:** Rewrite `Bag` replacement strategy to balance:
    1.  **Priority** (Current importance)
    2.  **Recency** (Last access time)
    3.  **Diversity** (Prevent monoculture of concepts)
    4.  **Goal-Relevance** (Boost concepts related to active goals)

### 3.3 Robust NL Parsing with Clarification
*   **Problem:** Ambiguous NL inputs fail or produce wrong NAL.
*   **Solution:** Enhance LM-to-NAL translation to:
    1.  Generate *multiple* parse trees if ambiguous.
    2.  Ask clarifying questions: "Did you mean 'All birds fly' or 'Some birds fly'?"
    3.  Learn from corrections: "No, I meant X" → Update parser weights.

---

## Phase 4: Automated Development & Self-Improvement
*Goal: Automate the evolution loop.*

### 4.1 Self-Generated Unit Tests
*   **Mechanism:** For every bug found in Phase 2, automatically generate a Jest test case.
*   **Output:** A growing `tests/auto-generated/` suite that prevents regression.
*   **Command:** `/generate-test "System crashes when A inherits B and B inherits A"`

### 4.2 Hyperparameter Optimization (Auto-Tuning)
*   **Problem:** Magic numbers (truth thresholds, bag sizes, deduction rates) are hardcoded.
*   **Automation:** Run Bayesian Optimization on these parameters using a benchmark suite.
*   **Goal:** Find the optimal configuration for "Cognitive Coherence" (minimized contradictions, maximized derivation depth).

### 4.3 Cognitive Benchmarking Suite
Create `src/benchmark/cognitive-benchmark.ts` to score the system on:
1.  **Consistency:** No internal contradictions.
2.  **Completeness:** Derives all valid inferences from given premises.
3.  **Efficiency:** Minimal CPU/Memory usage per derivation.
4.  **Robustness:** Graceful handling of noise/contradictions.
5.  **Accessibility:** Success rate of NL-to-NAL translation.

**Target:** Improve this score automatically over time.

---

## Phase 5: Seeding Advanced Cognitive Functions
*Goal: Move from reactive reasoning to proactive cognition.*

### 5.1 Meta-Cognitive Monitoring ("The Observer")
*   **Function:** A background process monitoring derivation rates, memory health, and contradiction levels.
*   **Behavior:**
    *   If "Confusion" (high contradiction) > Threshold → Trigger "Reflect" state (pause input, resolve conflicts).
    *   If "Boredom" (low activity) → Trigger "Explore" state (proactively query memory for gaps).
*   **NL Interface:** "You seem confused." → System explains conflict.

### 5.2 Temporal Causal Discovery
*   **Function:** Detect patterns in event streams ("A always precedes B").
*   **Action:** Automatically generate `<A =/> B>` (implication) beliefs from observed temporal sequences.
*   **NL Interface:** "I noticed that every time it rains, the ground gets wet." → System forms causal rule.

### 5.3 Goal-Directed Attention Control
*   **Function:** Attention is currently priority-driven. Make it *goal-driven*.
*   **Mechanism:** Temporarily boost priority of concepts relevant to the *current active goal*, even if base priority is low.
*   **NL Interface:** "I need to solve this puzzle about animals." → System focuses attention on `animal`, `puzzle`, `logic` concepts.

### 5.4 Concept Clustering & Abstraction ("Sleep Cycle")
*   **Function:** Periodically analyze belief graph to find dense clusters.
*   **Action:** Hypothesize new abstract concepts to represent clusters (e.g., noticing `cat`, `dog`, `bird` cluster → invent `LivingThing`).
*   **Result:** System "invents" higher-level categories to compress knowledge.
*   **NL Interface:** "What do cats, dogs, and birds have in common?" → "They are all LivingThings."

---

## Execution Protocol

1.  **Analyze:** Read current state of `src/nar/rules/`, `src/nar/truth/`, `src/nar/memory/`, `src/nar/nl/`.
2.  **Experiment:** Run a targeted stress test (Phase 2).
3.  **Observe:** Did it crash? Derive nonsense? Loop? Misinterpret NL?
4.  **Fix:** Modify code to resolve the issue.
5.  **Verify:** Run full test suite + generated tests.
6.  **Report:** Summarize limitation, fix, and new capability.

**Start Now:** Identify the most critical barrier to **Natural Language accessibility** (Phase 1) or **Cognitive Consistency** (Phase 2) and propose a concrete plan.

---

## Appendix: Example Interaction Flows

### Scenario A: Learning via NL
```
User: "Remember that all dolphins are mammals."
System: [Parses intent: REMEMBER]
        [Translates: "all dolphins are mammals" → <dolphin --> mammal>. :1.0:0.9]
        [Stores in Memory]
System: "I've noted that dolphins are mammals."

User: "And mammals are animals."
System: [Translates: <mammal --> animal>. :1.0:0.9]
        [Runs Reasoning]
        [Derives: <dolphin --> animal>.]
System: "Understood. Since dolphins are mammals and mammals are animals, I've also concluded that dolphins are animals."
```

### Scenario B: Debugging via NL
```
User: "Why do you think dolphins are animals?"
System: [Retrieves derivation path]
System: "I believe this because:
         1. You told me 'all dolphins are mammals'.
         2. You told me 'mammals are animals'.
         3. By transitive reasoning, dolphins must be animals."

User: "What if dolphins weren't mammals?"
System: [Runs Counterfactual]
System: "If dolphins were not mammals, I could not conclude they are animals based on that rule alone. I would need other evidence."
```

### Scenario C: Cognitive Control via NL
```
User: "Focus on marine biology."
System: [Sets attention focus: {marine, biology, ocean, fish, mammal}]
System: "I'm now prioritizing concepts related to marine biology."

User: "Forget everything about sharks."
System: [Executes memory pruning: pattern='shark']
System: "I've removed all beliefs and concepts related to sharks."

User: "What were we talking about?"
System: [Recalls episodic memory]
System: "We were discussing marine mammals, specifically dolphins and their classification."
```

---

**End of GROW.md**
*This document serves as the living blueprint for the autonomous evolution of SeNARS. Refer to it when initiating new development cycles.*
