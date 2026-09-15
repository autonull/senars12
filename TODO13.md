If we design the system for the **lowest common denominator** (1.5B–4B edge models) using constrained micro-prompts and symbolic fallbacks, a 70B frontier model will simply execute those exact same prompts faster and with higher accuracy. We don't need a "tier" to tell us how to prompt a big model; the Kernel just does its job, and the LLM acts as a universal slot-filler.

# SeNARS12 — Universal Cognitive Kernel Plan (REVISED)

**Status: Phases 0–6 implemented (2026-09-15).** All 7 fundamentals scenarios pass (`LM_PROVIDER=mock pnpm bench:fundamentals`). 254 unit/integration tests pass. See "Progress" at the bottom for details and open items.

**Scope:** Edge-native cognition, universal LM rules, multi-agent cooperation, architectural simplification.
**Constraint:** No CI requirements. No tier abstractions. Build for the common denominator.

## Revision Notes (codebase alignment, 2026-09)

Audited against the actual monorepo (`nar`, `core`, `kernel`, `metta`, `io`, `util`, `ui`). Deltas from the original plan:

1. **Phase 0 target file** is `nar/src/agent/index.ts`, not `create-agent.ts`. There is **no Arbiter** and no `EngineResult` proposal boundary anywhere — nothing to delete (verified by grep).
2. **`MettaCommandParser` is NOT metta-specific.** It is the general LLM command parser (`send`, `remember`, `query`, `shell`, …, `metta`) in `metta/src/agent/MettaCommandParser.ts`, consumed by `core/src/Agent.ts` via `commandParser`. We keep it and only drop its `metta` command. Do not delete the parser.
3. **`metta` tool already exists** (`core/src/motor/builtin-tools.ts:288-302`, invoked via `deps.metta` ← `mettaExecutor`). Demotion = stop registering the MettaEngine as a reasoning engine, keep the tool executor wired.
4. **LM rules are zod-schema-driven** (`LMRuleDefinition` in `nar/src/lm/rule-builders.ts` has `schema`, `activationCondition`; no `buildPrompt`/`grammar`/`fallback`). We extend the existing definition rather than introducing a parallel one.
5. **All 9 planned LM rule IDs already exist** (plus 5 extra we keep: concept-elaboration, interactive-clarification, temporal-causal, uncertainty-calibration, variable-grounding). Work = add GBNF constraints + symbolic fallbacks, not new rules.
6. **Ollama provider already uses `createOpenAICompatible`** in `nar/src/lm/providers.ts` with `thinkingAwareFetch` injecting `chat_template_kwargs: { enable_thinking: false }` (L115-128) — the llamacpp provider extends this pattern with a dedicated `fetch` + GBNF passthrough.
7. **Retry escalation** extends `withRetry` in `nar/src/lm/lm-service.ts:66-88` (today: transport errors only, backoff, throws).
8. **Contradiction handling lives in `nar/src/cognitive/analyzers/corrections.ts`**, not `rules/processor.ts`. Correction hook goes there (a thin `attemptLMCorrection` may still be exposed via `SelfAnalyzerService`).
9. **Two `SourceQuality` definitions must be reconciled**: zod `SourceQualitySchema` in `kernel/src/schemas.ts:379-386` and numeric legacy enum in `nar/src/grounding.ts:4-10`; mapping at `nar/src/kernel/KernelPerceptionGate.ts:92`.
10. **Bench has 3 of 7 scenarios** (`scripts/fundamentals-bench.ts`: Multi-Candidate Ambiguity, Hypothesis Injection, Epistemic Firewall) with `mock` provider branches. Scenarios 4–7 extend this file.

---

## Governing Principles

1. **One Kernel, One Rule Set.** The Trusted Kernel (NAL + Gates) and the LM Rules are identical everywhere.
2. **Constrained Universal Prompts.** Every LM Rule uses a constrained micro-prompt (GBNF grammar, JSON schema, or slot-filling) that works on a 1.5B model. If a 70B model is plugged in, it executes the exact same prompt.
3. **Symbolic Fallbacks.** If the LLM fails (timeout, garbage, refusal), the rule immediately falls back to a pure NAL symbolic heuristic. No cognitive function is ever lost.
4. **Narsese Is the Universal Wire.** All inter-agent communication uses Narsese terms with truth values.
5. **MeTTa Is a Tool.** Exact computation is available on demand. It does not participate in the cognitive loop.

---

## Phase 0 — MeTTa Demotion

Remove MeTTa from the cognitive loop; retain it strictly as a callable tool.

### 0.1 Stop Registering `MettaEngine` as an Engine
**File:** `nar/src/agent/index.ts`
- Delete `agent.registerEngine('metta', mettaEngine)` (L175) and the `engines.metta` config flag (L23, L143, L204).
- Keep a lazily-instantiated `MettaEngine` **only** to back `mettaExecutor`, so the `metta` tool (`core/src/motor/builtin-tools.ts`) keeps working through the `ActionGate`.

### 0.2 Drop the `metta` Command from Command Routing
**File:** `metta/src/agent/MettaCommandParser.ts`
- Remove `'metta'` from `LLM_COMMANDS` and its `#parseLine` branch. All other commands (`send`, `remember`, `query`, `shell`, …) are untouched.
- Move the parser out of the metta package in a follow-up (it is conceptually a core concern); for now, only remove the metta command to keep the diff small.

### 0.3 Clean Core Enums & Schema
- `core/src/CognitiveEvent.ts:1` and `core/src/protocol/capabilities.ts:7`: narrow `'nar' | 'metta'` → `'nar'`.
- `core/src/agent/phases.ts:40,53` and `core/src/Agent.ts:79,98,146`: remove metta-engine event emission; keep the `metta` tool dep.
- `core/src/PolicyEngine.ts:12`: drop the `metta` command allowance.
- `kernel/src/schemas.ts` `DerivationRecordSchema.engine` (`'nar' | 'metta'`): narrow to `'nar'`.

### 0.4 Fix Tests
- `tests/integration/metta-tool-invocation.test.ts`: rewrite to invoke the `metta` tool via the tool registry (no `metta:` chat prefix).
- `tests/e2e/metta-smoke.test.ts`, `tests/integration/multi-agent.test.ts`: remove direct MettaEngine registration; assert the tool still executes programs.
- Sweep `nar/src/tools/adapters/external-tools.ts` (L1454-1711) scenario text for stale metta-engine references.

---

## Phase 1 — Local Inference & Constrained Decoding

Stabilize local model inference and force small models to output valid syntax.

### 1.1 Native `LlamaCppProvider`
**File:** `nar/src/lm/providers/llamacpp.ts` (new; wired into `nar/src/lm/providers.ts`)
- Add `'llamacpp'` to `LMProviderName` and the auto-detect ladder (probe `http://host/prop` or `/v1/models`, after Ollama).
- Plain `fetch` provider (bypasses AI SDK when needed), reusing the `thinkingAwareFetch` pattern:
  - inject `chat_template_kwargs: { thinking: false }` for Qwen-family models;
  - pass `grammar` (GBNF) straight through in the completion payload;
  - `json_object`/JSON-schema response format for structured tasks.
- Slots: quality/fast/structured/compact, consistent with `CHAINS`.

### 1.2 Universal GBNF Grammar Library
**Directory:** `nar/src/lm/grammars/` (new)
1. `narsese-term.gbnf` — valid Narsese term syntax (statements, copulas, compound terms, truth separators).
2. `single-word.gbnf` — exactly one token, for mask-filling.
- Exported via `nar/src/lm/grammars/index.ts` (`loadGrammar(name): string`), consumed by `LMRuleDefinition.grammar`.

### 1.3 Universal LLM Failure Escalation
**File:** `nar/src/lm/lm-service.ts` (`withRetry`)
1. Attempt 1: normal micro-prompt.
2. On failure: retry once with `temperature + 0.2`.
3. On second failure: return `null` (not throw). Caller activates the symbolic fallback.
- Transport-level backoff and circuit breaker (`providers.ts`) remain as-is underneath.

---

## Phase 2 — Universal Cognitive Micro-Tasks

The Kernel does structural work; the LLM fills gaps.

### 2.1 `TraceAbstractor`
**File:** `nar/src/lm/context/trace-abstractor.ts` (new)
Consumes `DerivationRecord` from `kernel/src/schemas.ts` (produced by `nar/src/rules/recorder.ts`).
```typescript
extractCriticalPath(record: DerivationRecord): CriticalPath;   // premises + ruleId per step
extractStructuralSkeleton(term: Term): string;                  // (cat --> animal) → (?A --> ?B)
```

### 2.2 NAL → NL: Socratic Explanation
**File:** `nar/src/lm/rule-templates/belief-rules.ts` (`lm-explanation-generation`)
- Replace free-text generation with slot-filling: *"I believe [Conclusion] because [Premise 1] and [Premise 2]."* (≤20 words).
- **Fallback:** pure string interpolation: `I concluded X because Y and Z.`

### 2.3 NAL → NAL: Analogical Leap
**File:** `nar/src/lm/rule-templates/belief-rules.ts` (`lm-analogical-reasoning`)
- Kernel finds structural matches via variable unification (using `TraceAbstractor.extractStructuralSkeleton`); the LLM fills only the mask with one word (`single-word.gbnf`).
- **Fallback:** NAL symbolic `comparison` + `analogy` rules.

### 2.4 Bidirectional Correction
**File:** `nar/src/cognitive/analyzers/corrections.ts` (+ hook on `SelfAnalyzerService`)
When a contradiction traces to an LLM translation:
```text
You parsed "${sourceText}" as: ${wrongNarsese}.
This contradicts: ${contradictingNarsese}.
Reparse "${sourceText}" to resolve the contradiction. Output only Narsese.
```
Constrained by `narsese-term.gbnf`; on failure, drop the LLM-derived belief and keep the symbolic side.

---

## Phase 3 — Universal LM Rules & Symbolic Fallbacks

Extend the existing rule system — no parallel definition, no tier matrix.

### 3.1 Extend `LMRuleDefinition`
**File:** `nar/src/lm/rule-builders.ts`
```typescript
grammar?: string;                                   // GBNF grammar name for constrained decoding
maxOutputTokens?: number;
fallback?: (context: LMRuleContext) => Task[] | null; // pure-NAL fallback; null → skip
```
`LMRule` execution (`nar/src/lm/LMRule.ts`) applies escalation (1.3) and falls back on `null`/invalid output. No `buildPrompt` field: existing `rule-templates` prompt construction + zod `schema` stays canonical.

### 3.2 Universal Rule Matrix (all existing IDs + 5 extras retained)

| Rule ID | Universal Prompt Strategy | Symbolic Fallback |
|---|---|---|
| `lm-narsese-translation` | Constrained JSON, multi-candidate | Template parser |
| `lm-explanation-generation` | Template slot-fill | String interpolation |
| `lm-analogical-reasoning` | Kernel isomorphism + single-word mask | NAL `comparison` + `analogy` |
| `lm-hypothesis-generation` | "What connects A and B? Output Narsese." | NAL `abduction` |
| `lm-schema-induction` | "Name this pattern: [NAL Skeleton]" | Frequency-based pattern detection |
| `lm-meta-reasoning` | "Which strategy fixes this error?" | Priority-weighted strategy selection |
| `lm-belief-revision` | "Adjust confidence based on context." | Source-quality lookup |
| `lm-goal-decomposition` | "List 2 subgoals for X in JSON." | Template decomposition |
| `lm-curiosity-question` | "What is the missing variable for X?" | NAL `question` generation |
| *(5 extras)* concept-elaboration, interactive-clarification, temporal-causal, uncertainty-calibration, variable-grounding | Existing prompts | Best-effort NAL heuristics (null → skip) |

### 3.3 Shadow Validation
**File:** `nar/src/lm/shadow-validation.ts` (new)
Every LLM-generated Narsese task is validated in a shadow `Bag<T>` for 3 cycles. Contradiction → silently dropped, symbolic fallback used. Hooked at rule-output admission (next to `nar/src/lm/admit.ts`), reusing gate logic from `KernelPerceptionGate`.

---

## Phase 4 — Multi-Agent Cognitive Cooperation

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
Transport reuses `io/src/connections/ws.ts` (`startWSServer`) rather than a bespoke server.

### 4.2 Delegation Flow
Agent A delegates via WebSocket; Agent B runs the *same universal LM rule* locally and returns Narsese. A admits the result through `KernelPerceptionGate` with `PEER_AGENT` source quality and shadow-validates it.

### 4.3 Source Quality
- Add `PEER_AGENT` to `SourceQualitySchema` (`kernel/src/schemas.ts:379`), the legacy `SourceQuality` enum (`nar/src/grounding.ts`), and the `sourceQualityToConfidence` mapping (`nar/src/kernel/KernelPerceptionGate.ts:92`). Confidence from the peer's reported truth value (not a fixed constant).
- While touching `grounding.ts`, reconcile the legacy numeric enum with the zod schema (single source of truth in `kernel`).

---

## Phase 5 — Validation: Fundamentals Benchmark

**File:** `scripts/fundamentals-bench.ts` — extend the existing 3 scenarios to 7. `pnpm bench:fundamentals` (and `:mock` for deterministic CI, `:ollama` / `:llamacpp` for real models).

| # | Scenario | Status | Assertion |
|---|---|---|---|
| 1 | Multi-Candidate Ambiguity | ✅ exists | ≥2 candidates admitted provisionally |
| 2 | Abductive Leap | exists (extend) | LM hypothesis appears in derivation trace; fallback fires under mock |
| 3 | Epistemic Firewall | ✅ exists | Belief/Goal separation enforced |
| 4 | Socratic Explanation | new | NL output contains premise terms and rule name; mock → interpolation fallback |
| 5 | Bidirectional Correction | new | Contradiction resolved via reparsing; mock → symbolic side kept |
| 6 | Analogical Leap | new | Structural match found, mask filled, shadow validation passes |
| 7 | Graceful Degradation | new | Kill the LLM mid-run; NAL fallbacks take over, no crash |

---

## Phase 6 — README.md Update

- **6.1 Architecture Overview:** remove MeTTa from "Untrusted Proposers"; list it under tools.
- **6.2 LM Rules section:** document universal rules + symbolic fallbacks and the escalation path; state: *"SeNARS12 uses constrained micro-prompts that work on 1.5B edge models. A larger model executes the same prompts with higher fidelity. If the LLM fails, the Kernel falls back to pure NAL symbolic logic."*
- **6.3 Multi-Agent Cooperation section:** WebSocket delegation protocol, PEER_AGENT admission, shadow validation.
- **6.4 Quick Reference:** remove `MettaEngine`; add `TraceAbstractor`, `BidirectionalCorrection`, `CognitiveTaskDelegation`, `LlamaCppProvider`, grammars.

---

## Master Checklist

### Phase 0: MeTTa Demotion
- [ ] Stop registering `MettaEngine` as engine; keep tool executor (`nar/src/agent/index.ts`)
- [ ] Remove `metta` command from `MettaCommandParser` / `LLM_COMMANDS`
- [ ] Clean core enums: `CognitiveEvent.ts`, `capabilities.ts`, `phases.ts`, `PolicyEngine.ts`, `DerivationRecordSchema.engine`
- [ ] Fix metta-related tests (tool invocation, smoke, multi-agent)

### Phase 1: Local Inference & Constrained Decoding
- [ ] `LlamaCppProvider` (native fetch, `chat_template_kwargs`, GBNF passthrough) wired into provider registry + auto-detect
- [ ] Ship `narsese-term.gbnf` + `single-word.gbnf` with loader
- [ ] Failure escalation in `withRetry` (retry temp+0.2 → null)

### Phase 2: Universal Cognitive Micro-Tasks
- [ ] `TraceAbstractor` (critical path + structural skeleton)
- [ ] Slot-fill explanation + string fallback (`lm-explanation-generation`)
- [ ] Kernel-driven analogical leap + NAL fallback (`lm-analogical-reasoning`)
- [ ] Bidirectional correction in `nar/src/cognitive/analyzers/corrections.ts`

### Phase 3: Universal LM Rules
- [ ] Extend `LMRuleDefinition` (`grammar`, `maxOutputTokens`, `fallback`); wire into `LMRule` execution
- [ ] Add grammar constraints + fallbacks to all 9 planned rules (and null-fallbacks for the 5 extras)
- [ ] Shadow validation Bag for LLM Narsese

### Phase 4: Multi-Agent Cooperation
- [ ] `CognitiveTaskDelegation` / `CognitiveTaskResult` types
- [ ] WebSocket delegation handler on top of `io` transport
- [ ] `PEER_AGENT` source quality (kernel schema + grounding enum + gate mapping); reconcile duplicate `SourceQuality`

### Phase 5: Validation
- [ ] Add scenarios 4-7 to `fundamentals-bench.ts` (with mock-provider fallback branches)
- [ ] All 7 scenarios pass (`bench:fundamentals:mock`; real model where available)

### Phase 6: README Update
- [ ] Architecture overview (MeTTa → tools)
- [ ] LM Rules section (universal + fallbacks)
- [ ] Multi-Agent Cooperation section
- [ ] Quick Reference table

## Improvement Opportunities (noted during audit, not in scope)
- Move `MettaCommandParser` (a general command parser) out of `metta/` into `core/` or `io/`.
- Unify `SourceQuality` fully: delete the legacy numeric enum once the kernel schema is the only consumer.
- Replace the ad-hoc `probeOllama`/auto-detect ladder with a shared provider-probe abstraction when llamacpp lands.
- `nar/src/lm/context.ts` is minimal; `TraceAbstractor` is a good seed for a proper `context/` module.
- Bench scenario 2 currently can't verify LM firing under mock; scenario 7's degradation path doubles as the fix.

## Progress (2026-09-15)

### Phase 0 — MeTTa Demotion ✅
- `nar/src/agent/index.ts`: MettaEngine no longer registered as engine; `engines.metta` flag removed; MettaEngine instantiated only to back the `metta` tool via `mettaExecutor`.
- `MettaCommandParser`: `metta` command removed from `LLM_COMMANDS` (all other chat commands kept).
- Core enums narrowed to `'nar'`: `CognitiveEvent.EngineOrigin`, `util/src/types/cognitive.ts`, `capabilities.ts`, `ChatService`, `Agent`/`phases` event emission, `PolicyEngine` allowlist, `kernel` `EngineOriginSchema` + `DerivationRecordSchema.engine` (`'nar'` literal). `isMettaEvent` removed.
- Config: `backends.metta` removed from `src/config/schema.ts`, `senars.config.json`, lifecycle, doctor, schema test.
- Tests: metta-smoke / multi-agent no longer register the engine; nar-events-bridge origin test uses default; 33 unit files pass.

### Phase 1 — Local Inference & Constrained Decoding ✅
- `nar/src/lm/providers/llamacpp.ts` (new): native fetch wrapper — GBNF `grammar` passthrough, `chat_template_kwargs {thinking:false}` injection, placeholder model id auto-resolved from `/v1/models`, `/health` probe.
- `providers.ts`: `'llamacpp'` provider (slots quality/fast/structured/compact), CHAINS, MODEL_CAPABILITIES, circuit-breaker defaults, auto-detect ladder (transformers → cloud → Ollama → llamacpp).
- `env-config.ts`: `'llamacpp'` provider, `llamacppHost` / `LM_LLAMACPP_HOST`, default model `local-model` (server alias resolved at request time).
- Grammars: `nar/src/lm/grammars/{narsese-term,single-word}.gbnf` + cached `loadGrammar()`.
- Escalation: `LMService.tryGenerateText` (attempt → retry at temp+0.2 → `null`); `generateText` accepts `grammar` via `runWithGrammar` (AsyncLocalStorage scope).

### Phase 2 — Universal Cognitive Micro-Tasks ✅
- `TraceAbstractor` (`nar/src/lm/context/trace-abstractor.ts`): `extractCriticalPath(DerivationRecord)` + `extractStructuralSkeleton` (positional `?A/?B` variable abstraction; term-cache `_serialized` invalidated).
- Slot-fill explanation prompt (`{{premise1}}/{{premise2}}` filled from `relatedBeliefs`) with graceful null fallback.
- Analogical leap: mask-fill prompt + `single-word` grammar + `similarityFallback` (NAL `<->`).
- Bidirectional correction: `attemptLMCorrection()` in `nar/src/cognitive/analyzers/corrections.ts`; wired as `ObserverService.attemptLMCorrections(nar)` (reparse + re-admit at low confidence; null → symbolic side kept).

### Phase 3 — Universal LM Rules & Symbolic Fallbacks ✅
- `LMRuleDefinition` extended: `grammar`, `maxOutputTokens`, `fallback` (`Term`-typed, cast at config boundary).
- `LMRule` execution: `tryGenerateText` with grammar/maxOutputTokens; null/throw → `applyFallback` (emits `lm.fallback` event).
- `rule-templates/fallbacks.ts`: symbolic fallbacks for all 9 planned rules — translation template parser, analogy similarity, hypothesis abduction question, conjunction goal decomposition, curiosity question; explanation/revision/meta/schema degrade to null (skip) — no unsafe symbolic equivalent.
- Shadow validation (`nar/src/lm/shadow-validation.ts`): LLM-originated tasks (`source` contains `llm`) checked against current beliefs in `admitTasks`; contradictory candidates silently dropped.

### Phase 4 — Multi-Agent Cooperation ✅
- `nar/src/cooperation/delegation.ts`: `CognitiveTaskDelegation` / `CognitiveTaskResult`, `createDelegation`, transport-agnostic `handleDelegationMessage` (drop-in for `io` WS connections).
- `PEER_AGENT` added to `kernel` `SourceQualitySchema`, `grounding.ts` enum (0.6), and `KernelPerceptionGate.sourceQualityToConfidence` (0.6 neutral prior; peer truth value governs).

### Phase 5 — Fundamentals Benchmark ✅
- Scenarios 4–7 added to `scripts/fundamentals-bench.ts` (slot-fill prompt + graceful degradation; correction reparse; skeleton + grammar + shadow; killed-LLM → NAL fallbacks with live NAR cycles). All 7 pass with `LM_PROVIDER=mock`.
- New package subpaths: `./lm/rule-builders`, `./lm/rule-templates`, `./lm/rule-templates/fallbacks`, `./lm/context/trace-abstractor`, `./lm/shadow-validation`, `./lm/grammars`, `./cooperation`, `./cognitive/corrections`.

### Phase 6 — README ✅
Architecture diagram (MeTTa removed from proposers), universal prompts/fallbacks statement, GBNF + llamacpp section, multi-agent cooperation section, Quick Reference updated (`MettaEngine` removed as engine; TraceAbstractor/ShadowValidator/attemptLMCorrection/CognitiveTaskDelegation added).

## Open Items / Next Steps
1. **Real-LM bench scenarios 1–3: verified working up to admission, but wall-clock heavy.** With the live llama.cpp Gemma-4B: scenario 1 formalizes 3 candidates and admits 2 through the PerceptionGate (all five root-cause bugs below fixed). The NAR cycle loop then makes multiple ~10–20 s real LM calls per cycle — a full 3-scenario run takes many minutes. Wrap-up decision: mock path (`bench:fundamentals:mock`, 7/7 pass) is the fast regression gate; real-model runs should use `MAX_CYCLES=5 LM_PROVIDER=llamacpp` and one scenario at a time.
2. Real-model quality pass for scenarios 4–6 semantics (mask-fill word choice, explanation phrasing) once wall-clock is tamed.
3. Consider enforcing `maxOutputTokens` for the `generateObject` native path (the JSON-mode fallback already caps via generateText).
4. Grammar-based symbolic fallback for the 5 extra rules (currently null-skip) if needed later.
5. Multi-agent E2E test over a real `io` WS connection (delegation handler exercised via bench units only).

### Root-cause fixes landed for real-LM operation (2026-09-15 wrap-up)
1. **No silent CPU fallback**: explicit `llamacpp` provider chains no longer demote to `builtin:*` transformers models — the configured provider is authoritative.
2. **Provider identity**: AI SDK reports `llamacpp.chat`; normalized at `getModelChain` + `LMService.provider` (previously broke chain lookup silently).
3. **Structured output**: `LMService.generateObject` falls back from the native adapter (zod-adapter crash) to a real-LM JSON-mode round trip (schema in prompt → JSON extraction → zod validation, temp+0.2 retry).
4. **Thinking-token sink**: reasoner models (Gemma/Qwen) spend all `max_tokens` in `reasoning_content`; llamacpp wrapper injects `chat_template_kwargs {enable_thinking:false}` by default (`LM_DISABLE_THINKING=false` re-enables).
5. **Narsese normalization** (`nar/src/nl/normalize.ts`): LLM output like `(Alice --> senior developer)`, `(Backup Generator Kicks In) --> (Server Crashes)`, `--(...)`, bare `A && B` is canonicalized (snake_case atoms, outer-paren wrapping) and used by `SymbolicFirewall.check` + `KernelPerceptionGate.admitFormalization`. All probed real-model outputs now parse.

**Wrap-up state:** Phases 0–6 complete; mock bench 7/7; unit/integration suites green; real llama.cpp end-to-end path proven (provider → GBNF grammar → structured output → Narsese normalization → gate admission).

**Runtime guidance for real-model runs:**
- Serve a small model non-router (warm, no cold loads): `llama-server -m <Qwen3.5-4B-Q4_K_M>.gguf --alias qwen4b -ngl 99 -c 8192 -fa on --threads 4`.
- Small context (`-c 8192`) — the 128k KV cache was dominating load/prefill cost; `--threads 1` starved prefill.
- llamacpp requests now default to `max_tokens 768` when uncapped (bounded generation).
- Run `LM_PROVIDER=llamacpp MAX_CYCLES=5 pnpm bench:fundamentals` — expect ~1–3 s per call warm.

---

*One kernel. Universal prompts. Symbolic fallbacks. The NAL reasons. The LLM fills. MeTTa computes when asked. The Truth Algebra verifies.* 🧠⚡
