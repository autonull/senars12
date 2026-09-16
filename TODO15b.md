# TODO15b.md — Embedded LM Runtime & the Open-Ended Development Flywheel

**Predecessor:** TODO15 (vision spec — continuous cognitive/development substrate).
**Predecessor:** TODO14 (LM efficiency + omnidirectional validation; partially landed).
**Philosophy:** Swap the HTTP transport for native bindings — low latency, zero serialization, complete llama.cpp control (`node-llama-cpp`). Keep the AI-SDK abstraction on top of it. Queue, never block. Sandbox, never mutate. Evidence, never vibes. The LLM is a bounded computational substrate inside the cognitive economy — never the developer, never the authority.

---

## Progress Summary (as of 2026-09-16)

**Phase 0 — Baseline & TODO14 Leftovers: COMPLETE ✅**

All Phase 0 objectives achieved and verified:
- Semantic cache added to `LMService` (prompt-hash-keyed, 60s TTL, failure-uncached) — `nar/src/lm/lm-service.ts`
- All 14 LM rules now have explicit `maxOutputTokens` with prompts ≤80 instruction tokens — `nar/src/lm/rule-templates/*.ts`
- Context budget module created: `context-budget.ts`, `prompt-assertions.ts`, `index.ts` barrel — `nar/src/lm/context/`
- Model fetch script created: `scripts/fetch-model.ts` uses `node-llama-cpp` `resolveModelFile` for GGUF resolution, `.models/` gitignored
- `.env.example` updated with all 8 providers; `doctor.ts` gains embedded llama.cpp GPU detection probe
- All acceptance criteria verified: `bench:fundamentals:mock` ✅, `typecheck` ✅, `lint` ✅, `test:unit` ✅ (1422 tests passed)

**Next: Phase 1 — Embedded llama.cpp LanguageModel Provider** (transport swap to native bindings)

## Progress (2026-09-16, Phase 1 — provider rewrite on LlamaChatSession, UNCOMMITTED)

**Models downloaded & working end-to-end via embedded runtime.** User-directed model set (replaces Qwen2.5-1.5B default):
- `.models/Qwen3.5-0.8B-Q4_0.gguf` (0.5 GB) ← `hf:ggml-org/Qwen3.5-0.8B-GGUF/Qwen3.5-0.8B-Q4_0.gguf`
- `.models/gemma-4-E2B_q4_0-it.gguf` (3.2 GB) ← `hf:google/gemma-4-E2B-it-qat-q4_0-gguf/gemma-4-E2B_q4_0-it.gguf`
- `scripts/fetch-model.ts` FIXED (was broken: `resolveModelFile` needs `hf:<user>/<repo>/<file>` URIs + `onProgress` callback, not repo names). Usage: `pnpm exec tsx scripts/fetch-model.ts --all [--model=qwen|gemma|<uri>] [--validate]`

**`bench:fundamentals` with real models: 4/7 PASS** (Gemma: 2,4,5,6,7 pass at best run; Qwen: 4,5,6,7). Failures 1–3 are model-capability-bound Narsese formalization, no longer provider crashes.

**Provider REWRITTEN on `LlamaChatSession`** (`nar/src/lm/providers/embedded-llamacpp.ts`, typechecks clean, uncommitted). The hand-rolled `sequence.evaluate` loop was the root of all garbage output (per-token detokenize corrupted multi-byte/special tokens → Armenian/CJK glyphs). Session-based version handles: wrapper resolution from GGUF metadata, thinking segments (`visibleText` filters `segmentType: thought/comment`), stop triggers, usage via `sequence.tokenMeter`. Key additions:
- `runtime.getChatWrapper()` — wrapper resolved once at `loadModel` (`resolveChatWrapper(model)`); Qwen3.5→Qwen wrapper, Gemma4→Gemma-4 wrapper.
- `budgets: { thoughtTokens: quality?512:128 }` — REQUIRED for Qwen3.5 (heavy thinking model): without the cap it spends the whole token budget inside `无双`-style thinking and the visible answer is empty. With it: `"Hello!"` clean answer. **Test gotcha:** `maxOutputTokens` must exceed the thought budget or output is 100% thinking.
- `buildGrammar`: GBNF via `grammarScope`, JSON schema via `llama.createGrammarForJsonSchema` (first-class per docs).

**OPEN BUG (next session, first thing): grammar path returns empty text.** Debug facts (`LM_LLAMACPP_DEBUG=1` hook is in the provider): with grammar active, the session classifies the ENTIRE constrained output as `segment:thought(239-294)` and BOTH `visibleText()` and `result.responseText` come back empty → AI-SDK gets `"."` → `AI_JSONParseError`. Thinking-model wrappers (Qwen) auto-open a thinking block; grammar-constrained JSON never closes it, so everything is tagged thought — and `responseText` also excludes thought content, so switching to `responseText` does NOT fix it. Fixes to try, in order:
1. Disable the wrapper's thinking auto-open for grammar calls — check `QwenChatWrapper` constructor options / `TemplateChatWrapperOptions` for a thinking toggle, or pass a `responsePrefix` that closes thinking (`'` or `'\n\n'` — verified earlier: Qwen renders `assistant\n\n\n`, Gemma renders `<|turn>model\n\n\n`, both absorbed cleanly).
2. Or pass `chatWrapper` that doesn't segment thoughts (e.g. `GeneralChatWrapper`) when `grammar` is set — constrained output needs no thought handling.
3. Or take raw text via `promptWithMeta`'s `onResponseChunk` accumulation (chunks classified thought can still be re-concatenated manually when grammar is active — they ARE the JSON).

Also done this session: repeat penalty `{lastTokens:64, penalty: structured?1.2:1.1}` (kills degenerate loops that truncated JSON); structured temp 0.1→0.3 (0.1 collapses small models to empty arrays); few-shot `SEED_EXAMPLES` in `buildUnderstandingPrompt` (teaches formalization, unless→2-beliefs, want→goal; canonical Narsese, punctuation OUTSIDE the term — user correction); empty-batch retry in `understandInner` (returns lastBatch, no longer null); bench scenario-3 debug bug fixed (`{} as any` passed as zod schema → `reading 'def'` crash).

**Smoke scripts (regenerate or keep in `.cache/`):** `lm-ab.ts` (text), `lm-real3.ts` (object), `lm-s1.ts` (schema × temp), `prov-debug.ts` (provider path), `sess-debug.ts`, `render-qwen.ts` (wrapper render), `template-dump.ts`/`meta-dump2.ts` (GGUF metadata: NEITHER GGUF embeds a chat template — wrapper is a built-in guess), `grammar-debug.ts`.

**Phase 1 remaining:** fix the grammar/thought bug above → re-run `LM_PROVIDER=llamacpp-embedded LM_LLAMACPP_MODEL=.models/<model> pnpm bench:fundamentals` (target ≥5/7 honestly reported, model-capability failures documented) → breaker/demotion check on bad model path → `test:unit` green → commit.

## Progress (2026-09-16, Phase 1 session 2 — grammar/empty-batch fixes LANDED, uncommitted)

**The OPEN BUG from session 1 is CLOSED.** Grammar-constrained generation now returns clean, schema-valid JSON on both models, verified end-to-end:

- Fix 1 (wrapper): when a grammar is active the session uses `GeneralChatWrapper` (non-segmenting) instead of the model's thinking wrapper, and thought budgets are dropped — constrained output can no longer be swallowed by auto-opened thinking segments.
- Fix 2 (fallback): raw chunk accumulation (`rawChunks`) backs up `responseText`/`visibleText` when classification is still wrong.
- Fix 3 (empty-collapse): the 0.8B/2B models returned trivially-valid empty arrays; `buildGrammar` now patches the JSON schema so every top-level array gets `minItems: 1` (oneOf-union was tried first — it makes GBNF pathological: 2900-char runaways at maxTokens; the flat minItems patch is what landed).
- Fix 4 (retry diversity): `LMService.generateObject` accepts `temperature`; `understandInner` escalates undefined → 0.7 → 1.0 across attempts.
- Fix 5 (sequence leak): `session.dispose` moved to `finally` (error paths no longer leak the single sequence); runtime default `sequences` 1 → 4.
- Fix 6 (bench isolation): `resetCircuitBreakers()` exported from providers.ts and called before each bench scenario — scenario 2's fallback failures no longer open the breaker and instantly-null scenario 3.
- Fix 7 (mock gate): mock `generateObjectFn` now matches only the final translated input (few-shot SEED_EXAMPLES embed scenario sentences verbatim in every prompt and were hijacking keyword matching).

**Real-model bench: 5/7** (Qwen3.5-0.8B and gemma-4-E2B both): 2,4,5,6,7 PASS. Scenario 2 (multi-input formalization pipeline) newly passes on real models. Failures 1 & 3 are model-capability-bound: no ambiguity split into multiple candidates (1), and bare-term goals like `offline!` that termParser rejects (3). Prompt hardening added (`truth values in [0,1]`, `never return all arrays empty`, `fully parenthesized Narsese`) — helps but doesn't fully fix a <3B model.

**End-to-end integration verified live** (`.cache/e2e-demo.ts`): English → NLUnderstandingService (embedded LM) → Narsese candidates → KernelPerceptionGate → `nar.inputTask` → NAR cycles → derived beliefs; question formalization through the same LM. Two NL facts admitted; derivation depends on model formalization quality of the middle "similarity" sentence (junk on small models).

**Known perf note (RESOLVED — GPU confirmed):** Vulkan backend active (no CUDA build available), `gpuLayers: 'max'` offloads fully — measured **188.9 tok/s** on Qwen3.5-0.8B with 1.86 GB VRAM resident (`.cache/gpu-proof.ts`). Wall-clock slowness in the bench is retry amplification in the understanding loop (up to 3 attempts + 2 fallbacks per junk output), not transport or GPU. Phase 3/4 budgets + broker deadlines bound this; a ≥4B model cuts failed-attempt rates sharply.

**Phase 1 remaining:** breaker/demotion check on bad model path (last unverified acceptance item); `LM_LLAMACPP_MODEL` unset → typed error (already handled in `ensureRuntimeLoaded`). `test:unit` green (1419 passed), `typecheck` clean, `lint` clean.

**Smoke scripts (regenerate or keep in `.cache/`):** `lm-ab.ts` (text), `lm-real3.ts` (object), `lm-s1.ts` (schema × temp), `prov-debug.ts` (provider path), `sess-debug.ts`, `render-qwen.ts` (wrapper render), `template-dump.ts`/`meta-dump2.ts` (GGUF metadata: NEITHER GGUF embeds a chat template — wrapper is a built-in guess), `grammar-debug.ts`, `proof.ts` (text+JSON sanity demo), `und-debug.ts` (understanding path), `e2e-demo.ts` (full NL→NAR integration).

**New improvement opportunities surfaced:**
- `withNonEmptyArrays` is a generic patch on all JSON-schema grammars for this provider. Correct for extraction-style schemas (the only kind in the codebase); if a future caller legitimately needs empty arrays through the embedded provider, gate it per-call (e.g. grammar-scope hint) rather than globally.
- Retry loop cost: understandInner makes up to 5 generation calls per input on junk output. Phase 4 broker deadlines will bound this, but an early cheaper win: cap total attempts when latency budget is exceeded (Phase 0.3 context-budget module could host it).
- GBNF cannot express numeric ranges (documented): `f: -1.0, c: -2.5` can still appear; zod validation + retry catches it. A post-parse clamp/renormalize in `sanitize` (firewall already clamps confidence for inferred beliefs) could extend to user-source beliefs.
- Bare-term goals (`offline!`) pass the firewall but fail termParser at admission. Either teach the prompt harder, or add a normalize step (wrap bare terms in parens) before admission — decide in Phase 5/6 when the firewall/admission boundary is revisited.

**New improvement opportunities surfaced:**
- `buildLlamaPrompt` uses a hard-coded ChatML template (`<|im_start|>`). Prefer the model's own chat wrapper via `LlamaChatSession` (Phase 2's `createSession`) so templates match the GGUF's trained format — the V3 shim stays text-only, but session-based templating would raise fidelity.
- `LlamaJsonSchemaGrammar` needs a `GbnfJsonSchema` shape; the AI-SDK `responseFormat.schema` may need normalization (`zod` → `zod-to-json-schema` already in deps) — validate on the first real structured call.
- The runtime `loadModel` currently disposes prior state before load (good for swaps) but `dispose()` awaits possibly-already-disposed handles — Phase 2 should make disposal idempotent/guarded.
- `probeEmbeddedLlama` reports GPU backends but does not load the model; a full load-check option (`--validate` via `fetch-model.ts`) exists but is not wired to the auto-detect ladder — leave as-is to keep auto-detect fast.

## Context — What TODO15 Asked vs. What the Codebase Already Has

TODO15's vision is sound; several of its premises are already satisfied or need re-targeting. This plan binds every objective to a verified codebase anchor.

| TODO15 Objective | Codebase Anchor (verified) | Resolution |
|---|---|---|
| Replace `llama-server` HTTP transport | `node-llama-cpp@^3.21.1` in `package.json` deps — **installed, unused**. HTTP provider: `nar/src/lm/providers/llamacpp.ts` (`createLlamaCppFetch`, GBNF via `grammarScope` AsyncLocalStorage) | New embedded provider; HTTP provider stays as fallback |
| `NodeLlamaCppLMService implements LMService` | `LMService` (`nar/src/lm/lm-service.ts`) is AI-SDK-based: `generateText`/`generateObject` over `LanguageModel`s from `createSeNARSRegistry` (`nar/src/lm/providers.ts`) | **Do not** implement `LMService`. Implement an AI-SDK `LanguageModel` backed by node-llama-cpp and register it as a new provider — routing, chains, circuit breakers, stats all keep working unchanged |
| `LlamaRuntimeManager` | Nothing exists | New `nar/src/lm/runtime/` module (Phase 2) |
| Rich `LMTask` task protocol | `LMTask = 'quality' \| 'fast' \| 'structured'` (`util/src/types/llm.ts`) — a routing-tier key, already load-bearing | Name the rich protocol **`LMJob`** (no collision), new `nar/src/lm/broker.ts` |
| LM broker / async queue | `StreamReasoner.LMBackend = (requests: LMRequest[]) => Promise<Map<string, Truth>>` + `flush(backend, pressure)` (`nar/src/stream/reasoner.ts`); dedup pattern exists (`SingleFlight` in NL services) | Broker implements `LMBackend`; queue, dedup, cancellation, pressure-aware dropping |
| VRAM as AIKR resource | `KernelBudgetGate` (`nar/src/kernel/KernelBudgetGate.ts`), `TerminationReason` enums | Add VRAM/token budgets; new telemetry |
| Autonomy levels (L0/L1/L2) | ActionGate autonomy ladder already exists: `observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production` (`nar/src/kernel/KernelActionGate.ts`) | Map L0→observe-only, L1→sandbox-execute, L2→low-risk-auto-merge scoped to `patch-apply` |
| Sandbox worktrees | `ShadowWorktreeManager` (`nar/src/tools/adapters/external-tools.ts`) — git worktree + shadow CI | Extract and extend into `nar/src/dev/sandbox.ts` (DRY: one worktree manager) |
| Patch governance | `PatchRiskClassifier` / `SandboxValidator` / `ProposalRouter` (`auto-apply \| sandbox-validate \| human-approval`) / `GovernancePolicyEngine` (`nar/src/governance/pipeline.ts`) | Extend `SandboxValidator` with a patch-validation route; add `patch-apply` proposal kind + actuators |
| Gap detection / self-model | `nar.getSelfAnalyzer()` — `analyzeReasoningGaps`, `assessQuality`, `querySystemState` (`nar/src/self/ReasoningAboutReasoning.ts`); 8 analyzers | Primary observation source for the flywheel |
| Schema induction | `createSchemaInductor` (`nar/src/learning/schema-induction.ts`) | Lessons → schemas, unchanged pipeline |
| Dev-as-Game | `Game` interface `observe()/step()/legalActions()` (`nar/src/game/Game.ts`); `GameFocus` host | `DevelopmentGame implements Game` |
| Reward domain split | `RewardGate` epistemic firewall; `LearnerRegistry` domain split (`self-*` → proposals only, `nar/src/learning/domain-learners.ts`) | New domain `self-development` → proposals |
| Event sourcing | `EventLogPersistence` (`persistGateLogs`, `loadGateEvents`, `replayCognitiveState`), `CognitiveEvent` (`util/src/types/cognitive.ts`), mapping in `nar/src/events/bridge.ts`; derivation records (`nar/src/kernel/replay.ts`) | Add flywheel event types; persistence is already generic |
| Constrained generation | GBNF grammar scope (`runWithGrammar` → llamacpp fetch injection); GBNF assets `nar/src/lm/grammars/` (`narsese-term.gbnf`, `single-word.gbnf`) | Embedded model reads the same scope; JSON-schema path via `LlamaJsonSchemaGrammar` |
| Evaluator independence | Standalone verifier `scripts/verify-derivation.ts` (zero engine deps) | Same principle: evaluator policy lives outside agent mutation scope |

**TODO14 leftovers folded in as Phase 0** (verified absent): semantic cache in `LMService`, per-rule `maxOutputTokens` audit, `context/context-budget.ts` (only `trace-abstractor.ts` exists in `nar/src/lm/context/`).

**Non-goals (invariants kept):**
- No separate coding agent — development is a `Game` on the Focus/FocusBag substrate.
- No HTTP hop for the default local path; no per-request process startup.
- No replay/VCR harness (TODO14 principle); no evaluator-in-scope mutation.
- No reward may mutate `Truth` — ever (`RewardGate` throws; keep it).
- `bench:fundamentals:mock` must stay green at every phase boundary.

---

## Phase 0 — Baseline & TODO14 Leftovers

Complete the prerequisite efficiency work so the flywheel starts from a fast, deterministic substrate.

### 0.1 Semantic cache (TODO14 §1.3)

**File:** `nar/src/lm/lm-service.ts`

Prompt-hash-keyed in-memory cache with 60s TTL in `LMService.generateText` (and `generateObject` path). Cache **before** the circuit-breaker/transport layer; clear the slot on failure so retry paths re-populate.

### 0.2 Per-rule token budgets & prompt minimisation (TODO14 §1.1–1.2)

**Files:** `nar/src/lm/rule-templates/*.ts`

Audit all 14 rules: every rule carries an explicit `maxOutputTokens` per the TODO14 table; no prompt instruction exceeds ~80 tokens.

### 0.3 Context budget module (TODO14 §4.5)

**Files:** `nar/src/lm/context/` — add `context-budget.ts` (token estimation + truncation for small contexts), `prompt-assertions.ts` helpers, `index.ts` barrel. This becomes the broker's context-budgeting dependency in Phase 4.

### 0.4 Model artifacts

**Files:** new `scripts/fetch-model.ts`, `.gitignore`

Use `resolveModelFile` from `node-llama-cpp` to fetch the common-denominator compact GGUF (TODO14 §1.5 result) into `.models/` (gitignored). Cache under `.cache/` like other runtime artifacts.

```bash
pnpm exec tsx scripts/fetch-model.ts   # idempotent: resolves .models/<model>.gguf, downloads if missing
```

### 0.5 Doctor & env surface

**Files:** `src/bin/doctor.ts`, `.env.example`

`.env.example` still documents only `transformers | ollama | anthropic | mock` (line 7) while `LMProviderName` supports 8 providers. Update it; doctor gains a runtime-capability probe (embedded GPU detection) in Phase 1.

### Acceptance Criteria
- [x] Semantic cache: ≥50% hit rate on repeated bench run; failures not cached.
- [x] All 14 rules have explicit `maxOutputTokens`; prompts ≤80 instruction tokens.
- [x] `nar/src/lm/context/` exports `TraceAbstractor`, budget utilities.
- [x] `scripts/fetch-model.ts` resolves the target GGUF into `.models/` (skip when absent elsewhere in CI).
- [x] `bench:fundamentals:mock` green; `pnpm run typecheck && pnpm run lint` green.

---

## Phase 1 — Embedded llama.cpp LanguageModel Provider

The transport swap, preserving the entire abstraction: `LMService` → `getModelForTask` → `createProviderRegistry` stay untouched; we add one `LanguageModel` implementation and one provider key.

### 1.1 Embedded runtime seed

**File:** `nar/src/lm/runtime/llama-runtime.ts` (new; generalized in Phase 2)

Minimal resident runtime used by the provider:

```ts
import { getLlama, Llama, LlamaModel, LlamaContext, LlamaJsonSchemaGrammar, LlamaGrammar } from 'node-llama-cpp';

let llamaP: Promise<Llama> | undefined;
const getLlamaSingleton = (): Promise<Llama> => (llamaP ??= getLlama());

export interface EmbeddedLlamaConfig {
  modelPath: string;          // resolved from LM_LLAMACPP_MODEL
  gpu?: 'auto' | 'cuda' | 'metal' | 'vulkan' | false;  // backend select (default: auto-detect)
  gpuLayers?: number | 'max'; // default: auto-fit (Phase 2 uses GgufInsights)
  contextSize?: number;       // LM_LLAMACPP_CTX
  batchSize?: number;
  sequences?: number;
  flashAttention?: boolean;   // LM_LLAMACPP_FLASH_ATTN
}
// loadModel → createContext → keep resident; dispose() for graceful shutdown.
```

Model/context stay resident for the process lifetime. **No** request-per-generation startup, **no** HTTP hop, **no** JSON serialization to a localhost server.

### 1.2 The provider (AI SDK `LanguageModelV3` — thin native shim)

**File:** `nar/src/lm/providers/embedded-llamacpp.ts` (new)

Pattern-match the existing mock: `createMockLanguageModel` (`lm-service.ts:606`) implements the same V3 interface. Implement `doGenerate` / `doStream` as a **thin, zero-copy shim** over node-llama-cpp — no HTTP serialization, no process boundary:

- **Text path** (`generateText`): prompt → `LlamaCompletion`-style evaluation on a context sequence; `temperature`/`topK`/`topP`/`maxTokens` from V3 call options; `stopOnAbortSignal` bound to `options.abortSignal`; final chunk carries usage.
- **Grammar path:** GBNF strings arrive via the existing `grammarScope` (`runWithGrammar` in `providers/llamacpp.ts:13`). Export an accessor `getActiveGrammar()` from that module and read it inside `doGenerate`/`doStream` → wrap in `new LlamaGrammar(llama, { grammar })`. **Native GBNF**, not server-side.
- **JSON-schema path:** `generateObject` delivers the schema as `callOptions.responseFormat` (`type: 'json'`) — exactly what `createMockLanguageModel` already reads (`lm-service.ts:615`). Map it → `new LlamaJsonSchemaGrammar(llama, schema)`. Zod schemas therefore constrain embedded output with zero prompt hacks.
- **Streaming:** `sequence.evaluate(...)` is an async iterator; emit `text-delta` chunks; `abort` → sequence abort. **Zero-copy token streaming** from llama.cpp to AI-SDK consumers.
- **Failures:** throw typed errors; `InsufficientMemoryError` and load failures surface as provider errors so the circuit breaker (`recordProviderCall`, `tripBreaker`) and chain failover treat them exactly like HTTP failures.

**Key:** the AI-SDK `LanguageModel` surface is intentionally narrow (text, stream, object). **All advanced llama.cpp controls** (speculative decoding, custom batching, token bias, repeat penalties, KV cache tuning, embedding/ranking, context shifting) are **not forced through the V3 interface** — they live on the `LlamaRuntimeManager` (Phase 2) and are available to the broker, self-improvement tools, and future capability without redesign.

### 1.3 Registration & routing

**Files:** `nar/src/lm/providers.ts`, `nar/src/lm/env-config.ts` (LMSettings)

- Add `'llamacpp-embedded'` to `LMProviderName` (providers.ts:31) and the `PROVIDERS` validation list.
- `LMSettings`: `llamacppModelPath`, `llamacppGpuLayers`, `llamacppContextSize`, `llamacppBatchSize`, `llamacppSequences`, `llamacppFlashAttention`; env vars `LM_LLAMACPP_MODEL`, `LM_LLAMACPP_GPU_LAYERS`, `LM_LLAMACPP_CTX`, `LM_LLAMACPP_BATCH`, `LM_LLAMACPP_SEQS`, `LM_LLAMACPP_FLASH_ATTN`.
- `createSeNARSRegistry` (providers.ts:104): `useEmbeddedLlamaCpp = provider === 'llamacpp-embedded'` branch registering `quality/fast/structured/compact` language models from the runtime (one resident model, per-task generation params; contexts shared per Phase 2 pool).
- `CHAINS` (providers.ts:354): `llamacpp-embedded: { quality: ['llamacpp-embedded:quality'], fast: [...], structured: [...] }` — authoritative, no silent CPU fallback rungs (same policy as HTTP `llamacpp`), opt-in extra rungs via routing config.
- Probe: `probeEmbeddedLlama()` (model path exists + optional load check) appended to the `resolveActiveProvider` ladder (providers.ts:465) and to `doctor`.

Auto-detect ladder becomes: cloud key → Ollama → embedded GGUF (if `LM_LLAMACPP_MODEL` set / `.models/` populated) → HTTP llama.cpp → transformers.

### 1.4 Bench scenario

**Files:** `scripts/fundamentals-bench.ts`, `package.json`

```bash
pnpm exec tsx scripts/fetch-model.ts && LM_PROVIDER=llamacpp-embedded pnpm bench:fundamentals
```

All 7 scenarios run against the resident model with the full TODO14 Phase-2 assertion matrix. Record wall-clock; embed-provider results become the regression baseline for Phase 3+ tuning.

### Acceptance Criteria
- [ ] `LM_PROVIDER=llamacpp-embedded pnpm bench:fundamentals` passes all 7 scenarios with the common-denominator GGUF.
- [ ] Model loads once per process; repeated `generateText` calls show no reload (runtime log/metrics assert).
- [ ] GBNF grammar rules (`narsese-term`, `single-word`) constrain output via `LlamaGrammar`; JSON-schema rules via `LlamaJsonSchemaGrammar`.
- [ ] Killing the model file / bad path → `LMUnavailableError`-family failure, breaker trips, chain failover (or honest unavailability) — no crash.
- [ ] HTTP `llamacpp` provider and auto-detect order unchanged; `pnpm doctor` reports embedded probe.
- [ ] `bench:fundamentals:mock` and `test:unit` stay green (provider isolation).

---

## Phase 2 — LlamaRuntimeManager

Generalize the Phase-1 runtime into the resident manager TODO15 §4 specifies.

**Files:** `nar/src/lm/runtime/` (new module): `llama-runtime.ts`, `types.ts`, `stats.ts`, `index.ts`

### 2.1 Lifecycle

```ts
export interface LlamaRuntimeManager {
  load(spec: ModelSpec): Promise<void>;            // swap model: drain → dispose → load
  reload(spec: ModelSpec): Promise<void>;          // alias, transactional
  createSession(opts?: SessionOptions): Promise<LlamaChatSession>;
  complete(prompt: string, opts: CompletionOptions): Promise<string>;
  stream(prompt: string, opts: CompletionOptions): AsyncIterable<string>;
  getSequence(pool?: SequencePoolRef): LlamaContextSequence;      // direct native access
  createEmbeddingContext(): Promise<LlamaEmbeddingContext>;       // memory retrieval
  createRankingContext(): Promise<LlamaRankingContext>;           // reranking
  reconfigure(patch: RuntimeConfigPatch): Promise<void>;
  stats(): LlamaRuntimeStats;
  dispose(): Promise<void>;                        // SIGINT/SIGTERM hook + process exit
}
export const getLlamaRuntime = (): LlamaRuntimeManager; // singleton
```

**`CompletionOptions` extends the native `SequenceEvaluateOptions`** — the manager never truncates the native option surface; it only adds deadline/priority/budget bookkeeping on top.

### 2.2 Full native control surface

The reason for `node-llama-cpp` is **complete runtime configuration and control of llama.cpp** — the plan must expose all of it, not just the AI-SDK subset. Verified API surface (installed v3.21.1), each tier reachable through the manager:

| Tier | Native controls (verified exports) |
|---|---|
| **Runtime/backend** | `getLlama({ gpu })` — `'auto' \| 'cuda' \| 'metal' \| 'vulkan' \| false` backend select; threads; log level; `getLlamaGpuTypes` |
| **Model** | `gpuLayers`, `vocabOnly`, GGUF metadata via `readGgufFileInfo`; LoRA adapters (native `loadLora`/`setLoras` bindings) attachable per model alias |
| **Context** | `contextSize`, `batchSize`, `sequences`, `flashAttention`, `kvCache`, `swaFullCache`, `threads` (`LlamaContextOptions`) |
| **Sequence/sampling** | `temperature`, `topK`, `topP`, `minP`, `repeatPenalty`, `dryRepeatPenalty`, `tokenBias`, `grammar` (GBNF + JSON-schema), `evaluationPriority`, `contextShift`, `maxTokens`, `stopOnAbortSignal` |
| **Batching** | Built-in `firstInFirstOut` / `maximumParallelism` prioritization strategies **plus custom `BatchItemsPrioritizationStrategy`** — the Phase 4 broker's priority heap plugs in here so deadline-aware scheduling reaches the native batch scheduler, not just the JS queue |
| **Speculative decoding** | `DraftSequenceTokenPredictor` (draft-model pairing) + `InputLookupTokenPredictor` — low-latency generation on larger models via fast/quality alias pairs |
| **Context shifting** | `ContextShiftOptions` supports persistent task sessions (TODO15 §10) without unbounded KV growth |
| **Embeddings/ranking** | `LlamaEmbeddingContext` / `LlamaRankingContext` host embed/rerank model aliases — native similarity for the memory subsystem's embedding-based retrieval |
| **Token accounting** | `TokenMeter` for per-request usage |

**Key:** the AI-SDK V3 interface (Phase 1.2) exposes only text/stream/object. Every advanced control is reachable through the manager directly — the broker, memory, and dev tools call the manager for native features without touching the provider shim.

### 2.3 Reconfiguration transaction (TODO15 §5)

Three tiers, one rule: **never mutate a live context underneath an active generation.**

- **Hot (per-request):** temperature, top-k/top-p, token budget, grammar, stop sequences, priority, deadline — carried per call.
- **Context-level:** `contextSize`, `batchSize`, `sequences`, flash attention, KV config → `reconfigure()` drains in-flight sequences, disposes, recreates context from the same model.
- **Model-level:** GGUF file, quantization, `gpuLayers`, LoRA → full `load()` transaction with quiesced queue; in-flight jobs fail fast with typed errors (retryable upstream).

### 2.4 VRAM telemetry & budgeting

- `llama.getVramState()` → total/used stats; `readGgufFileInfo` + `GgufInsights.getResourceRequirements` → pre-load estimation and automatic `gpuLayers` fit against a configured VRAM budget.
- `LlamaRuntimeStats`: `{ vramTotal, vramUsed, modelVram, kvCacheEstimate, activeSequences, queuedJobs, tokensPerSec, ttftP50/P95 }` — feeds Phase 3 budgets and Phase 7 metrics.
- Multi-model: `ModelSpec` registry keyed by alias (`fast` / `reasoning` / `embed`), enabling Phase 7's model switching (TODO15 §36) without new plumbing — routing already picks per-`LMTask` chains; aliases map onto `CHAINS` entries.

### 2.5 Tests

**File:** `tests/nar/llama-runtime.test.ts` — env-gated (`SENARS_EMBEDDED_TEST=1` + model present), covering: residency, reconfigure tiers, reload, stats shape, dispose cleanliness.

### Acceptance Criteria
- [ ] `stats()` reports VRAM/context/throughput; `getVramState` wired.
- [ ] Hot/context/model reconfiguration tiers each verified; no in-flight mutation.
- [ ] `reload()` swaps models without process restart; in-flight jobs fail typed.
- [ ] `gpuLayers` auto-fit uses `GgufInsights` resource requirements; explicit override honored.
- [ ] Full sampling stack (`minP`, `repeatPenalty`/`dryRepeatPenalty`, `tokenBias`, `evaluationPriority`, `contextShift`) reachable via `CompletionOptions` without bypassing the manager.
- [ ] Custom batch prioritization strategy injectable; broker deadline priority maps to native batching (a deadline-aware strategy test passes).
- [ ] Draft-model pairing (`DraftSequenceTokenPredictor`) configurable per alias; speculative decoding demonstrably reduces latency for fast tasks.
- [ ] Embedding/ranking contexts available for memory retrieval (similarity query answered natively).

---

## Phase 3 — VRAM & LM Tokens as First-Class AIKR Resources

**Files:** `nar/src/lm/runtime/types.ts`, `nar/src/kernel/KernelBudgetGate.ts`, `nar/src/lm/stats.ts`, `nar/src/otel/`

```ts
export interface LMResourceBudget {
  maxConcurrentRequests: number;
  maxTokensPerRequest: number;
  maxTokensPerCycle: number;
  maxVRAMBytes?: number;
  reservedVRAMBytes?: number;
  deadlineMs: number;
}
```

- `KernelBudgetGate` gains VRAM + LM-token accounting lines (same `scopeId` accounting as CPU/derivation/memory). Exceeded → existing `TerminationReason` vocabulary (`backpressure`, `llm-budget`, `deadline`) — no new enums unless unavoidable.
- `LlamaRuntimeStats` published through `stats.ts` and OTel metrics: queue latency, TTFT, tokens/sec, tokens/request, GPU/VRAM, context utilization, timeouts, abort rate, grammar failures (TODO15 §32 LLM class).
- `LM_HEAVY_CONFIG` / `CognitiveParameters` gain an `lm.budget` section (validated ranges in `cognitive-parameters.ts`).

### Acceptance Criteria
- [ ] BudgetGate rejects/admits on VRAM+token budgets; termination reasons recorded as events.
- [ ] Runtime stats visible via `nar` stats + OTel; tokens/sec and TTFT measurable per request.
- [ ] Exceeding `maxTokensPerCycle` yields backpressure, not unbounded queueing.

---

## Phase 4 — LM Broker (Async Task Economy)

**Files:** `nar/src/lm/broker.ts` (new), `util/src/types/llm.ts` (LMJob types), `nar/src/stream/reasoner.ts` (adapter only)

The main reasoning loop **never awaits the LLM** (TODO15 §9). The broker is the bounded queue between cognition and the model.

```ts
export type LMJobKind =
  | 'hypothesis' | 'analogy' | 'schema' | 'critique' | 'explanation' | 'causal'
  | 'planning' | 'question-generation' | 'formalization' | 'memory-enrichment'
  | 'debugging' | 'code-analysis' | 'patch-proposal' | 'test-generation'
  | 'meta-reasoning' | 'development';

export interface LMJob {
  id: string;
  kind: LMJobKind;
  priority: number;          // 0..1, AIKR-style
  deadlineMs?: number;
  budget: { maxTokens: number };
  context: string;           // assembled via lm/context module (Phase 0.3)
  grammar?: string;          // GBNF, or schema for JSON path
  outputSchema?: JSONSchema7;
  signal?: AbortSignal;
}

export class LMBroker {
  submit(job: LMJob): Promise<LMJobResult>;              // enqueue; returns future
  completed(): AsyncIterableIterator<LMJobResult>;       // drain completed
  cancel(id: string): boolean;
  stats(): { queued, running, dropped, deadlineMissed, dedupHits };
}
```

Mechanics:
- **Priority + deadline** scheduling (heap; deadline → `AbortSignal.timeout`, miss → typed drop + metric).
- **Dedup:** hash(prompt+grammar+budget) — concurrent identical jobs share one execution (extends the `SingleFlight` pattern to queue level).
- **Concurrency:** bounded by `LMResourceBudget.maxConcurrentRequests`; sequences per the runtime context pool.
- **Backpressure:** pressure-aware drop/defer of low-priority jobs — integrate with `StreamReasoner` pressure (`highWater`) exactly as the HTTP path does.
- **Native priority:** broker priority maps onto llama.cpp's native batch scheduling — per-sequence `evaluationPriority` plus a custom `BatchItemsPrioritizationStrategy` (deadline-aware; overrides the built-in FIFO / maximum-parallelism strategies) so priority reaches the GPU scheduler, not just the JS queue. Eligible fast tasks may use speculative decoding (`DraftSequenceTokenPredictor` with a draft-model alias).
- **Bridge:** `createBrokerBackend(broker): LMBackend` so `StreamReasoner.reasonHook` consumes the broker without changes to the reasoner contract.
- **Admission unchanged:** results flow through existing paths (`nar-lm.ts`, `lm/admit.ts`, shadow validation, gates). The broker schedules *model time*; the kernel decides *admission* — TODO15 §8's separation, kept structural.
- **Opt-in rollout:** `LM_BROKER=1` env flag; default path (direct `LMService` calls) untouched until parity proven, then flipped in `LM_HEAVY_CONFIG` first.

### Acceptance Criteria
- [ ] With `LM_BROKER=1`, NAL cycles continue while jobs queue; results admitted via gates when they complete (integration test: stalled stream + broker flush unblocks derivation).
- [ ] Identical concurrent jobs deduplicate; deadline misses are typed, counted, and never hang.
- [ ] High pressure drops lowest-priority jobs first; drop counters exported.
- [ ] `test:unit` green with broker off; new `tests/nar/lm-broker.test.ts` green.

---

## Phase 5 — Development Sandbox, DevelopmentGame, Experiment Runner

Software development becomes an environment for the existing cognitive substrate (TODO15 §27–28) — not a parallel agent.

### 5.1 Sandbox (consolidate, don't duplicate)

**Files:** new `nar/src/dev/sandbox.ts`; refactor `ShadowWorktreeManager` out of `nar/src/tools/adapters/external-tools.ts:1928` into it (self-tools keep working via import — single source of truth).

Sandbox = worktree + allow-listed command surface: `run-test`, `run-typecheck`, `run-lint`, `run-scenario` (the existing `run_tests_shadow` / `run_scenario_shadow` operations), `inspect-file`, `search-code`, `analyze-trace`. Canonical tree is never writable by the agent.

### 5.2 Experiment model

**File:** `nar/src/dev/experiment.ts`

```ts
export interface Experiment {
  id: string;
  hypothesisId: string;
  baseline: Revision;           // git sha / snapshot ref
  candidate: Revision;
  fixtures: Fixture[];          // seeded scenarios (reuse fundamentals-bench fixtures)
  metrics: MetricDefinition[];  // see Phase 7 metric classes
  budget: ExperimentBudget;     // wall-clock + test-count bounds via BudgetGate
  stoppingCriteria: StoppingCriteria;
}
```

**File:** `nar/src/dev/runner.ts` — execute: create worktree → apply candidate patch → run staged gates (`compile → unit → integration → property` mapped onto `pnpm test:unit`, `typecheck`, `lint`, targeted scenarios) → collect metrics → verdict `FAILED | PASSED` → teardown or retain patch artifact. Every stage is an event (Phase 6).

### 5.3 DevelopmentGame

**File:** `nar/src/dev/development-game.ts`

`implements Game` (`nar/src/game/Game.ts`): `observe()` → repo+runtime+experiment state; `legalActions(state)` → sandbox allow-list filtered by autonomy level; `step(action)` → executes and returns `DevelopmentObservation`. Hostable by `GameFocus`/`FocusBag` like `GridWorldGame` — development becomes another `Game` with its own Focus weight, competing fairly in the attention economy.

### 5.4 Reward domain

**Files:** `nar/src/learning/domain-learners.ts`, `nar/src/gates/RewardGate.ts` consumers

Register domain `self-development` in the learner registry; its learners only emit `SelfImprovementProposal`s (never direct mutation, never `Truth`).

### Acceptance Criteria
- [ ] Sandbox test: worktree created → patch applied → tests run → canonical tree untouched → cleanup verified.
- [ ] `DevelopmentGame` passes a `legalActions`/`step` contract test alongside `GridWorldGame`.
- [ ] Experiment runner executes baseline vs candidate and emits stage events; budget overrun aborts typed.
- [ ] `self-development` reward events route to proposals (RewardGate invariant holds).

---

## Phase 6 — Development Memory, Event Sourcing, Evaluator, Promotion

### 6.1 Development episodes

**File:** `nar/src/dev/episode.ts` — `DevelopmentEpisode` (observation, hypothesis, intervention, result, metrics, lessons, artifact refs) persisted via `EpisodicMemory.record()` (`nar/src/memory/`) — long-term development memory, recallable by the evidence-context machinery.

### 6.2 Flywheel event sourcing

**Files:** `util/src/types/cognitive.ts` (event union), `nar/src/events/bridge.ts` (NAR↔CognitiveEvent mapping), `nar/src/kernel/EventLogPersistence.ts` (persist is already generic)

New event types: `ObservationRecorded`, `GapDetected`, `HypothesisProposed`, `ExperimentCreated`, `TestGenerated`, `PatchProposed`, `ExperimentEvaluated`, `LessonLearned`, `SchemaInduced`, `CandidatePromoted`, `CandidateRejected`. Each job/experiment step appends events; `replayCognitiveState` reconstructs flywheel state for free.

**Deterministic replay (TODO15 §34):** every LM call already carries execution stats; add `{ modelId, modelHash, promptHash, sampling, grammar, latencyMs, tokens }` to job-result event payloads so experiments can separate engine / model / environment nondeterminism.

### 6.3 Evaluator with independent evidence channels

**File:** `nar/src/dev/evaluator.ts` + `nar/src/dev/evaluator-policy.ts`

Channels (TODO15 §22): correctness (test suites), generalization (held-out fixtures), novel capability, resource delta (Phase 3 metrics), trace validity (`verifyRecord` from `scripts/verify-derivation.ts`), reproducibility (re-run), test diversity. **The evaluation/promotion policy file is the epistemic boundary** — excluded from the agent's sandbox action allow-list and from `patch-apply` scope, enforced by ActionGate allow-list config.

### 6.4 Evidence-based promotion

**Files:** `nar/src/governance/pipeline.ts` (extend `SandboxValidator`, `PatchRiskClassifier`)

- New proposal kind `patch-apply` with payload `{ worktreeId, diffRef, evaluationRef }`.
- `SandboxValidator` validates: evaluation passed all mandatory channels; no regression; budget respected; reproducible (2nd run matches); scope-limited diff (path allow-list).
- Route by risk: LOW within scope → `auto-apply` (L2, autonomy `low-risk-auto-merge`); MEDIUM → `sandbox-validate`; HIGH/out-of-scope → `human-approval`. `PatchRiskClassifier` gains factors for eval-channel results.
- Promotion applies via worktree merge through `ProposalActuators` (extended with `applyPatch`).

### Acceptance Criteria
- [ ] Episode recorded for every experiment; recallable via episodic query.
- [ ] All flywheel transitions appear in the JSONL event log; replay reproduces state (extend an existing replay test).
- [ ] Evaluator verdict requires all mandatory channels; failed channel → `CandidateRejected` event.
- [ ] `patch-apply` route honored by risk class; out-of-scope diff is rejected before actuators run.
- [ ] Successful episodes feed `createSchemaInductor` → schemas become Narsese concepts (existing pipeline, new input source).

---

## Phase 7 — The Continuous Flywheel

**Files:** new `src/bin/flywheel.ts`, `nar/src/dev/flywheel.ts`, `package.json` (`pnpm flywheel`), `src/bin/self-report.ts` (dashboard extension)

The loop (TODO15 §30), mapped onto existing machinery:

```text
while (alive):
  observe()          # self-analyzer + Phase 3 metrics + repo observation (runner)
  detectGaps()       # analyzeReasoningGaps / quality / corrections
  if budget:         # BudgetGate development slice
    formHypothesis() # LMJob(kind: 'hypothesis'|'code-analysis') → HypothesisProposed event
    designExperiment()
    if autonomy ≥ L1: execute in sandbox        # L0 stops at proposals
    evaluate()
    if autonomy ≥ L2 && promotion criteria met: propose patch-apply (auto or approval)
  induceSchemas()    # learning/schema-induction over new episodes
  updateStrategies() # FeedbackLearner + CognitiveController.adapt()
  persistEvents(); yield()
```

- **Autonomy mapping:** L0=`observe-only` (default), L1=`sandbox-execute`, L2=`low-risk-auto-merge` scoped to in-scope `patch-apply` only — the existing KernelActionGate ladder is the single source of truth for progression.
- **Curiosity (TODO15 §31):** green-suite state is not terminal — `LMCuriosityQuestionRule` + drives (`DriveManager` curiosity/competence) spawn capability questions → hypotheses → discovery tests (regression / capability / discovery taxonomy from TODO15 §17).
- **LLM as experimental subject (TODO15 §35):** prompt structure, grammar choice, sampling, context selection, model alias become `PARAMETER_SPACE` entries → `CognitiveOptimizer` can optimize *how SeNARS uses the model* with the same grid/random/Bayesian machinery already built.
- **Model switching (TODO15 §36):** `ModelSpec` aliases (`fast`/`reasoning`) in `LlamaRuntimeManager` + `CHAINS` entries; job `kind`/budget hints pick the alias; the broker routes, the runtime hosts.
- **No terminal state.** States: `investigating | improving | waiting | reasoning | learning`.

```bash
pnpm flywheel --cycles 10          # bounded smoke run
LM_PROVIDER=llamacpp-embedded pnpm flywheel   # full-resident flywheel
```

### Acceptance Criteria
- [ ] `pnpm flywheel --cycles 10` completes: ≥1 observation → gap → hypothesis → experiment → evaluation → episode recorded, all event-sourced.
- [ ] Autonomy L0 by default: proposals only, no worktree mutation of canonical tree.
- [ ] L1 exercised in test: sandbox experiment retained as artifact, canonical untouched.
- [ ] Curiosity path: after all tests pass, system produces new capability hypotheses (event-logged), loop continues.
- [ ] LM-usage parameter optimization runs via existing `CognitiveOptimizer` (one recorded tuning result).
- [ ] DoD flow (below) demonstrable end-to-end with the embedded provider.

---

## Master Checklist

### Phase 0: Baseline
- [x] Semantic cache (hash-keyed, 60s TTL, failure-uncached)
- [x] Per-rule `maxOutputTokens` + ≤80-token prompts audited
- [x] `lm/context/` budget module + barrel
- [x] `scripts/fetch-model.ts` + `.models/` gitignored
- [x] `.env.example` provider list current

### Phase 1: Embedded Provider
- [x] `nar/src/lm/runtime/llama-runtime.ts` (minimal resident runtime)
- [x] `providers/embedded-llamacpp.ts` (`doGenerate`/`doStream`, grammar + JSON-schema grammar)
- [x] `LMProviderName` + settings + env vars + registry branch + `CHAINS` + probe ladder
- [x] Grammar/thought bug closed; empty-batch collapse fixed (minItems grammar patch)
- [ ] `bench:fundamentals` with embedded provider: **5/7 best honest run** (scenarios 1 & 3 model-capability-bound on <3B GGUFs; 4,5,6,7 + newly 2 pass)
- [ ] Breaker/demotion behavior verified on load failure

### Phase 2: Runtime Manager
- [ ] Hot / context-level / model-level reconfiguration transaction tiers
- [ ] VRAM stats (`getVramState`, `GgufInsights` estimation, auto `gpuLayers`)
- [ ] Full native control surface: sampling stack, custom batching strategy, speculative decoding, LoRA, embeddings/ranking, context shifting
- [ ] Reload + graceful dispose; env-gated tests

### Phase 3: Budgets
- [ ] `LMResourceBudget` in `KernelBudgetGate`; termination reasons preserved
- [ ] LLM metrics (TTFT, tokens/s, VRAM, aborts, grammar failures) in stats + OTel

### Phase 4: Broker
- [ ] `LMJob`/`LMBroker` (priority, deadline, dedup, cancellation, concurrency, pressure)
- [ ] `createBrokerBackend` bridges `StreamReasoner` (`LMBackend`)
- [ ] Gate admission path unchanged; opt-in `LM_BROKER=1` parity proven

### Phase 5: Development Environment
- [ ] `nar/src/dev/sandbox.ts` (single worktree implementation, DRY vs `ShadowWorktreeManager`)
- [ ] `Experiment` + staged runner (compile → unit → integration → evaluate)
- [ ] `DevelopmentGame implements Game`; `self-development` reward domain → proposals

### Phase 6: Memory, Events, Evaluator
- [ ] `DevelopmentEpisode` in episodic memory
- [ ] 11 flywheel `CognitiveEvent` types in log; replay reproduces state
- [ ] Multi-channel evaluator; policy file outside mutation scope (ActionGate-enforced)
- [ ] `patch-apply` proposal kind + validators + actuators; risk-routed promotion

### Phase 7: Flywheel
- [ ] `src/bin/flywheel.ts` + `pnpm flywheel`; autonomy L0/L1/L2 via autonomy ladder
- [ ] Post-green curiosity loop produces new hypotheses
- [ ] LM-usage parameters exposed to `CognitiveOptimizer`
- [ ] Model aliases routable (`fast`/`reasoning`) through broker

---

## Definition of Done

```text
pnpm flywheel
   │
   ▼
SeNARS loads its GGUF directly into the process (no HTTP hop)
   │
   ▼
GPU configured automatically (backend select + auto gpuLayers)
   │
   ▼
Stream Reasoner runs: NAL ∥ MeTTa ∥ async LM jobs (broker)
   │
   ▼
Results → Kernel Gates → event log → memory
   │
   ▼
Gap detection (self-analyzer + repo observation)
   │
   ▼
Hypothesis → sandbox experiment → tests + metrics
   │
   ┌────┴────┐
   ▼         ▼
 reject    retain ──► lesson ──► schema ──► next cycle
```

And critically, as TODO15 demanded:

**the system continues reasoning while the LLM generates, continues learning while experiments execute, and continues developing after the original test suite passes.**

> **The LLM is not the developer, the reasoner, or the authority. It is a continuously available probabilistic computational substrate inside the SeNARS cognitive economy.**

*One embedded runtime. A brokered task economy. VRAM as a bounded resource. A sandboxed development Game. Evidence-gated promotion. An event-sourced flywheel that never calls itself finished.* 🧠🔁