# SeNARS — The Fold: Final Development Plan

**Status:** authoritative, self-contained, implementation-ready. Supersedes the `TODO.core.*` and `docs/plan/NEXT.*` lineage.
**Goal:** realize the system's full potential as *one deterministic fold over one log* — a stand-alone logic tool, an auditable co-processor, and an autonomous self-growing agent, as three profiles of one mechanism — **preserving every capability the project has built**.

---

## 0. Where we are (verified on `main`)

- **Consolidation is done.** One `src/`; ~392 import errors → 0; **3,417 unit tests passing / 0 failing**; utilities, registries, catalogs, sampling strategies, and config defaults single-sourced; LogStore/GateEventLedger persistence repaired.
- **The fold's skeleton is landed but not alive.** `loop/`, `logics/`, `log/`, `faculties/`, `oracles/`, `admit/`, `economy/`, `worlds/`, `mining/`, `deck/`, `surface/mcp` exist, yet: no entry point executes them; no tests import them; they write nothing to the log; they use `Math.random`/`Date.now` and global singletons; engines spawn external binaries; the DSL parser and dry-run sandbox are placeholders; the three-valued `Verdict` and risk-tier machinery do not exist. The skeleton is already ~28–30k raw lines.
- **The legacy runtime is still production** (`bin/senars.ts` → `createAgentFromEnv`) and carries a rich capability surface the fold plan never names: MeTTa engine, imagination/scenario generation, RLFP preference learning, RL baselines, premise-selection strategies, contrastive/embedding memory, distillation, GBNF-constrained decoding, portable WASI heads, causal/concept/associative memory indexes, self-modification tooling, 14 games, focus trees, metacognitive analyzers, NL/dialogue, schema induction, and transport/plugin/governance infrastructure.
- **Known debt:** 45 active gates; `complexity:budget` suspended with a stale baseline; `typecheck:bin` 247 errors; tests excluded from typecheck; 560+ vitest aliases; dependency sprawl; stale scripts; one flaky test; four deferred UI tests.
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
- [ ] Return tests to typecheck; drive `typecheck:bin` 253 → 0.
- [ ] **Build the capability manifest directly** from the capability registries + a behavioral-test index (a small generator; *not* dependent on the full schema-genome pipeline). Each entry = a user-facing behavior with an owner and a behavioral test — **not raw exports**. Wire the preservation gate.

**Accept:** one plan; gates green with the budget armed; no script references a deleted file; behavior-level capability manifest + preservation gate live; known-red ledger empty.
**Preserves:** everything — the manifest is the safety net for all later work.

### W1 — The living slice (wire one profile end-to-end) ⟵ kill criterion
- [ ] Typed `Env {rng, clock, ids, oracles}` threaded through `loop/`, `economy/`, `faculties/`, `admit/`, `mining/`; eliminate `Math.random`/`Date.now`.
- [ ] Import-boundary gate: no `fs`/`net`/`Math.random`/`Date.now` in the fold.
- [ ] Per-instance registries (`createOracleRegistry`, `createFacultyRegistry`, `createJudge`); replace globals; remove `require('./specs.js')` from `FacultyEngine`.
- [ ] Wire `loop` emit → log append; `BaseOracle.emitTelemetry` → log; admissions, judgments, weight changes are events.
- [ ] `senars logic prove | model | counterexample | check | convert` executing the **new** core with the tau-prolog oracle; `Verdict` union implemented.
- [ ] **Golden replay: a seeded end-to-end run, byte-identical across replays, including oracle pins and `config:digest`.**

**Accept:** byte-identical seeded replay (the kill criterion); two-agent-in-one-process isolation test; the CLI proves a Pelletier problem with a re-checkable certificate.
**Preserves:** all behavior; pure wiring. **If this fails → §4 fallback.**

### W2 — The oracle seam made real
- [ ] Per-operation zod `query`/`result`/`cert` schemas; memo/pin keys = `(operation, queryDigest, provider, version, context)`; add `version` to memo entries; fix `meta.durationMs = 0`.
- [ ] Charge every oracle call through `BUDGET_RESOURCES`; pin store lives on the log.
- [ ] Enforce the **`one-oracle` gate**: any `fetch`/client/`child_process` outside `src/oracles` fails CI.
- [ ] **Port `mcplogic`'s WASM engines** (`z3-solver`, `clingo-wasm`, MiniSat/`logic-solver`, tau-prolog), axiom libraries, Tseitin CNF, symmetry breaking, SAT-backed model finding, Pelletier/TPTP benches (MIT → AGPL compatible). **WASM is the default.**
- [ ] **Keep native `z3`/`clingo` as an optional high-power oracle provider** behind the same seam (server-only).
- [ ] **Add `engine.metta`** as an oracle (evaluation/rewriting semantics), re-homing `metta/` and `meta/ProofMettaProposer`.
- [ ] Consolidate the duplicate `logics/axiomatic/engines` wrapper layer into the seam (parity-gated).

**Accept:** obligation 11; **obligation 13 parity for the portable WASM profile** (node/browser/edge identical verdict hashes — the native provider is exempt as a server-only option); zero `child_process` outside `src/oracles`.
**Preserves:** full solver power (native option), MeTTa; **consolidates:** the duplicate engine wrapper layer only.

### W3 — Verdicts, risk, governance spine
- [ ] Operator risk classes `reversible | bounded | irreversible`; risk × verdict gate matrix; `unchecked` on irreversible ⇒ escalate or refuse with explanation.
- [ ] Governance-owned artifacts unwritable by the agent *by construction*; mission overlays admit scoped, expiring weight deltas with provenance.
- [ ] Port `autonomy/`, `governance/`, `decision/`, `capability/` semantics into this spine.

**Accept:** obligations 9/10 — fail-closed irreversible, live reversible; agent writes to governance rejected; overlays expire.
**Preserves:** the autonomy/governance/decision state machines, re-homed.

### W4 — One truth port, independent verification
- [ ] `Logic<T>` port; NAL(+temporal) rules as **formula-ASTs**; compile for the step, **interpret** for verification; algebraic laws + OpenNARS reference vectors.
- [ ] Projections as admitted rung-4 rules: `NAL→Axiomatic` thresholds as premises; `Axiomatic→NAL` caps confidence, preserves base stamp ids.
- [ ] Fuzzy module proves the port is real. Notation codecs over one IR (Narsese, Prover9/TPTP, SMT-LIB, DIMACS, JSON) with round-trip property tests.
- [ ] **Keep the transcribed verifier table as an independent witness**; interpreter primary, table a third cross-check; drift test → cross-witness agreement test.
- [ ] **Parity-gate `src/rules` (55 rules) and `src/terms`:** rule-by-rule, term-kind-by-term-kind inventory; port missing rules/kinds toward NAL-8 before any retirement; one term layer (`kernel/terms`).

**Accept:** obligations 1/4/8; laws + vectors green; three independent witnesses agree.
**Preserves:** full rule/term coverage (NAL-8 source material), verification independence; **consolidates:** duplicate term layer and rule table only after parity.

### W5 — Faculties & judgment, trained
- [ ] Re-spec faculties as LM roles (`perceive.formalize`, `propose.action|hypothesis|repair|plan|skill`, `retrieve.rerank`, `judge.rubric`, `narrate.explain`, `mirror.postmortem`, **`simulate.scenario`**): one prompt + one schema + one mandatory symbolic fallback; null provider runs the fallback.
- [ ] Cascade with a hard floor: symbolic veto (never learned) → evidence support → LM rubric judge (async, cached) → learned logistic judge. **Every weight change is an event** with before/after and triggering episodes; per-judge ECE; drifting judge auto-demoted with an event; learned calibration replaces hardcoded Platt constants.
- [ ] **Port the unique System One capabilities:** contrastive + embedding-cache + hard-negatives → embedding/representation oracle; distill + train + label-sources → distillation lane; action-grammar + `lm/grammars` → **GBNF-constrained decoding oracle**; **wasi-head-bundle + wasi-runtime → portable learned-head runtime**; groundedness/trace/wake/resource gates → cascade gates; mc-return + manifold-rl-agent → credit-assignment strategy.
- [ ] **Port imagination** (`ScenarioGenerator`, `HiddenModelOracle`, `CognitiveTreadmill`) → `simulate.scenario` faculty + internal-simulation oracle.
- [ ] Curriculum generator: **certificate-labeled** problems; **RLFP preferences as a second label source**.
- [ ] Arena lanes **A–D × fast/balanced/deliberate**, symmetric arms, same model/tools/seeds/schemas; publish the cost/quality surface. Re-run the pre-registered comparison with *trained* judges; append the result whatever it says.
- [ ] Consolidate **only the duplicate judgment path** into the cascade's learned judge, after trained parity. Arena Brier picks the *default judge*, not whether other capabilities exist.

**Accept:** D5 learning lift; ECE tracked with demotion events; cost/quality surface published; GBNF + WASI heads + distillation + imagination executing through the seam.
**Preserves:** representation learning, distillation, constrained decoding, portable heads, safety gates, MC credit assignment, imagination; **consolidates:** the duplicate judge only.

### W6 — Economy, memory, and the two-way loop
- [ ] Ten contract schemas in zod (`Candidate, Judgment, ConsequenceReport, Conflict, Diagnostic, RepairRequest, Verdict, Outcome, Lesson, WorkItem`), producer + consumer + test per schema.
- [ ] Repair ladder: param fix → precondition subgoal → alternate operator → explained veto. **S2 mints S1 work** into the same task economy.
- [ ] `U = Σ wᵢ·φᵢ`; successor features by TD from the log; VoI with learned answerability; metareasoning from judgment margins; one aged-bag scheduler; drives become the gradient view.
- [ ] **Port memory indexes as fold-derived materialized views:** CausalIndex, ConceptGraph, associative/EmbeddingLayer, episode-consolidator — preserve every query; only the private store consolidates. Forgetting/archive → view eviction.
- [ ] **Port metacognitive analyzers as fold queries** (capabilities, corrections, performance, policy, quality, reasoning-patterns, resources, term-patterns); counterfactual → imagination faculty.
- [ ] **Port schema induction** (`SchemaInductor`, domain-learners, aikr-processor) into mining with feature parity; surprise a first-class event.
- [ ] **Keep premise-selection strategies** behind rule application; **keep RL baselines** as arena arms; **keep RLFP** as the preference-learning lane.
- [ ] Consolidate drive machinery, the episodic *store*, and metrics collectors into folds **only after query-surface parity**.

**Accept:** obligation 6 (fairness over 10k ticks); D2 traced repair; delayed-reward competence; new mission transfers as a new `w`; every legacy memory/analyzer query answered by a fold.
**Preserves:** all memory indexes, analyses, premise selection, RL/RLFP; **consolidates:** duplicate store/collector mechanisms only.

### W7 — Repertoire & federation
- [ ] One lifecycle: `propose → validate → trial(shadow) → admit(event) → use → measure → refine|demote|retire(event)`.
- [ ] Rung 2: the real skill DSL — composition + conditionals + bounded loops, fuel-metered, effects only via admitted operators; **the language has no dangerous words**. Real interpreter + real dry-run episodes replace placeholders.
- [ ] Rung 3: faculties/profiles/oracle policies, A/B trial, auto-rollback. Rung 4: rules/projections via the W4 verifier. **Rung 5: port the self-modification tooling** (`tools/adapters/self/*`, shadow-worktree, code-exec, codemod, test-gen, test-runner) as admission machinery — external runner + human merge only.
- [ ] Frequent oracle results promote from memo-cache to admitted lemma-rules. **Books** = exported repertoire + derivations; receiver **re-folds and re-verifies**, rejecting poisoned imports.
- [ ] Autonomy dial governance-owned; the agent requests freedom with its measured track record.

**Accept:** D3, D9, D10, D12; obligations 7/12; rollback is one event.
**Preserves:** the entire self-modification toolchain, re-homed as rung 5.

### W8 — One binary, every surface
- [ ] Schema-genome pipeline: one zod declaration → TS type, log codec, MCP tool, elicitation form, fuzzer, doc table; regenerates the capability manifest. Totality types make a new event without a consumer a compile error.
- [ ] Generated MCP surface (SDK, dual era, stateless; handles are log references; long checks return task handles; forms from schemas). Replace mock + legacy server (parity-gated).
- [ ] `senars` with profiles as data: `logic`, `coprocessor`, `agent`, `device` (+ domain packs). Device profile imports zero LM.
- [ ] **Keep `io/` WebSocket/session/auth/health** as streaming transport; **keep `plugins/`** as the runtime form of packs; **keep `motor/`** as operator/tool dispatch; **keep retrieval/action tools** (rag-query, web-search) as oracles/tools.
- [ ] **Port NL/dialogue:** formalizer → `perceive.formalize`; dialogue management → a pack.
- [ ] Distribution: npx, browser bundle + playground (port `mcplogic`'s), edge worker, single-file bundle with vendored `.wasm`. **No containers, no required external binaries, no Python.**

**Accept:** D11 — one certificate verified on browser, CLI, kernel, peer; obligation 13 incl. MCP Inspector; a newcomer gets a derivation in seconds with no install.
**Preserves:** transport, plugins, motor, tools, NL/dialogue; **consolidates:** duplicate MCP servers only after parity.

### W9 — The deck
- [ ] Schema-driven generic inspector + three hand-built views (timeline, provenance, pressure). Any new event renders with zero UI code.
- [ ] Consolidate the 17-surface registry, gallery treadmill, and duplicated ui/ui-shell/ui-contract catalogs into the deck (parity-gated). Re-home the four deferred server tests onto generated contracts.

**Accept:** a new event type renders without UI code; visual gate covers three views + inspector; all previously-deferred UI tests pass.
**Preserves:** every view's information content; **consolidates:** duplicate registry/catalog machinery.

### W10 — Consolidation & dependency hygiene
- [ ] Freeze the legacy runtime (`no-new-legacy` enforced); retire duplicates per the ledger **only as parity proofs land**.
- [ ] Collapse gates **45 → ~8 + preservation** where types/generation subsume them.
- [ ] Retire the 560+ vitest aliases as real exports/paths land.
- [ ] Dependencies: one schema library (zod), one UI library (lit), one runner (vitest), one linter (biome), one WASM story (in-process; drop wasmtime + @wasmer/wasi); `node-llama-cpp`/`better-sqlite3` optional peers; remove jest/ts-jest/eslint remnants.

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
2. **W1:** typed `Env` + determinism lint; per-instance registries; events wired to the log; `senars logic prove` on the new core; `Verdict`; **byte-identical seeded replay**.
3. **⟶ GATE (§4): Go to W2+ only if W1 replays byte-identically. Otherwise stop and take the named fallback.**
4. W2: `one-oracle` gate green; WASM engine port; native provider retained; `engine.metta`.
5. W3: risk tiers + gate matrix; fail-closed irreversible demonstrated.
6. W4: formula-AST NAL + interpreter verifier + laws/vectors; transcribed table kept as witness.
7. W5: faculty specs + fallbacks; judge weight-change events; ECE demotion; GBNF + WASI heads + imagination ported.
8. W6: curriculum + RLFP labels; arena lanes; cost/quality surface; memory indexes + analyzers as folds.
9. W7: skill DSL + admission lifecycle; self-tools as rung 5; books re-fold; poisoned book rejected.
10. W8: generated MCP + profiles + npx + playground.
11. W9: deck renders a new event for free.
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

