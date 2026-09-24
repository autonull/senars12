# TODO22: System One Integration — Bot Behavioral Intelligence

## Goal
Integrate System One (manifold, dispatcher, cortex, reflexes) into the Bot's **live behavior and decision-making** — not just diagnostics. Every user interaction, NARS cycle, and autonomous action should leverage System One where available.

**Explicitly excluded:** Self-modification (governance pipeline), distributed networking.

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

## Architecture: Where System One Touches Bot Behavior

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

## Phase 3: Reflexes in Conversation (Not Just Games)

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

### 3.3 Reflex-Driven Response Selection
Instead of raw LLM stream:
1. LMReflex proposes N candidate responses (via GBNF grammar)
2. Manifold scores each (entailment, groundedness, quality, safety)
3. Highest-scoring response selected → streamed to user
4. Trace logged → traceGrader → distillation

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

### 6.2 Default Profile with System One
Update `config/profiles.ts` or `NARBuilder.fromProfile('tool-use')`:
- `systemOne.enabled: true`
- `systemOne.manifold.provider: 'wasi'` (local) or `'http'` (remote)
- `systemOne.cortex.provider: 'llamacpp-embedded'` (same as main LM)
- `systemOne.lmReflex: true`

---

## Implementation Plan

### Phase 1: CLI Exposure (Week 1)
| Task | File | Effort |
|------|------|--------|
| `.systemone` full status | `bot.ts` + `system-one.ts` | 4h |
| `.judge` manifold query | `bot.ts` | 2h |
| `.route` dispatcher inspection | `bot.ts` + `dispatcher.ts` | 3h |
| `.cortex` control | `bot.ts` + `cortex-adapter.ts` | 3h |

### Phase 2: Reasoning Loop Integration (Week 2)
| Task | File | Effort |
|------|------|--------|
| Groundedness gate in `collectChat()` | `bot.ts` | 4h |
| Trace grader sampling | `bot.ts` + `trace-grader.ts` | 3h |
| Manifold-aware Narsese output | `bot.ts` + `nar-io.ts` | 3h |

### Phase 3: Conversation Reflexes (Week 3)
| Task | File | Effort |
|------|------|--------|
| `ConversationGame` + `GameFocus` | `nar/src/nar/games.ts` | 6h |
| Attach at startup in `bot.ts` | `bot.ts` | 2h |
| `.reflex` CLI commands | `bot.ts` | 3h |
| Reflex-driven response selection | `bot.ts` + `LMReflex.ts` | 6h |

### Phase 4: Dispatcher Routing (Week 3-4)
| Task | File | Effort |
|------|------|--------|
| Auto-routing in `.lm-model` / chat | `bot.ts` + `dispatcher.ts` | 4h |
| Provisional cache CLI | `bot.ts` | 2h |

### Phase 5: Meta-Game Observability (Week 4)
| Task | File | Effort |
|------|------|--------|
| `.meta` CLI commands | `bot.ts` + `SelfMetaGame.ts` | 4h |
| Drive stimulation via chat | `bot.ts` | 2h |

### Phase 6: Config & Defaults (Week 4)
| Task | File | Effort |
|------|------|--------|
| `.s1-config` CLI | `bot.ts` + `system-one.ts` | 3h |
| Default profile with System One | `agent/builder.ts` | 2h |
| Update `.env.example` | `.env.example` | 1h |

**Total: ~60 hours (4 weeks)**

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
10. **Default profile** — `systemOne.enabled=true` with sensible defaults

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
bot.ts (entry)
    ├── SystemOneRuntime (nar/src/nar/system-one.ts)
    │   ├── Manifold (createManifold / createHttpManifold)
    │   ├── Dispatcher (createDispatcher)
    │   ├── Cortex (createLMServiceCortex / StubCortex)
    │   ├── GroundednessGate (createGroundednessGate)
    │   ├── TraceGrader (createTraceGrader)
    │   └── Reflexes (ManifoldReflex, LMReflex)
    │
    ├── GameManager (nar/src/nar/games.ts)
    │   └── ConversationGameFocus (NEW)
    │
    └── SelfMetaGame (nar/src/game/SelfMetaGame.ts)
```

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