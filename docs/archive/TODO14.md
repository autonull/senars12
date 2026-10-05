# TODO14.md — Efficient Omnidirectional Validation & Compact Model Tuning

**Predecessor:** TODO13 (Phases 0–6 complete, 7/7 mock bench, 259 tests green).
**Philosophy:** No replay infrastructure, no test harness bloat. Make the real LM calls fast and reliable enough that testing with a live compact model is painless. Validate every rule in every direction with rule-specific assertions, not generic "did it crash" checks.

---

## Context

TODO13 proved the pipeline end-to-end: provider → GBNF → structured output → Narsese normalization → gate admission. But validation has two gaps:

1. **Directional blindness.** The bench asserts NL→NAL admission and a few fallbacks. It does not assert that explanations reference the correct premises, that analogies produce valid structural mappings, that goal decompositions yield valid subgoals, or that meta-reasoning selects real strategies. The LM Rules are omnidirectional; the assertions must be too.

2. **Wall-clock pain.** Real-model bench takes minutes because prompts are verbose, `maxOutputTokens` is loose, and every NAR cycle re-calls the LLM for the same context. The fix is not a test harness—it is making the calls themselves fast and deterministic.

---

## Phase 1 — Make LM Calls Fast and Reliable

The goal: a single compact model (target: Qwen3-0.8B or SmolLM2-360M) passes all 7 bench scenarios in under 30 seconds total. No tier system, no routing matrix—just one well-tuned model and tight prompts.

### 1.1 Per-Rule Token Budgets

**File:** `nar/src/lm/rule-templates/` (all rule files)

Set `maxOutputTokens` precisely per rule. Small models burn cycles generating tokens nobody needs.

| Rule | maxOutputTokens | Rationale |
|---|---|---|
| `lm-narsese-translation` | 128 | Multi-candidate JSON |
| `lm-explanation-generation` | 64 | ≤20 words |
| `lm-analogical-reasoning` | 8 | Single-word mask |
| `lm-hypothesis-generation` | 64 | One Narsese term |
| `lm-schema-induction` | 128 | Pattern + name JSON |
| `lm-goal-decomposition` | 96 | 2–3 subgoals JSON |
| `lm-belief-revision` | 32 | Confidence float |
| `lm-meta-reasoning` | 32 | Strategy name |
| `lm-curiosity-question` | 48 | One question |
| `lm-interactive-clarification` | 48 | One question |
| `lm-temporal-causal` | 96 | Temporal Narsese |
| `lm-variable-grounding` | 64 | Grounding term |
| `lm-concept-elaboration` | 96 | Property list |
| `lm-uncertainty-calibration` | 32 | Confidence float |

### 1.2 Prompt Minimisation

**Files:** All `nar/src/lm/rule-templates/*.ts`

Audit every prompt template. Remove all preamble, persona instructions, and explanatory text. The Kernel provides structure; the prompt should state only the task.

**Before (typical):**
```
You are a logical reasoning assistant. Given the following beliefs and
derivation trace, please generate a natural language explanation that
is clear, concise, and references the specific premises used...
```

**After:**
```
Explain: I believe {{conclusion}} because {{premise1}} and {{premise2}}.
Rewrite naturally. Under 20 words.
```

Target: no prompt exceeds 80 tokens of instruction. The Narsese context appended by `TraceAbstractor` is the payload; the instruction is the envelope.

### 1.3 Semantic Cache (Production, Not Test)

**File:** `nar/src/lm/lm-service.ts`

A simple in-memory cache keyed on prompt hash. If the same prompt fires twice in the same session (common during NAR cycles where the context hasn't changed), return the cached result instantly. This speeds up both production reasoning and bench runs.

```typescript
private cache = new Map<string, { result: string | null; at: number }>();
private cacheTtlMs = 60_000; // 1 minute

async generateText(prompt: string, opts?: LMGenerateOptions): Promise<string | null> {
  const key = hashCode(prompt + (opts?.grammar ?? '') + (opts?.maxOutputTokens ?? ''));
  const hit = this.cache.get(key);
  if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.result;

  const result = await this.tryGenerateText(prompt, opts);
  this.cache.set(key, { result, at: Date.now() });
  return result;
}
```

This is not a VCR. It is a runtime optimisation that also makes repeated bench runs instant.

### 1.4 Skip-When-Possible

**File:** `nar/src/lm/LMRule.ts`

Before calling the LLM, check whether the rule's activation context is strong enough to warrant an LM call. If the task priority is below a threshold, or the symbolic fallback would produce an equivalent result, skip the LLM entirely.

```typescript
if (context.taskPriority < this.rule.minPriorityForLM) {
  return this.applyFallback(context); // Skip LLM, use symbolic path
}
```

This prevents the NAR cycle loop from hammering the LLM for low-priority background tasks.

### 1.5 Model Selection: Find the Common Denominator

**Process (not code):**

1. Start with `SmolLM2-135M`. Run `pnpm bench:fundamentals`. Record which scenarios fail and why.
2. Tune prompts for failing rules (shorter, more constrained, better GBNF).
3. If a rule still fails, step up to `SmolLM2-360M`. Repeat.
4. Continue up the ladder (`Qwen3-0.8B`, `Qwen2.5-1.5B`) until all 7 scenarios pass.
5. That model is the common denominator. Document it. All future development targets it.

The constraint forces prompt quality. If a rule needs a 7B model to work, the prompt is too vague. Fix the prompt, not the model.

### Acceptance Criteria
- [ ] All 14 rules have explicit `maxOutputTokens` set.
- [ ] No prompt template exceeds 80 instruction tokens.
- [ ] Semantic cache hit rate > 50% on repeated bench runs.
- [ ] Skip-when-possible reduces LM calls by ≥30% in a 10-cycle NAR run.
- [ ] A named compact model passes all 7 scenarios in < 30 seconds.

---

## Phase 2 — Omnidirectional Rule Assertions

Every LM Rule gets three assertions: structural (format), semantic (content matches input), cognitive (NAL state changed correctly). These run in the bench against the mock provider (fast) and the compact model (real).

### 2.1 Assertion Matrix

**File:** `scripts/fundamentals-bench.ts` (extend each scenario) and `tests/lm/rule-assertions.ts` (new shared helpers)

| Rule | Direction | Structural | Semantic | Cognitive |
|---|---|---|---|---|
| `lm-narsese-translation` | NL→NAL | Passes `normalizeNarsese` | Candidates match source spans | Admitted via `PerceptionGate`, correct task type |
| `lm-explanation-generation` | NAL→NL | Non-empty, ≤20 words | Contains each `CriticalPath` premise term and rule name | Attached to correct derivation record |
| `lm-analogical-reasoning` | NAL→NAL | Single word or valid Narsese | Mask word creates valid mapping with skeleton | Shadow validation passes, belief admitted with `<->` |
| `lm-hypothesis-generation` | NAL→NAL | Valid Narsese | Shares variables with both stalled terms | Shadow validation passes, derivation unblocks |
| `lm-schema-induction` | NAL→NAL | Valid JSON: `narsese`, `name`, `confidence` | Pattern matches recurring derivation structure | Schema promoted to rule registry |
| `lm-goal-decomposition` | NAL→NAL | Valid JSON array, ≥2 items | Subgoals are subterms or prerequisites of parent | Subgoals admitted as goals, priority < parent |
| `lm-belief-revision` | NAL→NAL | Valid float in [0,1] | Differs from prior confidence | Truth updated, revision history logged |
| `lm-meta-reasoning` | NAL→NAL | Strategy name in allowed set | Appropriate for detected failure pattern | `CognitiveController` strategy actually changes |
| `lm-curiosity-question` | NAL→NL | Non-empty question | References the missing variable or unknown term | Admitted as `Question` task |
| `lm-interactive-clarification` | NL→NL | Non-empty question | References the ambiguous source span | Routed to user, not admitted as belief |
| `lm-temporal-causal` | NL→NAL | Valid Narsese with temporal copula | Sequence matches input temporal language | Admitted with temporal stamp |
| `lm-variable-grounding` | NAL→NAL | Valid Narsese | Grounding term is a concrete instance of the variable | Admitted as belief |
| `lm-concept-elaboration` | NAL→NL | Valid property list | Properties are plausible for the concept | Properties admitted as beliefs |
| `lm-uncertainty-calibration` | NAL→NAL | Valid float in [0,1] | Calibration direction matches evidence quality | Truth confidence updated |

### 2.2 Prompt Assembly Validation

**File:** `tests/lm/prompt-assertions.ts` (new)

Before the LLM is called, assert that the prompt was correctly assembled from the NAL state. This catches bugs where `TraceAbstractor` produces the right skeleton but the prompt template forgets to inject it.

```typescript
describe('prompt assembly', () => {
  it('explanation prompt contains actual premise terms', () => {
    const context = buildMockContext('lm-explanation-generation');
    const prompt = buildPrompt('lm-explanation-generation', context);
    const path = context.traceAbstractor.extractCriticalPath(context.derivation);
    for (const premise of path.premises) {
      expect(prompt).toContain(premise.narsese);
    }
    expect(prompt).toContain(path.ruleApplied);
  });

  it('analogy prompt contains mask and skeleton', () => {
    const context = buildMockContext('lm-analogical-reasoning');
    const prompt = buildPrompt('lm-analogical-reasoning', context);
    expect(prompt).toContain('[MASK]');
    expect(prompt).not.toContain('undefined');
  });

  // One test per rule
});
```

### 2.3 Cognitive Impact Assertions

**File:** `scripts/fundamentals-bench.ts` (extend)

After each rule fires, assert the NAL state changed correctly. These are the assertions that prove the rule actually *did something*, not just that it returned a string.

```typescript
// Scenario 4: Explanation
const explanation = nar.getExplanation(derivationId);
assert(explanation.text.length > 0, 'Explanation must not be empty');
assert(explanation.text.length < 200, 'Explanation must be concise');
for (const premise of criticalPath.premises) {
  assert(explanation.text.includes(premise.narsese), `Must reference ${premise.narsese}`);
}

// Scenario 6: Analogical Leap
const analogicalBeliefs = nar.getBeliefs().filter(b =>
  b.term.toString().includes('<->') && b.stamp.source.includes('LM_ANALOGY')
);
assert(analogicalBeliefs.length > 0, 'Analogical belief must be admitted');
assert(analogicalBeliefs[0].truth.confidence < 0.5, 'Confidence must be discounted');

// Goal Decomposition
const subgoals = nar.getGoals().filter(g =>
  g.stamp.source.includes('LM_DECOMPOSITION')
);
assert(subgoals.length >= 2, 'Must produce at least 2 subgoals');
assert(subgoals.every(g => g.priority < parentGoal.priority), 'Subgoals must have lower priority');
```

### 2.4 Integration into Bench

Extend `scripts/fundamentals-bench.ts` to run all 7 scenarios with the full assertion matrix. Each scenario reports:

```
Scenario 4: Socratic Explanation
  ✅ Structural: 42 chars, ≤20 words
  ✅ Semantic: references (whiskers --> cat), (cat --> animal), deduction
  ✅ Cognitive: attached to derivation rec-0042
  Provider: mock | 0ms
```

### Acceptance Criteria
- [ ] All 14 rules have structural, semantic, and cognitive assertions.
- [ ] Prompt assembly tests cover every rule's template.
- [ ] Bench reports per-rule assertion results, not just pass/fail.
- [ ] All assertions pass with `LM_PROVIDER=mock`.
- [ ] All assertions pass with the common-denominator compact model.

---

## Phase 3 — Adversarial & Fallback Validation

Test every rule's failure path without a real LLM. The mock provider injects garbage; the system must fall back gracefully.

### 3.1 Per-Rule Failure Injection

**File:** `nar/src/lm/providers/mock.ts` (extend with adversarial mode)

```typescript
const ADVERSARIAL_RESPONSES: Record<string, () => string | Error> = {
  'lm-narsese-translation':    () => '(((BROKEN SYNTAX !!))',
  'lm-explanation-generation': () => JSON.stringify({ explanation: '' }),  // empty
  'lm-analogical-reasoning':   () => 'three words here',                   // violates single-word
  'lm-hypothesis-generation':  () => '(cat --> fish). %1.0;0.9%',         // contradicts beliefs
  'lm-goal-decomposition':     () => JSON.stringify({ subgoals: [] }),     // empty
  'lm-meta-reasoning':         () => JSON.stringify({ strategy: 'fake' }), // invalid strategy
  'lm-belief-revision':        () => JSON.stringify({ confidence: 2.5 }),  // out of range
  'lm-schema-induction':       () => JSON.stringify({ confidence: 0.05 }), // too low
  'lm-curiosity-question':     () => '',                                   // empty
  'timeout':                   () => { throw new Error('LM_TIMEOUT'); },
};
```

### 3.2 Fallback Assertions

**File:** `scripts/fundamentals-bench.ts` (add `--adversarial` flag)

For each rule, inject the adversarial response and assert:
1. System does not crash.
2. Symbolic fallback fires (derivation trace records `fallbackUsed: true`).
3. NAL state remains consistent (no contradictions admitted, no invalid beliefs).
4. Cognitive tick completes.

```bash
pnpm bench:fundamentals:mock --adversarial   # All fallback paths, < 5 seconds
```

### 3.3 Firewall Fuzz Testing

**File:** `tests/lm/normalize-fuzz.test.ts` (new)

Property-based test: feed 10,000 mutated strings into `normalizeNarsense` + `parseNarseseLenient`. Assert the system never throws an unhandled exception.

```typescript
import fc from 'fast-check';

test('firewall never crashes on arbitrary input', () => {
  fc.assert(fc.property(fc.string(), (garbage) => {
    const result = parseNarseseLenient(normalizeNarsese(garbage));
    // Must return a valid Term or null. Must never throw.
    return result === null || typeof result === 'object';
  }), { numRuns: 10_000 });
});
```

### Acceptance Criteria
- [ ] Every rule has an adversarial response defined.
- [ ] `--adversarial` bench passes: all fallbacks fire, no crashes.
- [ ] Fuzz test passes 10,000 iterations without exception.
- [ ] Adversarial bench completes in < 5 seconds (mock provider, no LLM).

---

## Phase 4 — TODO13 Remaining Work

### 4.1 Resolve `core ↔ metta` Workspace Cycle

**Files:** `metta/src/agent/MettaCommandParser.ts` → `core/src/commands/CommandParser.ts`

The `MettaCommandParser` is now a general command parser (no `metta` command). Move it to `core`. Update all imports. The `metta` package should depend on `core`, never the reverse.

### 4.2 Unify `SourceQuality`

**Files:** Delete `nar/src/grounding.ts` legacy numeric enum. Make `kernel/src/schemas.ts` `SourceQualitySchema` the single source of truth. Update `KernelPerceptionGate.sourceQualityToConfidence` to consume the Zod schema directly.

### 4.3 Shared Provider-Probe Abstraction

**File:** `nar/src/lm/providers.ts`

Extract a common `probe(provider): Promise<boolean>` interface. Replace the duplicated `probeOllama`, `probeLlamaCpp`, and cloud-check logic with a single probe registry used by `resolveActiveProvider`.

### 4.4 Bench Wall-Clock Budget

**File:** `scripts/fundamentals-bench.ts`

Add `MAX_CYCLES` enforcement and per-scenario timeout. If a scenario exceeds 60 seconds with a real model, abort and report. Add `--scenario=N` flag to run one scenario at a time.

```bash
MAX_CYCLES=5 LM_PROVIDER=llamacpp pnpm bench:fundamentals --scenario=4
```

### 4.5 `TraceAbstractor` as Seed for `context/` Module

**File:** `nar/src/lm/context/` (directory)

Expand `trace-abstractor.ts` into a proper `context/` module. Add:
- `context/prompt-assertions.ts` (from Phase 2.2)
- `context/context-budget.ts` (token counting, truncation for small models)
- `context/index.ts` (barrel export)

### Acceptance Criteria
- [ ] `core ↔ metta` cycle resolved; `metta` depends on `core` only.
- [ ] `SourceQuality` has exactly one definition (in `kernel`).
- [ ] Provider probes use a shared interface.
- [ ] Bench respects `MAX_CYCLES` and `--scenario=N`.
- [ ] `context/` module exports `TraceAbstractor`, prompt assertions, and budget utilities.

---

## Phase 5 — Semantic Quality Pass

With the compact model identified (Phase 1.5) and assertions in place (Phase 2), run the real model through scenarios 4–6 and tune prompt quality.

### 5.1 Explanation Phrasing

Run Scenario 4 with the compact model. Read the generated explanations. If they are grammatically broken or miss premises, tighten the slot-fill template. If they are too verbose, reduce `maxOutputTokens`.

### 5.2 Mask-Fill Word Choice

Run Scenario 6 (Analogical Leap). Inspect the single-word mask fills. If the model consistently picks wrong words, the structural skeleton prompt may be ambiguous. Add one clarifying example to the prompt (few-shot, but only one shot—keep it minimal).

### 5.3 Goal Decomposition Quality

Run a goal-decomposition scenario. Verify subgoals are actually useful (not just syntactic variants of the parent). If the model produces trivial subgoals, add a constraint: "Subgoals must be actionable operations or measurable conditions."

### 5.4 Iterate

For each quality issue found:
1. Identify the prompt template.
2. Tighten the instruction or add a GBNF constraint.
3. Re-run the scenario.
4. Verify assertions still pass.

Do not add complexity to the Kernel to compensate for a weak prompt. Fix the prompt.

### Acceptance Criteria
- [ ] Scenarios 4–6 produce semantically correct output with the compact model.
- [ ] No explanation misses a premise.
- [ ] No analogy mask-fill is structurally invalid.
- [ ] No goal decomposition produces trivial subgoals.
- [ ] All Phase 2 assertions still pass after tuning.

---

## Phase 6 — Multi-Agent E2E Test

The final proof: two SeNARS12 instances cooperating over a real WebSocket connection.

### 6.1 Wire Delegation into `io` Transport

**File:** `io/src/connections/ws.ts` (extend)

Register the delegation handler from `nar/src/cooperation/delegation.ts` on the WebSocket server.

```typescript
wsServer.on('message', (data: Buffer) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'cognitive.delegation') {
    handleDelegationMessage(msg.data, {
      nar: agent.nar,
      respond: (result) => wsServer.send(JSON.stringify({
        type: 'cognitive.delegation.result',
        data: result,
      })),
    });
  }
});
```

### 6.2 E2E Test Script

**File:** `scripts/multi-agent-handshake.ts` (new)

```typescript
// Agent A: edge (mock or compact model)
// Agent B: frontier (mock with higher-quality responses, or real model)

// 1. Feed Agent A a problem it can't solve alone
await agentA.nar.believe('(alice --> senior_developer). %1.0;0.9%');
await agentA.nar.question('(alice --> access_mainframe)?');

// 2. Agent A delegates hypothesis-generation to Agent B
const delegation = createDelegation({
  taskType: 'lm-hypothesis-generation',
  narseseContext: serializeNarState(agentA.nar),
  callbackEndpoint: 'ws://localhost:8765',
});
await agentA.sendDelegation(delegation);

// 3. Agent B processes and returns
// 4. Agent A admits the result via PEER_AGENT source quality

// Assert: Agent A's belief space now contains the bridging hypothesis
const beliefs = agentA.nar.getBeliefs();
assert(beliefs.some(b => b.stamp.source.includes('PEER_AGENT')));
```

### 6.3 Run Over Real WebSocket

```bash
# Terminal 1: Agent B
pnpm bot --port=8765 --agent=b

# Terminal 2: Agent A + handshake
pnpm exec tsx scripts/multi-agent-handshake.ts
```

### Acceptance Criteria
- [ ] Delegation handler wired into `io` WebSocket server.
- [ ] Handshake script completes: Agent A delegates, Agent B responds, Agent A admits.
- [ ] Admitted result has `PEER_AGENT` source quality.
- [ ] Shadow validation runs on the received result.
- [ ] Derivation trace on Agent A shows the peer-provided hypothesis.

---

## Master Checklist

### Phase 1: LM Call Efficiency
- [ ] Per-rule `maxOutputTokens` set for all 14 rules
- [ ] All prompt templates ≤ 80 instruction tokens
- [ ] Semantic cache in `LMService` (hash-keyed, 60s TTL)
- [ ] Skip-when-possible logic in `LMRule` execution
- [ ] Common-denominator model identified and documented

### Phase 2: Omnidirectional Assertions
- [ ] Assertion matrix implemented for all 14 rules
- [ ] Prompt assembly tests for every rule template
- [ ] Cognitive impact assertions in bench
- [ ] Bench reports per-rule assertion detail
- [ ] All assertions pass with mock provider

### Phase 3: Adversarial & Fallback
- [ ] Adversarial responses defined for every rule
- [ ] `--adversarial` bench flag implemented and passing
- [ ] Fuzz test on `normalizeNarsese` (10,000 iterations)
- [ ] All fallback paths verified (no crashes, correct trace)

### Phase 4: TODO13 Remaining
- [ ] `MettaCommandParser` moved to `core`, cycle resolved
- [ ] `SourceQuality` unified (single source in `kernel`)
- [ ] Shared provider-probe abstraction
- [ ] Bench `MAX_CYCLES` + `--scenario=N` enforcement
- [ ] `context/` module expanded

### Phase 5: Semantic Quality
- [ ] Scenarios 4–6 tuned with compact model
- [ ] Explanations reference all premises
- [ ] Analogies produce valid structural mappings
- [ ] Goal decompositions produce useful subgoals

### Phase 6: Multi-Agent E2E
- [ ] Delegation handler wired into `io` WS transport
- [ ] Handshake script written and passing
- [ ] `PEER_AGENT` admission verified
- [ ] Shadow validation on peer results verified

---

*One compact model. Tight prompts. Semantic cache. Every rule asserted in every direction. Every fallback proven. No replay harness, no test bloat—just fast, reliable calls and honest assertions.* 🧠⚡
