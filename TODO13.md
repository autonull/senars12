If we design the system for the **lowest common denominator** (1.5B–4B edge models) using constrained micro-prompts and symbolic fallbacks, a 70B frontier model will simply execute those exact same prompts faster and with higher accuracy. We don't need a "tier" to tell us how to prompt a big model; the Kernel just does its job, and the LLM acts as a universal slot-filler. 

Here is the final, fat-trimmed, zero-overengineering plan. We build for the edge, and the frontier just works as a bonus.

---

# SeNARS12 — Universal Cognitive Kernel Plan

**Scope:** Edge-native cognition, universal LM rules, multi-agent cooperation, architectural simplification.
**Constraint:** No CI requirements. No tier abstractions. Build for the common denominator.

## Governing Principles

1. **One Kernel, One Rule Set.** The Trusted Kernel (NAL + Gates) and the LM Rules are identical everywhere. 
2. **Constrained Universal Prompts.** Every LM Rule uses a constrained micro-prompt (GBNF grammar, JSON schema, or slot-filling) that works on a 1.5B model. If a 70B model is plugged in, it executes the exact same prompt.
3. **Symbolic Fallbacks.** If the LLM fails (timeout, garbage, refusal), the rule immediately falls back to a pure NAL symbolic heuristic. No cognitive function is ever lost.
4. **Narsese Is the Universal Wire.** All inter-agent communication uses Narsese terms with truth values.
5. **MeTTa Is a Tool.** Exact computation is available on demand. It does not participate in the cognitive loop.

---

## Phase 0 — MeTTa Demotion

Remove MeTTa from the cognitive tick pipeline. Retain it as a callable tool.

### 0.1 Remove MeTTa from the Agent Engine Registry
**File:** `nar/src/agent/create-agent.ts`
```typescript
agent.registerEngine('nar', new NAREngine(nar));
// MeTTa is NOT registered as a reasoning engine.
```

### 0.2 Remove Command Routing & Arbiter
Remove the `metta:` prefix routing from the command parser. Delete any `Arbiter` or `EngineResult` proposal boundary between NAL and MeTTa. 

### 0.3 Retain MeTTa as a Tool
The existing `metta` tool remains in `BUILTIN_TOOLS`, invoked through the `ActionGate`:
```typescript
await tools.execute('metta', { program: '(add (succ 0) (succ 0))', timeoutMs: 5000 });
```

---

## Phase 1 — Local Inference & Constrained Decoding

Stabilize local model inference and force small models to output valid syntax.

### 1.1 Native `LlamaCppProvider`
**File:** `nar/src/lm/providers/llamacpp-native.ts` (new)
Write a native provider using `fetch` to bypass AI SDK limitations.
- Inject `chat_template_kwargs: { thinking: false }` for Qwen models.
- Pass `grammar` (GBNF) directly in the payload for constrained decoding.
- Use native JSON mode for structured output.

### 1.2 Universal GBNF Grammar Library
**Directory:** `nar/src/lm/grammars/`
Ship exactly two grammars to force small models into valid syntax:
1. `narsese-term.gbnf` (Forces valid Narsese term syntax)
2. `single-word.gbnf` (Forces exactly one token for mask-filling)

### 1.3 Universal LLM Failure Escalation
Every LM call follows a strict, simple escalation:
1. **Attempt 1:** Normal micro-prompt.
2. **On failure:** Retry once with `temperature + 0.2`.
3. **On second failure:** Return `null`. The caller activates the pure NAL symbolic fallback.

---

## Phase 2 — Universal Cognitive Micro-Tasks

Build the infrastructure that lets any model participate in NAL↔NAL, NAL→NL, and correction. The Kernel does the structural work; the LLM just fills the gaps.

### 2.1 `TraceAbstractor`
**File:** `nar/src/lm/context/trace-abstractor.ts` (new)
Extracts the minimal structural skeleton from a NAL derivation.
```typescript
export class TraceAbstractor {
  extractCriticalPath(record: DerivationRecord): CriticalPath {
    // Returns the exact 2-3 premises and the rule applied.
  }
  extractStructuralSkeleton(term: Term): string {
    // Replaces atoms with variables: (cat --> animal) → (?A --> ?B)
  }
}
```

### 2.2 NAL → NL: Socratic Explanation
**Edge-Universal Prompt (Slot-filling):**
```text
Complete this sentence naturally, under 20 words:
"I believe [Conclusion] because [Premise 1] and [Premise 2]."
```
**Fallback:** If LLM fails, use pure string interpolation: `I concluded X because Y and Z.`

### 2.3 NAL → NAL: Analogical Leap
**Kernel-Driven Isomorphism:** 
The Kernel uses NAL's `variable-unification` to find structural matches. The LLM only fills the semantic gap.
**Universal Prompt:**
```text
Concept A is "${source.nl}". Concept B is "${target.nl}".
Concept X is "${analogSource.nl}". Concept Y is "[MASK]".
Fill the mask with exactly one word.
```
**Fallback:** If LLM fails, use NAL's symbolic `comparison` and `analogy` rules.

### 2.4 Bidirectional Correction
**File:** `nar/src/rules/processor.ts`
When a contradiction is detected and traceable to an LLM translation, `RuleProcessor.attemptLMCorrection()` fires.
**Universal Prompt:**
```text
You parsed "${sourceText}" as: ${wrongNarsese}.
This contradicts: ${contradictingNarsese}.
Reparse "${sourceText}" to resolve the contradiction. Output only Narsese.
```
Constrained by `narsese-term.gbnf`.

---

## Phase 3 — Universal LM Rules & Symbolic Fallbacks

Replace the tier-matrix with a single, clean rule definition. Every rule has exactly one prompt and one symbolic fallback.

### 3.1 `LMRuleDefinition`
**File:** `nar/src/lm/types.ts`
```typescript
export interface LMRuleDefinition {
  id: string;
  category: 'belief' | 'goal' | 'question' | 'meta';
  buildPrompt: (context: LMRuleContext) => string;
  grammar?: string;          // GBNF grammar for constrained decoding
  maxOutputTokens: number;
  fallback: (context: LMRuleContext) => NarseseTerm | null; // Pure NAL fallback
}
```

### 3.2 Universal Rule Matrix

| Rule ID | Universal Prompt Strategy | Symbolic Fallback |
|---|---|---|
| `lm-narsese-translation` | Constrained JSON, multi-candidate | Mock/Template parser |
| `lm-explanation-generation` | Template slot-fill | String interpolation |
| `lm-analogical-reasoning` | Kernel isomorphism + single-word mask | NAL `comparison` + `analogy` |
| `lm-hypothesis-generation` | "What connects A and B? Output Narsese." | NAL `abduction` |
| `lm-schema-induction` | "Name this pattern: [NAL Skeleton]" | Frequency-based pattern detection |
| `lm-meta-reasoning` | "Which strategy fixes this error?" | Priority-weighted strategy selection |
| `lm-belief-revision` | "Adjust confidence based on context." | Source-quality lookup |
| `lm-goal-decomposition` | "List 2 subgoals for X in JSON." | Template decomposition |
| `lm-curiosity-question` | "What is the missing variable for X?" | NAL `question` generation |

### 3.3 Shadow Validation
Every LLM-generated Narsese term is validated in a shadow `Bag<T>` for 3 cycles. If it produces a contradiction, it is silently dropped and the symbolic fallback is used.

---

## Phase 4 — Multi-Agent Cognitive Cooperation

Enable SeNARS12 instances to cooperate by delegating cognitive tasks via Narsese.

### 4.1 Delegation Protocol
**File:** `nar/src/cooperation/delegation.ts` (new)
```typescript
export interface CognitiveTaskDelegation {
  taskId: string;
  taskType: string;           // LM Rule ID
  narseseContext: string;     // Serialized NAL state
  callbackEndpoint: string;   // WebSocket URL
}

export interface CognitiveTaskResult {
  taskId: string;
  resultNarsese: string[];    // Narsese terms with truth values
  success: boolean;
}
```

### 4.2 Delegation Flow
Agent A (running locally) delegates a task via WebSocket to Agent B (running on a beefier server). Agent B runs the *exact same universal LM rule* using its local model, and returns the Narsese result. Agent A admits the result through its `PerceptionGate` with `PEER_AGENT` source quality and shadow-validates it.

### 4.3 Source Quality
Extend `SourceQuality` enum:
```typescript
PEER_AGENT = 'PEER_AGENT' // Confidence determined by peer's reported truth value
```

---

## Phase 5 — Validation: Fundamentals Benchmark

Prove all capabilities locally with 7 scenarios. No tier flags, just a pure pass/fail benchmark.

### 5.1 Scenarios
**File:** `scripts/fundamentals-bench.ts`

| # | Scenario | Assertion |
|---|---|---|
| 1 | Multi-Candidate Ambiguity | ≥2 candidates admitted provisionally |
| 2 | Abductive Leap | LM hypothesis appears in derivation trace |
| 3 | Epistemic Firewall | Belief/Goal separation enforced |
| 4 | Socratic Explanation | NL output contains premise terms and rule name |
| 5 | Bidirectional Correction | Contradiction resolved via reparsing |
| 6 | Analogical Leap | Structural match found, LLM fills mask, shadow validation passes |
| 7 | Graceful Degradation | Kill the LLM mid-run. Assert NAL symbolic fallbacks take over and the system keeps reasoning without crashing. |

### 5.2 Execution
```bash
pnpm bench:fundamentals
```
Assert all 7 scenarios pass on the local model (e.g., `Qwen2.5-3B` via `llama.cpp`).

---

## Phase 6 — README.md Update

Align documentation with the simplified architecture.

### 6.1 Architecture Overview
Remove MeTTa from the "Untrusted Proposers" box. Add it to the tools.

### 6.2 Update LM Rules Section
Document the Universal Rules and their Symbolic Fallbacks. Explicitly state: *"SeNARS12 uses constrained micro-prompts that work on 1.5B edge models. If a larger model is provided, it executes the same prompts with higher fidelity. If the LLM fails, the Kernel falls back to pure NAL symbolic logic."*

### 6.3 Add Multi-Agent Cooperation Section
Document the WebSocket delegation protocol and how agents share Narsese conclusions.

### 6.4 Update Quick Reference
Remove `MettaEngine`. Add `TraceAbstractor`, `BidirectionalCorrection`, and `CognitiveTaskDelegation`.

---

## Master Checklist

### Phase 0: MeTTa Demotion
- [ ] Remove `MettaEngine` from `createAgent()`
- [ ] Remove `MettaCommandParser` from command routing
- [ ] Verify `metta` tool works via `ActionGate`
- [ ] Remove Arbiter Pattern enforcement

### Phase 1: Local Inference & Constrained Decoding
- [ ] Implement `LlamaCppProvider` (native fetch, `chat_template_kwargs`, GBNF)
- [ ] Ship `narsese-term.gbnf` and `single-word.gbnf`
- [ ] Implement LLM failure escalation (retry -> null)

### Phase 2: Universal Cognitive Micro-Tasks
- [ ] Implement `TraceAbstractor`
- [ ] Implement NAL->NL slot-fill explanation + string fallback
- [ ] Implement NAL->NAL kernel-driven analogical leap + NAL fallback
- [ ] Implement `RuleProcessor.attemptLMCorrection()`

### Phase 3: Universal LM Rules
- [ ] Define flat `LMRuleDefinition` (no tiers, no variants)
- [ ] Implement all 9 rules with universal prompts and symbolic fallbacks
- [ ] Implement shadow validation for LLM hypotheses

### Phase 4: Multi-Agent Cooperation
- [ ] Define `CognitiveTaskDelegation` (4 fields) and `Result` (3 fields)
- [ ] Implement WebSocket delegation handler
- [ ] Add `PEER_AGENT` to `SourceQuality`

### Phase 5: Validation
- [ ] Add scenarios 4-7 to `fundamentals-bench.ts`
- [ ] Verify all 7 scenarios pass locally

### Phase 6: README Update
- [ ] Update Architecture Overview (MeTTa removal)
- [ ] Update LM Rules section (Universal + Fallbacks)
- [ ] Add Multi-Agent Cooperation section
- [ ] Update Quick Reference table

---

*One kernel. Universal prompts. Symbolic fallbacks. The NAL reasons. The LLM fills. MeTTa computes when asked. The Truth Algebra verifies.* 🧠⚡
