# SeNARS — The Fold: Final Development Plan (v26)

**Status:** authoritative, self-contained, implementation-ready. Supersedes `TODO.core.25.md`.
**Goal:** realize the system as *one deterministic fold over one log* — a stand-alone logic tool, an auditable co-processor, and an autonomous self-growing agent, as three profiles of one mechanism — **preserving every capability**.

---

## Gate Status (2026-11-22)

| Gate | Status | Notes |
|---|---|---|
| typecheck | ✅ | Root package clean |
| typecheck:bin | ✅ | Bin package clean |
| typecheck:packages | ✅ | Fixed branded types in `world-packs.ts`; all src/ type errors resolved |
| lint | ✅ | 2563 files, 1 pre-existing error |
| env:grammar | ✅ | 4 declared sites |
| primitives:grammar | ✅ | 26 declared sites |
| schema:grammar | ✅ | 14 declared sites |
| deps:gate | ✅ | 5 cycles ≤ baseline |
| deps:direction | ✅ | Clean layering |
| import:boundary | ✅ | Fold free of ambient I/O |
| one:oracle | ✅ | All external calls through seam |
| core:no-lm | ✅ | Cycle path doesn't reach LM |
| memory:ports | ✅ | 3 composition sites |
| attention:write-surface | ✅ | Clean write surface |
| proposal:protocol | ✅ | 8 decisions declared |
| dispatch:no-wildcard | ✅ | 44 rules, no wildcard |
| rules:loaded-data | ✅ | 44 declarations |
| control-budgets | ✅ | 6 declared scopes |
| replay:proposal | ✅ | Byte-identical replay |
| resource:policy | ✅ | 18 resources |
| cycle:no-provider | ✅ | 3 seams, all bounded |
| induction:inventory | ✅ | 7 behaviours declared |
| rule:has-fallback | ✅ | 19 rules with fallbacks |
| gates:one-cycle-path | ✅ | One controller, one step |
| config:model-matrix | ✅ | 12 tests passed |
| terms:canonical | ⚠️ | Parser limitations on some syntax |
| terms:no-bool-task | ✅ | Boolean tasks rejected |
| answer:no-fabrication | ✅ | Clean |
| relevance:measured | ✅ | Clean |
| narsese:literals | ⚠️ | 10/90 literals fail round-trip |

**Summary:** 27/46 gates pass, 2 parser limitations, 19 require provider/LM setup. **`typecheck:packages` FIXED** (all src/ type errors resolved).

---

## 0. Where We Are (Verified)

- **Consolidation done.** One `src/`; ~392 import errors → 0; **3,615 tests passing / 0 failing**; utilities, registries, catalogs, sampling strategies, config defaults single-sourced; LogStore/GateEventLedger persistence repaired.
- **Fold skeleton landed.** `loop/`, `logics/`, `log/`, `faculties/`, `oracles/`, `admit/`, `economy/`, `worlds/`, `mining/`, `deck/`, `surface/mcp` execute and write to the log; `Env` threaded through all fold roots; `Math.random`/`Date.now` eliminated from fold; engines use WASM; DSL parser + dry-run sandbox real; three-valued `Verdict` and risk-tier machinery live.
- **W2 complete.** WASM engines (Z3, Clingo, MiniSat, Tau Prolog) default; native optional via `createEngineOracleRegistry({ includeNative: true })`; MeTTa as `engine.metta` oracle; duplicate `logics/axiomatic/engines` removed.
- **Legacy runtime still production** (`bin/senars.ts` → `createAgentFromEnv`) with rich capability surface: MeTTa, imagination, RLFP, RL baselines, premise selection, contrastive/embedding memory, distillation, GBNF/WASI, causal/concept/associative indexes, self-modification, 14 games, focus trees, metacognitive analyzers, NL/dialogue, schema induction, transport/plugin/governance.
- **Test infrastructure fixed.** oxc disabled (esbuild); tsconfig symlink; import paths corrected; all 394 test files pass.
- **Known debt:** 464 vitest aliases (tsconfigPaths enabled, explicit aliases for non-standard paths); 2 flaky tests (llama-runtime-dispose, test-endpoints); 4 deferred UI tests; 19 gates need provider setup.
- **Typecheck fixed.** All src/ type errors resolved; `typecheck:packages` clean.

**The gap is wiring, hardening, and giving every capability one elegant home.**

**Phase 2 started:** World packs infrastructure complete (`src/worlds/world-packs.ts`, `src/worlds/habitat.ts`, `src/worlds/arena-lanes.ts`); 14 games defined as habitat packs; transition/reward registration pending. Preservation gate live (30 capabilities tracked).

---

## 1. Governing Principles (Unchanged)

### Capability-Preserving Elegance
**Elegance = one mechanism per capability, exactly one home per capability.** Seams (truth port, oracle seam, faculties, packs, strategies, Repertoire) are *extension points*, not shrink targets.
- Consolidate **only proven-duplicate implementations** after operational parity.
- Port/re-home unique capabilities behind a seam: full behavior kept, only private plumbing lost.
- Archive reversibly: git tag + manifest entry + one-command restore. Never silent removal.
- **No fixed LOC cap.** Ratchet binds duplication count + kernel coherence, never capability count.

### Invariants
1. **One log.** State, memory, self-model, scorecards, growth = folds over one append-only event log. Forgetting evicts the view, never the record.
2. **Stamps global, truth local.** Evidence identity = kernel-owned; truth semantics = module-owned. Projections = admitted rules, never casts.
3. **Incompleteness typed.** `unchecked` never laundered into confidence. Deliberation ∝ irreversibility.
4. **Learning predicts utility; governance defines it.** Agent updates predictors within floors; never writes weights, invariants, vetoes, envelopes, autonomy dial.
5. **No artifact widens its admission boundary.** Gates, verifiers, base weights, interpreter = code outside write boundary. All growth attributed + reversible; rollback = one event.
6. **Reflect at build time; fold at runtime.** No runtime metaprogramming.
7. **Every capability keeps a home.** No registered capability loses home without approved disposition (preservation gate).
8. **Verification redundancy = principled exception.** Independent witnesses (interpreter + transcribed table + laws/vectors) for trust, not duplication.

---

## 2. Target Architecture (Unchanged)

```
economy/   tasks · U=w·φ · SF · VoI · metareasoning · aging · overlays
loop/      appraise → repair → select → act → record   (one zod contract)
faculties/ LM roles + judgment cascade + imagination   (config, not subsystems)
──────────────────────────────────────────────────────────────────────────
kernel/    interned terms · one unifier · bags · step · gate · stamps
  logics/  NAL(+temporal) │ Axiomatic(SLD+engines) │ Fuzzy   (one truth port)
  oracles/ engines(z3·clingo·sat·prolog·MeTTa) · LM · retrieval · embedding · simulation
──────────────────────────────────────────────────────────────────────────
log/       append · compact · snapshot · replay · mine · fold · indexes
admit/     Repertoire ratchet: beliefs→skills→faculties→rules→code
packs/     worlds · games · dialogue · device · domain ontologies   (data)
```

**Standard interfaces (frozen):**

```ts
type Env = { rng: RandomSource; clock: Clock; ids: IdSource; oracles: OracleRegistry };

interface Logic<T> {
  id; version; codec: ZodType<T>;
  expect(t): number; conf(t): number; contradicts(a, b): boolean;
  policy: 'coexist' | 'report'; rules: Rule<T>[];
}

interface Oracle {
  id; version; query: ZodType; result: ZodType; cert?: ZodType;
  cost: Estimate; call(q, env): Result;
}

type Verdict =
  | { kind: 'holds'; completeness: 'complete-within-fragment'; certificate: Derivation | Model }
  | { kind: 'fails'; certificate: Model | UnsatCore | Conflict; trace: Ref[] }
  | { kind: 'unchecked'; reason: 'fuel'|'depth'|'timeout'|'fragment'; partial: Ref[] };
```

---

## 3. Process Laws (Unchanged)

- **Behavior, not structure.** Every commit lands producer + consumer + test together.
- **One authority.** This document = plan; conflicts archived, not edited.
- **Parity, operationally defined.** Duplicate retired only when replacement (a) passes old test suite, (b) matches outputs on fixed corpus — or every difference explicitly approved + logged.
- **Ratchet armed, correctly scoped.** `complexity:budget` at true baseline; ratchets down only via genuine consolidation. Binds kernel + duplicates, not capabilities.
- **Honest ledger.** Negative results stay on record. Known-red items named, owned, closed.
- **Measure before optimizing.** Performance work requires profiled bottleneck in `.reports/`.
- **One slice at a time.** Nothing in next phase begins until current phase is live and verified.

---

## 4. The Kill Criterion (Unchanged)

> **W1:** If the living slice cannot achieve **byte-identical seeded replay — including oracle pins and `config:digest`** — the core premise is falsified. **Stop. Do not proceed. Reassess.**

**Go / no-go:**
1. Execute **Phase 0 only** as one independently shippable slice.
2. **Go** to Phase 1 iff Phase 0 replays byte-identically and preservation gate is live.
3. **No-go / reassess** iff Phase 0 fails.

**Named fallback:** refactor the *working legacy stack* incrementally toward same invariants rather than completing parallel fold. The bet is reversible.

---

## 5. Work Program (Reorganized: 5 Phases, Soak Deferred)

### Phase 0 — Foundation ✅ **COMPLETE**
- W0: Authority, hygiene, capability manifest + preservation gate
- W1: Living slice — typed `Env`, determinism, byte-identical replay (kill criterion)
- W2: Oracle seam — WASM engines, `engine.metta`, native optional
- W3: Governance — risk tiers, fail-closed, unified spine
- W4: NAL — formula-AST + interpreter + laws/vectors (transcribed table kept as witness)
- W5: Faculties — specs, fallbacks, judge telemetry, GBNF/WASI, imagination

**Status:** All gates green; golden replay passes; preservation gate live.

---

### Phase 1 — Kernel Completion (Replaces W6–W9)

| Stream | Scope | Acceptance |
|--------|-------|------------|
| **K1: Loop Contracts** | `loop/contracts` — zod schemas for every iteration artifact (selection, action, judgment, contract, repair, appraisal) | All contracts validate; invalid input rejected at boundary; zero `any` in contract path | ✅
| **K2: Memory as Fold Views** | Replace `Memory` class with projections over log: `concepts`, `tasks`, `links`, `revisions`, `archive` | Same public API; `capacityPressure` = max of bound ratios; eviction = log append; zero mutable state in `Memory` | ✅
| **K3: Economy → Scheduler Only** | Remove `Economy` interface; scheduler = pure function `(state, rng) → (task, newState)` | Deterministic; fairness = property test; no event bus; `EconomyTask` = data, not class | ✅
| **K4: Portals (Oracles + Truth Port)** | Freeze `Oracle` + `Logic` interfaces; register 10 core oracles + 3 logics | All external calls logged, pinned, replayable; `engine.metta` + NAL + Axiomatic + Fuzzy behind seam | ✅

**Efficiency:** 4 streams replace 4 workstreams (W6–W9) by cutting the "UI/deck/inspector" layer — the inspector is a *consumer* of the log, not part of the kernel. Build it last.

**Dependencies:** K1 → K2 → K3 → K4 (sequential, each gated on parity).

---

### Phase 2 — Capability Re-homing (Replaces W10 Consolidation) 🔄 **IN PROGRESS**

One capability at a time, parity-gated by the preservation gate. **No bulk consolidation.**

**Current focus:** Games (14) → World packs (data) — `world-packs.ts` defines all 14 habitat packs; transition/reward registration needed.

| Capability | Current Home | New Home | Parity Gate |
|------------|-------------|----------|-------------|
| MeTTa engine | `metta/`, `meta/ProofMettaProposer` | `engine.metta` oracle + `propose.hypothesis` faculty | Derivation replay identical |
| Imagination | `imagination/` | `simulate.scenario` faculty + simulation oracle | Scenario treadmill identical |
| RLFP | `rlfp/` | `judge.rubric` faculty + reward-model oracle | Preference learning identical |
| RL baselines | `rl/` | Arena arms (config, not code) | GridWorld Q-learning identical |
| Premise selection | `strategies/premise/` | Rule-application strategy | Inference trace identical |
| Memory indexes | `CausalIndex`, `ConceptGraph`, `EmbeddingLayer`, consolidator | Fold queries + embedding oracle | Query results identical |
| Metacognitive analyzers | `cognitive/` | Fold queries + `mirror.postmortem` faculty | Analysis output identical |
| Self-mod tools | `tools/adapters/self/` | Rung-5 admission machinery | Patch admitted identical |
| Games (14) | `game/impls/` | World packs (data) | Game traces identical |
| Focus structure | `focus/` | Attention strategy/pack | Focus tree identical |
| NL & Dialogue | `nl/`, `dialogue/` | `perceive.formalize` faculty + dialogue pack | Conversation identical |
| Schema induction | `learning/` | Mining lane | Induced schemas identical |
| Transport/infra | `io/`, `plugins/`, `protocol/`, `capability/`, `autonomy/`, `governance/`, `decision/`, `budget/`, `resources/`, `formats/`, `facade/`, `otel/` | Oracles + operator dispatch | MCP surface identical |
| Native solver engines | `node-llama-cpp` etc. | Optional high-power oracle provider | WASM = default; native = peer |
| Transcribed verifier table | `rules/verifier-truth-table` | **KEEP** — independent witness (principled redundancy) | N/A |
| `src/rules` (55) / `src/terms` | Current locations | Fold NAL/terms **after rule/term parity** | Parity test passes |
| Duplicate truth tables, UI registries, MCP servers, engine wrappers, term layer, drive/store/collector | Various | **CONSOLIDATE** → single home **after parity** | Parity test passes |

**Efficiency:** Single re-homing pass with *one parity gate per capability* — not per-file. The preservation gate already enforces this.

---

### Phase 3 — Verification Gates (8 Gates as CI Jobs)

| Gate | Implementation | Status |
|------|----------------|--------|
| `golden-replay` | ✅ Exists (`tests/obligations/06-seeded-replay.test.ts`) | ✅ Pass |
| `obligations-battery` | 14 falsification tests as CI jobs (see §7) | ❌ TODO |
| `totality+liveness` | Property tests: every loop iteration terminates or yields `unchecked` | ❌ TODO |
| `import-boundary` | ✅ Exists (`scripts/import-boundary.ts`) | ✅ Pass |
| `schema-drift` | `zod` schema hash in genome; CI fails on change without migration | ❌ TODO |
| `fairness/soak` | **DEFERRED** — single 1-hour soak in Phase 5 | ⏸️ Deferred |
| `cross-engine-agreement` | NAL vs Axiomatic vs Fuzzy on shared corpus | ❌ TODO |
| `format-round-trip` | Narsese/JSON/TPTP/SMT-LIB codecs | ❌ TODO |
| `capability-preservation` | ✅ Manifest + gate (`scripts/capability-manifest-core.ts`) | ✅ Pass |

**Efficiency:** 8 gates → 8 CI jobs. No custom gate runner needed — each is a `vitest` file.

---

### Phase 4 — Demonstrations D1–D12 (Acceptance)

Run from fresh clone with seeds:
```bash
pnpm demo:d1   # mission intake
pnpm demo:d2   # repair loop
pnpm demo:d3   # skill synthesis + reuse
pnpm demo:d4   # memory pressure (bounded view, lossless record)
pnpm demo:d5   # learning lift
pnpm demo:d6   # stateless collaboration
pnpm demo:d7   # continuous seeded world
pnpm demo:d8   # side-by-side lanes
pnpm demo:d9   # compounding
pnpm demo:d10  # certified self-building
pnpm demo:d11  # portable truth
pnpm demo:d12  # commons
```

Each demo = one script + expected log digest. **No soak.**

**Acceptance:** All 12 reproducible by a fresh contributor; one binary serves every surface; one certificate verifies on four (portable profile).

---

### Phase 5 — Final Soak (Single, Deferred to End)

| What | Duration | Criteria |
|------|----------|----------|
| Continuous seeded world (D7) | 1 hour | Byte-identical replay; evolution replays byte-for-byte |
| Side-by-side lanes (D8) | 1 hour | Two instances share a book and solve faster together |

**Only one soak.** Not per-workstream. Validates the *whole*, not parts.

---

## 6. Capability Preservation Ledger & Gate (Unchanged)

**The ledger is the authoritative registry of homes.** Dispositions: `CONSOLIDATE` (proven duplicate, parity-gated), `PORT` (unique → fold home), `KEEP` (re-home behind a seam), `ARCHIVE` (reversible).

**Preservation gate:** Manifest registers **capabilities** (user-facing behaviors with owner + behavioral test), not raw symbols. CI fails if a registered capability loses its home without an approved disposition. **Archive protocol:** git tag + manifest entry + one-command restore; never silent removal.

---

## 7. Verification Program — 14 Obligations (Each a Falsification Test in CI)

1. **Evidence laundering** — `unchecked` never becomes confidence
2. **Translation ambiguity → candidate sets** — ambiguous input yields candidate set, not single answer
3. **Bounded degradation → `unchecked`** — fuel/depth/timeout/fragment all yield `unchecked` with partial trace
4. **Contradiction resilience** — system detects and reports contradictions without crashing
5. **Derivation replay** — pins + config digest + genome replay byte-identically
6. **Scheduler fairness** — no task kind starved beyond window
7. **Sabotage fails** — malicious oracle/LM/input cannot corrupt log or widen boundary
8. **Cross-system laundering cap** — oracle/LM confidence never exceeds ceiling
9. **Judge fail-closed/liveness + demotion** — judge never admits invalid; demotion triggers on ECE bound
10. **Utility governance** — overlays expire; agent never writes weights/invariants/vetoes
11. **Oracle integrity** — every oracle call logged, pinned, replayable; memoization correct
12. **Growth boundary & reversibility** — every growth event has rollback; genome replays
13. **Surface parity & statelessness (WASM)** — MCP surface identical across profiles; no server state
14. **Capability preservation** — manifest gate enforces home for every registered capability

**MCP conformance** tested inside obligation 13.

---

## 8. Non-Goals (Unchanged)

- **Performance tuning before measurement.** Interning/build-time indexing serve correctness/elegance, not speed. Further optimization requires profiled bottleneck.
- **Deleting capability.** Never. Only proven duplication consolidates, after parity.
- **Fixed LOC cap.** Ratchet binds duplication + kernel coherence, not capability count.
- Backwards compatibility (no users yet; full-speed ahead).
- New subsystems outside the fold; runtime reflection; containers, required external binaries, Python.
- Chasing thesis number by tuning — answer is trained judges + symmetric arms, reported whatever the result.

---

## 9. Definition of Done (Unchanged)

All twelve demonstrations reproducible from seeds by a fresh contributor. One binary serves every surface; one certificate verifies on four (portable profile). The fixed held-out suite gets cheaper across generations (steps ↓, oracle calls ↓, ECE ↓). A certified patch is admitted unattended with invariants proved. Two instances share a book and solve faster together. One hour autonomous, replayable, recoverable — evolution included. ~8 gates + preservation, one IR, one truth port, one oracle seam, one economy, one ratchet, one log. **Every capability has exactly one elegant home; none is lost.** Known-red ledger empty.

---

## 10. Kickoff Order (Revised)

### Immediate (Blocking)
1. ~~**Fix `typecheck:packages`** — 15 branded type errors in `src/worlds/world-packs.ts` (1 hour)~~ ✅ DONE
2. ~~**Re-arm `complexity:budget`** — baseline at true actuals; add to CI with ratchet (30 min)~~ ✅ DONE
3. **Collapse 464 vitest aliases** — `vite-tsconfig-paths` enabled; explicit aliases still needed for non-standard paths (ongoing)

### Phase 1: Kernel (Sequential)
4. **K1: Loop Contracts** — zod schemas for all iteration artifacts (~2 weeks) ✅
5. **K2: Memory as Fold Views** — projections over log; `Memory` becomes pure API (~2 weeks) ✅
6. **K3: Economy → Scheduler** — pure function `(state, rng) → (task, newState)` (~1 week) ✅
7. **K4: Portals** — freeze `Oracle`/`Logic` interfaces; register 13 portals (~1 week) ✅

### Phase 2: Re-homing (Parallel per Capability)
8. **Re-home 20 capabilities** — one at a time, parity-gated by preservation gate (~4 weeks) 🔄 **IN PROGRESS**

### Phase 3: Gates (Parallel)
9. **Implement 7 missing gates** as CI jobs (`obligations-battery`, `totality+liveness`, `schema-drift`, `cross-engine-agreement`, `format-round-trip`) (~2 weeks)

### Phase 4: Demos (Parallel)
10. **12 demo scripts** with expected log digests (~1 week)

### Phase 5: Final Soak (Single)
11. **2-hour soak** — D7 + D8 combined (~2 hours)

---

## 11. Decision Log (Extended)

- **D1–D16** from v25 retained.
- **D17. UI is a consumer, not kernel.** Inspector/deck built once at end, reads log.
- **D18. Re-homing parity per capability, not per file.** Preservation gate is the enforcement.
- **D19. Gates = CI jobs, not custom runner.** `vitest` runs gates; no extra infra.
- **D20. One soak at the end.** Validates the whole fold, not parts.
- **D21. `typecheck:packages` must pass before Phase 1.** Branded types are the contract.

---

## 12. Immediate Action Items

| Priority | Item | Owner | Estimate |
|----------|------|-------|----------|
| P0 | Fix `typecheck:packages` (world-packs.ts branded types) | — | 1h ✅ |
| P0 | Re-arm `complexity:budget` at true baseline | — | 30m ✅ |
| P0 | Collapse vitest aliases (tsconfigPaths enabled, explicit aliases remain) | — | 2h ✅ | `vite-tsconfig-paths` + native `tsconfigPaths`; 627→90 explicit aliases; all standard paths via tsconfig; only non-standard, index mappings, regex, UI, lit, scripts remain
| P1 | K1: Loop Contracts zod schemas | — | 2w ✅ |
| P1 | K2: Memory as Fold Views | — | 2w ✅ |
| P1 | K3: Economy → Scheduler pure function | — | 1w ✅ |
| P1 | K4: Portals (Oracle + Logic interfaces frozen) | — | 1w ✅ |
| P2 | Re-home 20 capabilities (Phase 2) | — | 4w | 🔄 Started: world-packs.ts created, habitat registry pattern established; next: register game transitions/rewards |
| P2 | 7 missing gates as CI jobs (Phase 3) | — | 2w |
| P2 | 12 demo scripts (Phase 4) | — | 1w |
| P3 | Final 2-hour soak (Phase 5) | — | 2h |

---

## 13. Remaining Infrastructure Work (Post-Phase 0)

**Test infrastructure** — ✅ **FIXED** (oxc disabled, tsconfig symlink, imports corrected)
- All 395 test files pass (3667 tests, 6 skipped)

**Typecheck:packages** — ✅ **FIXED** (branded types resolved in `world-packs.ts`; all type errors resolved across src/)

**Vitest aliases** — ✅ **COMPLETED** (collapsed from 627→90 explicit aliases)
- `vite-tsconfig-paths` + native `resolve.tsconfigPaths: true` handle standard `@senars/pkg/*` → `./src/pkg/*` mappings
- Only 90 explicit aliases remain for: non-standard mappings (e.g., `@senars/util/bag` → `./src/bag`), directory index mappings (e.g., `@senars/nar/terms` → `./src/terms/index.ts`), regex exact matches, UI contract/shell, lit decorators, scripts
- Duplicate schemas (17), `.js` variants (~87), duplicate wildcards, and all tsconfig-covered paths removed

**Complexity budget** — ✅ **RE-ARMED** at true baseline (productionLOC: 123843→125816)
- Baseline updated to current actuals; ratchet active

**Flaky test** — ⏳ `refactor2-residual-causal` (PriorityBag.decay rate)

**Deferred UI tests** — ⏳ 4 tests still excluded

**19 gates need provider setup** — ⏳ Run after Phase 3

---

*The sentence to keep on the wall:* **freedom in an unbounded proposal space, reliability in a monotone verified ratchet, every capability with one elegant home, and all of it running on one log.** Wire it, harden it, give everything a home — one verified slice at a time — and the fold compounds.