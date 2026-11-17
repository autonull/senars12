# TODO.CORE.23.md — One Fold

**Supersedes:** CORE.21 and CORE.22, absorbed in full. Self-contained.
**Thesis:** the previous plans were right about *what* and wrong about *how many*. Everything they wanted — worlds, arena, repair, growth, stateless interop, a stand-alone logic tool, neurosymbolic synergy — falls out of **one deterministic fold over one log**, with logics, engines, and LM faculties plugged into a single standard seam. Fewer parts, more capability, every claim falsifiable.

---

## 1. What we are building

A reasoner that is simultaneously:

- **a stand-alone logic tool** anyone runs in five seconds (`npx senars logic prove …`, browser, edge, any MCP client) — the mcplogic capability, undiminished;
- **an auditable co-processor** other agents call statelessly for consequences, conflicts, counterexamples, and repairs;
- **an autonomous, self-growing agent** in seeded worlds, whose entire evolution replays byte-for-byte.

These are not three systems. They are **three profiles of one fold**.

```
use → log → mine → admit → cheaper reasoning → harder use → log …
```

The flywheel is not a layer. It is what the fold *does*: every solved problem deposits an admitted artifact (a schema, a lemma-rule, a skill, a faculty, a predictor update) that lowers the cost of the next. Growth is event-sourced, so **replay reproduces not just decisions but evolution**.

**The sentence:** one log, many logics, one economy, one ratchet — attention bounded, record unbounded, truth modular, evidence global, deliberation proportional to irreversibility, utility governed, predictions learned, and all self-modification flowing through one reversible admission gate nothing can widen.

---

## 2. The collapse — what was many becomes one

| Was (senars12 / CORE.21 / CORE.22) | Now | Mechanism |
|---|---|---|
| two MCP servers + substrate package | **one binary, one generated MCP surface** | profiles are data; tools project from schemas |
| Narsese↔FOL *bridge subsystem* | notation codecs + **projection rules** | one term IR; translation is printing + admitted rules |
| logic core pkg + engine manager + sessions + KB store | **one Axiomatic logic module** + oracle seam | KB = disposable check-time projection of the log |
| System One manifold / heads / distillation pipeline | **learned logistic judge + successor features + bandit** | ~450 LOC of audited predictors |
| drives + meta-goal injector | **task economy**; drives = gradient view | `driveᵢ = wᵢ·deficitᵢ` |
| episodic store + metrics + self-analyzer + stats managers | **folds over the log** | self-model is a query |
| capital layer (six classes) | **Repertoire + oracle memo-cache + curriculum task source** | one admission lifecycle |
| evolution engine | bandit over oracle/profile policies | rung-3 artifact |
| ontology manager | **domain pack** | data |
| Workshop / Mirror subsystems | rung-2 admission + postmortem faculty + log mining | same loop |
| per-module hand-written verifiers | **one interpreter strategy + algebraic laws + reference vectors + cross-engine agreement** | formula-ASTs |
| 44 gates | **~8 gates** + totality types + generated artifacts | schema-as-genome |
| 17-surface UI registry | schema-driven inspector + 3 views | new events get UI free |
| federation subsystem | book = repertoire + derivations export; receiver **re-folds** | one mechanism |

Net: ~14k production LOC + ~5k test — roughly **5× smaller than the current tree with a larger capability surface**, because versatility became configuration and duplication became generation.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ economy/   tasks · U=w·φ · SF · VoI · metareasoning · aging  │
│ loop/      appraise → repair → select → act → record         │
│ faculties/ LM roles + judgment cascade          (config)     │
├──────────────────────────────────────────────────────────────┤
│ kernel/    interned terms · one unifier · bags · step · gate │
│   logics/  NAL(+temporal) │ Axiomatic(SLD+engines) │ Fuzzy   │
│   oracles/ engines · LM · retrieval   (one seam, logged)     │
├──────────────────────────────────────────────────────────────┤
│ log/  append · compact · snapshot · replay · mine · fold     │
│ admit/ Repertoire ratchet (beliefs→skills→faculties→rules→code)│
└──────────────────────────────────────────────────────────────┘
```

One package, directories not packages. Five unifications carry everything:

1. **One term layer.** Hash-consed interned terms; Narsese and Prover9/TPTP/SMT-LIB/DIMACS/JSON are *notation codecs* over the same IR (round-trip property tests). Equality is identity; digests memoize.
2. **One truth port.** Modules own truth semantics; the kernel owns **stamps** (evidence identity) and mechanics. *Stamps are global, truth is local* — the invariant that makes cross-logic inference safe against laundering.
3. **One oracle seam.** Every external or nondeterministic computation — Z3, Clingo, MiniSat, Tau-Prolog, an LM faculty, a retrieval call — is an `Oracle`: zod-typed, budgeted, **logged, memoized by `(queryDigest, version)`, replay-pinned**. Live mode calls; replay reads. This single mechanism makes engines and LMs alike deterministic fold participants. The memo-cache *is* the lemma capital.
4. **One economy.** Everything schedulable is a `Task` with expected utility; one aged-bag scheduler; no parallel drive machinery.
5. **One ratchet.** All growth — beliefs, schemas, skills, faculties, rules, projections, overlays, code — is admitted data with one lifecycle.

### The standard interfaces

```ts
// Truth module — five universal ops; revision is a NAL *rule*, not an interface method
interface Logic<T> {
  id: string; version: string; codec: ZodType<T>;
  expect(t: T): number; conf(t: T): number;      // utility & VoI projections
  contradicts(a: T, b: T): boolean;
  policy: 'coexist' | 'report';
  rules: Rule<T>[];                               // inference is data
}
type Rule<T> = { name; premises: Pattern[]; conclusion: Pattern;
                 truth: TruthAST<T>; cost: Estimate };
// TruthAST primitives: module ops, consts, projection refs, and oracle(engine, query) nodes.
// The kernel compiles ASTs to closures for the step; the verifier INTERPRETS the same ASTs
// via a different evaluation path. Independence = strategy + laws + vectors, not duplicate code.

interface Oracle { id; version; query: ZodType; result: ZodType; cert?: ZodType;
                   cost: Estimate; call(q, env): Result }   // logged · memoized · pinned

type Verdict =
  | { kind: 'holds';     completeness: 'complete-within-fragment'; certificate: Derivation | Model }
  | { kind: 'fails';     certificate: Model | UnsatCore | Conflict; trace: Ref[] }
  | { kind: 'unchecked'; reason: 'fuel'|'depth'|'timeout'|'fragment'; partial: Ref[] };
```

One `Verdict`, two readings: for an entailment query `holds`=proved, `fails`=countermodel, `unchecked`=unknown; for an invariant check `holds`=safe, `fails`=violation, `unchecked`=**declared incompleteness, never laundered into confidence**. A finite model is independently re-checkable by pure evaluation; SLD/resolution traces re-walk; SMT/ASP verdicts are replay-pinned and cross-engine checked (honest limit, §12).

The kernel receives a typed `Env = { rng, clock, ids, oracles }` — no `fs`, no `net` in its type; an import-boundary lint makes misuse impossible. **Reflect at build time; fold at runtime.** Runtime metaprogramming would poison replay; all leverage lives in types, schemas, and generation.

### Shipped logics

| Module | Truth | Rules | Policy |
|---|---|---|---|
| **NAL** | ⟨f,c⟩ + stamp | ~16: deduction, induction, abduction, revision, analogy, detachment, negation + **temporal** (`;`, `:/:` with delay buckets, temporal induction) | coexist (paraconsistent; conflicts feed repair) |
| **Axiomatic** | basis `{assumed, derived, projected}` + certificate ref | Horn SLD as data (synchronous floor) + oracle-rules dispatching to prolog/sat/z3/clingo by query shape; engine choice is a learned bandit policy | report (conflict = structured repair fuel) |
| **Fuzzy** | grade ∈ [0,1] | 3 rules | coexist — *exists only to prove the port is real* (~80 LOC) |

**Projections are rules, not casts** (admitted, rung 4): `NAL→Axiomatic` at `f≥0.9 ∧ c≥0.8`, thresholds recorded as premises; `Axiomatic→NAL` caps confidence and **preserves base stamp ids**, so revision still detects evidence overlap after a round trip. The verifier checks projections like any rule.

**FOL is a check-time view, never a knowledge base.** Invariants are timeless (governance-pinned); fluents are temporal NAL beliefs. At decision time, project decision-relevant beliefs above threshold into a *local, disposable* assumption set, add invariants + proposed effects, run the check. Contradiction is about *this decision*, with a trace — never a growing global theory rejecting reality.

---

## 4. Faculties & judgment — versatility as config

Every LM capability is a `FacultySpec` (zod-validated, versioned, digest-pinned): one prompt + one output schema + **one mandatory symbolic fallback** (null provider runs it). Ten entries in one file, not ten subsystems: `perceive.formalize`, `propose.action|hypothesis|repair|plan|skill`, `retrieve.rerank`, `judge.rubric`, `narrate.explain`, `mirror.postmortem`. The engine is one function: select context → render → one OpenAI-compatible client → zod-validate → route to gate (proposers) or return scores (judges). Rejections logged with reasons.

Judgment is a **cascade with a hard floor**: symbolic constraint pass (veto, never learned) → evidence support → LM rubric judge (async, cached) → learned logistic judge over ~8 inspectable features, updated online, **every weight change an event with before/after and triggering episodes**. Per-judge ECE tracked from outcomes; a drifting judge is auto-demoted to weight 0 with an event. Profiles — `fast` (symbolic only, zero LM), `balanced`, `deliberate` (+ engine oracles + 2 repair attempts) — are config, switchable through a governed tool, and **run as arena lanes to produce a cost/quality curve instead of a vibe**.

**Neurosymbolic synergy is a configuration of one loop, not an architecture of two systems:** appraisal = bounded NAL derivation (what probably holds) ⊕ axiomatic check over the disposable projection (what must hold). A profile selects which modules and oracles participate — either, or both. Device profile: no LM at all. Logic profile: axiomatic only. Full agent: everything, metered.

---

## 5. The loop — cooperation as a two-way protocol

One schema file (~10 zod types, producer + consumer + test in the same commit): `Candidate, Judgment, ConsequenceReport, Conflict, Diagnostic, RepairRequest, Verdict, Outcome, Lesson, WorkItem`.

**Every System 2 output is a promptable artifact for System 1's next move.** Diagnostics are fuel, not logs. The repair ladder: param fix → precondition subgoal → alternate operator → explained veto with derived alternative. And **S2 mints S1 work**: *explain this contradiction, formalize this cluster, name this pattern, verify this skill* — work items enter the same task economy. Explanation debt is a task source. Synergy is an economy of work flowing both directions, scheduled by one utility mechanism.

**Risk-proportional deliberation** (fixes fail-closed deadlock): operators carry `reversible | bounded | irreversible`.

| Risk | Required to act |
|---|---|
| reversible | symbolic floor only (~ms) — liveness preserved |
| bounded | floor + learned judge; LM judge async, cached |
| irreversible | full cascade **and** `complete-within-fragment`; `unchecked` ⇒ escalate (pending approval) or refuse with explanation |

**Time and memory, from the log alone.** Episodic memory *is* the log; recall is a segment query. Procedural learning is log mining: a window over `(state-bucket, operation, state′-bucket)` triples emits operator schemas with NAL truth from observed frequencies (~400 LOC of counting). Surprise (predicted ≠ observed) is a first-class event feeding curiosity and repair. The working set (bags, concept table) is a **bounded materialized view**; the archive (compacted JSONL) is unbounded and lossless. Forgetting evicts the view, never the record; rehydration is replay. **AIKR bounds attention, not knowledge.**

---

## 6. Economy & governance

```
U(state) = Σ wᵢ·φᵢ   φ = [mission, safety, resources, coherence⁻¹, knowledge⁻¹, capability]
EU(task) = E[U(s′)−U(s)] − λ·cost − ρ·risk ;  rate = EU/cost → aged-bag sampling
```

- **Drives are the gradient** (`wᵢ·deficitᵢ`); homeostasis falls out. The old four drives map to weights, with none of the trigger bugs.
- **Long horizon without a planner explosion:** successor features — learn `SF(s)=E[Σγᵗφ(sₜ)]` by TD from the log; `V=w·SF` (~100 LOC). Delayed-reward competence + free transfer: a new mission is a new `w` over the same learned dynamics. Deliberate planning = bounded backward chaining over admitted schemas, checked at each expansion.
- **Answerable curiosity:** a question is a task whose payload is an acquisition plan (sim observation, MCP query, internal derivation). `VoI = P(answerable)·P(flip)·|EU gap| − cost(plan)`; answerability learned per channel. Unanswerable questions decay.
- **Metareasoning from judgment margins:** deliberate iff `P(flip)·stakes > cycle cost`. Small margin ⇒ think; large margin ⇒ act. No metareasoner subsystem.
- **Mission overlays:** directives admit scoped, expiring weight deltas through the gate (`{delta, scope, ttl, provenance}`). Behavior changes; the base objective never drifts.

**The one line that matters:**

| Governance owns (agent cannot write) | Learning owns (agent may update, audited) |
|---|---|
| utility weights **w**, invariants, judge vetoes/floors, envelopes, thresholds, skill policy, autonomy dial | SF predictors, cost models, judge weights *within* floors, proposer priors/exemplars, retrieval priors, oracle-selection bandit |

*Learning improves the prediction of utility; governance defines utility.* Weight changes are proposable via MCP → human approval, never self-applied.

---

## 7. Growth — the Repertoire

Rules, projections, skills, faculties, overlays: **one kind of thing**, one lifecycle:

```
propose → validate(schema) → trial(shadow/dry-run) → admit(event) → use → measure → refine|demote|retire(event)
```

| Rung | Artifact | Validation | Admits |
|---|---|---|---|
| 1 | beliefs, schemas, exemplars, priors | truth algebra + stamps | autonomous |
| 2 | **skills in a tiny DSL** — composition + conditionals + bounded loops, fuel-metered, effects *only* via admitted operators | schema + symbolic pre/post + dry-run episode | autonomous within policy |
| 3 | faculties, judgment profiles, oracle policies | schema + fallback proof + A/B trial, auto-rollback | autonomous, low-risk |
| 4 | rules & projections (formula ASTs) | interpreter + algebraic laws + reference vectors + shadow regression | autonomous if green, else human |
| 5 | code (new logic modules, kernel) | full CI + obligations in shadow repo, **external runner** | human merge only |

The DSL is strictly more expressive than compositions and still needs no sandbox: **the language has no dangerous words.** Shadow-worktree CI belongs at the code boundary, not around data the type system can check.

**Two laws make freedom safe:**
1. *No artifact may widen its own admission boundary.* Gates, verifiers, base weights, and the interpreter are code, outside the write boundary. Everything else is free.
2. *All growth is attributed and reversible.* Admit/demote/retire are events; bad growth is quarantined by status, never deleted; rollback is one event. The autonomy dial is governance-owned; the agent requests more freedom with its measured track record as evidence, never grants it.

**The curriculum generator** is a task source (~150 LOC): random theory synthesis + model finding + benchmark mutation produce problems whose **labels are certificates** — positives with proofs, negatives with countermodels. The learned judge and SF train on infinite verified data; no human annotation, no cold-start ceiling. Frequent oracle results promote from memo-cache to admitted lemma-rules (rung 4). **Books** = exported repertoire + derivations; a receiver re-folds and re-verifies, rejecting poisoned imports. Federation is not a subsystem; it is the fold, applied to someone else's log.

---

## 8. The elegance engine — tricks that delete code

| Trick | Mechanism | Deletes |
|---|---|---|
| **Schema-as-genome** | one zod declaration → TS type, log codec, MCP tool (SDK takes zod), **MRTR elicitation form**, deck form, fuzzer, doc table | dead-schema/drift class; ~10 gate scripts; hand-written codecs & tool wrappers (~800 LOC) |
| **Types as the gate** | `reducers satisfies Record<EventType, Reducer>` — a new event without a consumer is a compile error; `capabilities() = Object.keys(registries)` cannot lie | producer/consumer gate shrinks to a liveness test |
| **Formula-AST truth** | compile for the step, interpret for verification; algebraic laws + OpenNARS reference vectors | the second hand-written truth implementation (~300 LOC), *strengthening* verification |
| **Typed Env** | `{rng, clock, ids, oracles}`; no fs/net in the kernel type + import lint | runtime sandbox for the core; most purity gates |
| **Everything is a fold** | state, deck, scorecards, calibration, MCP resources, **self-model** (`(self --> reliable_at_X)` measured from outcomes) | episodic store, metrics collector, self-analyzer, stats (~1,000 LOC) |
| **Schema-driven deck** | generic inspector renders any event from its schema; 3 hand-built views (timeline, provenance tree, pressure) | the UI registry treadmill |
| **Interning** | hash-consed terms/stamps; equality = identity | all deep-equality code |
| **Compile-time rule index** | discrimination tree generated from rule patterns at build | runtime reflection; matching perf bugs |
| **One log, ten consumers** | audit, replay, recall, mining, Mirror, calibration, self-model, deck, MCP resources, scorecard | every parallel persistence path |

---

## 9. One binary, every surface

`senars` — one entry, profiles and **domain packs** as data. A pack = `{operators + risk classes, features φ, invariants, percept→term mappings, faculty overrides, adapter}`. Kernel, economy, log, gates never change.

| Use case | Profile / pack | Notes |
|---|---|---|
| stand-alone theorem tool | `senars logic prove/model/counterexample/check/convert` | the mcplogic product; CLI, REPL, library import |
| browser / offline / widget | same core, WASM engines, worker | identical verdicts & hashes |
| local assistant tool | `senars serve --profile logic` (stdio) | published alias `npx mcplogic` → same binary |
| hosted / edge / serverless | `--profile logic --transport http` | stateless handler, no affinity |
| audited co-processor (Lane B) | `--profile coprocessor` | appraisal engine over live kernel; caller policy as invariants |
| full autonomous agent | `--profile agent` + world pack | Habitat / Probe |
| personal knowledge assistant | assistant pack | paraconsistent evidence, cited answers |
| tool-call firewall / code agent | firewall pack | risk-tiered verdicts over tool ontologies |
| ops / IoT / robotics | device pack | **zero LM**, temporal schemas |
| compliance / audit | regulation pack | provenance chains, three-valued verdicts |
| tutoring / explainable reasoning | curriculum pack | trace-walk explanations, visible forgetting |
| research testbed | any | logics × profiles × lanes |
| batch benchmarks / formats | `senars bench`, `senars convert` | Prover9 · TPTP · SMT-LIB · DIMACS · JSON |

**MCP surface (generated, SDK v2, dual era):** `createMcpHandler(factory)` serves 2026-07-28 and 2025-era on one endpoint; `serveStdio` for local. Handlers written once in MRTR style (`inputRequired` + signed `requestState`; forms auto-generated from the Candidate schema). Long checks return task handles (`tasks/get`). Lists carry `ttlMs`/`cacheScope`, deterministic order. `_meta.traceparent` flows into the log. Tools project from Task/Rule schemas: `prove, find_model, find_counterexample, check_consistency, derive_consequences, audit_plan, explain_trace, ask, formalize, believe, goal, propose_action, submit_observation, request_skill, propose_patch, book_export/import, verify_certificate`. Resources are fold queries (`kb:`, `proof:`, `lemma:`, `book:`, `nar://…`, `arena://scorecards/…`), content-addressed, paginated. **No sessions anywhere; handles are log references.**

**Distribution:** npm/npx, browser bundle, edge worker entry, GitHub Releases tarball (single-file bundle + vendored `.wasm`, plain `node`), systemd unit in the runbook, MCP registry. **No containers, no external binaries, no Python.**

---

## 10. Worlds & arena

Habitat and Probe are **packs behind the same `serve --profile world`**, never embedded in the kernel. Roles (agent/observer/evaluator/admin), episode handles, idempotency keys, cursors. Operators carry FOL pre/post; **the evaluator checks them with the Axiomatic module directly** — SeNARS grades neither itself nor its rivals.

Lanes: **A** competent LM-only · **B** LM + co-processor · **C** full agent · **D** symbolic-only — same model, tools, seed, schemas, scoring — **crossed with judgment profiles** (`fast/balanced/deliberate`) to produce the cost/quality surface. Scorecards are folds over evaluator logs; fairness is a gate (equal manifests/seeds/schemas; agent scope cannot read evaluator state).

**Demonstrations (acceptance catalogue):** D1 mission intake · D2 repair loop · D3 skill synthesis + reuse · D4 memory pressure (bounded view, lossless record) · D5 learning lift · D6 stateless collaboration · D7 continuous seeded world · D8 side-by-side lanes · D9 compounding (fixed suite cheaper across generations) · D10 certified self-building · D11 portable truth (browser→CLI→kernel→peer, one certificate, four verifications) · D12 commons (poisoned book rejected, honest book reused).

---

## 11. Build

| Area | LOC |
|---|---|
| terms, notation codecs, interning | 900 |
| kernel (bags, view-cache, step, gate) | 1,400 |
| NAL + temporal | 950 |
| Axiomatic (SLD + engine adapters + CNF/Tseitin + models/symmetry + MUS) | 2,600 |
| projections + fuzzy | 230 |
| oracle seam + faculty engine + 10 specs | 900 |
| judgment cascade + learned judge | 450 |
| economy (tasks, U, SF, VoI, meta, aging, overlays) | 650 |
| loop + contract schemas | 950 |
| Repertoire + DSL interpreter | 700 |
| mining + learning | 600 |
| verification (interpreter strategy, laws, vectors) | 450 |
| MCP surface + handlers (mostly generated) | 500 |
| CLI / REPL / profiles / packs | 600 |
| deck (inspector + 3 views) | 700 |
| Habitat/Probe packs + arena fold | 800 |
| formats + axiom data | 400 |
| persistence / compaction / replay | 500 |
| **Total** | **≈ 14,300 production + ~5,000 test** |

| M | Content | Wks | Kill criterion |
|---|---|---|---|
| M0 | skeleton: log, terms, truth port, NAL core, schema-genome pipeline, golden replay | 2 | byte-identical seeded runs; totality types compile |
| M1 | full NAL + temporal, gates, snapshot/restore, mining; obligations 1–6 | 3 | headless green, no LM; fairness over 10k ticks |
| M2 | faculties + judgment + repair loop + contract | 3 | traced repair; fail-closed irreversible, live reversible |
| M3 | **Axiomatic + engines + certificates + projections**; MCP logic & coprocessor profiles; stand-alone faces | 3 | cross-engine agreement; laundering cap; instance-hop; `npx` works |
| M4 | Habitat/Probe + arena + scorecard; economy + SF + VoI | 3 | first synergy-lift number; obligations 8, 10, 11 |
| M5 | Repertoire rungs 2–4; curriculum; books; deck | 3 | D3/D9/D10/D12; **evolution replays** |
| M6 | code rung 5; ablations; soak; docs; release | 2 | cost/quality surface; 1-hour unattended; fresh-contributor reproduction |

**~19 weeks.** The port exists at M0, freezes at M3 when the second consumer (Axiomatic) lands — the two-consumers rule applied honestly to the one abstraction we commit to early, justified because the interpreter/verifier split forces the seam anyway.

---

## 12. Obligations, gates, limits

**Proof obligations (each a falsification test in CI):**
1. Evidence laundering — 5× re-derivation never inflates confidence.
2. Translation ambiguity — nuance yields candidate sets + MRTR, not one confident wrong parse.
3. Bounded degradation — shrinking budgets yield `unchecked`, never hang/fabricate.
4. Contradiction resilience — both beliefs coexist with distinct truth.
5. Derivation replay — byte-identical incl. oracle pins, config digests, **and genome**.
6. Scheduler fairness — every admissible class nonzero share over 10k ticks.
7. Sabotage — a patch disabling guards fails obligations; external merge only.
8. Cross-system laundering — NAL→Axiomatic→NAL respects the cap; overlapping stamps block revision.
9. Judge fail-closed (irreversible) / liveness (reversible); miscalibrated judges demoted with events.
10. Utility governance — agent writes to governance artifacts rejected by construction; overlays expire.
11. Oracle integrity — models re-evaluated purely; cross-engine agreement; replay pins hold.
12. Growth boundary & reversibility — no artifact widens admission; rollback is one event.
13. Surface parity & statelessness — browser/node/edge identical hashes; instance-hop; era matrix.

**Gates (~8):** golden-replay (incl. `config:digest`) · obligations battery · totality + liveness · import-boundary (Env purity) · schema-drift (generated artifacts fresh) · fairness/soak · cross-engine agreement · format round-trip. MCP conformance (Inspector) runs inside obligation 13.

**Honestly limited:** NAL subset, not full NAL-8 (higher-order arrives as rung-4 data). Linear value approximation, not POMDP optimality; eligibility-decay credit assignment declares its bias. Fuel-bounded checking is incomplete — *typed* as `unchecked`, never hidden. SMT/ASP certificates are replay-pinned and cross-checked, not independently re-proven (finite models and SLD traces are fully checkable). LM judges uncalibrated until outcomes accumulate; the cascade says so and demotes drift. Formula-AST independence is strategy-level; laws and reference vectors are the backstop.

---

## 13. Definition of done

All twelve demonstrations reproducible from seeds by a fresh contributor. One binary serves every surface in §9. One certificate verifies on four surfaces. The fixed held-out suite gets cheaper across generations (steps ↓, oracle calls ↓, ECE ↓). A certified patch is admitted unattended with invariants proved. Two instances share a book and solve faster together. One hour autonomous, replayable, recoverable — **evolution included**. ~8 gates, one IR, one truth port, one oracle seam, one economy, one ratchet, one log. Known-red ledger empty.

---

## 14. Kickoff — first twelve changes

1. Schema-genome pipeline (zod → type/codec/tool/form/fuzzer/doc) + totality types.
2. One log + interning + golden replay + `config:digest`.
3. Truth port + NAL core rules as formula-ASTs + interpreter verifier + laws/vectors.
4. Temporal terms + surprise events + log mining (procedural schemas).
5. Gate matrix (risk × verdict) + snapshot/restore; obligations 1–6.
6. Oracle seam + faculty engine + 10 specs + mandatory fallbacks.
7. Judgment cascade + learned judge + calibration/demotion; repair loop + contract.
8. Axiomatic module: SLD floor + engine oracles + CNF/models/MUS + certificates; projections; obligation 8/11.
9. Generated MCP surface (dual era, MRTR, tasks) + logic/coprocessor profiles + CLI/browser/edge faces.
10. Economy: U/SF/VoI/metareasoning/overlays; obligations 9/10.
11. Habitat pack + lane A + fairness gate + first scorecard fold.
12. Repertoire ratchet + DSL + curriculum generator; obligation 12 — the flywheel's first turn.

---

## 15. Decision log

- **D23.1** One fold, one log. Profiles and packs are data; there is one binary.
- **D23.2** Logics unify behind one port; engines and LMs unify behind one oracle seam (logged, memoized, replay-pinned).
- **D23.3** Stamps global, truth local. Projections are admitted rules; the bridge is not a subsystem.
- **D23.4** FOL is a disposable check-time view; invariants timeless, fluents temporal.
- **D23.5** Three-valued verdicts; incompleteness is typed, never laundered. Deliberation ∝ irreversibility.
- **D23.6** Memory is a cache over the log; AIKR bounds attention, not knowledge.
- **D23.7** Synergy is a two-way work-item economy; diagnostics are fuel; S2 mints S1 work.
- **D23.8** Learning predicts utility; governance defines it. Overlays expire.
- **D23.9** All growth is one reversible ratchet; no artifact widens its own boundary; the genome replays.
- **D23.10** Certificates label the curriculum; the system teaches itself.
- **D23.11** Reflect at build time, fold at runtime. Every trick must delete code.
- **D23.12** Worlds grade the agents; federation is re-folding, not trust. No containers, no binaries, no Python.

---

**Why this is the same ambition with fewer parts:** CORE.21's worlds, repair, governance, and observation; CORE.22's stand-alone tool, certificates, flywheel, and stateless interop; v2's modular truth, faculties, contract, and economy; v3's corrections and elegance engine — all of it survives, and almost all of it becomes *the same mechanism seen from different angles*. The log is the memory, the curriculum, the capital, the self-model, and the federation format. The oracle seam is the engines and the LMs. The ratchet is the growth and the safety. One fold, doing the work of a dozen subsystems — and because it is one fold, it replays, it audits, and it compounds. That is the elegance that lets the thing grow without breaking: **freedom in an unbounded proposal space, reliability in a monotone verified ratchet, and both halves running on one log.**

