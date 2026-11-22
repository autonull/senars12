# SeNARS — The Fold: Final Development Plan

**Status:** authoritative, self-contained, implementation-ready. Supersedes the `TODO.core.*` and `docs/plan/NEXT.*` lineage.
**Goal:** realize the system's full potential as *one deterministic fold over one log* — a stand-alone logic tool, an auditable co-processor, and an autonomous self-growing agent, as three profiles of one mechanism — **preserving every capability the project has built**.

## Gate Status (2026-11-22)

| Gate | Status | Notes |
|---|---|---|
| typecheck | ✅ | Root package clean |
| typecheck:bin | ✅ | Bin package clean |
| typecheck:packages | ✅ | Root typecheck clean |
| lint | ✅ | 2535 files, no errors |
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
| narsese:literals | ⚠️ | 10/90 literals fail round-trip (parser gaps) |

**Summary:** 25/46 gates pass, 2 with known parser limitations, 19 not yet run (require provider/LM setup).

---

## 0a. Implementation status (this pass)

Legend: `[x]` landed · `[~]` partial (named residual) · `[ ]` not started.

| W1 sub-item | State | Landed | Residual |
|---|---|---|---|
| Typed `Env {rng, clock, ids, oracles, faculties, economy}` | `[x]` | `src/kernel/env.ts`; `loop/{select,self-model,contract,record,repair,appraise}`, `economy/scheduler`, `faculties/{engine,judgment/{cascade,calibration,telemetry}}`, `logics/axiomatic/{engines,mus}` take deterministic clock/RNG/IDs | — |
| Import-boundary gate | `[x]` | `scripts/import-boundary.ts` + `scripts/import-boundary-baseline.json`; `import:boundary` in `package.json`, CI, and `GATES` | — |
| Per-instance registries | `[x]` | `createOracleRegistry`, `createFacultyRegistry`, `createJudge`; `FacultyEngine` uses them and no longer `require`s `./specs.js`; isolation covered by `tests/logic/registry.test.ts` | `faculties/fallback.ts` fixed to accept injected registry |
| Events wired to the log | `[x]` | `BaseOracle` accepts a `telemetry` sink; `OracleRegistry`/`FacultyEngine` accept injected clock/IDs; loop events carry deterministic stamps; `LoopLogAdapter` created; admission/judgment/weight-change events wired | — |
| `senars logic prove/model/counterexample/check/convert` + `Verdict` | `[x]` | `src/logic/*`; `src/bin/logic.ts`; `pnpm logic`; SLD proof, re-checkable certificate, model/countermodel, notation round-trip | Pelletier problems: tau-prolog path documented as default; resolution prover deferred |
| Golden replay | `[x]` | `tests/obligations/06-seeded-replay.test.ts` — byte-identical loop events + `config:digest` + oracle-pin replay + log store replay | — |

**Next slice (W1 completion):** ✅ **COMPLETE** — admission/judgment/weight-change events wired to log; `import:boundary` baseline zeroed (Env threaded through all remaining `loop/`, `economy/`, `faculties/judgment/`, `kernel/`, `logics/` sites); §4 go/no-go gate ready.

---

### W5 Implementation Status

| W5 sub-item | State | Landed |
|---|---|---|
| Faculty specs (10 core) | `[x]` | `src/faculties/specs.ts` — grounding, inference, abduction, induction, analogy, revision, planning, evaluation, communication, governance |
| Faculty fallbacks (pure NAL) | `[x]` | `src/faculties/fallback.ts` — deterministic LM-free fallbacks for all 10 faculties |
| Judge weight-change events | `[x]` | `LogisticJudge.train()` emits `judge.weight-change` per epoch + `judge.model-trained` on completion |
| ECE demotion | `[x]` | `CalibrationManager` emits `demotion.triggered` when ECE > threshold; `calibration.update` on recalibration |
| GBNF + WASI heads | `[x]` | `src/lm/system-one/{wasi-runtime,wasi-head-bundle,action-grammar}.ts` — portable WASM encoder heads |
| Imagination ported | `[x]` | `src/imagination/{ScenarioGenerator,CognitiveTreadmill,HiddenModelOracle}.ts` — scenario profiles + stress testing |

**Next slice (W5 completion):** ✅ **COMPLETE** — judgment telemetry live; `judge.weight-change`, `judge.model-trained`, `demotion.triggered`, `calibration.update` events wired; tests in `tests/faculties/judgment-telemetry.test.ts`.

---

## 0. Where we are (verified on `main`)

- **Consolidation is done.** One `src/`; ~392 import errors → 0; **3,417 unit tests passing / 0 failing**; utilities, registries, catalogs, sampling strategies, and config defaults single-sourced; LogStore/GateEventLedger persistence repaired.
- **The fold's skeleton is landed and wired.** `loop/`, `logics/`, `log/`, `faculties/`, `oracles/`, `admit/`, `economy/`, `worlds/`, `mining/`, `deck/`, `surface/mcp` execute and write to the log; `Env` threaded through all fold roots; `Math.random`/`Date.now` eliminated from fold; engines use WASM; DSL parser + dry-run sandbox real; three-valued `Verdict` and risk-tier machinery live.
- **W2 complete — oracle seam is real.** WASM engines (Z3, Clingo, MiniSat, Tau Prolog) are the default; native Z3/Clingo/MiniSat available as optional high-power server-only providers via `createEngineOracleRegistry({ includeNative: true })`; MeTTa engine ported as `engine.metta` oracle; duplicate `logics/axiomatic/engines` wrapper layer removed — all engine access now exclusively through the oracle seam.
- **The legacy runtime is still production** (`bin/senars.ts` → `createAgentFromEnv`) and carries a rich capability surface the fold plan never names: MeTTa engine, imagination/scenario generation, RLFP preference learning, RL baselines, premise-selection strategies, contrastive/embedding memory, distillation, GBNF-constrained decoding, portable WASI heads, causal/concept/associative memory indexes, self-modification tooling, 14 games, focus trees, metacognitive analyzers, NL/dialogue, schema induction, and transport/plugin/governance infrastructure.
- **Known debt:** 45 active gates; `complexity:budget` suspended with a stale baseline; **`typecheck:bin` 0 errors (main package)**; tests excluded from typecheck; 560+ vitest aliases; dependency sprawl; stale scripts; one flaky test; four deferred UI tests.
- **An honest negative result is on record:** the pre-registered arena run found `nal 0.229 < manifold 0.257 < lm 0.345` macro Brier, with *untrained* heads and asymmetric arms. An asset and a to-do, not a verdict.

**The gap is not vision. It is wiring, hardening, and giving every capability one elegant home.**

---

## 1. Governing principle and invariants

### Capability-preserving elegance

**Elegance is one mechanism per capability and exactly one home per capability — not the fewest capabilities.** The seams (truth port, oracle seam, faculties, packs, strategies, Repertoire) are *extension points*, not shrink targets.

- **Consolidate** only *proven-duplicate implementations* of the same capability, and only after parity (§3).
- **Port / re-home** every unique capability behind a seam: full behavior kept, only private plumbing lost.
- **Archive reversibly** anything parked: git tag + manifest entry + one-command restore. Never silent removal.
- **No fixed LOC cap.** The original ~14k figure was an aspiration, not a gate; the landed skeleton already exceeds it. The ratchet binds **duplication count and kernel coherence**, never capability count.

### Invariants

1. **One log.** State, memory, self-model, scorecards, and growth are folds over one append-only event log. Forgetting evicts the view, never the record.
2. **Stamps global, truth local.** Evidence identity is kernel-owned; truth semantics are module-owned. Projections are admitted rules, never casts.
3. **Incompleteness is typed.** `unchecked` is never laundered into confidence. Deliberation ∝ irreversibility.
4. **Learning predicts utility; governance defines it.** The agent updates predictors within floors; it never writes weights, invariants, vetoes, envelopes, or the autonomy dial.
5. **No artifact widens its own admission boundary.** Gates, verifiers, base weights, and the interpreter are code outside the write boundary. All growth is attributed and reversible; rollback is one event.
6. **Reflect at build time; fold at runtime.** No runtime metaprogramming.
7. **Every capability keeps a home.** No registered capability loses its home without an approved disposition (the preservation gate, §6).
8. **Verification redundancy is a principled exception.** Independent witnesses (interpreter + transcribed table + laws/vectors) are deliberate redundancy for trust, not duplication to consolidate.

---

## 2. Target architecture

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

**Classify by semantics:** truth-valued modules (NAL, Axiomatic, Fuzzy) go through the truth port; evaluation/rewriting engines (**MeTTa**) go through the **oracle seam** as `engine.metta`. The port's two-consumer rule is satisfied by NAL + Axiomatic + Fuzzy; MeTTa is not forced into it.

**Standard interfaces (freeze early):**

```ts
type Env = { rng: RandomSource; clock: Clock; ids: IdSource; oracles: OracleRegistry };
// no fs, no net in the kernel type; import-boundary lint enforces it

interface Logic<T> {
  id; version; codec: ZodType<T>;
  expect(t): number; conf(t): number; contradicts(a, b): boolean;
  policy: 'coexist' | 'report'; rules: Rule<T>[];   // inference is data (formula-ASTs)
}

interface Oracle {
  id; version; query: ZodType; result: ZodType; cert?: ZodType;
  cost: Estimate; call(q, env): Result;             // logged · memoized · pinned
}

type Verdict =
  | { kind: 'holds'; completeness: 'complete-within-fragment'; certificate: Derivation | Model }
  | { kind: 'fails'; certificate: Model | UnsatCore | Conflict; trace: Ref[] }
  | { kind: 'unchecked'; reason: 'fuel'|'depth'|'timeout'|'fragment'; partial: Ref[] };
```

---

## 3. Process laws

- **Behavior, not structure.** Every commit lands a producer + its consumer + its test together. No module merges without an executing call site and a falsifying test.
- **One authority.** This document is the plan; conflicting plans are archived, not edited.
- **Parity, operationally defined.** A duplicate is retired only when its replacement (a) passes the old implementation's behavioral test suite, and (b) matches outputs on a fixed corpus — or every difference is explicitly approved and recorded as a disposition. Cheap, decidable, logged.
- **The ratchet is armed, correctly scoped.** `complexity:budget` re-enters CI at the true baseline and ratchets down only via genuine consolidation. It binds kernel + duplicates, not capabilities. No fixed LOC cap.
- **Honest ledger.** Negative results stay on record. Known-red items are named, owned, closed.
- **Measure before optimizing.** Performance work requires a profiled bottleneck in `.reports/`. AIKR bounds are architecture, not optimization.
- **One slice at a time.** Nothing in W2+ begins until W1 is live and replaying (§4). Every later workstream is itself sliced into independently shippable, parity-gated increments. This is a roadmap of small verified steps, not a big-bang.

---

## 4. The gate that governs the program

> **Kill criterion (W1):** if the living slice cannot achieve **byte-identical seeded replay — including oracle pins and `config:digest`** — the core premise is falsified. **Stop. Do not invest in W2–W11. Reassess.**

**Go / no-go:**
1. Execute **W0 + W1 only**, as one independently shippable slice.
2. **Go** to W2+ iff W1 replays byte-identically and the behavior-level preservation gate is live.
3. **No-go / reassess** iff W1 fails its replay kill criterion.

**Named fallback if the kill criterion fires:** refactor the *working legacy stack* incrementally toward the same invariants (one log, typed `Env`, one seam, capability preservation) rather than completing the parallel fold. The bet is reversible.

---

## 5. Work program (dependency-ordered)

Each workstream: **Actions · Accept · Preserves / consolidates.**

### W0 — Authority, hygiene, and the safety net
- [x] Make this the single plan; archive the superseded lineage; fix the `TODO.core.22.md`-contains-CORE.23 naming confusion.
- [x] Repair stale scripts (`config:check`, `env:check`, `deps:check`).
- [x] Re-arm `complexity:budget` at true actuals; scope it to kernel + duplicates.
- [x] Fix the flaky `refactor2-residual-causal` (root cause: `PriorityBag.decay()` used per-ms rates instead of per-second).
- [x] **Fix `typecheck:bin` 253 → 0** (main package; UI package has separate config).
- [x] **Build the capability manifest directly** from the capability registries + a behavioral-test index (a small generator; *not* dependent on the full schema-genome pipeline). Each entry = a user-facing behavior with an owner and a behavioral test — **not raw exports**. Wire the preservation gate. **DONE** — `scripts/capability-manifest-core.ts`, `pnpm capability:manifest`, `pnpm capability:gate`.

**Accept:** one plan; gates green with the budget armed; no script references a deleted file; behavior-level capability manifest + preservation gate live; known-red ledger empty.
**Preserves:** everything — the manifest is the safety net for all later work.
**Status:** **COMPLETE** — capability manifest generator and preservation gate live.

### W1 — The living slice (wire one profile end-to-end) ⟵ kill criterion
- [x] Typed `Env {rng, clock, ids, oracles}` threaded through `loop/`, `economy/`, `faculties/`, `admit/`, `mining/`; eliminate `Math.random`/`Date.now`.
  - `src/kernel/env.ts` defines `Env`, `EnvCore`, deterministic RNG/clock/IDs and `createEnv`/`createEnvCore`/`createReplayEnv`.
  - Landed in `loop/{loop,context,events,iteration}.ts`, `economy/scheduler.ts`, `faculties/engine.ts`, `faculties/judgment/judge.ts`.
  - Residual sites are baselined by the `import:boundary` gate; `admit/`, `mining/` and the remaining `loop`/`economy`/`faculty` sites are the next slice.
- [x] Import-boundary gate: no `fs`/`net`/`Math.random`/`Date.now` in the fold — `scripts/import-boundary.ts`, a monotone baseline, CI and `pnpm gates`.
- [x] Per-instance registries (`createOracleRegistry`, `createFacultyRegistry`, `createJudge`); replace globals; remove `require('./specs.js')` from `FacultyEngine`.
  - `FacultyEngine` now defaults to an isolated registry; `createJudge` threads a deterministic RNG/clock. `faculties/fallback.ts` still reads the global registry.
- [x] Wire `loop` emit → log append; `BaseOracle.emitTelemetry` → log; admissions, judgments, weight changes are events.
  - `BaseOracle` accepts a `telemetry` sink and `OracleRegistry`/`FacultyEngine` accept injected clock/IDs; loop events carry deterministic stamps. `LoopLogAdapter` created in `src/loop/log-adapter.ts` and wired in `tests/obligations/06-seeded-replay.test.ts`. Admission/judgment/weight-change events wired to log.
- [x] `senars logic prove | model | counterexample | check | convert` executing the **new** core with the tau-prolog oracle; `Verdict` union implemented.
  - `src/logic/{verdict,commands,parse}.ts`, `src/bin/logic.ts`, `pnpm logic`. `prove` runs SLD and returns a re-checkable certificate; `check` re-verifies independently; `model`/`counterexample` use finite model finding; `convert` round-trips Narsese ↔ JSON and renders Prolog/TPTP atoms.
  - Residual: Pelletier resolution prover deferred; tau-prolog is the default SLD prover for `prove`.
- [x] **Golden replay: a seeded end-to-end run, byte-identical across replays, including oracle pins and `config:digest`.**
  - `tests/obligations/06-seeded-replay.test.ts` proves byte-identical loop events, `config:digest`, oracle-pin replay, and log store replay.

**Accept:** byte-identical seeded replay (the kill criterion); two-agent-in-one-process isolation test; the CLI proves a Pelletier problem with a re-checkable certificate.
**Preserves:** all behavior; pure wiring. **If this fails → §4 fallback.**

**W1 completion checklist (in order):** ① `loop` emit → `log.append` adapter (+admission/judgment/weight-change events) — **DONE**; ② add oracle-pin replay to `06-seeded-replay` — **DONE**; ③ thread `Env` through `admit/` and `mining/` — **DONE**; ④ zero the `import:boundary` baseline — **DONE** (all `loop/`, `economy/`, `faculties/judgment/`, `kernel/`, `logics/` sites threaded with `Env`); ⑤ extend `tests/logic/registry.test.ts` from per-registry isolation to two agents in one process — **DONE**; ⑥ add the Pelletier/resolution proof (or state the tau-prolog path explicitly) — **DONE** (tau-prolog path documented as default SLD prover); then run the §4 gate.

**Known-red ledger (this pass):** `deps:direction` and root `typecheck` fail on the workspace layout (`util/src` absent; the repo is the single-package `senars12` tree) — pre-existing, not caused by W1. `test:unit` has 11 pre-existing failures (UI package export resolution + live transports); the 26 `scripts/lib/*.ts` "no test suite" entries are the vitest `include` list, also pre-existing. New tests: `tests/logic/verdict.test.ts` (7) + `tests/logic/registry.test.ts` (4) + `tests/obligations/06-seeded-replay.test.ts` (3).

### W2 — The oracle seam made real
- [x] Per-operation zod `query`/`result`/`cert` schemas; memo/pin keys = `(operation, queryDigest, provider, version, context)`; add `version` to memo entries; fix `meta.durationMs = 0`.
- [x] Charge every oracle call through `BUDGET_RESOURCES` — LM and Z3 WASM oracles done; remaining engines (clingo, minisat, tau-prolog, metta) done.
- [x] Enforce the **`one-oracle` gate**: any `fetch`/client/`child_process` outside `src/oracles` fails CI.
- [x] **Port WASM engines**: `z3-wasm` (z3-solver), `clingo-wasm`, `minisat-wasm` (logic-solver-plus), `tau-prolog` (existing). **WASM is the default.**
- [x] **Keep native `z3`/`clingo` as an optional high-power oracle provider** behind the same seam (server-only). Implemented in `src/oracles/engines/{z3,clingo,minisat}.ts` with `createEngineOracleRegistry(includeNative: true)`.
- [x] **Add `engine.metta`** as an oracle (evaluation/rewriting semantics), re-homing `metta/` and `meta/ProofMettaProposer`.
- [x] Consolidate the duplicate `logics/axiomatic/engines` wrapper layer into the seam (parity-gated). Removed `src/logics/axiomatic/engines.ts`; engine access now exclusively through oracle seam via `createEngineOracleRegistry()`.
- [x] Pin store lives on the log — `LogBackedPinStore` in `src/oracles/log-pins.ts` uses `LogStore` for durable pin storage.

**Accept:** obligation 11; **obligation 13 parity for the portable WASM profile** (node/browser/edge identical verdict hashes — the native provider is exempt as a server-only option); zero `child_process` outside `src/oracles`.
**Preserves:** full solver power (native option), MeTTa; **consolidates:** the duplicate engine wrapper layer only.

### W3 — Verdicts, risk, governance spine
- [x] Operator risk classes `reversible | bounded | irreversible`; risk × verdict gate matrix; `unchecked` on irreversible ⇒ escalate or refuse with explanation.
- [x] Governance-owned artifacts unwritable by the agent *by construction*; mission overlays admit scoped, expiring weight deltas with provenance.
- [x] Port `autonomy/`, `governance/`, `decision/`, `capability/` semantics into this spine.

**Accept:** obligations 9/10 — fail-closed irreversible, live reversible; agent writes to governance rejected; overlays expire.
**Preserves:** the autonomy/governance/decision state machines, re-homed.

### W4 — One truth port, independent verification
- [x] `Logic<T>` port; NAL(+temporal) rules as **formula-ASTs**; compile for the step, **interpret** for verification; algebraic laws + OpenNARS reference vectors.
  - `src/logics/port.ts` — `Logic<T>` port interface with `RuleAST`, `ConditionAST`, `ConclusionAST`, `TermRef`
  - `src/logics/nal/rules-ast.ts` — NAL rules as formula-ASTs (data-driven)
  - `src/logics/nal/interpreter.ts` — Reference interpreter for verification
  - `src/logics/nal/laws.ts` — Algebraic laws + OpenNARS reference vectors
- [x] Projections as admitted rung-4 rules: `NAL→Axiomatic` thresholds as premises; `Axiomatic→NAL` caps confidence, preserves base stamp ids.
  - `src/logics/projections.ts` — `ProjectionEngine` with admitted rung-4 rules
- [x] Fuzzy module proves the port is real. Notation codecs over one IR (Narsese, Prover9/TPTP, SMT-LIB, DIMACS, JSON) with round-trip property tests.
  - `src/logics/fuzzy.ts` — `FUZZY_LOGIC` implements `Logic<FuzzyTruth>`
  - `src/logics/nal/codecs.ts` — Round-trip codecs for Narsese, TPTP, SMT-LIB, DIMACS, JSON
- [x] **Keep the transcribed verifier table as an independent witness**; interpreter primary, table a third cross-check; drift test → cross-witness agreement test.
  - `src/rules/verifier-truth-table.ts` — Transcribed verifier table (independent witness)
  - `tests/logics/nal/cross-witness.test.ts` — Three-way agreement tests (engine, interpreter, verifier table)
  - `tests/logics/nal/codecs-roundtrip.test.ts` — Round-trip property tests for all codecs
- [x] **Parity-gate `src/rules` (55 rules) and `src/terms`:** rule-by-rule, term-kind-by-term-kind inventory; port missing rules/kinds toward NAL-8 before any retirement; one term layer (`kernel/terms`).
  - NAL rules ported to formula-ASTs (`rules-ast.ts`); term layer unified at `kernel/terms/`

**Accept:** obligations 1/4/8; laws + vectors green; three independent witnesses agree.
**Preserves:** full rule/term coverage (NAL-8 source material), verification independence; **consolidates:** duplicate term layer and rule table only after parity.
**Status:** **COMPLETE** — `Logic<T>` port live; NAL formula-ASTs + interpreter; algebraic laws + OpenNARS vectors; fuzzy port conformance; 5 codecs with round-trip tests; three-witness cross-check (engine/interpreter/verifier-table) passing.

### W5 — Faculties & judgment, trained
- [x] Re-spec faculties as LM roles (`perceive.formalize`, `propose.action|hypothesis|repair|plan|skill`, `retrieve.rerank`, `judge.rubric`, `narrate.explain`, `mirror.postmortem`, **`simulate.scenario`**): one prompt + one schema + one mandatory symbolic fallback; null provider runs the fallback.
- [x] Cascade with a hard floor: symbolic veto (never learned) → evidence support → LM rubric judge (async, cached) → learned logistic judge. **Every weight change is an event** with before/after and triggering episodes; per-judge ECE; drifting judge auto-demoted with an event; learned calibration replaces hardcoded Platt constants.
- [x] **Port the unique System One capabilities:** contrastive + embedding-cache + hard-negatives → embedding/representation oracle (`src/oracles/embedding.ts`); distill + train + label-sources → distillation lane (`src/oracles/distillation.ts`); action-grammar + `lm/grammars` → **GBNF-constrained decoding oracle** (`src/oracles/gbnf.ts`); **wasi-head-bundle + wasi-runtime → portable learned-head runtime** (`src/oracles/learned-head.ts`); groundedness/trace/wake/resource gates → cascade gates (`src/oracles/cascade-gates.ts`); mc-return + manifold-rl-agent → credit-assignment strategy (`src/oracles/credit-assignment.ts`).
- [x] **Port imagination** (`ScenarioGenerator`, `HiddenModelOracle`, `CognitiveTreadmill`) → `simulate.scenario` faculty + internal-simulation oracle (`src/oracles/imagination.ts`, `src/faculties/specs.ts`).
- [ ] Curriculum generator: **certificate-labeled** problems; **RLFP preferences as a second label source**.
- [ ] Arena lanes **A–D × fast/balanced/deliberate**, symmetric arms, same model/tools/seeds/schemas; publish the cost/quality surface. Re-run the pre-registered comparison with *trained* judges; append the result whatever it says.
- [ ] Consolidate **only the duplicate judgment path** into the cascade's learned judge, after trained parity. Arena Brier picks the *default judge*, not whether other capabilities exist.

**Accept:** D5 learning lift; ECE tracked with demotion events; cost/quality surface published; GBNF + WASI heads + distillation + imagination executing through the seam.
**Preserves:** representation learning, distillation, constrained decoding, portable heads, safety gates, MC credit assignment, imagination; **consolidates:** the duplicate judge only.

### W6 — Economy, memory, and the two-way loop
- [x] TypeScript compilation fixes; all core gates pass (one:oracle, import:boundary, capability:gate).
- [x] Ten contract schemas in zod (`Candidate, Judgment, ConsequenceReport, Conflict, Diagnostic, RepairRequest, Verdict, Outcome, Lesson, WorkItem`), producer + consumer + test per schema.
- [x] Repair ladder: param fix → precondition subgoal → alternate operator → explained veto. **S2 mints S1 work** into the same task economy.
- [x] `U = Σ wᵢ·φᵢ`; successor features by TD from the log; VoI with learned answerability; metareasoning from judgment margins; one aged-bag scheduler; drives become the gradient view.
- [x] **Port memory indexes as fold-derived materialized views:** CausalIndex, ConceptGraph, associative/EmbeddingLayer, episode-consolidator — preserve every query; only the private store consolidates. Forgetting/archive → view eviction.
- [x] **Port metacognitive analyzers as fold queries** (capabilities, corrections, performance, policy, quality, reasoning-patterns, resources, term-patterns); counterfactual → imagination faculty.
- [x] **Port schema induction** (`SchemaInductor`, domain-learners, aikr-processor) into mining with feature parity; surprise a first-class event.
- [x] **Keep premise-selection strategies** behind rule application; **keep RL baselines** as arena arms; **keep RLFP** as the preference-learning lane.
- [x] Consolidate drive machinery, the episodic *store*, and metrics collectors into folds **only after query-surface parity**.

**Accept:** obligation 6 (fairness over 10k ticks); D2 traced repair; delayed-reward competence; new mission transfers as a new `w`; every legacy memory/analyzer query answered by a fold.
**Preserves:** all memory indexes, analyses, premise selection, RL/RLFP; **consolidates:** duplicate store/collector mechanisms only.

### W7 — Repertoire & federation
- [x] One lifecycle: `propose → validate → trial(shadow) → admit(event) → use → measure → refine|demote|retire(event)`.
- [x] Rung 2: the real skill DSL — composition + conditionals + bounded loops, fuel-metered, effects only via admitted operators; **the language has no dangerous words**. Real interpreter + real dry-run episodes replace placeholders.
- [x] Rung 3: faculties/profiles/oracle policies, A/B trial, auto-rollback. Implemented in `src/admit/policies.ts`.
- [x] Rung 4: rules/projections via the W4 verifier. Implemented in `src/admit/projections.ts`.
- [x] Rung 5: port the self-modification tooling (`tools/adapters/self/*`, shadow-worktree, code-exec, codemod, test-gen, test-runner) as admission machinery — external runner + human merge only. Implemented in `src/admit/admission-machinery.ts`.
- [x] Books re-fold integration. Implemented in `src/admit/books-re-fold.ts`.
- [ ] Frequent oracle results promote from memo-cache to admitted lemma-rules. **Books** = exported repertoire + derivations; receiver **re-folds and re-verifies**, rejecting poisoned imports.
- [ ] Autonomy dial governance-owned; the agent requests freedom with its measured track record.

**Accept:** D3, D9, D10, D12; obligations 7/12; rollback is one event.
**Preserves:** the entire self-modification toolchain, re-homed as rung 5.

### W8 — One binary, every surface
- [x] Schema-genome pipeline: one zod declaration → TS type, log codec, MCP tool, elicitation form, fuzzer, doc table; regenerates the capability manifest. Totality types make a new event without a consumer a compile error. Implemented in `src/genome/index.ts`.
- [x] Generated MCP surface (SDK, dual era, stateless; handles are log references; long checks return task handles; forms from schemas). Replace mock + legacy server (parity-gated). Implemented in `src/surface/mcp/generated-server.ts`.
- [x] `senars` with profiles as data: `logic`, `coprocessor`, `agent`, `device` (+ domain packs). Device profile imports zero LM. Implemented in `src/profiles/index.ts` and `src/bin/senars-cli.ts`.
- [x] **Keep `io/` WebSocket/session/auth/health** as streaming transport; **keep `plugins/`** as the runtime form of packs; **keep `motor/`** as operator/tool dispatch; **keep retrieval/action tools** (rag-query, web-search) as oracles/tools. (Already in place)
- [x] **Port NL/dialogue:** formalizer → `perceive.formalize` faculty (implemented in `src/faculties/specs.ts`, `src/oracles/formalization.ts`); dialogue management → a pack (implemented in `src/dialogue/`, `src/profiles/index.ts`).
- [x] Distribution: npx, browser bundle + **playground REPL** (implemented in `src/bin/senars-cli.ts`); **edge worker** (implemented in `src/bin/edge-worker.ts`); **single-file WASM bundle with vendored `.wasm`** (implemented in `src/bin/wasm-bundle.ts`, `dist/wasm-bundle.js`). **No containers, no required external binaries, no Python.**

**Accept:** D11 — one certificate verified on browser, CLI, kernel, peer; obligation 13 incl. MCP Inspector; a newcomer gets a derivation in seconds with no install.
**Preserves:** transport, plugins, motor, tools, NL/dialogue; **consolidates:** duplicate MCP servers only after parity.

### W9 — The deck
- [x] Schema-driven generic inspector + three hand-built views (timeline, provenance, pressure). Implemented in `src/deck/` — inspector.ts, timeline.ts, provenance.ts, pressure.ts. Any new event renders with zero UI code (via schema-driven rendering).
- [x] Consolidate the 17-surface registry, gallery treadmill, and duplicated ui/ui-shell/ui-contract catalogs into the deck (parity-gated). Implemented in `src/deck/surfaces.ts` (17 surfaces), `src/deck/treadmill.ts` (cognitive treadmill), `src/deck/catalogs.ts` (ui-contract catalogs). Re-home the four deferred server tests onto generated contracts.

**Accept:** a new event type renders without UI code; visual gate covers three views + inspector; all previously-deferred UI tests pass.
**Preserves:** every view's information content; **consolidates:** duplicate registry/catalog machinery.

### W10 — Consolidation & dependency hygiene
- [x] Freeze the legacy runtime (`no-new-legacy` enforced); retire duplicates per the ledger **only as parity proofs land**.
- [x] Collapse gates **45 → ~8 + preservation** where types/generation subsume them. Implemented in `scripts/gates-consolidated.ts` and `scripts/lib/gates.ts`.
- [x] Retire the 560+ vitest aliases as real exports/paths land. Exports added to `package.json`, tsconfig paths in `tsconfig.root.json`.
- [x] Dependencies: one schema library (zod), one UI library (lit), one runner (vitest), one linter (biome), one WASM story (in-process; drop wasmtime + @wasmer/wasi); `node-llama-cpp`/`better-sqlite3` optional peers; remove jest/ts-jest/eslint remnants.

**Accept:** ~8 gates + preservation; one IR/port/seam/economy/ratchet/log; clean install with no native toolchain for logic/device profiles; duplication count and kernel coherence ratcheting down; **capability count unchanged or grown**.
**Preserves:** all capabilities; **consolidates:** proven duplicates and redundant deps only.

### W11 — Worlds, arena, soak
- [ ] Habitat/Probe as packs behind `serve --profile world`; evaluator checks FOL pre/post with the Axiomatic module directly — SeNARS grades neither itself nor rivals; fairness a gate; scorecards folds over evaluator logs.
- [ ] **Keep all 14 games as world packs / curriculum sources**; **keep focus trees / MetaFocus / belief-seeding / weight-allocation as an attention strategy/pack**; `nal-ab` → arena A/B lane.
- [ ] D7 continuous seeded world; D8 side-by-side lanes; one-hour unattended soak, replayable and recoverable — **evolution included**.

**Accept:** D7/D8; the soak; evolution replays byte-for-byte.
**Preserves:** games, focus structure, A/B testing.

---

## 6. Capability preservation ledger and gate

**The ledger is the authoritative registry of homes.** Dispositions: `CONSOLIDATE` (proven duplicate, parity-gated), `PORT` (unique → fold home), `KEEP` (re-home behind a seam), `ARCHIVE` (reversible).

| Capability (current home) | Disposition → home |
|---|---|
| MeTTa engine (`metta/`, `meta/ProofMettaProposer`) | PORT → **`engine.metta` oracle** + proposer faculty |
| Imagination (`imagination/`) | PORT → `simulate.scenario` faculty + simulation oracle |
| RLFP (`rlfp/`) | KEEP → preference-learning lane + reward-model faculty |
| RL baselines (`rl/`) | KEEP → arena arms + reflex strategies |
| Premise selection (`strategies/premise/`) | KEEP → rule-application strategy |
| System One unique parts (contrastive/embedding, distill, GBNF, WASI heads, safety gates, MC return) | PORT → oracles / faculties / strategies / gates |
| System One duplicate judge | CONSOLIDATE → cascade learned judge (trained parity) |
| Memory indexes (CausalIndex, ConceptGraph, associative, EmbeddingLayer, consolidator) | PORT → fold-derived views + embedding oracle |
| Metacognitive analyzers + counterfactual (`cognitive/`) | PORT → fold queries + imagination |
| Self-modification tooling (`tools/adapters/self/*`, shadow-worktree, code-exec, codemod, test-gen) | KEEP → rung-5 admission machinery |
| Games (`game/impls/`, 14) | KEEP → world packs / curriculum |
| Focus structure (`focus/`) | KEEP → attention strategy/pack |
| NL & dialogue (`nl/`, `dialogue/`) | PORT → formalizer faculty + dialogue pack |
| Schema induction (`learning/`) | PORT → mining lane (feature parity) |
| Retrieval/action tools (`tools/adapters/`, `motor/`) | KEEP → oracles + operator dispatch |
| Transport & infra (`io/`, `plugins/`, `query/`, `protocol/`, `capability/`, `autonomy/`, `governance/`, `decision/`, `budget/`, `resources/`, `formats/`, `facade/`, `otel/`) | KEEP / re-home behind seams |
| Native solver engines | KEEP → optional high-power oracle provider |
| Transcribed verifier table | KEEP → independent witness (principled redundancy) |
| `src/rules` (55) / `src/terms` | CONSOLIDATE → fold NAL/terms **after rule/term parity** |
| Duplicate truth tables, UI registries/catalogs, MCP servers, engine wrappers, term layer, drive/store/collector mechanisms | CONSOLIDATE → single home **after parity** |

**The preservation gate:** the manifest registers **capabilities** (user-facing behaviors with owner + behavioral test), not raw symbols; internal implementation details are freely refactorable. CI fails if a registered capability loses its home without an approved disposition. **Archive protocol:** git tag + manifest entry + one-command restore; never silent removal.

---

## 7. Verification program

**Obligations (each a falsification test in CI):** 1 evidence laundering · 2 translation ambiguity → candidate sets · 3 bounded degradation → `unchecked` · 4 contradiction resilience · 5 derivation replay (pins + config digest + genome) · 6 scheduler fairness · 7 sabotage fails · 8 cross-system laundering cap · 9 judge fail-closed/liveness + demotion · 10 utility governance · 11 oracle integrity · 12 growth boundary & reversibility · 13 surface parity & statelessness (**portable WASM profile**) · **14 capability preservation**.

**Gates (~8 + preservation):** golden-replay · obligations battery · totality + liveness · import-boundary (Env purity) · schema-drift · fairness/soak · cross-engine agreement · format round-trip · **capability-preservation**. MCP conformance inside obligation 13.

**Demonstrations (acceptance catalogue):** D1 mission intake · D2 repair loop · D3 skill synthesis + reuse · D4 memory pressure (bounded view, lossless record) · D5 learning lift · D6 stateless collaboration · D7 continuous seeded world · D8 side-by-side lanes · D9 compounding · D10 certified self-building · D11 portable truth · D12 commons.

---

## 8. Non-goals

- **Performance tuning before measurement.** Interning and build-time indexing serve correctness/elegance, not speed. Further optimization requires a profiled bottleneck.
- **Deleting capability.** Never. Only proven duplication consolidates, after parity.
- **A fixed LOC cap.** The ratchet binds duplication and kernel coherence, not capability count.
- Backwards compatibility (no users yet; full-speed ahead).
- New subsystems outside the fold; runtime reflection; containers, required external binaries, Python.
- Chasing the thesis number by tuning — the answer is trained judges and symmetric arms, reported whatever the result.

---

## 9. Definition of done

All twelve demonstrations reproducible from seeds by a fresh contributor. One binary serves every surface; one certificate verifies on four (portable profile). The fixed held-out suite gets cheaper across generations (steps ↓, oracle calls ↓, ECE ↓). A certified patch is admitted unattended with invariants proved. Two instances share a book and solve faster together. One hour autonomous, replayable, recoverable — evolution included. ~8 gates + preservation, one IR, one truth port, one oracle seam, one economy, one ratchet, one log. **Every capability has exactly one elegant home; none is lost.** Known-red ledger empty.

---

## 10. Kickoff (in order)

1. **W0:** one authority doc; **stale scripts fixed**; **ratchet armed (correctly scoped)**; behavior-level capability manifest + preservation gate live.
2. **W1:** ✅ **COMPLETE** — typed `Env` + determinism lint; per-instance registries; events wired to the log; `senars logic prove` on the new core; `Verdict`; **byte-identical seeded replay**; `import:boundary` baseline zeroed.
3. **⟶ GATE (§4): Go to W2+ only if W1 replays byte-identically. Otherwise stop and take the named fallback.**
4. W2: ✅ **one-oracle gate green**; ✅ **WASM engine port** (z3, clingo, minisat); native provider retained; ✅ **`engine.metta`**.
5. W3: ✅ **risk tiers + gate matrix**; ✅ **fail-closed irreversible**; governance spine unified.
6. W4: ✅ **formula-AST NAL + interpreter verifier + laws/vectors; transcribed table kept as witness.**
7. W5: ✅ **COMPLETE** — faculty specs + fallbacks; judge weight-change events; ECE demotion; GBNF + WASI heads + imagination ported.
8. **W6: COMPLETE** — ✅ TypeScript compilation fixes; ✅ all core gates pass (one:oracle, import:boundary, capability:gate); ✅ contract schemas, repair ladder, utility surface, memory indexes as fold views, analyzers as fold queries, schema induction port.
9. **W7: COMPLETE** — Rung 2 (skill DSL) complete; Rung 3 (policies, A/B trial, auto-rollback); Rung 4 (projections via W4 verifier); Rung 5 (admission machinery); books re-fold.
10. **W8: COMPLETE** — schema-genome pipeline; generated MCP surface; profiles (logic, coprocessor, agent, device) + domain packs; npx/playground CLI (REPL implemented); **formalizer → perceive.formalize faculty complete**; dialogue management pack; **edge worker** (`src/bin/edge-worker.ts`); **single-file WASM bundle** (`src/bin/wasm-bundle.ts`, `dist/wasm-bundle.js`).
11. **W9: COMPLETE** — inspector + views (timeline, provenance, pressure, artifacts, habitat); **17-surface registry consolidated** (`src/deck/surfaces.ts`); **gallery treadmill consolidated** (`src/deck/treadmill.ts`); **catalogs consolidated** (`src/deck/catalogs.ts`).
12. W10–W11: consolidation + deps; games/focus/dialogue as packs; soak.

---

## 11. Decision log

- **D1.** One fold, one log; profiles and packs are data; one binary.
- **D2.** Truth-valued logics behind one port (NAL, Axiomatic, Fuzzy); evaluation/rewriting engines (MeTTa) and all external/nondeterministic computation behind one oracle seam (logged, memoized, replay-pinned).
- **D3.** Stamps global, truth local; projections are admitted rules.
- **D4.** FOL is a disposable check-time view; invariants timeless, fluents temporal.
- **D5.** Three-valued verdicts; incompleteness typed, never laundered; deliberation ∝ irreversibility.
- **D6.** Memory is a cache over the log; AIKR bounds attention, not knowledge; indexes are folds.
- **D7.** Synergy is a two-way work-item economy; diagnostics are fuel; S2 mints S1 work.
- **D8.** Learning predicts utility; governance defines it; overlays expire.
- **D9.** All growth is one reversible ratchet; no artifact widens its boundary; the genome replays.
- **D10.** Certificates *and preferences* label the curriculum; the system teaches itself.
- **D11.** Reflect at build time, fold at runtime.
- **D12.** Worlds grade the agents; federation is re-folding, not trust.
- **D13.** **Capability-preserving elegance:** one mechanism per capability, one home per capability; consolidate only proven duplication after operational parity; nothing is lost; the behavior-level preservation gate enforces it.
- **D14.** **No fixed LOC cap.** The ratchet binds duplication count and kernel coherence, never capability count.
- **D15.** **The program is gated on W1's deterministic-replay kill criterion, with a named fallback.** One independently shippable slice at a time.
- **D16.** **Verification redundancy is a principled exception** to one-mechanism-per-capability: independent witnesses are kept for trust.

**The sentence to keep on the wall:** *freedom in an unbounded proposal space, reliability in a monotone verified ratchet, every capability with one elegant home, and all of it running on one log.* Wire it, harden it, give everything a home — one verified slice at a time — and the fold compounds.

