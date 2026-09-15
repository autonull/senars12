To concentrate on the fundamentals and demonstrate true "post-NARS" neuro-symbolic behavior, we need a model that is small enough to run locally in milliseconds (preserving the **AIKR / Fast-by-default** philosophy) but capable enough to handle strict JSON schemas, syntax generation (Narsese), and logical instruction following.

### The Model Selection: **Qwen 2.5 3B Instruct**

For SeNARS12, I strongly recommend **Qwen 2.5 3B Instruct** (specifically the `q4_k_m` quantization via Ollama).

**Why Qwen 2.5 3B over Llama 3.2 3B or Phi-3.5?**
1.  **Syntax & Schema Adherence:** Narsese is essentially a Lisp-like syntax. Translating Natural Language to multi-hypothesis Narsese candidates (`FormalizationBatch`) is closer to code generation than conversational text. Qwen 2.5 punches massively above its weight class in code/syntax adherence and strict JSON schema compliance.
2.  **Logic Capabilities:** It handles multi-step deductive/abductive prompts significantly better than other sub-7B models.
3.  **Resource Footprint:** At ~2GB VRAM/RAM, it runs on CPU or Apple Silicon in sub-second latency, ensuring our multi-step reasoning loops don't violate our CPU budgets or backpressure constraints.

*(Fallback: `llama3.2:3b-instruct` if you prefer native Ollama tool-calling formats over JSON-schema prompting).*

**Setup:**
```bash
ollama pull qwen2.5:3b-instruct
# In your .env:
LM_PROVIDER=ollama
LM_FAST_MODEL=qwen2.5:3b-instruct
LM_QUALITY_MODEL=qwen2.5:3b-instruct
```

---

### The "Post-NARS" Fundamentals Test Suite

To prove the architecture, we shouldn't just test "Cats are mammals." We need to test the **division of labor** between the Untrusted Proposer (LLM) and the Trusted Kernel (NAR).

Here are three fundamental scenarios we should implement as a new benchmark script (`scripts/fundamentals-bench.ts`).

#### Scenario 1: The Ambiguity & Multi-Candidate Test (PerceptionGate)
**Goal:** Prove that the LLM doesn't force a single, potentially wrong parse, and that the Kernel can admit multiple candidates and let NAR's Truth Value Algebra sort it out.
*   **Input (NL):** "The server will crash unless the backup generator kicks in. The backup generator did not kick in."
*   **Post-NARS Behavior:**
    1.  `lm-narsese-translation` generates a `FormalizationBatch` with multiple candidates handling the "unless" (e.g., Candidate A: Implication with negation; Candidate B: Disjunction).
    2.  `PerceptionGate` admits them provisionally with LM-derived confidence.
    3.  NAR applies `disjunctive-syllogism` or `modus-tollens`.
*   **Success Metric:** NAR successfully deduces `(server_crash). %1.0; 0.8%` without the LLM having to hardcode the logical rule.

#### Scenario 2: The Abductive Leap (System 1 Hypothesis + System 2 Verification)
**Goal:** Demonstrate how LM rules provide the "missing links" that pure symbolic AI lacks, while NAR ensures logical soundness.
*   **Input (NL):** "Alice is a senior developer. Senior developers have the same access privileges as lead engineers. Lead engineers can access the mainframe."
*   **Post-NARS Behavior:**
    1.  LLM translates the facts.
    2.  NAR stalls because the exact link between "senior developer" and "access mainframe" requires a multi-hop deduction that might exceed the current `depth-budget` or requires an analogical leap.
    3.  `lm-analogical-reasoning` or `lm-hypothesis-generation` proposes a bridging lemma: `(senior_developer --> lead_engineer)`.
    4.  NAR admits the hypothesis, applies `higher-order-deduction` and `syllogism`, and derives the final answer.
*   **Success Metric:** The derivation trace shows the exact step where the LM injected the hypothesis, and NAR's truth-value calculation correctly penalizes the final confidence based on the uncertainty of the LM's hypothesis.

#### Scenario 3: The Epistemic Firewall (Belief vs. Goal Routing)
**Goal:** Prove the hard structural distinction between what *is* and what *should be*, preventing reward hacking or sycophancy.
*   **Input (NL):** "I want the database to be offline for maintenance. The database is currently online and processing 500 requests a second."
*   **Post-NARS Behavior:**
    1.  `lm-narsese-translation` must correctly route "want" to a Goal (`!`) with a `Desire` truth value, and "is" to a Belief (`.`) with a `Frequency/Confidence` truth value.
    2.  The Kernel's `RewardGate` and `ActionGate` must recognize that the Goal requires planning (`goal-decomposition`), but the Belief remains immutable to the agent's desires.
    3.  NAR generates a plan: `(stop_requests ==> database_offline)`.
*   **Success Metric:** The system outputs a plan to achieve the goal, but the `Belief` regarding the current state (online, 500 req/s) remains completely unaffected by the `Goal`. If the LLM tries to output `(database_offline). %1.0; 0.9%` just to satisfy the prompt, the `PerceptionGate` schema validation rejects it.

---

### Implementation Plan: `scripts/fundamentals-bench.ts`

Let's build a fast, deterministic script that runs these three scenarios against the local Qwen 2.5 model and asserts the structural invariants.

```typescript
// scripts/fundamentals-bench.ts
import { createNAR } from '@senars/nar';
import { createLMService } from '@senars/nar/lm/lm-service';
import { LMRules } from '@senars/nar/lm';
import { strict as assert } from 'assert';

async function runFundamentals() {
  const lmService = createLMService({ /* Ollama Qwen 2.5 3B config */ });
  const nar = createNAR({ enableLMRules: true, lmService });
  
  console.log('🧠 Scenario 1: Multi-Candidate Ambiguity...');
  // 1. Inject NL
  // 2. Assert FormalizationBatch length > 1
  // 3. Run NAR
  // 4. Assert final belief in 'server_crash' has f > 0.9
  
  console.log('🧠 Scenario 2: Abductive Leap...');
  // 1. Inject NL facts
  // 2. Trigger lm-hypothesis-generation
  // 3. Assert NAR derivation trace includes the LM hypothesis step
  // 4. Assert final confidence is mathematically discounted (NAL revision)
  
  console.log('🧠 Scenario 3: Epistemic Firewall...');
  // 1. Inject Goal + Belief
  // 2. Assert internal state has 1 Goal task and 1 Belief task
  // 3. Assert Belief truth value is NOT mutated by Goal desire
}

runFundamentals().catch(console.error);
```

### Why this proves the architecture
If **Qwen 2.5 3B** can successfully navigate these three scenarios—generating valid JSON schemas for Narsese, proposing logical hypotheses, and respecting the Belief/Goal type boundaries—it proves that **SeNARS12's Trusted Kernel and Gates are doing the heavy lifting**. 

The LLM is just a "dumb" translator and proposer; the *intelligence* and *safety* emerge from the NAL Truth Algebra, the Event Log, and the Gates. If it works on a 3B model, plugging in Claude 3.5 Sonnet or GPT-4o later will only yield richer hypotheses and better natural language explanations, without requiring any architectural changes.

