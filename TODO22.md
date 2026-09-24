# TODO22: System One Integration — Bot Behavioral Intelligence

## Goal
Integrate System One (manifold, dispatcher, cortex, reflexes) into the Bot's **live behavior and decision-making** — not just diagnostics. Every user interaction, NARS cycle, and autonomous action should leverage System One where available.

**Explicitly excluded:** Self-modification (governance pipeline), distributed networking.

**New (CLM-Inspired Enhancements):** Apply Contrastive Language Model techniques (Kwok et al. 2026, *Contrastive Language Models: A System One Model for Fast and Generalizable Decision-Making*, https://contrastive-lm.notion.site/) to enhance SeNARS System One's existing inference, learning, and routing — **using existing SeNARS components**, not external CLM models.

---

## Current State (TODO21 Done)

| Component | Status | Bot Exposure |
|-----------|--------|--------------|
| NAR Core | ✅ Full | `.stats`, `.beliefs`, `.concepts`, `.attention`, Narsese I/O |
| System One Manifold | ✅ Built, **enabled by config** | `.manifold` (health only) |
| System One Dispatcher | ✅ Built, **enabled by config** | Not exposed |
| System One Cortex | ✅ Built, **configurable** | Not exposed (cortex=off by default) |
| System One Reflexes | ✅ Built (ManifoldReflex, LMReflex) | Only in arcade games |
| Groundedness Gate | ✅ Built | Not exposed (egress filter) |
| Trace Grader | ✅ Built | Not exposed |
| Distillation Dataset | ✅ Built | `.distill` (status only) |
| Self-Meta-Game | ✅ Built | Not exposed |

**Key gap:** System One is **passive** — constructed at startup but never consulted during normal bot reasoning, chat, or tool use.

---

## Architecture: Bot ↔ NAR Orthogonality

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BOT LAYER (bot.ts)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ CLI Commands│  │Conversation │  │ Config Ops  │  │ Web/UI    │  │
│  │ .systemone  │  │ GameFocus   │  │ .s1-config  │  │ .webui    │  │
│  │ .judge      │  │ .reflex     │  │ .config-*   │  │ .arcade   │  │
│  │ .route      │  │ .ground     │  │             │  │           │  │
│  │ .meta       │  │ .trace      │  │             │  │           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
└─────────┼────────────────┼────────────────┼───────────────┼────────┘
          │                │                │               │
          ▼                ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NAR LIBRARY (@senars/nar)                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SystemOneRuntime (internal, shared by all NAR consumers)    │   │
│  │   ├── Manifold (WASI/HTTP) — enhanced: contrastive calib   │   │
│  │   ├── Dispatcher — enhanced: contrastive routing           │   │
│  │   ├── Cortex (LLM-backed)                                   │   │
│  │   ├── GroundednessGate — enhanced: contrastive entailment  │   │
│  │   ├── TraceGrader — enhanced: contrastive trace quality    │   │
│  │   └── Reflexes (ManifoldReflex, LMReflex) — enhanced:      │   │
│  │        action embedding cache, contrastive verification    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ GameManager → attaches reflexes to GameFocus instances     │   │
│  │   ├── Arcade games (existing)                              │   │
│  │   └── ConversationGameFocus (Bot-only, attached in bot.ts) │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SelfMetaGame (observes all focuses, emits proposals)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Orthogonality Rules:**
- **Bot-only:** CLI commands, ConversationGameFocus, bot.ts default profile
- **Shared (NAR library):** All System One components, enhancements, reflexes, GameManager
- **No leakage:** Bot config/defaults never modify shared NAR defaults
- **Testable:** Non-Bot tests instantiate NAR with explicit config, unaffected by Bot defaults

```
User Input → Bot.chat() → NAR.reason()
                      │
                      ├─► Tier 1: Manifold (fast, calibrated, offline)
                      │     └─► Judgment heads: entailment, groundedness, quality, safety
                      │
                      ├─► Tier 2: Dispatcher (routing + provisional + cortex fallback)
                      │     └─► Routes to: manifold → provisional → cortex → baseline
                      │
                      ├─► Groundedness Gate (egress filter on LLM output)
                      │
                      └─► Reflexes (per-tick decisions in GameFocus)
                            ├─► ManifoldReflex: manifold scores actions
                            └─► LMReflex: LM proposes, manifold judges
```

**Integration points for Bot:**
1. **NAR.reason()** — already calls manifold via dispatcher (if systemOne.enabled)
2. **Agent.chat()** — LLM stream passes through groundedness gate
3. **GameFocus** — reflexes attached per-game (arcade, future: conversation)
4. **Self-Meta-Game** — observes all focuses, emits proposals

---

## Phase 0: Prototype Gate — ManifoldReflex for Conversation (Week 0, 2h)

**Before investing in Phase 3, validate the core loop works.**

```typescript
// In bot.ts (temporary, behind flag):
if (process.env.SENARS_PROTOTYPE_REFLEX) {
  const focus = new ConversationGameFocus({ ... });
  focus.bindReflex(new ManifoldReflex({ 
    candidates: ['acknowledge', 'clarify', 'answer', 'defer'],
    manifold: systemOne.manifold!,
    embeddingCache: systemOne.embeddingCache!,
  }));
  // Test: single LM response → manifold scores → accept/reject
}
```

**Success criteria (gate):**
- ManifoldReflex scores 4 candidates in **<10ms/tick**
- Accept/reject threshold improves response quality vs raw LM (human eval)
- If **>50ms/tick** or **quality ≤ baseline**, defer Phase 3 to TODO23

---

## CLM-Inspired Enhancements to SeNARS System One

**Reference:** Kwok, J., Kang, H., Suresh, T., Saad-Falcon, J., Pavone, M., Ré, C., & Mirhoseini, A. (2026). *Contrastive Language Models: A System One Model for Fast and Generalizable Decision-Making*. Notion Blog. https://contrastive-lm.notion.site/

**Approach:** Apply CLM techniques to **enhance existing SeNARS System One components** — no external models, no ONNX export, no separate training pipeline. The SeNARS manifold, dispatcher, reflexes, and groundedness gate already provide the infrastructure; CLM techniques improve their speed, calibration, and generalization.

### Key CLM Techniques Adapted to SeNARS

| CLM Technique | SeNARS Application | Implementation |
|---------------|-------------------|----------------|
| **Bidirectional InfoNCE loss** | Manifold head calibration — train judgment heads to pull correct (state, judgment) pairs together, push incorrect apart | Add contrastive calibration step to `manifold.calibrate()` using episodic memory as positives, hard negatives from failed judgments |
| **Disaggregated embeddings** | Cache action/response embeddings; only re-encode state per step | `EmbeddingCache` already exists — extend to cache candidate response embeddings for reflexes, routing |
| **Hard negative mining** | Improve manifold discrimination via synthetic hard negatives | Generate hard negatives from NARS contradictions, failed derivations, LM hallucinations; add to manifold calibration data |
| **Scaling laws for head sizing** | Auto-size manifold projection heads based on data budget | Use SeNARS `calibrationVersion` + `modelDigest` tracking; add head-size optimizer in `system-one.ts` |
| **Replay (40/60 mix)** | Prevent catastrophic forgetting during online manifold updates | Episodic memory replay already exists — ensure manifold calibration includes replay from `.cache/episodes` |
| **Zero-shot cosine scoring** | Fast fallback when manifold heads uncalibrated | Add cosine-similarity fallback in `ManifoldReflex` / `groundednessGate` when heads not ready |

### Enhanced SeNARS Components (No New Providers)

```
Existing SeNARS → CLM-Enhanced
─────────────────────────────────────────────────────────────────
Manifold (WASI)       → Contrastive calibration + cached action embeddings
Dispatcher            → Contrastive routing scores + hard-negative routing
ManifoldReflex        → Pre-computed action embeddings, single state encode/tick
LMReflex              → Contrastive verification of LM proposals (cheap)
GroundednessGate      → Entailment head via contrastive scoring (faster)
TraceGrader           → Contrastive trace quality metric
```

### Implementation: Enhance Existing Files

| Component | File | CLM Technique Applied |
|-----------|------|----------------------|
| Manifold calibration | `nar/src/lm/system-one/manifold.ts` | Bidirectional InfoNCE + hard negatives |
| Embedding cache | `nar/src/lm/system-one/embedding-cache.ts` | Disaggregated state/action caching |
| ManifoldReflex | `nar/src/reflex/ManifoldReflex.ts` | Pre-compute action embeddings |
| LMReflex | `nar/src/reflex/LMReflex.ts` | Contrastive verification of proposals |
| GroundednessGate | `nar/src/lm/system-one/groundedness-gate.ts` | Contrastive entailment scoring |
| Dispatcher | `nar/src/lm/system-one/dispatcher.ts` | Contrastive routing with hard negatives |
| TraceGrader | `nar/src/lm/system-one/trace-grader.ts` | Contrastive trace quality metric |

---

## Phase 1: Expose System One as Bot Capabilities (CLI)

### 1.1 System One Status Command — Live Dashboard
```bash
.systemone              # Full status (enabled, manifolds, heads, dispatcher, cortex, reflexes)
.systemone heads        # Per-head: ECE, abstain threshold, calibration status, sample counts
.systemone dispatcher   # Routing stats: tier hit rates, latency percentiles, fallback counts
.systemone cortex       # Cortex provider/model, grammar, temp, call stats
.systemone reflexes     # Attached reflexes per focus: type, arm counts, budgets
```

### 1.2 Real-Time Manifold Judgment
```bash
.judge <proposition>           # Run manifold heads on arbitrary proposition
.judge "birds can fly"         # Returns: entailment=0.92, groundedness=0.87, quality=0.78
.judge --head entailment <p>   # Single head
```

### 1.3 Dispatcher Routing Inspection
```bash
.route <task>                  # Show routing decision path for a task
.route "summarize this"        # quality: manifold(0.9)→provisional(0.6)→cortex(off)
.route --verbose <task>        # Show scores at each tier
```

### 1.4 Cortex Control (Runtime Toggle)
```bash
.cortex on|off|status         # Toggle cortex provider (requires LM service)
.cortex model <id>            # Set cortex model (H2 domain binding)
.cortex grammar <narsese|json> # Set output grammar
```

---

## Phase 2: System One in Bot Reasoning Loop

### 2.1 Groundedness-Gated LLM Output
**Current:** LLM streams raw to user.
**Target:** Every LLM token/segment passes through `groundednessGate(manifold, embeddingCache)`.

```typescript
// In bot.ts collectChat():
for await (const evt of agent.chat(input, { signal, tier })) {
  if (evt.kind === 'text-delta' && evt.text) {
    const grounded = await groundednessGate(evt.text); // async, non-blocking
    if (grounded) process.stdout.write(evt.text);
    else process.stdout.write('[filtered]');
  }
}
```

**CLI:**
```bash
.ground on|off|status        # Toggle groundedness gate
.ground threshold <0-1>      # Set threshold (default 0.7)
```

### 2.2 Trace Grading on Derivations
**Current:** Derivations logged but not graded.
**Target:** After N cycles, sample traces → `traceGrader` → distillation dataset.

```bash
.trace on|off                # Enable trace grading
.trace sample <rate 0-1>     # Sampling rate
.trace dataset               # Show dataset stats
```

### 2.3 Manifold-Aware Narsese Queries
**Current:** `robin --> fly?` returns NARS truth value only.
**Target:** Also return manifold judgment (entailment, confidence, groundedness).

```bash
robin --> fly?
# Output:
# NARS: f=0.95 c=0.82
# Manifold: entailment=0.93 groundedness=0.89 quality=0.76
# Dispatcher: tier1 (manifold) — 12ms
```

---

## Phase 3: Reflexes in Conversation (Not Just Games) — **Gated by Phase 0**

### 3.1 Conversation as a GameFocus
Create a persistent `ConversationGameFocus` attached at startup:
- **Game:** `ConversationGame` — state = dialogue history, user intent, open tasks
- **Reflexes:** `ManifoldReflex` (score candidate responses) + optional `LMReflex`
- **Manifold judges:** response quality, safety, relevance, groundedness

### 3.2 CLI Commands for Reflex Control
```bash
.reflex list                 # All reflexes on conversation focus
.reflex manifold on|off      # Toggle ManifoldReflex
.reflex lm on|off            # Toggle LMReflex (proposes, manifold judges)
.reflex budget <cycles>      # Set reasoning budget per tick
.reflex arms <n>             # Number of candidate actions
```

### 3.3 Reflex-Driven Response Selection — **Two-Stage Delivery**

**Stage 1 (v1, ~12h) — Accept/Reject Single Response:**
1. LM generates single response (current stream)
2. ManifoldReflex scores response (entailment, groundedness, quality, safety)
3. If score ≥ threshold → stream to user; else → regenerate or defer
4. **CLI:** `.reflex manifold on` enables this immediately

**Stage 2 (v2, +11h) — Multi-Candidate Selection:**
1. LMReflex proposes N candidates (via GBNF grammar: `acknowledge`, `clarify`, `answer`, `defer`, `tool_use`)
2. ManifoldReflex scores each candidate
3. Highest-scoring selected → streamed
4. **CLI:** `.reflex lm on` enables v2 (requires v1 working)

**Gate:** Stage 1 must pass Phase 0 criteria (<10ms/tick, quality > baseline) before Stage 2.

---

## Phase 4: Dispatcher-Driven LM Routing

### 4.1 Tier-Aware LM Selection
**Current:** `.tier quality|fast|structured` picks model statically.
**Target:** Dispatcher routes per-request based on:
- Task type (classification, generation, reasoning)
- Latency budget
- Manifold confidence (if high → use fast tier; if low → escalate)

```bash
.routing-auto on|off         # Enable dispatcher auto-routing
.routing-auto policy <conservative|balanced|aggressive>
```

### 4.2 Provisional Cache for Frequent Queries
Dispatcher's provisional tier caches recent judgments:
```bash
.provisional status          # Cache hit rate, TTL, size
.provisional flush           # Clear provisional cache
```

---

## Phase 5: Self-Meta-Game Observability (Read-Only)

### 5.1 Meta-Game Status
```bash
.meta status                 # Observed focuses, proposal queue, drive states
.meta drives                 # Homeostatic drive intensities
.meta proposals              # Pending proposals (type, risk, status)
.meta propose <type> <args>  # Manually inject proposal (for testing)
```

### 5.2 Drive Stimulation via Chat
```bash
.drive stimulate test_failed # Manually trigger drive
.drive stimulate contradiction_detected
.drive stimulate low_coverage
```

---

## Phase 6: Configuration & Persistence

### 6.1 System One Config via CLI
```bash
.s1-config show              # Full systemOne config (manifold, cortex, budgets, RL, distillation)
.s1-config set manifold.heads.entailment.abstainThreshold 0.4
.s1-config set cortex.provider llamacpp-embedded
.s1-config set budgets.maxJudgmentCallsPerCycle 16
.s1-config save              # Persist to senars.config.json
.s1-config reload            # Hot-reload (manifold/cortex need restart)
```

### 6.2 Bot-Only Default Profile with System One
**In `src/bin/bot.ts` only** — not in `agent/builder.ts` or shared profiles. Non-Bot NAR consumers (tests, `senars` bin, `repl`, library users) are unaffected.

```typescript
// In bot.ts main(), before createAgentFromEnv():
const appConfig = await loadConfig();
if (!appConfig.systemOne?.enabled) {
  appConfig.systemOne = { enabled: true, manifold: { provider: 'wasi' }, cortex: { provider: 'llamacpp-embedded' }, lmReflex: true };
}
// ... pass to createAgentFromEnv()
```

This ensures:
- **Bot users** get System One by default (opt-out via config)
- **Non-Bot NAR users** keep current behavior (opt-in via config)
- **Tests** control System One explicitly via test config

---

## Implementation Plan

### Phase 0: Prototype Gate — ManifoldReflex for Conversation (Week 0)
| Task | File | Effort |
|------|------|--------|
| Prototype ManifoldReflex scoring 4 fixed candidates | `bot.ts` (temp flag) | 2h |
| Benchmark: <10ms/tick, quality > baseline | `scripts/reflex-proto-bench.ts` | 1h |
| **Gate decision:** proceed to Phase 3 v1 or defer | — | — |

### Phase 1: CLI Exposure + Manifold Enhancements (Week 1-2)
| Task | File | Effort |
|------|------|--------|
| `.systemone` full status | `bot.ts` + `system-one.ts` | 4h |
| `.judge` manifold query | `bot.ts` | 2h |
| `.route` dispatcher inspection | `bot.ts` + `dispatcher.ts` | 3h |
| `.cortex` control | `bot.ts` + `cortex-adapter.ts` | 3h |
| **Contrastive manifold calibration (InfoNCE + hard negatives)** | `nar/src/lm/system-one/manifold.ts` | 12h |
| **Hard negative mining from episodic/NARS** | `nar/src/memory/episodic.ts` + `manifold.ts` | 8h |
| **Scaling-law auto head sizing** | `nar/src/lm/system-one/manifold.ts` | 4h |

**⚠️ Benchmark Gate (end of Phase 1):**
Run `scripts/manifold-bench.ts` comparing baseline vs contrastive manifold:
- **ECE (Expected Calibration Error)** must improve ≥10%
- **Discrimination AUC** (positive vs negative judgment pairs) must improve ≥10%
- **Latency** ≤33ms/judgment at 100 candidates (budget)
- If **any metric fails**, revert to baseline calibration; defer CLM enhancements to TODO23

**Contrastive Implementation Scope (exact):**
- **Positives:** `(state_embedding, judgment_vector)` from:
  - Episodic memory: successful derivations with high truth confidence
  - Distillation dataset: teacher-forced trajectories (when available)
  - Human-labeled: `.judge` CLI confirmations (future)
- **Negatives (hard):** `(state_embedding, wrong_judgment)` from:
  - NARS contradictions: `(A --> B)` & `(A --> [B]_not)` both high confidence
  - Failed derivations: premises true, conclusion false (validated by LM)
  - LM hallucinations: groundedness gate rejections with LM-generated alternatives
- **Loss:** Bidirectional InfoNCE (state→judgment + judgment→state)
- **Training:** Online, per calibration cycle; replay 40% episodic / 60% new

### Phase 2: Reasoning Loop + Groundedness Enhancements (Week 2-3)
| Task | File | Effort |
|------|------|--------|
| Groundedness gate in `collectChat()` | `bot.ts` | 4h |
| Trace grader sampling | `bot.ts` + `trace-grader.ts` | 3h |
| Manifold-aware Narsese output | `bot.ts` + `nar-io.ts` | 3h |
| **GroundednessGate: contrastive entailment scoring** | `nar/src/lm/system-one/groundedness-gate.ts` | 4h |
| **TraceGrader: contrastive trace quality metric** | `nar/src/lm/system-one/trace-grader.ts` | 3h |
| **Distillation auto-capture from successful conversations** | `nar/src/lm/system-one/distill.ts` | 4h |

### Phase 3: Conversation Reflexes — **Gated, Two-Stage (Week 3-4)**
| Task | File | Effort |
|------|------|--------|
| `ConversationGame` + `GameFocus` | `nar/src/nar/games.ts` | 6h |
| Attach at startup in `bot.ts` | `bot.ts` | 2h |
| `.reflex` CLI commands | `bot.ts` | 3h |
| **Stage 1 (v1): ManifoldReflex accept/reject single response** | `bot.ts` + `ManifoldReflex.ts` | 6h |
| **Stage 2 (v2): LMReflex multi-candidate + manifold selection** | `bot.ts` + `LMReflex.ts` | 11h |
| **ManifoldReflex: pre-compute action embeddings** | `nar/src/reflex/ManifoldReflex.ts` | 6h |
| **LMReflex: contrastive verification of proposals** | `nar/src/reflex/LMReflex.ts` | 6h |
| **Disaggregated action embedding cache** | `nar/src/lm/system-one/embedding-cache.ts` | 8h |

### Phase 4: Dispatcher Routing + Dispatcher Enhancements (Week 4)
| Task | File | Effort |
|------|------|--------|
| Auto-routing in `.lm-model` / chat | `bot.ts` + `dispatcher.ts` | 4h |
| Provisional cache CLI | `bot.ts` | 2h |
| **Dispatcher: contrastive routing with hard negatives** | `nar/src/lm/system-one/dispatcher.ts` | 6h |

### Phase 5: Meta-Game Observability (Week 4)
| Task | File | Effort |
|------|------|--------|
| `.meta` CLI commands | `bot.ts` + `SelfMetaGame.ts` | 4h |
| Drive stimulation via chat | `bot.ts` | 2h |

### Phase 6: Config & Defaults (Week 4-5)
| Task | File | Effort |
|------|------|--------|
| `.s1-config` CLI | `bot.ts` + `system-one.ts` | 3h |
| **Bot-only default profile with System One** | `src/bin/bot.ts` (not agent/builder.ts) | 2h |
| Update `.env.example` | `.env.example` | 1h |
| Benchmark: enhanced vs baseline manifold | `scripts/manifold-bench.ts` | 4h |

**Total: ~113 hours (5-6 weeks)**

**Note:** CLM techniques are **not a separate phase** — they're internal algorithm improvements folded into the component work above. No new providers, no new config, no separate training pipeline.

---

## Acceptance Criteria

1. **`pnpm run bot` with `systemOne.enabled=true`** — Manifold + Dispatcher active at startup
2. **`.systemone`** — Shows all subsystems with live metrics
3. **`.judge "birds fly"`** — Returns manifold head scores
4. **`.route "summarize"`** — Shows dispatcher tier path + scores
5. **`.ground on`** — LLM output filtered by groundedness gate
6. **`.reflex lm on`** — Conversation uses LMReflex + ManifoldReflex
7. **Chat with manifold-aware output** — NARS truth + manifold judgment shown
8. **`.meta status`** — Shows self-meta-game state
9. **`.s1-config save`** — Persists System One config
10. **Bot-only default profile** — `systemOne.enabled=true` in `bot.ts` (opt-out via config); non-Bot NAR users unaffected
11. **CLM-enhanced manifold** — Contrastive calibration active, hard negatives from episodic memory
12. **CLM-enhanced reflexes** — Action embeddings cached, single state encode per tick
13. **CLM-enhanced routing** — Contrastive routing scores with hard-negative discrimination
14. **Benchmark** — Enhanced manifold ≤20ms/judgment at 100 candidates (vs ~33ms baseline)
15. **Phase 0 Gate Passed** — ManifoldReflex <10ms/tick, quality > baseline (or Phase 3 deferred)
16. **Phase 1 Benchmark Gate Passed** — ECE/AUC ≥10% improvement, latency ≤33ms (or CLM enhancements deferred)

## Other High-Value Work Along the Way (Opportunistic)

These are **not on the critical path** but add significant value with minimal extra effort when touching related files:

| Work | Trigger | Effort | Value |
|------|---------|--------|-------|
| **Manifold health alerts** | Phase 1 (manifold.ts) | 2h | PagerDuty/Slack alerts when ECE > 0.15 or head uncalibrated > 1h |
| **Distillation auto-capture** | Phase 2 (distill.ts) | 4h | Auto-save high-confidence conversation traces to distillation dataset |
| **Reflex A/B testing framework** | Phase 3 (ManifoldReflex.ts) | 3h | Compare v1 vs v2 vs baseline response quality via `.reflex abtest on` |
| **System One Prometheus metrics export** | Phase 1 (system-one.ts) | 2h | `/metrics` endpoint: manifold latency, head ECE, dispatcher tier distribution, reflex scores |
| **Conversation trace logging** | Phase 3 (ConversationGameFocus) | 2h | `.trace conversation on` — full reflex→manifold→response trace per turn |
| **Hard negative quality dashboard** | Phase 1 (manifold.ts) | 2h | `.systemone hard-negatives` — show mined negatives, sources, discrimination margins |
| **Manifold head interpretability** | Phase 1 (manifold.ts) | 3h | `.judge --explain` — show which training examples most influenced judgment |
| **Cost-aware routing policy** | Phase 4 (dispatcher.ts) | 3h | `.routing-auto policy cost-aware` — prefers cheaper tiers within quality budget |
| **Reflex decision audit trail** | Phase 3 (GameFocus) | 2h | `.reflex history` — last N decisions with scores, chosen action, outcome |

**Rule:** Only implement when already in the file for critical-path work. No separate tickets.

---

## Configuration Defaults (for `.env.example`)

```bash
# System One (TODO22)
SENARS_SYSTEMONE_ENABLED=true
SENARS_SYSTEMONE_MANIFOLD_PROVIDER=wasi
SENARS_SYSTEMONE_CORTEX_PROVIDER=llamacpp-embedded
SENARS_SYSTEMONE_LMREFLEX_ENABLED=true
SENARS_SYSTEMONE_GROUNDEDNESS_THRESHOLD=0.7
SENARS_SYSTEMONE_TRACE_SAMPLING=0.1
```

**CLM-inspired enhancements are internal defaults** — no extra env vars. If universally better, they become the default behavior in the enhanced components.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Manifold latency adds to chat response | Budget: `maxLatencyMsPerJudgment=33ms`; async prefetch in reflexes |
| Cortex calls increase LM spend | Circuit breakers + spend tracking; `.cortex off` by default |
| Reflexes change response character | Start with `ManifoldReflex` only (scoring); `LMReflex` opt-in |
| Trace grading fills disk | `autoFlush=false` default; `.trace dataset` shows size; rotation at 100MB |
| Config changes need restart | Hot-reload for budgets/RL; manifold/cortex restart noted in CLI |

---

## Dependencies

```
bot.ts (entry) — BOT ONLY
    ├── CLI Commands (.systemone, .judge, .route, .cortex, .ground, .trace, .reflex, .meta, .s1-config)
    ├── ConversationGameFocus (attached at startup, Bot-only)
    ├── Bot default profile (System One enabled by default, opt-out via config)
    └── Web/UI/Arcade integration (.webui, .arcade)

NAR Library (@senars/nar) — SHARED BY ALL CONSUMERS
    ├── SystemOneRuntime (nar/src/nar/system-one.ts)
    │   ├── Manifold (createManifold / createHttpManifold) — enhanced: contrastive calibration
    │   ├── Dispatcher (createDispatcher) — enhanced: contrastive routing
    │   ├── Cortex (createLMServiceCortex / StubCortex)
    │   ├── GroundednessGate (createGroundednessGate) — enhanced: contrastive entailment
    │   ├── TraceGrader (createTraceGrader) — enhanced: contrastive trace quality
    │   └── Reflexes (ManifoldReflex, LMReflex) — enhanced: action embedding cache
    │
    ├── GameManager (nar/src/nar/games.ts)
    │   ├── Arcade games (existing)
    │   └── ConversationGameFocus (attachable by any consumer, not Bot-specific)
    │
    └── SelfMetaGame (nar/src/game/SelfMetaGame.ts)

CLM Techniques (internal, folded into components above):
    ├── Bidirectional InfoNCE loss for manifold calibration
    ├── Disaggregated state/action embedding cache
    ├── Hard negative mining from episodic memory/NARS contradictions
    ├── Scaling-law auto head sizing
    └── Replay (40/60) for online calibration stability
```

**Key orthogonality:**
- Bot default profile set in `bot.ts` only — never in shared `agent/builder.ts` or profiles
- Non-Bot NAR consumers (tests, `senars` bin, library users) instantiate NAR with explicit config
- All System One enhancements benefit all NAR consumers automatically
- No Bot-specific config leaks into shared NAR defaults

---

## Out of Scope (Explicit)

- ❌ Governance pipeline wiring (`ProposalRouter` → approval → apply)
- ❌ Self-modification (code patches, schema promotion, capability scaffolding)
- ❌ Distributed System One (peer, open-systemone manifold providers)
- ❌ External governance service
- ❌ Automatic self-improvement loop (only `.meta propose` for manual testing)

---

## Success Metric

> **User chats with bot → every response scored by manifold → groundedness filtered → dispatcher routes LM calls → reflexes propose alternatives → trace graded → user sees NARS + manifold truth values → all configurable at runtime via `.systemone`, `.reflex`, `.ground`, `.route`, `.judge`, `.s1-config`.**