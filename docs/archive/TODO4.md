# TODO4.md — Post-M3 Remaining Work & Future Roadmap

## Status Summary

**All Major Milestones Through M3 Complete:**
| Milestone | Description | Status |
|-----------|-------------|--------|
| M0 | Green CI | ✅ |
| M1 | Self-test | ✅ |
| M1.5 | Cognitive scenarios | ✅ |
| M2 | Self-tune | ✅ |
| M2.5 | Imagination | ✅ |
| **M3** | **Autonomous Self-Improvement Loop** | ✅ **COMPLETE** |
| M3.5 | Cognitive Grounding & RL Parity | ✅ **COMPLETE** (in new architecture) |
| **M4** | **Production Loop (1hr unattended)** | ⏳ **NEXT** |
| M5 | Autonomous Self-Modification | ⏳ (post-M4) |

**New Architecture Status (Focus-Game-Reflex Kernel):**
| Slice | Component | Status |
|-------|-----------|--------|
| 1 | `Bag<T>`, `Focus`, `FocusBag` | ✅ |
| 2 | `GameFocus`, Gates (Perception/Action/Reward) | ✅ |
| 3 | `Reflex` interface, `TabularQReflex`, `EpsilonGreedyReflex`, `UCBReflex` | ✅ |
| 4 | `Negotiator` (NAL veto + LearningEvent feedback) | ✅ |
| 5 | `MetaGame`, `SelfMetaGame`, `MetaFocus` | ✅ |
| | **M3.5 GridWorld validation in new arch** | ✅ **PASS** (100% success after 200 episodes) |

---

## 🎯 Priority 1: M4 — Production Loop (1hr Unattended)

**Objective:** Run `nar run --auto` continuously for 1 hour on real workloads without human intervention.

### Required Work

| Task | Description | Files | Blockers |
|------|-------------|-------|----------|
| **M4.1** | Stability hardening for long-running loops | `nar/src/nar-execution.ts`, `nar/src/tools/adapters/external-tools.ts` | Memory leaks, worktree accumulation, drive oscillation |
| **M4.2** | Workload definition for unattended run | New: `scripts/m4-workload.ts` | Needs representative cognitive tasks |
| **M4.3** | Auto-approval mode for ApprovalManager | `core/src/ApprovalService.ts` | Safety: must be opt-in with clear boundaries |
| **M4.4** | Health monitoring + auto-restart | `nar/src/nar.ts`, `core/src/Agent.ts` | Detect stuck cycles, OOM, deadlocks |
| **M4.5** | Persistent state across restarts | `nar/src/nar.ts` (saveState/loadState) | ✅ Mostly done; verify full belief/goal persistence |
| **M4.6** | 1-hour integration test in CI | GitHub Actions / local script | Requires M4.1-4.5 |

### Acceptance Criteria
- [ ] `nar run --auto --duration 3600` completes without crash
- [ ] Memory usage stable (no unbounded growth)
- [ ] Worktrees cleaned up automatically
- [ ] Drives don't oscillate pathologically
- [ ] Self-report shows healthy cognitive state throughout
- [ ] At least one meaningful self-improvement occurs (schema promotion, capability added, or knob tuned)

---

## 🎯 Priority 2: M3 End-to-End Sabotage→Auto-Fix Litmus Test

**Objective:** Demonstrate the complete autonomous repair loop on a real bug.

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| **2.1** | Identify realistic bug matching fix patterns | `tests/nar/integration/self-improvement-litmus.test.ts` (`.skip` test) | Deferred |
| **2.2** | Configure ApprovalManager auto-approval for testing | `core/src/ApprovalService.ts` | Deferred |
| **2.3** | Ensure shadow full-CI runs reliably in test env | `nar/src/tools/adapters/external-tools.ts` | ✅ Done |
| **2.4** | Enable `.skip` litmus test and verify | `tests/nar/integration/self-improvement-litmus.test.ts` | Blocked on 2.1, 2.2 |

**Fix Patterns Available:** `null_check`, `type_annotation`, `boundary_check`, `assertion`, `undefined_check`, `empty_check`, `division_by_zero`, `async_handling`

---

## 🎯 Priority 3: RLFP Intrinsic Reward Policy Validation

**Objective:** Prove intrinsic rewards (derivation depth reduction, self-model accuracy, contradiction reduction) improve policy over extrinsic-only.

| Task | Description | Files |
|------|-------------|-------|
| **3.1** | Design A/B experiment: extrinsic vs extrinsic+intrinsic | `nar/src/rlfp/RLFPLearner.ts`, new experiment script |
| **3.2** | Run multi-seed comparison on benchmark tasks | `scripts/rlfp-intrinsic-ab.ts` |
| **3.3** | Document results in `docs/tech/rlfp-intrinsic.md` | New file |

---

## 🎯 Priority 4: Phase 4 — Full Observability

**Objective:** Production-grade monitoring and visualization.

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| **4.1** | Prometheus metrics endpoint (`GET /metrics`) | `core/src/StatsManager.ts`, new HTTP route | Deferred |
| **4.2** | WebSocket cognitive stream (`WS /cognitive-stream`) | `core/src/protocol.ts`, `api/src/WebSocketAdapter.ts` | Deferred |
| **4.3** | CLI `.self-report` command | `src/bin/self-report.ts` | ✅ **DONE** |
| **4.4** | Grafana dashboard JSON | New: `grafana/senars-dashboard.json` | Deferred |
| **4.5** | Real-time UI integration | `@senars/ui` package | Deferred |

---

## 🎯 Priority 5: Drive-Stimuli Batching (Optional Optimization)

**Objective:** Reduce event overhead by batching drive stimuli per cycle.

| Task | Description | Files | Notes |
|------|-------------|-------|-------|
| **5.1** | Add `DriveManager.stimulateBatch()` API | `nar/src/drives/manager.ts` | Must be opt-in |
| **5.2** | Update `nar-execution.ts` to use batching | `nar/src/nar-execution.ts` | Preserve immediate-apply contract |
| **5.3** | Add tests for batched vs immediate parity | `tests/nar/unit/drive-manager.test.ts` | Required |

---

## 🎯 Priority 6: Whole-Repo Typecheck Cleanup

**Objective:** Reduce remaining 107 typecheck errors (mostly in test/e2e/UI code).

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| **6.1** | Fix `tests/e2e` union narrowing issues | `tests/e2e/*.test.ts` | 107 remaining |
| **6.2** | Fix `ui/src/server` missing modules | `ui/src/server/index.ts` | Vendored SpaceGraphJS |
| **6.3** | Fix `tests/conversational` AgentOptions drift | `tests/conversational/*.test.ts` | |
| **6.4** | Fix `tests/nar/integration` remaining nits | `tests/nar/integration/*.test.ts` | |

> **Note:** `nar` package itself is **100% clean**. CLI tooling (`src/cli`, `src/bin`, `src/api`) excluded from root tsconfig per user direction.

---

## 🎯 Priority 7: Beliefs/Goals Persistence Robustness

**Objective:** Full round-trip persistence for all task types including negated terms.

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| **7.1** | Fix negation-as-compound-operand parsing | `nar/src/terms/narsese.peggy` | Pre-existing gap |
| **7.2** | Ensure negated derived beliefs persist/load correctly | `nar/src/nar.ts` (saveState/loadState) | Partial |
| **7.3** | Add comprehensive persistence integration test | `tests/nar/unit/state-persistence.test.ts` | ✅ Base exists |

---

## 🎯 Priority 8: MeTTa Integration in Focus-Game-Reflex Architecture

**Objective:** Run MeTTa as a `Game`/`Reflex` within the new kernel.

| Task | Description | Files |
|------|-------------|-------|
| **8.1** | Implement `MeTTaGame` wrapping MeTTa runtime | `nar/src/game/MeTTaGame.ts` |
| **8.2** | Implement `MeTTaReflex` for pattern matching/rewrite | `nar/src/reflex/MeTTaReflex.ts` |
| **8.3** | Bind MeTTa space as `Focus.memory` concept source | `nar/src/focus/Focus.ts` |
| **8.4** | Cross-engine negotiation (NAL ↔ MeTTa) | `nar/src/reflex/Negotiator.ts` |

---

## 🎯 Priority 9: Multi-Focus Concurrency

**Objective:** True parallel execution of multiple `Focus` vessels.

| Task | Description | Files | Notes |
|------|-------------|-------|-------|
| **9.1** | Cooperative scheduler (sample N Focus per cycle) | `nar/src/focus/FocusBag.ts` | Single-threaded first |
| **9.2** | Worker-thread isolation for Focus | New: `nar/src/focus/WorkerFocus.ts` | Post-M4 |
| **9.3** | Shared concept memory across Focus | `nar/src/memory/memory.ts` | Global + local layers |

---

## 🎯 Priority 10: SelfMetaGame Safety Verification

**Objective:** Formal verification of SelfMetaGame action space before enabling code modification.

| Task | Description | Files |
|------|-------------|-------|
| **10.1** | Define allowed action schema (knobs, weights, reflex toggles) | `nar/src/game/SelfMetaGame.ts` |
| **10.2** | Prove no path to code-modifying tools from SelfMetaGame | Architecture review |
| **10.3** | Add runtime guard: reject codemod/shadow tools from MetaFocus | `nar/src/focus/MetaFocus.ts` |
| **10.4** | Document safety boundary in `docs/tech/self-meta-safety.md` | New file |

---

## 📋 Deferred / Nice-to-Have

| Item | Priority | Notes |
|------|----------|-------|
| Knowledge Book format (`.sbook` YAML) | Low | Priority 5 in README roadmap |
| Framework adapters (Express, React, LangChain) | Low | Priority 2 in README roadmap |
| Reasoning trace export (JSON-LD, GraphML, Mermaid) | Low | Priority 4 in README roadmap |
| RLFP annotation web UI | Low | Priority 4 in README roadmap |
| Strategy A/B testing framework | Low | Priority 4 in README roadmap |
| Personal Logic Vault flagship demo | Low | Priority 6 in README roadmap |

---

## 📁 File Map for Active Development

```
nar/src/
  bag/
    Bag.ts, index.ts                    # ✅ PriorityBag<T> (target interface)
  focus/
    Focus.ts, FocusBag.ts, GameFocus.ts, MetaFocus.ts, index.ts  # ✅ All slices
  gates/
    PerceptionGate.ts, ActionGate.ts, RewardGate.ts, index.ts    # ✅
  reflex/
    Reflex.ts, TabularQReflex.ts, EpsilonGreedyReflex.ts,        # ✅
    UCBReflex.ts, Negotiator.ts, index.ts
  game/
    Game.ts, GridWorldGame.ts, GridWorldEnv.ts,                  # ✅
    MetaGame.ts, SelfMetaGame.ts, index.ts
  rules/
    meta-rules.ts, processor.ts, types.ts                        # ✅ Meta-rules animated
  tools/
    adapters/external-tools.ts                                   # ✅ 8 self-tools + shadow CI
  rlfp/
    RLFPLearner.ts                                               # ✅ Intrinsic rewards
  nar-execution.ts                                               # ✅ Dispatch + observability
  nar.ts                                                         # ✅ Factory fixed, self-tools registered

tests/nar/
  rl/
    contract/                    # ✅ 36 tests (belief/goal/reward/no-bypass)
    environments/RLEnvironments.ts # ✅ Bandit, GridWorld, NonStationary, MemoryPressure
    baselines/                   # ✅ EpsilonGreedy, UCB, QLearning, SARSA
    adapters/adapters.ts         # ✅ Perception, Action, Reward, QBeliefStore, NativeAgents
    parity/                      # ✅ All levels + stress + cognitive advantage
  focus-game-reflex/
    kernel-slice1.test.ts        # ✅ Focus, FocusBag, GameFocus, Gates
    m35-gridworld-validation.test.ts  # ✅ GridWorld parity in new arch
    meta-game-sandbox.test.ts    # ✅ SelfMetaGame (16 tests)
  integration/
    self-improvement-litmus.test.ts  # ✅ Wiring verified, .skip for E2E sabotage
  unit/
    state-persistence.test.ts    # ✅ Drives persist, beliefs/goals work
    controller-accessors.test.ts # ✅ getStrategy/getWorktreePath
    factory.test.ts              # ✅ Feature flags forwarded
    nar-execution.test.ts        # ✅ Dispatch + meta-goal injection

scripts/
  rl-parity.ts                   # ✅ CLI runner (bandit/nonstationary/gridworld)
  self-improve-demo.ts           # ✅ Autonomous loop demo
  self-report.ts                 # ✅ CLI cognitive state report

docs/tech/
  cognitive-grounding.md         # ✅ Contracts spec
  rl-parity.md                   # ✅ Experimental protocol
  functionality.md               # ✅ Complete architecture spec
  deep-dive.md                   # ✅ Implementation details
```

---

## 🚀 Recommended Execution Order

1. **M4.1-4.3** — Stability, workload, auto-approval (enables M4)
2. **M4.4-4.6** — Monitoring, persistence verification, 1hr test
3. **2.1-2.4** — Sabotage litmus test (can parallelize with M4)
4. **3.1-3.3** — RLFP intrinsic reward A/B (independent)
5. **4.1-4.2** — Prometheus + WS streaming (post-M4)
6. **8.1-8.4** — MeTTa in new kernel (post-M4)
7. **9.1-9.3** — Multi-Focus concurrency (post-M4)
8. **10.1-10.4** — SelfMetaGame safety (before M5)
9. **5.1-5.3** — Drive batching (optimization, anytime)
10. **6.1-6.4** — Typecheck cleanup (ongoing)
11. **7.1-7.3** — Persistence robustness (ongoing)

---

## 🔬 Scientific Validation Gates (from TODO2.md — Still Active)

Before claiming any cognitive advantage or enabling M5 self-modification:

1. **Defect Audit** — All 19 checks pass for any negative result
2. **Multi-seed** — ≥10 seeds for standard validation, ≥20 for claims
3. **No-Bypass** — Instrumented tests proving no hidden paths
4. **Resource Parity** — Match compute budgets in comparisons
5. **Trace Causality** — Explanations from actual derivation traces, not post-hoc

---

## 📜 Milestone Definition of Done (Updated)

| Milestone | Demo Script | Status |
|-----------|-------------|--------|
| M0: Green CI | `pnpm test && pnpm typecheck` | ✅ |
| M1: Self-test | `nar test-loop --once` | ✅ |
| M1.5: Cognitive scenarios | `nar scenario-gen --seed "contradictory sensors" --count 5` | ✅ |
| M2: Self-tune | `nar tune --iterations 10` | ✅ |
| M2.5: Imagination | `nar imagine --seed 42 --profile induction` | ✅ |
| **M3: Self-improve** | `pnpm exec tsx scripts/self-improve-demo.ts` | ✅ **COMPLETE** |
| M3.5: Cognitive Grounding | `pnpm exec tsx scripts/rl-parity.ts --env gridworld --mode native --seeds 5` | ✅ **COMPLETE** (new arch) |
| **M4: Production loop** | `nar run --auto --duration 3600` | ⏳ **NEXT** |
| M5: Autonomous Self-Modification | `nar run --auto` + sabotage→fix verified | ⏳ (post-M4) |

---

*Generated 2026-09-08 from TODO.md, TODO2.md, TODO3.md consolidation*