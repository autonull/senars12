# NEXT — SeNARS Autonomous Cognitive Agent

> This document consolidates all known gaps from the current implementation and proposes a phased plan to achieve genuine autonomous cognition.

---

## 1. Immediate Fixes (Crash / Data Loss Risks) — ✅ ALL DONE

| # | Issue | Status |
|---|-------|--------|
| 1.1 | Unsafe `as NAR` cast | Fixed — `MessageContext.nar` optional, middleware guards in place |
| 1.2 | Empty `ConnectionManager` passed to commands | Fixed — `CommandContext.manager` optional, no `{}` cast |
| 1.3 | Write queue rejection poisons flush | Fixed — per-write `.catch()` with dirty-set cleanup |
| 1.4 | No-op cleanup leaks handlers | Fixed — `Connection` exposes `removeMessageHandler`, `io-bridge.ts` calls it |
| 1.5 | Stale integration script | Deleted from disk; ready for `git rm` |

---

## 2. Architecture Hardening (Tech Debt) — ✅ ALL DONE

| # | Issue | Status |
|---|-------|--------|
| 2.1 | Dynamic import on hot NL path | Fixed — `termParser` is now a static import |
| 2.2 | Bare `fs` imports (6 files) | Fixed — all use `node:fs` / `node:path` |
| 2.3 | Inline `import()` type expressions (9 locations) | Fixed — all use top-level `import type` |
| 2.4 | `BridgeContext` property redundancy | Documented — mutable re-declarations are intentional for middleware use |
| 2.5 | Undocumented `limit * 2` in `trimHistory` | Fixed — JSDoc explains pre-buffer design |
| 2.6 | Missing barrel exports | Fixed — `buildAgentTools`, `AgentToolDeps`, `BridgeOptions`, `BridgeContext` all exported from `src/index.ts` |

---

## 3. Autonomy Core (New Capability)

> The control loop that turns a reasoning engine into an autonomous agent.

### 3.1 Goal Stack & Pursuit Loop
**Files:** `src/agent/GoalManager.ts` (new), `src/agent/agent.ts`

```ts
interface Goal {
    id: string;
    description: string;
    status: 'pending' | 'active' | 'blocked' | 'done' | 'failed';
    subgoals: string[];
    progress: number; // 0-1
    createdAt: number;
    updatedAt: number;
    priority: number;
}
```

**Background tick addition:**
1. If no active goal → pop highest-priority pending goal → mark active
2. If active goal → evaluate progress via WM + NAR beliefs
3. If progress stalled → spawn subgoals / replan
4. If done → mark done, pop next
5. Persist goal stack to episodic memory

### 3.2 Metacognitive Critic
**File:** `src/agent/MetaCritic.ts` (new)

Runs every N background ticks (or on goal transition):
- Scores WM state against active goals (heuristic: belief support, contradiction count, uncertainty)
- Emits `agent:meta:evaluation` event with score + recommendations
- If score < threshold → injects replan note into next system prompt

### 3.3 Intrinsic Drives
**File:** `src/agent/Drives.ts` (new)

| Drive | Trigger | Action |
|-------|---------|--------|
| Curiosity | High-uncertainty concepts in attention | `nar_query` / `nar_reason` on that concept |
| Coherence | Contradiction detected in beliefs | `nar_reason` to resolve; spawn subgoal |
| Competence | Failed prediction (expected belief not derived) | Record in WM; adjust future strategy |

### 3.4 Autonomous WM Management
**File:** `src/agent/WMManager.ts` (new)

Background process (every 30s):
- Score each WM slot by: goal relevance, recency, access frequency
- Promote high-score slots (extend TTL, increase visibility in prompt)
- Demote/expire low-score slots
- Persist promoted slots to episodic memory

---

## 4. Tool Ecosystem Completion

| Tool | Status | Notes |
|------|--------|-------|
| `web_search` | ❌ | HTTP fetch + extract + summarize |
| `http_fetch` | ❌ | Raw GET/POST with timeout |
| `code_exec` | ❌ | WASM sandbox or subprocess with limits |
| `fs_read` / `fs_write` | ❌ | Scoped to workspace root |
| `rag_query` | ❌ | Embed → retrieve → rerank (uses existing episodic memory) |
| `delegate` | ❌ | Spawn sub-agent with scoped WM |
| `human_approval` | ❌ | Pause tool call, wait for confirmation |

**Implementation pattern:** Each as a NARS tool adapter in `src/nar/tools/adapters/external-tools.ts`.

---

## 5. Observability & Eval

| Item | Description |
|------|-------------|
| `agent:meta:evaluation` event | Metacritic score + recommendations |
| Goal lifecycle events | `goal:created/started/completed/failed` |
| Drive activation events | `drive:curiosity/coherence/competence` |
| Eval harness | `scripts/eval-autonomy.ts` — run agent on benchmark tasks, measure goal completion, truth convergence, tool efficiency |
| Dashboard | Optional: simple HTTP endpoint exposing `agent.getStats()` + goal stack + WM snapshot |

---

## 6. Testing Gaps (from TODO Phase 7)

| Missing Test | File |
|--------------|------|
| `chatWithHistory` with Narsese input | `tests/unit/agent/` |
| `chatWithHistory` with LM path + session history | `tests/unit/agent/` |
| `createNlInputTranslation` middleware | `tests/unit/agent/IOBridge.test.ts` |
| `createNarseseOutputHumanization` middleware | `tests/unit/agent/IOBridge.test.ts` |
| `createNarsTraceAnnotator` middleware | `tests/unit/agent/IOBridge.test.ts` |
| `JsonlSessionManager.restore()` with real files | `tests/unit/agent/SessionManager.test.ts` |
| `JsonlSessionManager.flushAll()` with write errors | `tests/unit/agent/SessionManager.test.ts` |
| `truncateForBudget` edge cases | `tests/unit/agent/chat-history.test.ts` |
| Agent working without NAR but with episodic memory | `tests/unit/agent/` |
| `buildTools()` with all tool sources combined | `tests/unit/agent/tools.test.ts` |
| GoalManager pursuit loop | `tests/unit/agent/GoalManager.test.ts` |
| MetaCritic evaluation | `tests/unit/agent/MetaCritic.test.ts` |
| Drives activation | `tests/unit/agent/Drives.test.ts` |
| WMManager promotion/demotion | `tests/unit/agent/WMManager.test.ts` |

---

## 7. Phased Execution Plan

### Phase A: Stabilize — ✅ DONE (this session)
- [x] Fix 1.1–1.5 (crash risks) — already fixed in existing code
- [x] Fix 2.1–2.6 (tech debt) — addressed across Iteration 5 + this session
- [x] Run full test suite, verify clean — 41 suites, 769 tests passing, typecheck 0 errors

### Phase B: Autonomy Core (3-5 days)
- [ ] `GoalManager` + persistence
- [ ] Background pursuit loop integration in `agent.ts`
- [ ] `MetaCritic` + event emission
- [ ] `Drives` + WM integration
- [ ] `WMManager` background promotion
- [ ] Tests for each

### Phase C: External Tools (2-3 days)
- [ ] `web_search`, `http_fetch`, `code_exec`, `fs_read/write`
- [ ] `rag_query` (leveraging episodic memory embeddings)
- [ ] `human_approval` middleware

### Phase D: Eval & Polish (2 days)
- [ ] `scripts/eval-autonomy.ts` with 10+ benchmark tasks
- [ ] Dashboard endpoint
- [ ] Documentation: `AUTONOMY.md` with architecture diagram
- [ ] Performance profiling (memory, latency under load)

---

## 8. Acceptance Criteria for "Autonomous"

1. **Goal persistence:** Agent restarts with previous goal stack intact
2. **Unprompted progress:** After `agent.start()`, goals advance without user messages
3. **Self-correction drives replan:** Metacritic detects stall → new subgoals created
4. **Curiosity yields knowledge:** High-uncertainty concepts → autonomous queries → new beliefs
5. **Eval passes:** ≥80% goal completion on benchmark suite within token budget

---

## 9. File Tree (Target)

```
src/agent/
├── agent.ts                    # + goal stack, drive integration
├── GoalManager.ts              # NEW
├── MetaCritic.ts               # NEW
├── Drives.ts                   # NEW
├── WMManager.ts                # NEW
├── presets.ts
├── options-schema.ts
├── config-bridge.ts
├── tools.ts                    # + external tool wiring
└── ...

src/nar/tools/adapters/
├── aisdk-adapter.ts
├── external-tools.ts           # NEW: web_search, http_fetch, code_exec, fs_*, rag_query
└── index.ts

scripts/
├── eval-autonomy.ts            # NEW
└── test-agent-integration.ts   # DELETED

tests/unit/agent/
├── GoalManager.test.ts         # NEW
├── MetaCritic.test.ts          # NEW
├── Drives.test.ts              # NEW
├── WMManager.test.ts           # NEW
└── ...existing...

AUTONOMY.md                     # NEW: architecture doc
```

---

## 10. Open Questions

1. **LLM as planner vs. NAR as planner?** Current: LM plans via tools. Alternative: NAR generates plans as compound goals.
2. **Drive weighting:** Fixed priorities or learned? Start fixed, expose config.
3. **Episodic memory as RAG index:** Current storage is JSONL per session. Need vector index for semantic retrieval — add `EpisodicMemory.buildVectorIndex()`.
4. **Multi-agent:** Delegate tool spawns child agent with forked WM. Resource limits?
5. **Human approval UX:** CLI vs. WebSocket vs. HTTP — standardize callback interface.

---

*Generated from gap analysis. Phase A (Stabilize) completed 2026-06-11. Typecheck: 0 errors. Tests: 41 suites, 769 passing.*