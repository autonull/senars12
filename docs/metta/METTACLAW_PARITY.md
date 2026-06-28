# SeNARS Cognitive Bot — Master Plan

> Transcending MeTTaClaw: a production-ready, symbolically-grounded cognitive agent.
> Date: 2026-04-05

---

## Philosophy

> "MeTTa is the operating system. LLMs are peripherals."

The LLM is a powerful but unreliable pattern-matching component. MeTTa and NARS provide the symbolic backbone: structured reasoning, truth-valued belief management, goal-directed behavior, and verifiable execution. The system is designed so that **symbolic reasoning drives, LLM fills gaps** — not the reverse.

---

## 0. MeTTaClaw Defects — Summary & Transcendence

| # | Defect | Severity | SeNARS Status | Action |
|---|---|---|---|---|
| D1 | Unbounded recursive loop (stack overflow) | **Critical** | Transcended (JS while-true) | ✅ Done |
| D2 | Hardcoded LLM provider logic | **High** | Transcended (ModelRouter) | ✅ Done |
| D3 | Fragile parenthesis balancing (Python hack) | **High** | Transcended (state-machine parser) | ✅ Done |
| D4 | Error handling swallows all errors | **High** | Transcended (structured error propagation) | ✅ Done |
| D5 | No command execution isolation | **High** | Transcended (per-command dispatch + audit) | ✅ Done |
| D6 | `prevmsg` logic broken | Medium | Transcended (clean queue) | ✅ Done |
| D7 | File-based history, race conditions | **High** | Transcended (in-memory + NARS serialize) | ✅ Done |
| D8 | ChromaDB blind call, no error handling | Medium | Transcended (local HNSW + safeGet) | ✅ Done |
| D9 | History ignores semantic content | Medium | Transcended (Episodic + Semantic stores) | ✅ Done |
| D10 | `read-file` ignores exists_file result | Medium | Transcended (capability-gated) | ✅ Done |
| D11 | No path sanitization on file ops | **High** | Transcended (capability gates + safety) | ✅ Done |
| D12 | `metta` skill arbitrary code exec, no safety | **Critical** | Transcended (capability gate + safety layer) | ✅ Done |
| D13 | Static skills, no runtime discovery | Medium | Transcended (dynamic registration) | ✅ Done |
| D14 | Mutually exclusive channels | Medium | Transcended (EmbodimentBus) | ✅ Done |
| D15 | Naive send deduplication (lossy) | Medium | Transcended (per-channel routing) | ✅ Done |
| D16 | Fragile DDG HTML scraping | Low | Transcended (capability-gated, swappable) | ✅ Done |
| D17 | `configure` blocks on stdin | **High** | Transcended (declarative config) | ✅ Done |
| D18 | `string-safe` mangles data irreversibly | **High** | Transcended (proper S-expr parsing) | ✅ Done |
| D19 | `last_chars` off-by-one risk | Low | Transcended (proper substring) | ✅ Done |
| D20 | Shell command injection vulnerability | **Critical** | Transcended (safetyLayer, disabled by default) | ✅ Done |
| D21 | `balance_parentheses` fundamentally broken | **High** | Transcended (state-machine parser) | ✅ Done |
| D22 | Hardcoded API key, no fallback | **High** | Transcended (config-driven, fallback chain) | ✅ Done |
| D23 | No error handling on LLM response | **High** | Transcended (try/catch + fallback responses) | ✅ Done |
| D24 | NAL rules: no conflict resolution | **High** | Transcended (full NARS with stamps) | ✅ Done |
| D25 | `|-` deduplication is naive | Medium | Transcended (NARS derivation tracking) | ✅ Done |
| D26 | Duplicate import | Low | N/A (SeNARS uses ESM imports) | ✅ N/A |
| D27 | Missing `./src/context` import | Medium | Transcended (complete ContextBuilder) | ✅ Done |
| D28 | External git deps unpinned | Medium | N/A (SeNARS uses npm/pnpm) | ✅ N/A |
| D29 | No error recovery or restart logic | **High** | Transcended (budget reset, autonomousLoop) | ✅ Done |
| D30 | README claims don't match implementation | Low | N/A (documentation concern) | ✅ N/A |
| D31 | IRC JOIN commented out | Medium | Transcended (proper IRCChannel) | ✅ Done |
| D32 | IRC no length limit (512-byte) | Medium | Transcended (_splitIntoLines + _batchLines) | ✅ Done |
| D33 | Mattermost _headers uninitialized | Low | **Excluded** (Mattermost not supported) | 🚫 Excluded |

**Result:** 29/33 defects fully transcended (D1-D25, D27, D29, D31-D32), 0 partially transcended, 1 excluded (D33), 3 N/A (D26, D28, D30).

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Embodiment Bus                               │
│   IRC  │  Nostr  │  Virtual  │  CLI  │  (extensible)                │
└────────────────────────┬────────────────────────────────────────────┘
                         │ messages (salience-ordered queue)
┌────────────────────────▼────────────────────────────────────────────┐
│                     MeTTa Control Plane                             │
│                                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  Context   │  │  LLM Invoke  │  │  Skill Dispatcher            │ │
│  │  Builder   │──│  (peripheral)│──│  (parse → gate → execute)   │ │
│  └─────┬─────┘  └──────────────┘  └──────────────┬───────────────┘ │
│        │                                         │                   │
│  ┌─────▼─────────────────────────────────────────▼───────────────┐  │
│  │                    Symbolic Core                               │  │
│  │                                                                │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │   NARS     │  │  MeTTa   │  │ Working  │  │  Goal      │  │  │
│  │  │  Engine    │  │Interpre- │  │  Memory  │  │  Manager   │  │  │
│  │  │            │  │  ter     │  │  (WM)    │  │  (NARS)    │  │  │
│  │  └─────┬──────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │  │
│  │        │              │             │               │         │  │
│  │  ┌─────▼──────────────▼─────────────▼───────────────▼──────┐  │  │
│  │  │              Memory Layer                                │  │  │
│  │  │  SemanticMemory │ EpisodicMemory │ AuditSpace │ NARS KB  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Safety & Governance                                          │  │
│  │  SafetyLayer (tier-based) │ HookOrchestrator │ AuditSpace     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Key principle:** The MeTTa control plane orchestrates everything. The LLM is invoked as one component among many — a powerful pattern completer, not the decision-maker.

---

## 2. Implementation Phases

### Phase 1: Foundation (Turnkey Operation)

**Goal:** Production-ready entry point, configuration, and basic cognitive pipeline.

#### 1.1 Unified Entry Point ✅
- `agent/examples/chatbot/run.js` — single entry with modes: `irc`, `cognitive`, `cli`, `demo`
- `bot.config.example.json` — declarative config schema
- `package.json` scripts: `bot`, `bot:irc`, `bot:cognitive`, `bot:cli`, `bot:demo`, `bot:test`
- Smoke tests at `agent/examples/chatbot/tests/smoke.js`

#### 1.2 S-Expr Command Enforcement
**Transcends MeTTaClaw D3, D5, D21**

- `SkillDispatcher` gains `maxCommands` config (default 3)
- Parenthesis balancing: proper state-machine parser (already implemented, verify correctness)
- Error feedback loop: when parse fails, inject format reminder into next cycle's FEEDBACK slot
- ContextBuilder adds explicit output format instruction when `sExprSkillDispatch` is active:
  ```
  OUTPUT FORMAT: Respond with up to 3 skill calls as S-expressions.
  Example: (respond "The answer is 4.") (think "User asked about math")
  Each argument must be a quoted string.
  ```
- Per-command error isolation: each command executes independently; failure of one doesn't block others

#### 1.3 NAL Rules Integration
**Transcends MeTTaClaw D24, D25**

- `NarsOps.js` registers `|-` as a grounded op that delegates to the NARS engine
- The grounded op accepts Narsese premises, runs NARS inference (deduction, induction, abduction), returns conclusions with truth values
- Implementation is in JS (not a MeTTa file) because NARS provides the actual inference engine with conflict resolution, derivation tracking, and attention management — not brute-force forward chaining like MeTTaClaw
- `nar-beliefs`, `nar-add`, `nar-truth` ops provide full NARS access from MeTTa
- Key difference from MeTTaClaw: NARS handles conflict resolution, derivation tracking (stamps), and attention management — not brute-force forward chaining

#### 1.4 Flexible Memory Atom Representation
**Transcends MeTTaClaw D8, D9**

- `SemanticMemory` stores `atom` field as any MeTTa expression (string or Term), not just plain text
- Storage format: `(memory-item $timestamp $atom $embedding $metadata)` in `atoms.metta`
- Query returns raw atoms usable by other MeTTa rules
- Enables cross-component memory operations: NARS can reason about stored memories, MeTTa rules can pattern-match on them

---

### Phase 2: Cognitive Depth

**Goal:** Advanced cognitive behavior through MeTTa/NARS symbolic integration.

#### 2.1 NARS-Driven Attention & Salience
**Current:** `AttentionMechanism` uses heuristic scoring (keyword overlap, recency).

**Enhancement:** Replace heuristic scoring with NARS expectation values:
- Each perception becomes a NARS task with budget priority
- NARS derives which concepts are most relevant given current beliefs
- Working memory selection driven by NARS attention allocation, not fixed thresholds
- Salience boost for: agent name mention, direct questions, high-truth beliefs, active goals

#### 2.2 Goal-Directed Behavior
**Current:** Goals exist as procedural memory rules.

**Enhancement:** Full NARS goal management:
- Goals are NARS tasks with desired states: `(^goal! (state desired) truth)`
- NARS derives sub-goals through backward inference
- `set-goal` skill creates goals with priority
- `nar-goals` queries active/pending/completed goals
- Goal satisfaction triggers procedural rules
- Autonomous mode: agent generates self-goals when idle (exploration, memory consolidation, self-evaluation)

#### 2.3 Reasoned LLM Utilization
**Current:** LLM is called with context, response is parsed for skills.

**Enhancement:** The symbolic core decides WHEN and HOW to use the LLM:

1. **LLM Invocation Decision** (NARS-derived):
   - Does the query match known beliefs with high confidence? → Answer directly from NARS
   - Is creative generation needed? → Invoke LLM
   - Is factual recall needed? → Query SemanticMemory first
   - Is reasoning needed? → Run NARS inference

2. **LLM Output Validation** (MeTTa-gated):
   - LLM produces S-expressions → parse and type-check against skill signatures
   - Invalid output → reject, feed error back, retry
   - Valid output → execute through skill dispatcher with safety checks

3. **LLM Knowledge Integration** (NARS revision):
   - Facts from LLM responses become NARS beliefs with lower initial confidence
   - Contradictions with existing beliefs trigger revision
   - Repeated LLM claims increase confidence through revision

4. **LLM Prompt Construction** (symbolically assembled):
   - Context built from NARS beliefs (filtered by relevance), not flat history
   - Skills exposed as MeTTa declarations, not free-form text
   - Output format enforced by MeTTa grammar, not prompt engineering alone

#### 2.4 MeTTa-Native Loop Execution
**Current:** `AgentLoop.metta` is spec-only; JS driver implements the loop.

**Enhancement:** As MeTTa interpreter gains async grounded-op support:
- Migrate loop execution from JS driver to MeTTa interpreter
- `AgentLoop.metta` becomes executable, not just declarative
- State lives in MeTTa atomspace, not JS objects
- Loop can be introspected and modified via MeTTa rules
- Maintain JS driver as fallback for environments where MeTTa async ops aren't available

---

### Phase 3: Self-Improvement

**Goal:** Agent improves its own configuration, prompts, and skills over time.

#### 3.1 Harness Optimization
- `HarnessOptimizer` analyzes audit trail for failure patterns
- Proposes prompt improvements, skill modifications, context budget adjustments
- Changes are gated by `harnessDiffusion` capability — can be reviewed before applying
- Score improvements via downstream success rate

#### 3.2 Self-Modifying Skills
- `add-skill` skill writes new entries to `skills.metta`
- Skills can be disabled/enabled at runtime via capability flags
- Skill usage tracked in audit trail; unused skills pruned during consolidation

#### 3.3 Memory Consolidation
- Periodic consolidation merges duplicate memories
- Low-access memories pruned based on budget
- Important memories pinned automatically based on usage patterns
- Cross-memory consistency checks (SemanticMemory vs NARS beliefs)

---

### Phase 4: Multi-Model Intelligence

**Goal:** Optimize LLM usage across models and tasks.

#### 4.1 Model Router
- Route tasks to appropriate models: small model for classification, large model for generation
- Epsilon-greedy exploration: occasionally try alternative models to discover better fits
- Score tracking per model per task type
- `set-model` skill for manual override, `eval-model` for benchmarking

#### 4.2 Cost-Aware Invocation
- Track token usage and latency per model
- Budget-aware: switch to smaller model when budget is tight
- Cache LLM responses for repeated queries

---

## 3. Design Principles (Transcending MeTTaClaw)

### 3.1 No Data Mangling
MeTTaClaw's `string-safe` replaces quotes/apostrophes with tokens, corrupting data. SeNARS uses proper S-expression parsing with string literal handling. **Rule:** Never transform user data through lossy encoding.

### 3.2 Capability Gates Over Trust
MeTTaClaw has no safety — arbitrary shell exec, file write, and eval are all available. SeNARS gates every skill behind capability flags, with safety layer and hooks. **Rule:** Dangerous operations are disabled by default and require explicit opt-in.

### 3.3 Structured Errors Over Silent Failure
MeTTaClaw swallows errors with `catch` and screaming constants. SeNARS propagates structured `{skill, result, error}` objects through the pipeline. **Rule:** Every failure is logged, audited, and fed back into the next cycle.

### 3.4 Declarative Config Over Interactive Prompts
MeTTaClaw's `configure` blocks on stdin, hanging in headless mode. SeNARS reads all config from `agent.json` at startup. **Rule:** No interactive prompts in production codepaths.

### 3.5 Multi-Channel Over Single Channel
MeTTaClaw's channels are mutually exclusive. SeNARS's EmbodimentBus supports simultaneous IRC, Nostr, Virtual, CLI. **Rule:** The agent should be embodiable in any number of channels concurrently.

### 3.6 Symbolic Core, Neural Peripherals
MeTTaClaw's LLM drives everything — the agent is an LLM wrapper. SeNARS's NARS/MeTTa core drives decisions, LLM fills gaps. **Rule:** The symbolic core can operate without the LLM; the LLM cannot operate without the symbolic core.

---

## 4. Configuration Schema

```jsonc
{
  "profile": "parity",              // minimal | parity | evolved | full
  "bot": {
    "nick": "SeNARchy",
    "personality": "helpful, curious, and concise",
    "maxContextLength": 30,
    "contextWindowMs": 3600000
  },
  "irc": {
    "enabled": true,
    "host": "irc.quakenet.org",
    "port": 6667,
    "channel": "##metta",
    "tls": false
  },
  "lm": {
    "provider": "transformers",
    "modelName": "onnx-community/Qwen2.5-1.5B-Instruct",
    "temperature": 0.7,
    "maxTokens": 256,
    "openai": { "baseURL": null, "apiKey": null }
  },
  "capabilities": {
    "shellSkill": false,
    "fileWriteSkill": false,
    "auditLog": true,
    "safetyLayer": false
  },
  "loop": {
    "budget": 50,
    "sleepMs": 2000
  },
  "rateLimit": {
    "perChannelMax": 3,
    "perChannelInterval": 8000,
    "globalMax": 10,
    "globalInterval": 10000
  }
}
```

---

## 5. Priority Order

| Priority | Phase | Task | Effort | Impact |
|---|---|---|---|---|
| P0 | 1.2 | S-expr command enforcement | Low | High |
| P0 | 1.3 | NAL rules integration | Medium | High |
| P1 | 1.4 | Flexible memory atoms | Medium | Medium |
| P1 | 2.1 | NARS-driven attention | Medium | High |
| P1 | 2.2 | Goal-directed behavior | Medium | High |
| P2 | 2.3 | Reasoned LLM utilization | High | High |
| P2 | 2.4 | MeTTa-native loop | High | Medium |
| P3 | 3.x | Self-improvement | High | Medium |
| P3 | 4.x | Multi-model intelligence | Medium | Medium |

---

## 6. Verification Status

### Defect Transcendence: 29/33 VERIFIED (all fixable defects), 0 PARTIAL, 0 NOT VERIFIED

| # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Unbounded recursive loop | ✅ VERIFIED | `MeTTaLoopBuilder.js:152` — `while (this.#running)` |
| D2 | Hardcoded LLM provider | ✅ VERIFIED | `LLMInvoker.js` + `ModelRouter` |
| D3 | Fragile parenthesis balancing | ✅ VERIFIED | `SkillDispatcher._balanceParens()` state machine |
| D4 | Error handling swallows errors | ✅ VERIFIED | `{skill, result, error}` per command |
| D5 | No command execution isolation | ✅ VERIFIED | `Promise.all` + per-command catch |
| D6 | `prevmsg` logic broken | ✅ VERIFIED | `MeTTaOpRegistrar.js:58-62` |
| D7 | File-based history, race conditions | ✅ VERIFIED | In-memory `historyBuffer` |
| D8 | ChromaDB blind call | ✅ VERIFIED | `SemanticMemory` HNSW + fallback |
| D9 | History ignores semantic content | ✅ VERIFIED | Episodic + Semantic stores |
| D10 | `read-file` ignores exists_file | ✅ VERIFIED | Capability-gated |
| D11 | No path sanitization | ✅ VERIFIED | `safety.metta` path traversal hooks |
| D12 | `metta` skill arbitrary code exec | ✅ VERIFIED | `mettaControlPlane` capability gate |
| D13 | Static skills | ✅ VERIFIED | `loadSkillsFromFile` + `discover-skills` |
| D14 | Mutually exclusive channels | ✅ VERIFIED | `EmbodimentBus` |
| D15 | Naive send deduplication | ✅ VERIFIED | Per-channel routing |
| D16 | Fragile DDG HTML scraping | ✅ VERIFIED | Capability-gated, swappable |
| D17 | `configure` blocks on stdin | ✅ VERIFIED | Declarative config |
| D18 | `string-safe` mangles data | ✅ VERIFIED | Proper S-expr parsing |
| D19 | `last_chars` off-by-one | ✅ VERIFIED | `.slice()` throughout |
| D20 | Shell command injection | ✅ VERIFIED | Forbidden patterns + allowlist |
| D21 | `balance_parentheses` broken | ✅ VERIFIED | State-machine parser |
| D22 | Hardcoded API key | ✅ VERIFIED | Config-driven |
| D23 | No error handling on LLM response | ✅ VERIFIED | `LLMInvoker.invoke()` try/catch |
| D24 | NAL no conflict resolution | ✅ VERIFIED | `conflictMap` + `Truth.expectation()` for conflict resolution |
| D25 | `\|-` deduplication naive | ✅ VERIFIED | `seen` Set deduplicates by `type|term` key |
| D26 | Duplicate import | ✅ N/A | ESM imports |
| D27 | Missing `./src/context` import | ✅ VERIFIED | `ContextBuilder.js` |
| D28 | External git deps unpinned | ✅ N/A | pnpm workspaces |
| D29 | No error recovery/restart | ✅ VERIFIED | Budget reset, autonomousLoop |
| D30 | README claims mismatch | ✅ N/A | Documentation |
| D31 | IRC JOIN commented out | ✅ VERIFIED | `IRCChannel` |
| D32 | IRC no length limit | ✅ VERIFIED | `_splitIntoLines` + `_batchLines` |
| D33 | Mattermost _headers | 🚫 EXCLUDED | Mattermost not supported |

### Phase 1 Items

| Item | Status | Notes |
|---|---|---|
| 1.1 Unified Entry Point | ✅ COMPLETE | `run.js`, `bot.config.example.json`, `package.json` scripts, smoke tests |
| 1.2 S-Expr Command Enforcement | ✅ COMPLETE | `maxSkillsPerCycle`, state-machine `_balanceParens`, error feedback with format reminder |
| 1.3 NAL Rules Integration | ✅ COMPLETE | `NarsOps.js` with `\|-`, `nar-beliefs`, `nar-add`, `nar-truth` grounded ops |
| 1.4 Flexible Memory Atoms | ✅ COMPLETE | `memory-item` type with `atom` field for any MeTTa expression. Backward compatible with `memory-atom`. |

### Symbolic Core Items

| Item | Status | Notes |
|---|---|---|
| LLMInvoker (single source) | ✅ COMPLETE | One instance, shared between MeTTaOpRegistrar and loop |
| NarsOps (NAL grounded ops) | ✅ COMPLETE | Direct `Term` import, no prototype hack |
| MeTTaLoopBuilder lifecycle | ✅ COMPLETE | `pause/resume/stop/on` with 9 event types |
| MeTTaSkillRegistrar modular | ✅ COMPLETE | 11 domain classes, capability-gated |
| safety.metta unified | ✅ COMPLETE | `hooks.metta` deleted, unified into `safety.metta` |
| Term direct import | ✅ COMPLETE | `import { Term } from '@senars/metta/kernel/Term.js'` |

### Regressions Fixed

| Regression | Fix |
|---|---|
| NarsOps used prototype hack for Term | Direct `import { Term } from '@senars/metta/kernel/Term.js'` |
| MeTTaLoopBuilder created 2 LLMInvoker instances | Single instance created in `build()`, passed to `#buildLoop()` |
| Error feedback lacked format reminder | Parse errors now inject S-expr format reminder into FEEDBACK slot |
| `nal-rules.metta` missing per plan | Superseded by JS `NarsOps` — correct architecture (NARS engine, not MeTTa rules) |
