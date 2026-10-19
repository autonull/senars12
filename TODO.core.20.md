# CORE.20 — The Coherent Neuro-Symbolic NARS: Parity+ with OpenNARS, ONA, and NARchy

**Status:** Directive · successor to `TODO.core.19.md` on the *capability* axis (CORE.19 hardened the substrate; CORE.20 spends it). Sibling of `TODO.ui.19.md` — CORE.20 owns reasoning/autonomy/reach, UI.19 owns presentation. Its end state is architectural as well as functional: one coherent system in which NAL is the authoritative reasoner and language models are first-class facilitators — **complete neuro-symbolic integration** (§0.5).
**Implemented at HEAD (2026-10-18):** CORE.19 is closed — every workstream DONE, §8 walkthrough test-backed (`tests/nar/core19-acceptance.test.ts`), §11 battery green, `complexity:budget` re-entered. UI.19 is **not yet implemented**: the client still ships the stub `gate-inspector.ts` and an unbound `$cycleState`, has no thought stream, and logs no progress. Crucially, **CORE.19 already shipped UI.19's kernel-side prerequisites** (cycle control-plane handlers, `cycle.state` emission, gate/derivation records, provenance, autonomy heartbeat, translation, persistence/replay) — so UI.19 has collapsed to presentation plus an `auto` input mode.
**Scope:** reasoning kernel (NAL 1–9), Narsese, temporal **models**, procedural/operator inference, operant learning, motivation, autonomy, memory scale, non-UI reach (REPL/interop/embedding), and the UI/UX parity checklist that consumes UI.19.
**Character:** Completion, not exploration. The substrate is hardened and deterministic; the work now is to *finish the logic*, *support the temporal plurality the logic needs*, *bind every neural touchpoint into one coherent neuro-symbolic contract*, *prove it against the reference systems with a conformance corpus*, and *exceed them where the hybrid architecture already gives an advantage*. No new packages, no new UI registries, no time estimates.

---

## 0. The pivot in one paragraph

SeNARS currently ships **44 of 55 declared inference rules**, and the 11 disabled ones are precisely the ones the reference systems are strongest at: all of NAL-7 (temporal), the NAL-4 product/image connective, and a cluster of structural rules parked on term-flooding guards. Two things it does have that the plan must *honour, not rebuild*: first-class **operator terms** — `f^(x,y)`, i.e. `move(dir-->left,steps-->3)`, one `operation` kind that already drives tool use (`terms/impls/operation-term.ts`, `dispatchToolGoals`) — and a small temporal core (`&/`, `&|`, `=/>`, `=|`). NAL-8's gap is therefore not representation but *inference and execution*: operations are not executed by a rule, goals are not deduced or subgoaled, and operator terms are not rewritten. NAL-9 exists only *beside* the logic (a timer-driven self subsystem, its rules deleted). The temporal gap is deeper than "missing rules": SeNARS has **one implicit temporal posture**, and the three references disagree on it — OpenNARS uses occurrence intervals and tense markers with an internal clock; ONA uses a fixed-timestep temporal window in a separate sensorimotor cycle; the author's own **NARchy** uses continuous-time numeric deltas (`dt`) attached to `&&`/`==>` terms, with virtual disjunctions and integrated negation. Locking SeNARS to any one of these is how a reasoning project stagnates. CORE.20 therefore closes the logic (F1–F4) — and makes temporality a **port with several models** (F2) — makes the system usable without a browser the way the references are (U1–U2), makes it *learn and want* the way the references do (A1–A4), and closes the UI/UX gap by finally landing UI.19's deck (X1). It measures all of it with one thing none of the references has: a **conformance corpus** that runs their own examples headless, seeded, across each temporal model, and does not accept "green" without a verified derivation. And it does all of it toward one *shape*, defined in §0.5: not a pile of features but the definitive NARS-like system — a coherent neuro-symbolic whole in which the symbolic core is the authority, language models are first-class facilitators (perception, proposal, judgment, explanation, guidance), and the two are bound by one contract, one stream, one provenance graph, and one temporal port.

## 0.5 The target architecture — complete neuro-symbolic integration

The plan's north star is not a feature list but a *shape*. SeNARS is one reasoning mind with three strata and a set of non-negotiable invariants; every workstream below either completes the strata or preserves the invariants.

**The spine (three strata).**

```
┌───────────────────────────────────────────────────────────────┐
│ SURFACE   event stream · provenance · observation deck         │  CORE.19 C1+C3 · UI.19 X1
│           CLI · REPL · HTTP · MCP · wire · embedding           │  CORE.19 C7 · CORE.20 U1/U2
├───────────────────────────────────────────────────────────────┤
│ NEURAL    perceive (NL→Narsese) · propose (rules, hypotheses,  │  CORE.19 C6 · CORE.20 I1
│ facilit.  schemas) · judge (embeddings, System One) ·          │
│           explain (Narsese→NL) · guide (search, selection)     │
├───────────────────────────────────────────────────────────────┤
│ SYMBOLIC  NAL 1–9 · temporal models · operator terms ·         │  CORE.20 F1–F4
│ AUTHORITY memory · autonomy · drives · governance              │  CORE.19 C4/C5
└───────────────────────────────────────────────────────────────┘
```

The symbolic stratum is the authority; the neural stratum is a *facilitator* that proposes, judges, translates, and guides but never decides; the surface stratum is a *window* with one stream and one provenance graph. Complete neuro-symbolic integration is exactly this: neither a symbolic system with an LLM bolted on (the current scattered state) nor a neural system with a logic veneer, but a single system whose strata share one admission gate, one event stream, one provenance graph, one consistency boundary, and one explanation path.

**The integration ladder (the target is the top).**

| Level | Name | Meaning |
|---|---|---|
| **L0** | Symbolic-only | pure NAL; no LM. The system must always be *able* to run here (D10). |
| **L1** | Neural I/O | LM translates NL↔Narsese only. |
| **L2** | Neural proposals | LM proposes rules, hypotheses, schemas; admitted, revisioned, replayable. |
| **L3** | Neural judgment | embedding/LM models score, ground, rank (System One); they influence *control*, never a derivation's soundness. |
| **L4** | Neural-amplified inference | LM guides search (premise/rule selection, ordering) but never changes *what is derivable*; symbolic verification remains final. |
| **L5** | **Complete integration** | all of the above, bidirectional, provenance-carrying, deterministic-fallback-preserving, behind one admission gate. **The target.** |

SeNARS today is an incoherent **L2–L3**: the pieces exist (LM rule producer, System One, `NLUnderstandingService`, `NLGenerationService`, `Formalizer`, `ExplanationGenerator`) but are not bound by a contract and do not share a pipeline. CORE.20's **I1** takes it to **L5 with soundness preserved**: every neural touchpoint is enumerated, gated, labeled, and fallback-protected, and a coherence test asserts it.

**The invariants (the coherence spine — every workstream preserves these).**

1. **One symbolic authority.** NAL decides; everything neural proposes.
2. **One admission gate.** Every external/neural task enters only through `KernelPerceptionGate.admitFormalization`, tagged with its source (D17).
3. **One event stream.** Every occurrence flows through the CORE.19 bus (D11).
4. **One provenance graph.** Every claim resolves to real records (CORE.19 C3).
5. **One consistency boundary.** Every persisted artifact declares what it saves and omits (D14).
6. **One temporal port.** Temporality is plural behind one interface (D25/D29).
7. **One explanation path.** Engine facts and paraphrase are labeled distinctly (CORE.19 C6).
8. **Determinism or a declared exemption.** Same seed+inputs ⇒ same trace (D13).
9. **Auditable learning.** Every learned artifact (rule, schema, hypothesis, knob) is revisioned, replayable, and revocable.
10. **Bounded everything.** Every accumulator, ring, and loop declares capacity and pressure (D14, CORE.19 C1.4).

## 1. Parity scorecard (the evaluation)

Verdicts are against *both* parity targets (OpenNARS, ONA) unless split; NARchy appears where it is the reference for a *technique* rather than a parity target. "Exceeds" means the hybrid architecture already offers something none of them has, and the plan protects it. All SeNARS claims are at HEAD 2026-10-18, grounded in §4.

### 1.1 Functional (logic & inference)

| Capability | OpenNARS | ONA | SeNARS @ HEAD | Verdict |
|---|---|---|---|---|
| NAL-1/2/3 core (syllogisms, sets, similarity) | full | full | 44 shipped rules incl. core/comparison/equivalence | **at parity** |
| NAL-4 product & **image** connectors | full (legacy) | full | product `*` exists; **image `(/, rel, args)`/`(\, rel, args)` absent** (NARchy's arity-4 form) | **below** |
| NAL-5/6 implication, variables, higher-order | full | partial (binary, KISS) | real, but `variableIntroduction`/`revisionWeak` are identity stubs | **at parity, stubs open** |
| NAL-7 temporal (events, tense, causal) | full, internal clock | fixed-timestep window | 4 rules disabled, `occurrenceTime` never populated, **one implicit model** | **below** |
| NAL-8 procedural (ops, goals, planning) | full, planning-rich | full, real-time sensorimotor | **operator terms `f^(x,y)` exist + drive tools**, but no execution rule, no goal deduction/subgoaling, no operator rewriting | **below** |
| NAL-9 self (mental ops, introspection) | designed, partial | absent | absent as rules; self-modification lives on timers | **below OpenNARS / above ONA** |
| Revision & choice | first-class rules | first-class | real (revision at admission, choice via bags) but not rule-table members | **at parity** |
| Truth functions (f,c), extended Boolean, De Morgan disj | full | full | real (`Truth.ts`); disjunction as de Morgan is partial | **at parity** |
| Negation | separate entity | separate entity | separate; **NARchy's integrated "full-spectrum negation" not modelled** | **at parity** |
| Term-flooding structural rules | enabled | enabled | 8 rules **disabled** on flooding/subsumption guards | **below** |
| Neuro-symbolic rule induction, System One, MeTTa | — | — | LM rule producer, judgment manifold, exact-computation substrate | **exceeds** |

### 1.2 Useful / usable

| Capability | OpenNARS | ONA | SeNARS @ HEAD | Verdict |
|---|---|---|---|---|
| REPL / shell | yes | yes (`./NAR shell`) | **no interactive REPL**; one-shot + reporting modes only | **below** |
| Experience files, save/load | yes | yes | persisted boundary (CORE.19 C4), no Narsese experience file | **partial** |
| Narsese compatibility | full | full | missing QUEST `@`(partial), budget `$..$`, occurrence `\|`, images, DIFF `<~>`, DELTA `Δ`, INT, `&&+N` | **below** |
| `.nal` / eval test suites | `.nal` suite | `evaluation.py` | 101 pnpm scripts + vitest; **no reference-corpus compat** | **below** |
| Observability: provenance, replay, determinism | trace window | dashboards | CORE.19 one stream, gate/derivation records, byte-identical replay | **exceeds** |
| Interfaces: CLI/HTTP/SDK/MCP | GUI + channels | C API, UDP, Docker, ROS | CLI, HTTP `/reasoning/*`, MCP, SDK | **at parity on web, below on wire/embed** |
| Wire protocol (multi-instance) | NarNode UDP | UDPNAR | none | **below** |
| Embedding (C API / WASM / Docker) | Maven lib | C API, Docker, Colab | SDK only, no embed/Docker | **below** |
| Docs, gates, security invariants | wiki | wiki | 44 gates, security invariants, generated API docs | **exceeds** |
| Natural language in/out | `english_to_narsese` (legacy) | NARS-GPT, legacy NLP | `Formalizer` + null provider + explanation generator (deterministic fallback) | **exceeds** |

### 1.3 Autonomous / cognitive / agentic

| Capability | OpenNARS | ONA | SeNARS @ HEAD | Verdict |
|---|---|---|---|---|
| Autonomous loop | working cycle (always on) | two inference cycles (always on) | heartbeat exists (CORE.19 C5) but **default off** | **below** |
| Curiosity | designed | minimal | real (drive + curiosity-question rule + RL exploration) | **at/above** |
| Consolidation / forgetting | decay + forgetting | eviction by **usefulness** | decay + pressure eviction + recoverable consolidation pass; **no usefulness eviction, no auto-balanced forgetting (NARchy)** | **at parity** |
| Drives / motivation | design, partial | motivation module | 4 homeostatic drives, but meta-goal policy **off + inert dynamics** | **partial** |
| Emotion / satisfaction | `[SATISFIED]`, desire-value | pragmatic/minimal | **absent** | **below** |
| Operant conditioning | procedural learning | **matches RL benchmarks** | Q-learning + GAE/SARSA + RLFP, but **no temporal-induction conditioning proven** | **below on proof** |
| Procedural / skill learning | yes | curiosity-driven exploration + operant | schemas from derivations; game reflex learning; **operator terms already exist** | **partial** |
| Planning / backward inference | rich, multi-goal | subgoaling over implication | goal→tool dispatch; no backward goal rule | **below** |
| Lifelong / cross-restart memory | experience files | memory-mapped persistence | **exceeds** (declared boundary, replay, determinism) | **exceeds** |
| Self-modification governance | NAL-9 (partial) | — | SelfOptimizer, ArchitectureDriver, patch/knob governance | **exceeds** |
| Multi-instance ecology | NarNode UDP | UDPNAR | none (NARchy's InterNARchy is the reference design) | **below** |

### 1.4 UI / UX

| Capability | OpenNARS | ONA | SeNARS @ HEAD | Verdict |
|---|---|---|---|---|
| Live graph of reasoning | Main GUI | `concepts_to_graph.py` | workspace renderers (2D + experimental 3D), UI.19 deck **not landed** | **partial** |
| Concept window (tasks/beliefs/truths) | yes | dashboard | aspects mounted; provenance/history **not wired** to real records | **partial** |
| Cycle controls (step/pause/rewind) | working-cycle UI | dashboard | controls mounted, **stub** (`gate-inspector.ts`); `$cycleState` unbound | **below** ([^1]) |
| Derivation trace / explanation | prediction/test chamber | `printDerivations`, filters | trace viewer + explanation generator exist (CORE.19 C6), **not rendered** | **partial** |
| Thought stream / narration | internal-experience log | dashboards | **absent** | **below** |
| Research apps (Pong, TestChamber, Cartpole, vision) | many | many + ROS | arcade games (Tetris, 2048, Catch, Bandit, Arithmetic, SelfMeta) | **at parity on games, below on vision/robotics** |

[^1]: The kernel handlers behind these controls **are** implemented (CORE.19 C2: `cycle.step/pause/resume/rewind`, `cycle.state` emitted per cycle); only the UI binding is missing. This is why X1 is cheap.

### 1.5 Neuro-symbolic integration maturity

| Level | OpenNARS | ONA | SeNARS @ HEAD | Target |
|---|---|---|---|---|
| L0 symbolic-only | yes | yes | yes (D10) | keep |
| L1 neural I/O | legacy NLP | NARS-GPT + legacy NLP | `Formalizer` + null provider + explanation generator | keep |
| L2 neural proposals | — | — | LM rule producer, schema inductor (scattered, no single contract) | bind |
| L3 neural judgment | — | — | System One manifold, embeddings, groundedness gate | bind |
| L4 neural-amplified inference | — | — | partial (System One ranking); not contractual | complete |
| L5 complete integration | no | no | **no** — pieces exist, no one contract | **reach (I1)** |

Neither reference reaches L2+. SeNARS is the only one positioned to, and reaching L5 coherently is the plan's real ambition beyond parity.

**Summary.** SeNARS is **at parity or ahead** on the neuro-symbolic axis, observability, persistence/determinism, governance, and non-UI web reach. It is **below** on: NAL-4 images, NAL-7 temporality (and *plurality of temporal models*), NAL-8 execution/planning, NAL-9, Narsese coverage, REPL/experience/`.nal` compat, wire protocol and embedding, default-on autonomy, emotion/motivation, proven operant conditioning, and the observation deck. CORE.20 closes exactly those, adopts the strongest technique from each reference (NARchy's dt-image-forgetting-negation, ONA's two-cycle operant loop, OpenNARS's interval tense + emotion design), binds the whole behind one neuro-symbolic contract (I1), and keeps the axes where it already leads. The references offer *parity*; the coherent neuro-symbolic whole (L5) is what SeNARS offers *beyond* them.

## 2. Relationship to CORE.19 and UI.19 (division of labor)

| Concern | Owner | CORE.20 contribution |
|---|---|---|
| NAL-4/7/8/9 rules, operator-term inference, **temporal model port** | **CORE.20** | implement + verify |
| Narsese parser breadth, REPL, experience files, `.nal` runner | **CORE.20** | own |
| Wire protocol, embedding (WASM/Docker), eval harness | **CORE.20** | own |
| Operant conditioning, motivation/emotion, default-on autonomy, memory scale | **CORE.20** | own + benchmark |
| Conformance corpus & parity scorecard | **CORE.20** | own (the new source of truth) |
| Thought stream, trace viewer, aspects, concept window, renderers | UI.19 | CORE.20 emits; UI.19 renders |
| `input-hud` `auto` mode | UI.19 | CORE.20 provides the kernel `perceive`/`explain` surface |
| Surface/aspect/renderer registries, 3D, package extraction | UI.19 | untouched |

**Division rule (inherited and tightened):** if a task can be expressed as *"make the kernel do X and emit/verify it,"* it is CORE.20. If it is *"display X,"* it is UI.19. The one legitimate CORE.20 touch under `ui/` is the server host routing kernel messages (as in CORE.19) and the parity client-binding checklist in X1, which *verifies* UI.19's work rather than performing it. No renderer, surface, aspect, or store-atom edits.

**Hard dependency:** X1 cannot be "done" until UI.19 lands. CORE.20 does not block on it — the scorecard records X1 as *blocked-by-UI.19* and the rest proceeds.

## 3. Halt list (enforced for the duration of CORE.20)

1. **No new UI registries or contract surface.** `FocusKind`, `Aspect`, `Shape`, `Channel`, `Arrangement`, and the event-bus families are open and sufficient. **Narrow exception (D25):** exactly one *kernel* port — `TemporalModel` — is permitted, with ≥2 implementations behind a config selector; it is a port like `NARConfig.driveMetaGoals`, not a registry of registries, and it is gated by the corpus.
2. **No package extraction or module moves.** The workspace packages stay as declared; `nar/` grows, it does not split.
3. **No UI edits.** Renderers, surfaces, aspects, view-specs, store atoms, contracts are UI.19's. Where a UI binding is needed, emit the event, verify the handler, and log it in X1/§10.
4. **No re-shimming landed slices.** Consume CORE.19 (one stream, control plane, boundary, ledger, heartbeat) and UI.18/19's contract; do not rewrite them.
5. **No disabling-by-default.** A rule ships enabled (or is not declared). If a guard is genuinely needed, it is a *precondition*, not a `DISABLED` entry. Retiring a rule requires a verified truth-function proof that it is unsound, not a flooding complaint. **Temporal exception:** a temporal rule a *model* does not support is declared unsupported *by that model* (D15), not globally disabled.
6. **No unverified inference.** Every newly enabled rule passes `verifyRecord` truth algebra (`core/src/verify-derivation.ts`), the determinism gate, and the hermetic gate before it ships.
7. **No general capability claims.** Results are reported per-scenario via the scorecard ("in this scenario, with this model, these inputs, the kernel did X"). No "matches OpenNARS" claim without a green corpus row.
8. **No chasing known-red unless it blocks a workstream.** Log in §13.
9. **No LLM-dependent core path (D10).** Every capability degrades to the deterministic path; the parity corpus runs with `LM_PROVIDER=mock` and with no provider.
10. **No time estimates.** Ordering only.

## 4. Orientation (verified facts — do not re-discover)

### 4.1 Rules & logic
- Rule table is **declared, not import-driven**: `RULE_BODIES` + `BUILTIN_DECLARATIONS` (`nar/src/rules/impls/registration.ts:40,433`). **55 declared, 11 disabled** (`DISABLED`, `:407`), **44 ship**.
- Disabled set (`registration.ts:407-425`): the four NAL-7 rules (`sequenceIntroduction`, `parallelIntroduction`, `predictiveImplication`, `temporalDeduction`) with reason *"temporal reasoning is not correct yet"*; and eight structural rules (`conversion`, `comparison`, `structuralReduction`, `difference`, `conjunctionIntro`, `intersectionComposition`, `unionComposition`, plus the inheritance-subsumption gap at `:425`) parked on flooding/subsumption guards.
- `occurrenceTime` is **defined** (`nar/src/rules/types.ts:12`) but `registration.ts:409` states nothing populates it reliably; the only ordering check is `buildSequenceRule` (`rule-builder.ts:148`), unreachable while its rules are disabled.
- Term operators present (`nar/src/terms/operators.ts:22-30`): sequence `&/`, parallel `&|`, predictive `=/>`, retrospective `=|`, operation `^`, product `*` (n-ary, non-commutative). **Absent:** tense/interval ops `:|:`, `:/:`, `\`, `/`; delta forms `&&+N`; image `(/, rel, args)`/`(\, rel, args)`; DIFF `<~>`; DELTA `Δ`; INT/BOOL.
- Stubs: `nal.revisionWeak` (`extended/comparison-ext.ts:31`) returns premise 1 only when identical; `variableIntroduction` (`extended/equivalence.ts:16`) is the identity `A-->?x ⊢ A-->?x`.
- NAL-9 rules are **deleted**: all six ids asserted `undefined` in `tests/nar/nal9-self.test.ts:8-47`.
- Rule application is recorded (CORE.19 C3): `DerivationRecorder` fire ring, `verifyRecord`-verifiable, durable and replayed.

### 4.2 Operator terms (the NAL-8 substrate that already exists)
- `operationTerm(name, args)` (`nar/src/terms/impls/operation-term.ts`) builds the `operation` kind; `move(dir-->left,steps-->3)` is a term like any other, `(move^(x,y))` and `move(x,y)` are the **same** term, and the grammar reads it back without a special case. `^move` is now a parse error; `kind` is the recogniser.
- `operationNameOf` (`:55`) decodes; `nar/src/nar-execution.ts:735-770` `dispatchToolGoals` detects operation goals (via `operationNameOf`, `:725`), removes them, and calls `toolGoalExecutor` → `tools/impls/goal.ts:14` → `ToolManager.execute`; success/failure writes RLFP reward and stimulates the competence drive. Wired at `nar.ts:372`.
- `GameFocus` (`focus/GameFocus.ts:354-370`) runs perceive→propose→negotiate→act→learn; `GoalActionAdapter.proposeAction` (`rl/impls/adapters/action.ts:49`) turns selected actions into `^op` goals. Cycle order: perceive → attend → reason → authorize → propose → learn (`nar-execution.ts:206-307`).
- **What is missing (F3):** inference *over* operator terms (decompose/rewrite/evaluate — NARchy's `Decompose1`, `Evaluate`), and execution *as a rule* (`!^op` + satisfied precondition → execute at a decision threshold), plus goal deduction/subgoaling.

### 4.3 Learning / drives / self
- RL is native-NARS Q-learning: `QBeliefStore` stores Q as `((*,state,^action) --> predicts_reward)` beliefs; `RewardBeliefAdapter` does GAE/TD and SARSA; ε-greedy policies with curiosity exploration. RLFP exists and is gated by `RLFP_ENABLED`.
- Drives: `DriveManager` (`drives/impls/DriveManager.ts:21`) maintains curiosity/competence/coherence/social with leaky integration and injects `(self-->property)!` goals; `drives/meta-goals.ts` maps deficiencies to operations but is **off by default** (`createDriveMetaGoalPolicy`, `:66`), and CORE.19 C5.6 showed the mapped drives' equilibria (~0.58–0.69) sit **above** the fixed trigger, so the policy is inert even when bound.
- Self: `self/ReasoningAboutReasoning.ts` (MetacognitiveMonitor + SelfAnalyzerService, every 10 cycles), `self/SelfOptimizer.ts` (tunes knobs, consolidates, rebalances), `self/architecture-driver.ts` (proposals + self-beliefs/goals). Five `meta-*` rules exist (`rules/impls/meta-rules.ts`) but `registerMetaRules` is called only by a demo/bin, **not `nar.ts`**.
- Emotion: **absent** (grep for valence/arousal/mood returns only equivalence/demotion helpers).

### 4.4 Memory
- `Concept` owns belief/goal/question bags (caps 100/50/20, `memory/concept.ts:143`); `Memory` is a `TermMap<Concept>`; attention is a single-write surface (`writeAttention`, `concept.ts:38-57`) with named reasons. Belief revision at admission (`concept.ts:327`, `Truth.revision`). Single decay sweep (`memory.ts:582`, rate 0.01), `Forgetting`/`Archive`/pressure eviction, `consolidate` every 10 cycles (`memory.ts:374`). **No usefulness-based eviction; no auto-balanced forgetting (NARchy).**

### 4.5 Narsese & reach
- Operators the parser lacks (per `docs/java/Op.java` and `docs/java/java_to_js.md` §1.2): `&&+N`/`&&-N`/`&&+-` deltas, pattern var `%`, budget `$..$`, occurrence time `\|`/`now`, QUEST `@` (COMMAND `;` partially handled — CORE.19 C6.2 admits `(do);`), images `\`/`/`, DIFF `<~>`, DELTA `Δ`, INT `+`, BOOL `B`, `pred:subj`.
- CLI: `src/bin/bot.ts` modes `--status/--doctor/--tune/--arcade/--multiagent` + one-shot positional Narsese (`src/bin/lib/oneshot.ts`, CORE.19 C7.1). **No interactive REPL.**
- MCP (`src/bin/lib/mcp/`), HTTP (`/metrics` + env-guarded `/reasoning/*`), SDK (`USAGE.md`, CORE.19 C7/C9). No wire protocol, no embedding, no Docker.
- UI client has `instrument/{cycle-controls,gate-inspector,trace-viewer}.ts`; `gate-inspector` is a stub, `$cycleState` unbound; no thought stream.

### 4.6 Reference models (verified, for design — do not re-discover)
- **NARchy** (`github.com/narchy/narchy`, author-owned; local reference `docs/java/`): derives from OpenNARS; strengths are **continuous-time NAL-7** (numeric `dt` on `&&`/`==>`; `&&+N` forward, `&&-N` reverse, `&&+-` variable; `&|` joined-at-start, `|&` joined-at-end; `DTERNAL`/`XTERNAL`), **temporal belief tables**, **virtual disjunctions** (`||` = `--(&& -- --)`, de Morgan), **full-spectrum negation** (negation inside concepts), an **image term** `(/, relation, args)` / `(\, relation, args)` (arity 4, `_` placeholder; rules `imageInt`, `imageExt`, `imageNormalize`), **pressurized auto-balanced forgetting**, adaptive concept allocation, concurrent bags (`HijackBag`/`CurveBag`), a binary I/O codec, **InterNARchy** P2P multi-agent protocol, and the **NAgent** sensor/motor API. Rule file: `docs/java/nal/nal4.nal`.
- **OpenNARS**: full NAL 1–9, internal clock/subjective time, interval/tense temporal inference, `[SATISFIED]` feeling operators + desire-value, NAL-9 mental operators, backward/planning inference, Main GUI.
- **ONA**: real-time two-cycle engine (semantic NAL1-6, sensorimotor NAL6-8), fixed-timestep temporal window, NARS-native operation execution at a **decision threshold** with precondition satisfaction and **curiosity-driven exploration**, operant conditioning matching RL benchmarks, usefulness-eviction memory, ROS/embedded, UDPNAR.
- SeNARS's own earlier read of these is in `docs/plan/narchy.java.md` (delta `d(f)/dt`, goal logic could/would/should, temporal conj/disj, De Morgan, negation in Impl) and `docs/java/java_to_js.md` (operator/punctuation gap).

### 4.7 The existing neuro-symbolic layer (the ground for the contract)
- **NL→Narsese (deterministic):** `StructuredFormalizer` (`nar/src/nl/formalizer.ts`) parses tolerant Narsese; a non-Narsese utterance is *declared* rejected (D15). **Hosted:** `LmFormalizer` wraps `NLUnderstandingService` + `SymbolicFirewall` + `toFormalizationBatch`.
- **Narsese→NL:** `NLGenerationService` (`nar/src/nl/generation.ts`, deterministic fallback) and `ExplanationGenerator` (`nar/src/nl/explanation.ts` — engine facts + labeled paraphrase + contradiction showcase; CORE.19 C6).
- **LM rule layer:** `LMRule` (`nar/src/lm/rule/LMRule.ts:65`) with circuit breaker, timeout, Zod structured output, constitution check, and a **symbolic fallback** (`applyFallback`, `:527`); templates in `rule-templates/` (11 belief, 1 goal, 2 curiosity, 5 meta); proposals flow through `proposal/{lm-rule-producer,lifecycle}.ts` into the live rule table (`nar.ts:353`).
- **Judgment:** System One (`nar/src/lm/system-one/*`, ~60 files) — embeddings, manifold, heads, calibration + drift demotion, groundedness gate.
- **Memory-adjacent:** concept/link embeddings, `RetrievalVerifiedMemory`, the `rag-query` tool.
- **Admission:** `KernelPerceptionGate.admitFormalization` (`nar/src/kernel/KernelPerceptionGate.ts:365`) re-parses and clamps by `SOURCE_QUALITY_CONFIDENCE`; LLM tasks pass `ShadowValidator` (`nar/src/lm/shadow-validation.ts`).
- **What is missing (I1):** these are *scattered*. There is no single enumerated contract binding every neural touchpoint, no one pipeline, no integration-ladder gate, and no coherence test. CORE.19 gave them provenance and a stream; CORE.20 I1 gives them a *shape*.

## 5. Decision log (append to the progress log)

- **D7–D17 — inherited unchanged** (integration-over-abstraction, extraction freeze, 3D experimental, LLM optional, one event stream, kernel-authoritative, full-fidelity determinism, declared boundaries, no silent no-ops, budgeted autonomy, LLM-as-proposal).
- **D18 — Parity is measured, never asserted.** Every capability claim against the references cites a corpus row in `parity-scorecard.json`.
- **D19 — Complete the logic before extending the reach.** F1–F4 gate U1–U2 and A1–A4.
- **D20 — Enable, don't disable.** A rule ships enabled or is not declared; guards become preconditions; the `DISABLED` map becomes a documented precondition list.
- **D21 — Reference-behaviour fidelity for operant/sensorimotor learning.** Reproduce ONA's conditioning results on the shared corpus; a stronger RL stack that cannot reproduce the reference is not parity.
- **D22 — Motivation is a policy, not a hope.** Emotion/satisfaction ship only where a drive's dynamics actually reach the trigger; observable, budgeted, reversible.
- **D23 — The corpus is the contract with the references.** `.nal`/eval cases are vendored and run as-is where licence permits; transcribed cases cite their source.
- **D24 — Wire and embed are first-class, not UI shadows.** The kernel is usable by a non-JS host and by another kernel, reusing the CORE.19 stream and boundary.
- **D25 — Temporality is plural.** One superset of temporal syntax, many **temporal models** behind one `TemporalModel` port (tense-interval / delta-time / tick-window), selected by config and scored by the corpus. No model is deleted for being "the wrong one"; no single model is allowed to define SeNARS. This is the one kernel port the halt list permits.
- **D26 — Reference techniques are adopted on merit, not lineage.** NARchy's dt-images, virtual disjunction, integrated negation, auto-balanced forgetting, and InterNARchy are candidates judged by the corpus, not adopted for pedigree.
- **D27 — Operator terms are first-class inference citizens.** `f^(x,y)` participates in inference (decompose, rewrite, evaluate), not only in tool dispatch.
- **D28 — One neuro-symbolic contract.** Every neural touchpoint is enumerated and bound by the invariants of §0.5. No neural code path may decide a derivation, bypass the admission gate, or lack a deterministic fallback.
- **D29 — Temporal plurality includes qualitative algebras.** Alongside the stamping models (tense-interval / delta-time / tick-window), SeNARS supports *relational* temporal algebras — Allen's interval algebra (13 base relations + composition) and the point algebra (Vilain–Kautz) — as composable facets of one `TemporalReasoner` port. Spatial analogues (RCC-8) are a reserved seam for embodiment.
- **D30 — The end state is a coherent whole, not a feature pile.** A workstream that adds capability without preserving the coherence spine (§0.5) is incomplete. The coherence test (I1) is as binding as the corpus (M0).
- **D31 — Temporal models are candidates; the goal is their unification.** Land every stamping model and algebra facet for consideration, compare them on the corpus, then synthesize a `unified` temporal model from the winners (F2.9). The plurality is the *method*; the unified model is the *result*.

## 6. Workstreams

Ordering: **M0, then F1 → F2 → F3 → F4 (logic critical path); U1 + U2 in parallel after F1; A1 after F2+F3; A2 after A1; A3 + A4 after A1; I1 runs alongside F2–A4 (it binds what they produce); X1 tracks UI.19; C20-close last.**

---

### M0 — Parity conformance harness (gates everything)

The one artifact none of the references has: their examples, run headless, seeded, **across each temporal model**, scored, with every inference verified. **Nothing else starts until M0 produces a baseline scorecard.**

1. Vend a **conformance corpus** under `tests/parity/corpus/`: OpenNARS's `.nal`/wiki example cases (NAL 1–9, Test Chamber, Pong), ONA's `evaluation.py` behaviour cases (simple/conditional discrimination, changed contingency, food-collector, cartpole), and — where it clarifies a technique — NARchy's `docs/java/nal/*.nal` cases (NAL-4 images, delta, virtual disjunction, negation). Each case is a fixture `{id, source, temporal?: {stamping?: 'tense-interval'|'delta-time'|'tick-window', algebra?: 'allen'|'point'}, tasks: Narsese[], expected, seed}`. Transcriptions cite the source URL (D23).
2. A **runner** (`tests/parity/runner.test.ts` + `scripts/lib/parity.ts`): execute each case on a seeded NAR (`LM_PROVIDER=mock`), assert expected derivations via `verifyRecord` (truth algebra) and expected behaviour via the RL/operant harness, and emit `parity-scorecard.json` with per-case, per-model, and per-axis pass/fail.
3. A `pnpm parity` script and a `parity:corpus` gate; the scorecard is checked in and ratchets (red→green only).
4. Baseline the scorecard at HEAD so §1's verdicts become numbers, not prose.

**Acceptance:** `pnpm parity` runs the corpus headless on a seeded kernel and prints a scorecard covering NAL 1–9, ONA operant, and the NARchy/OpenNARS technique cases, per model; the baseline is committed; the gate is in `pnpm gates`.

---

### F1 — Logic completeness (NAL-4 images, the stubs, the guards)

**Goal:** the 11 disabled rules are resolved — enabled under preconditions, or retired with a verified proof of unsoundness. NAL-4 images exist.

1. **NAL-4 product & image.** Keep product `*`. Add the **image term** in NARchy's representation — `(/, relation, args)` (extensional) and `(\, relation, args)` (intensional), arity 4, `_` placeholder (`Op.java:183,274-277`; `docs/java/nal/nal4.nal`) — with parser/`TermFactory` + serializer, and the image rules (`imageInt`, `imageExt`, `imageNormalize`). Product/image decomposition rules declared and verified.
2. **Retire `DISABLED` (D20).** For each of the eight structural rules, replace the flooding complaint with a real precondition (subsumption guard, term-complexity bound, "manufactures no term a reader asked for" check) and enable it. Where a rule is genuinely unsound (the inheritance:inheritance derivation at `:425`), write the counterexample as a test and retire it with that test as evidence.
3. **First-class `revision` and `choice`** as table members with truth functions and verification.
4. **Replace the stubs.** `variableIntroduction` becomes real generalization (`(cat-->animal). (dog-->animal). ⊢ ($x-->animal)`); `revisionWeak` becomes NAL revision or is removed.
5. **De Morgan & negation in Implication (NARchy techniques, D26).** Add `||` as the virtual disjunction `--(&& -- --)` and the de Morgan rules the NARchy `docs/java/nal` cases exercise; support negation inside `==>` where the corpus requires it.
6. Every new/changed rule passes `verifyRecord`, `test:determinism`, `test:hermetic`, `rule:has-fallback`.

**Acceptance:** NAL-4 image examples pass in the corpus; the `DISABLED` map is gone; `variableIntroduction`/`revisionWeak` are real or removed; no rule ships disabled.

---

### F2 — Temporal models: stamping, algebras, and one port

**Goal:** the temporal plurality the references disagree about is made explicit, composable, and swappable (D25/D29), so SeNARS cannot stagnate under one temporal system — and so it can reason *qualitatively* (Allen) as well as quantitatively.

1. **The `TemporalReasoner` port** (`nar/src/temporal/`) has **two composable facets**:
   - **`stamping`** — how an occurrence is represented: `stamp(task, clock)`, `operators()`, `truth()` (pre/post/conduct/projection), `order(a, b)`, `project(term, from, to)`.
   - **`algebra`** — how *relations between* intervals/points compose: a finite set of base relations, a composition table, `compose`/`invert`/`converse`, and a constraint network with path-consistency for query answering.
   A NAR selects one stamping model and may enable an algebra facet over the intervals it produces (e.g. `tense-interval` + `allen`). Selected by `NARConfig.temporal` (stamping + algebra) — a port like `driveMetaGoals`, not a registry.
2. **Superset syntax, model-owned interpretation.** The parser and `TermFactory` support the *union* of temporal spellings: `&/`, `&|` (present), `=/>`, `=|`, the delta forms `&&+N`/`&&-N`/`&&+-`, and the tense markers `:|:`/`:/:`/`:\:`, plus an interval-relation spelling for the algebra facet (a Narsese form for the 13 Allen relations, e.g. `(i1 before i2)`). Each model *interprets* the operators it owns and declares the rest unsupported (D15, halt rule 5); no model sees opaque syntax it silently mistreats.
3. **Stamping models**, each reproducing a reference:
   - **`tense-interval` (OpenNARS):** occurrence intervals, tense markers, an internal clock substrate, interval algebra; interval/tense temporal inference.
   - **`delta-time` (NARchy):** numeric `dt` on conjunction/implication terms (`&&+N`, `&&-N`, `&&+-`, joined-at-start `&|`), template temporalization, temporal belief tables (truth changing over time), virtual disjunction preserved through temporalization.
   - **`tick-window` (ONA):** a fixed timestep, a temporal window for implication formation, and the semantic/sensorimotor cycle split.
4. **Algebra facets** (D29) — each a qualitative relation algebra whose relations are NAL beliefs with `(f,c)`:
   - **`allen` — Allen's interval algebra:** the 13 base relations (`before`/`after`, `meets`/`met-by`, `overlaps`/`overlapped-by`, `during`/`contains`, `starts`/`started-by`, `finishes`/`finished-by`, `equals`), the full 13×13 composition table, converse, and a relational-composition / path-consistency solver. A relation is a belief; a disjunction of base relations is a set-valued belief; an inconsistency is a kernel-flagged conflict (CORE.19 C6.5), never silently dropped. Reference cases: Allen's transitivity table and path-consistency examples.
   - **`point` — the point algebra (Vilain–Kautz):** `{<, =, >}` over instants — the tractable projection of Allen relations onto point constraints; the fast path when only ordering matters.
   - **`none`** — the default; no algebra facet.
   A metric candidate (Simple Temporal Networks / STP — quantitative bounds) is a §10 seam.
5. **Occurrence stamping.** Populate `RuleInput.occurrenceTime` from the injected clock (CORE.19 D13) under whichever stamping model is active; persist the temporal position in the consistency boundary (CORE.19 C4). This closes `registration.ts:409` and revives `buildSequenceRule`.
6. **Temporal truth functions** — the pre/post/conduct/projection family (from `docs/java/TruthFunctions.java` and the interval maths) — implemented per stamping model and verified.
7. **Enable the four rules per model.** `sequenceIntroduction`, `parallelIntroduction`, `predictiveImplication`, `temporalDeduction` enabled under F1's discipline for models that support them; each verified.
8. **Cross-validation & selection.** The corpus scores every case under every applicable (stamping, algebra) combination; the scorecard reports a per-combination table. Where models disagree on a case, the disagreement is recorded, not hidden — the plurality is the point, and the disagreements are how temporal representations get *compared* rather than presumed.
9. **Unification — the real goal (D31, note 4).** The models land first *as candidates for consideration*; the end state is a **`unified` temporal model** assembled from the best of each (NARchy's dt terms, OpenNARS's interval tense, ONA's tick window, plus the algebra facets) once every model is present and the corpus shows which wins which case class. Design the unified model *after* F2's models are green — it is the synthesis the port exists to make possible, not a fourth model designed in a vacuum.

**Acceptance:** `NARConfig.temporal` selects among ≥3 stamping models, ≥2 composable algebra facets, and the `unified` synthesis once it exists; the corpus runs NAL-7, ONA/NARchy technique, and Allen/point constraint cases under each applicable combination; `tests/nar/nal7-temporal.test.ts` runs the **engine** (not the rule objects directly) and passes; the Allen path-consistency solver answers a relation query and flags an inconsistency; two seeded runs per model byte-identical (occurrence times the declared D13 exemption); each model's `report()` declares its gaps.

---

### F3 — Procedural reasoning (NAL-8) NARS-native, on operator terms

**Goal:** operator terms participate in inference, and operations/goals are inference — one path for tools, games, and the logic.

1. **Operator-term inference (D27).** Operator terms (`f^(x,y)`, `nar/src/terms/impls/operation-term.ts`) gain the rules NARchy's deriver assumes: generic decomposition (`Decompose1`), argument extraction, inline term rewriting, and **functor evaluation** (`Evaluate` — `add(1,2) ⊢ 3`, `intersect({A,B},{B,C}) ⊢ {B}`). These operate on the `operation` kind without breaking the "one spelling" contract.
2. **Operation execution rule.** `(!^op)` goal + satisfied precondition (belief) → execute `^op` when desire-value expectation ≥ a **decision threshold**; the outcome returns as an event that conditions the implication (ONA's operant loop). This is the rule the references have and SeNARS does not.
3. **Goal deduction & subgoaling.** Backward inference over `==>`/`=/>`: `(G!)` + `(C ==> G)` + satisfied `C` → derived goal; unsatisfied `C` → subgoal `(C!)`. Degree of satisfaction = `expectation(content) − expectation(desire)`.
4. **Planning.** A derived multi-step plan (`&/` or `&&+N` program) with a success truth-value; multi-goal preference and veto.
5. **Unify the execution path.** Route `dispatchToolGoals`, `GameFocus` actions, and the new operation rule through **one** executor (`NARExecution` → `ToolManager`), so a NARS operation and a tool are the same thing with different handlers.
6. **Curiosity bootstrapping.** When no procedural knowledge exists, emit periodic exploratory operations driven by the curiosity drive (the mechanism ONA calls "motor babbling" — one concept, one name), gated by a budget and an off switch (D16).

**Acceptance:** a goal provokes an operation via the rule (not the bridge); operator terms decompose and evaluate; a two-step plan is derived with a success TV; ONA procedural corpus rows green; the tool bridge and the rule share one executor.

---

### F4 — Self-reasoning (NAL-9) as rules

**Goal:** the self surface OpenNARS has and ONA does not — implemented as inference, bridged to the existing self-modification machinery.

1. **Mental operators.** `^believe`, `^doubt`, `^evaluate`, `^satisfied` as operations over the self (`{SELF}`), producing self-beliefs/goals.
2. **Introspective rules.** Implement the six deleted NAL-9 rules as table members with truth functions: strategy effectiveness, resource allocation, error-pattern detection, utility estimation, metacognitive revision, self-model consistency.
3. **Bridge, don't duplicate.** Fold the timer-driven `ReasoningAboutReasoning`/`SelfOptimizer`/`meta-*` rules into the table under a governed mode (`registerMetaRules` default-on behind config), so self-modification is inference with CORE.19 provenance (D16) and the existing governance gate.
4. **`[SATISFIED]` feeling operators** land with A2.

**Acceptance:** `tests/nar/nal9-self.test.ts` asserts the six rules **exist and run** through the engine (replacing the `undefined` assertions); a self-modification carries provenance and passes governance.

---

### U1 — Narsese, REPL, and experience parity

**Goal:** the system is driven the way the references are driven — from a shell, over files, with full Narsese.

1. **Full Narsese.** Parser + printer for the `Op.java` surface SeNARS lacks: QUEST `@`, COMMAND `;`, budget `$..$`, occurrence time `\|`/`now`, images `\`/`/`, DIFF `<~>`, DELTA `Δ`, INT `+`, BOOL `B`, pattern var `%`, delta forms `&&+N`, `pred:subj`, comments, multi-line. Round-trip tested (`narsese:literals` extended).
2. **Interactive REPL** (`pnpm repl`): read Narsese, step/run, print derivations on demand, save/load, reset, `:mode` switches for autonomy, `:model` switch for the temporal model. Reuses the CORE.19 control plane.
3. **Experience files.** Save/load a session's beliefs/goals/questions + cycle position (the CORE.19 boundary) + active temporal model as a portable file; replay.
4. **`.nal` test runner.** Execute `.nal` experience/test files (OpenNARS/NARchy pedagogy) through the M0 corpus runner.

**Acceptance:** `pnpm repl` starts a shell; an experience file saves and replays; an OpenNARS and a NARchy `.nal` tutorial are reproduced verbatim; every Narsese operator in `docs/java/Op.java` round-trips.

---

### U2 — Interop: wire protocol and embedding

**Goal:** the kernel is usable by a non-JS host and by another kernel — the ONA C-API/UDPNAR/Docker surface, informed by NARchy's InterNARchy and NAgent.

1. **Wire protocol.** A UDPNAR/InterNARchy-equivalent (UDP/TCP) message protocol so two SeNARS instances exchange Narsese + timestep + derivations, reusing the CORE.19 one event stream and boundary. Add the protocol to `core/src/protocol/` (shared, not UI-owned).
2. **Embedding.** A WASM build target and a stable host API (the analogue of ONA's C API / NARchy's NAgent) exposing `believe`/`ask`/`run`/`step` without the UI; a Docker image for one-shots and a long-running instance.
3. **Reference evaluation.** A `--benchmarks`/evaluation mode reproducing ONA's `evaluation.py` metrics (per-example correctness + timing) on the corpus, feeding the scorecard.
4. **SDK freeze.** The consumer surface (`NAR`/`Agent`/`createNAR`/`createAgent`) documented and versioned (CORE.19 C7.5/C9.2); capabilities honest; experimental methods marked.

**Acceptance:** two instances exchange over the wire and agree on derived conclusions; a Docker image runs a one-shot and a long-running instance; a non-JS host embeds the kernel; the evaluation mode reproduces ONA's metric shape.

---

### A1 — Operant conditioning & lifelong learning (reproduce ONA)

**Goal:** the learning the references demonstrate, proven on the corpus (D21).

1. **Temporal-induction operant loop.** Implication formation by induction over the F2 occurrence window → strengthening/weakening by prediction success (F3) → subgoaling (F3) → operation at the decision threshold → feedback conditions the implication. One loop, built from F2+F3, not a parallel RL path. (Requires a model with an occurrence window — `tick-window` or `delta-time`; the corpus picks.)
2. **Reproduce ONA's results** as corpus rows: simple discrimination (target ~100%, hypothesis confidence rising), conditional discrimination (~100%), changed-contingency adaptation, food-collector/cartpole. Record the numbers in the scorecard.
3. **Feedback on the one stream.** `G. :|:` (reinforce) / punish carry provenance (`CreatedBy: environment`), are budgeted, and are reversible (D16).
4. **Reconcile with RL.** The existing Q-learning/RLFP stack stays; the operant loop is the NARS-native route. The corpus gates both; disagreement is documented.

**Acceptance:** the ONA operant corpus rows pass deterministically on a seeded kernel; the scorecard reports the discrimination and adaptation numbers; the loop is observable and switchable.

---

### A2 — Motivation and emotion (D22)

**Goal:** the reference motivation/emotion surface, grounded in dynamics that actually fire.

1. **Fix the drive→meta-goal dynamics.** Give the policy a trigger the dynamics reach (per-drive threshold above equilibrium) or a decrementing stimulus, and turn `createDriveMetaGoalPolicy()` **on by default** where a deficit provokes a goal (closing CORE.19 C5.6's inert equilibrium).
2. **Satisfaction model.** A satisfaction value per goal and an overall satisfaction; beyond a neutral zone, emit `[SATISFIED]`/`[UNSATISFIED]` feeling operators as self-beliefs (OpenNARS design, made real).
3. **Motivation as an event provider.** Behavior-goal generation (the ONA motivation-module role) plus desire-value extended to concepts (OpenNARS design), emitted on the one stream. NARchy's "attention/motivation/emotion" framing is the target shape.
4. Every policy carries provenance, respects budgets, and has an off switch (D16).

**Acceptance:** a drive deficit provokes a goal through the policy (not a hand-injected one); satisfaction rises on success and the feeling operator emits; every behavior is observable and switchable.

---

### A3 — Autonomous continuum and ecology

**Goal:** autonomy runs by default-mode choice, survives long runs, and multiple instances can exchange.

1. **Default-on continuum.** The CORE.19 `AutonomyHeartbeat` becomes the driver in `continuous`/`stepping` modes behind config; a NAR left in an autonomous mode thinks unasked. The UI (UI.19) observes; the kernel drives (CORE.19 D12).
2. **Long-run stability.** Hours of continuous autonomy stay within cycle/wall-clock/bag budgets and reach a memory plateau (with A4); the recovery checkpoints (CORE.19 C5.5) hold.
3. **Multi-instance ecology.** Two+ kernels exchange over the U2 wire; document the admission/message format (NARchy's InterNARchy is the reference); the CORE.19 §9 "multi-instance ecology" seam is entered.

**Acceptance:** a NAR in `continuous` runs an idle window within budgets; restart resumes; two instances exchange and are each observable on their stream.

---

### A4 — Memory scale & usefulness eviction

**Goal:** the ONA/NARchy memory model (fixed capacity, usefulness + pressure eviction, auto-balanced forgetting) on top of CORE.19's bounded rings.

1. **Usefulness tracking.** Per-concept use count + last-use time as an eviction signal, complementing pressure/decay.
2. **Auto-balanced forgetting (NARchy).** Make the forgetting rate pressure-adaptive (load-sensitive) rather than a fixed `0.01` sweep, so a busy store forgets harder and an idle one more gently.
3. **Bounded concept memory.** A fixed-capacity policy that evicts by usefulness + pressure while keeping the CORE.19 bounded rings (gate/fire/derivation/event) declared in `RESOURCE_CONTRACTS`.
4. **Term-flooding proof.** With F1's guards, show `concept:budget`/`resource:policy` hold under a long run (no term explosion) and a plateau is reached.

**Acceptance:** a long seeded run reaches a stable memory plateau; eviction is by usefulness + pressure and forgetting adapts to load; `resource:policy` and `complexity:budget` green.

---

### I1 — The neuro-symbolic integration contract (the coherence spine)

**Goal:** take SeNARS from scattered L2–L3 to a coherent **L5**, with the invariants of §0.5 enforced by test (D28/D30).

1. **Enumerate and bind every neural touchpoint.** A registry-in-code (not a UI registry) of the LM entry points — perception (`Formalizer`/`NLUnderstandingService`), rule induction (`LMRule`, the rule producer), schema induction, judgment (System One), translation (`ExplanationGenerator`/`NLGenerationService`), memory embeddings, meta-control (config/patch proposals), tool assistance — each annotated with its ladder level, its admission path, its provenance, and its deterministic fallback. A test asserts no LM entry point exists outside the list.
2. **One pipeline.** Route perception → admission → inference → judgment → explanation → action through the single event stream (D11) and the single admission gate (D17), so one NL round-trip is traceable end to end with one correlation id. Kill any remaining side channel.
3. **One coherence test** (`tests/nar/core20-coherence.test.ts`): with `LM_PROVIDER=mock` and with no provider, assert (a) every neural event is labeled with its source and provenance; (b) no neural path mutates symbolic truth without passing the gate; (c) every neural capability degrades to a deterministic result; (d) a full NL→reason→explain round-trip carries one correlation id and resolves every cited derivation id.
4. **Neural-amplified inference (L4), soundness-preserving.** Let System One/LM influence *control* — premise selection, rule ranking, search order (the existing strategies) — under a hard rule: the set of derivable conclusions is unchanged; only the order/priority changes. Prove it: the determinism gate runs the amplifier on and off and the derived *set* matches.
5. **The ladder report.** `capabilities()` and the scorecard report the achieved integration level per subsystem, honestly (D15).

**Acceptance:** the coherence test passes on `mock` and no-provider; every neural touchpoint is enumerated and bound; neural amplification changes search, not derivability; the scorecard reports L5-or-below per subsystem with no unlisted path.

### X1 — UI/UX parity closure (consume UI.19; blocked-by UI.19)

**Goal:** everything OpenNARS's GUI and ONA's dashboards do, SeNARS does — and the observation deck exceeds them. CORE.20 does not build UI; it *verifies and enables* UI.19 and adds the parity affordances UI.19's plan omits.

1. **Record that CORE.19 met UI.19's backend prerequisites.** `cycle.step/pause/resume/rewind`, `cycle.state` per cycle, gate/derivation records, provenance, autonomy, translation, persistence are live kernel-side. Give UI.19 the exact event list it renders, in §10.
2. **Parity affordance checklist** for UI.19 to satisfy: live concept graph; concept window with beliefs/goals/questions and truth values; truth-value size/color; per-cycle trace; derivation replay; dashboard equivalents.
3. **Exceed checklist:** thought stream (episodic grouping of CORE.19 events), provenance aspect, gate inspector, explanation panel (CORE.19 C6), contradiction showcase, and a **temporal-model indicator** (which model is active, what it declares unsupported).
4. **Non-UI parity additions CORE.20 owns:** `printDerivations`-style per-step output in the REPL (U1) and the concept-graph export (U2) for headless dashboards.
5. Log any missing contract feature as a §10 seam; do **not** edit the UI.

**Acceptance (joint with UI.19):** every OpenNARS-GUI and ONA-dashboard affordance has a SeNARS equivalent or better in the running app; the §9 walkthrough passes on the 2D renderer; until UI.19 lands, X1's items are recorded blocked, not failed.

---

### C20-close — Document the parity core

1. This file is the document: the scorecard (§1), the decision log (§5), the corpus and its baseline (§M0), and the per-workstream progress log (§14).
2. Extend `USAGE.md`: REPL, experience files, wire protocol, embedding, evaluation mode, temporal-model selection.
3. Update `docs/security.md` for the wire protocol (U2) and the operation-execution path (F3).
4. `pnpm docs:drift` clean; `docs/api`/`docs/architecture` regenerated for the new modules (notably `nar/src/temporal/`).

**Acceptance:** a fresh session reads `TODO.core.20.md` alone and knows the parity status, the corpus, and every open gap.

## 7. Cross-cutting rules

1. **Green gates are preconditions.** Every commit passes the §12 battery or quarantines a failure with a logged reason.
2. **One event stream (D11).** New inference (F2–F4), operations (F3), conditioning (A1), motivation (A2) all emit on the CORE.19 bus. No side channels.
3. **Declared gaps over fake states (D15).** A blocked corpus row, an unsupported model operator, or a UI.19-blocked affordance is recorded, never faked.
4. **Consume the contract, never extend it.** A missing contract feature is a §10 seam. The one permitted extension is the `TemporalModel` port (D25).
5. **LLM optional everywhere (D10).** The corpus runs with `mock` and with no provider.
6. **Autonomy/motivation observable or it doesn't ship (D16).** Event + trace + budget + off switch.
7. **Determinism full-fidelity (D13).** Every new path is seedable and id-injectable; occurrence times are the single exemption.
8. **Measure, don't assert (D18).** Scorecard row or it didn't happen.

## 8. What this plan deliberately does not do

No new UI registries, packages, or module moves. No UI edits (X1 verifies UI.19; it does not render). No second consumer app or conformance *suite* beyond the parity corpus. No publishing pipeline beyond the U2 Docker/WASM embed. No `Cell` merge, no `Fidelity` fusion, no 3D growth. No performance/accessibility overhaul. No sentience claims anywhere.

## 9. Acceptance walkthrough (definition of done)

One seeded headless session, `LM_PROVIDER=mock` first then with a key; then the corpus; then the app:

1. **`pnpm parity`** runs the full corpus — NAL 1–9, OpenNARS apps, ONA operant, NARchy techniques — per temporal-model combination, and prints a scorecard with no red rows on the parity axes.
2. **F2:** select each stamping model (`tense-interval`, `delta-time`, `tick-window`) and each algebra facet (`allen`, `point`) in turn — including a composed run (`tense-interval` + `allen`); each runs its cases; the scorecard shows the per-combination table and any disagreement. The Allen solver answers a relation query through path consistency and flags an inconsistent network.
3. NAL-8: an operation term `f^(x,y)` decomposes and evaluates; a goal provokes an operation via the rule; a two-step plan derives with a success TV.
4. NAL-9: a self-modification is proposed by an introspective rule, carries provenance, passes governance.
5. A1: the ONA discrimination/adaptation numbers reproduce on the seeded kernel under the model the corpus selects.
6. A2: a drive deficit provokes a goal; satisfaction rises; `[SATISFIED]` emits.
7. **`pnpm repl`**: load an experience file, step, print a derivation, save; an OpenNARS `.nal` and a NARchy `.nal` tutorial reproduce.
8. U2: two instances exchange over the wire and agree on a conclusion; a Docker image runs a one-shot.
9. **X1 (with UI.19):** press step → graph grows, `$cycleState` advances, gate inspector shows the rule, provenance shows real parents, the thought stream narrates, an English explanation cites real derivation ids — on the 2D renderer, with the 3D toggle intact.
10. Repeat 3–6 with **no LLM key**: the deterministic path is fully functional.
11. **I1:** the coherence test passes on `mock` and no-provider; every neural touchpoint is enumerated and bound; neural amplification changes search order, not the derivable set; the scorecard reports the integration level (L5 or the honest level below).
12. **`pnpm gates` and `pnpm gates --tier slow` green**; the parity scorecard ratchets; README/USAGE reproduce the above.

## 10. Open seams (reserved, with re-entry triggers)

| Seam | Re-enter when |
|---|---|
| True replay-rewind (vs declared-partial) | CORE.20 F2/F3 make the checkpoint stable across temporal/procedural state |
| The `unified` temporal model (D31) | All stamping models + algebra facets are present and the corpus shows which wins which case class — then synthesize (F2.9, §15) |
| Distributed / OTel event export | The wire protocol (U2) exists and the stream is bounded |
| Multi-instance ecology (full) | **Entered by A3**; re-enter for negotiation/consensus and InterNARchy-style collaborative learning |
| Robotic / vision sensorimotor | **Entered by F3** (operation rule + one executor); re-enter for ROS/vision encoders, NAgent-style wrappers |
| System One calibration activation | Real graded labels exist (unchanged from CORE.19) |
| Performance + accessibility gates | Release-to-others replaces release-as-proof |
| UI `explain` intent + autonomy events on the UI stream | UI.19 registers them (CORE.19 §9, unchanged) |
| UI drives cycles in autonomous modes | UI.19's control surface needs to drive an autonomous kernel (CORE.19 §9) |
| Integrated ("full-spectrum") negation | F1's de Morgan work shows the separate-entity model costs the corpus cases NARchy passes |
| Spatial qualitative algebra (RCC-8) | An embodied/sensorimotor path (F3+U2) needs spatial relations; the algebra facet generalizes to a `RelationAlgebra` |
| Metric temporal constraints (STP / simple temporal networks) | Qualitative Allen relations prove insufficient and quantitative bounds are needed |
| Binary I/O codec | The corpus/serialization work needs a compact task codec beyond `nar-state` |

## 11. Implementation principle

Smallest change that closes a gap the scorecard can see. Prefer enabling (under a precondition) over declaring; prefer inference over side channels; prefer a model behind the port over a rewrite; prefer reproducing a reference over inventing a parallel path; prefer a measured corpus row over a claim. When torn between an architectural improvement and a parity capability, ship the capability and log the improvement in §10. Preserve the coherence spine (§0.5) at every step: a capability that breaks an invariant is not done.

**Execute M0, then F1 → F2 → F3 → F4; then U1 + U2 in parallel; then A1 → (A2, A3, A4); I1 runs alongside F2–A4; then C20-close. X1 tracks UI.19 and closes with it. Log progress per workstream in §14 exactly as CORE.19 does. This plan stays open: every seam in §10 is a door, not a wall.**

## 12. Verification battery (run per workstream)

Core green set (must pass after every workstream):

```
pnpm typecheck
pnpm typecheck:bin
pnpm typecheck:packages
pnpm test:unit
pnpm deps:gate
pnpm deps:direction
pnpm core:no-lm
pnpm memory:ports
pnpm attention:write-surface
pnpm control-budgets
pnpm gates:one-cycle-path
pnpm exports:check
pnpm exports:barrels
pnpm lint
```

Add per workstream:
- **M0:** `pnpm parity` (new); `parity-scorecard.json` ratchet check.
- **F2:** `pnpm test:determinism`, `pnpm test:hermetic`, `pnpm nal7-temporal` (engine, per model); a model-selection test; an Allen path-consistency + point-algebra test.
- **I1:** `pnpm core20:coherence` (new); the determinism gate with the neural amplifier on/off; the no-provider and mock runs; the touchpoint-enumeration test.
- **F3/F4:** `pnpm nal8-procedural`, `pnpm nal9-self` (assert-enabled), `pnpm cycle:no-provider`, `pnpm rule:has-fallback`.
- **A1:** the ONA operant rows in `pnpm parity`; `pnpm test:determinism`.
- **U2:** the wire round-trip test; the Docker smoke test; the WASM host test.
- **C20-close:** `pnpm gates --tier slow`, `pnpm docs:drift`. **`complexity:budget` is out of scope for CORE.20 (directive, §15 note 1)** — the ratchet is suspended for the duration; do not bump or obey it.

UI battery (`pnpm --dir ui typecheck`, `pnpm --dir ui test:unit`) is UI.19's concern; run it only when a shared protocol file under `core/src/protocol/` changes (U2 will).

## 13. Known-red ledger (carried from CORE.19 §12; document, do not chase unless blocking)

| Failure | Location | Status |
|---|---|---|
| Calibration reds (System One / RL surface) | `tests/nar/todo16-groundedness-gate.test.ts`, `tests/nar/todo22-clm-wiring.test.ts`, `tests/nar/todo16c-rl-distill.test.ts` | genuine numeric/calibration reds, deterministic, fail at HEAD by stash; out of CORE.20's logic-parity remit unless A1's corpus needs them (then enter via §10) |
| UI-owned `pnpm gates` reds | `env:grammar` (`ui/src/server/index.ts`), `primitives:grammar`/`schema:grammar` (`ui/src/client`), `ui:gate` (browser deps) | pre-existing, UI-owned (halt rule 3); `pnpm gates` stops at `env:grammar` |
| `todo17-games`/`todo17-parity`, `todo16-batching`, `cognitive-advantage` under full `test:unit` | `tests/nar/*` | pass in isolation; load-flaky under whole-suite contention; not chased (§rule 8) |
| Quarantined suites | `tests/nar/{refactor1-source-reputation,refactor1-aikr-induction,rl/budgetgate-verification}.test.ts.too_slow` | genuinely too slow for the fast lane; triaged in CORE.19 C8.3 |

*(The CORE.19 ledger rows fixed during CORE.19 — prompt-perception, server catalogs, refactor3/4, mcp-resources, bot-cli, `metta-conversation`, the `derivation.accepted` id-equality — stay fixed; CORE.20 must not regress them.)*

## 14. Progress log

> Append per workstream as CORE.19 does: status, files touched, evidence, friction logged against §10. Empty at plan adoption 2026-10-18.

### M0 — Parity conformance harness — **NOT STARTED**

### F1 — Logic completeness (NAL-4 images, stubs, guards) — **NOT STARTED**

### F2 — Temporal models (stamping + algebras) — **NOT STARTED**

### F3 — Procedural reasoning (operator terms) — **NOT STARTED**

### F4 — Self-reasoning — **NOT STARTED**

### U1 — Narsese, REPL, experience — **NOT STARTED**

### U2 — Interop: wire & embedding — **NOT STARTED**

### A1 — Operant conditioning — **NOT STARTED**

### A2 — Motivation & emotion — **NOT STARTED**

### A3 — Autonomous continuum & ecology — **NOT STARTED**

### A4 — Memory scale & usefulness eviction — **NOT STARTED**

### I1 — Neuro-symbolic integration contract — **NOT STARTED**

### X1 — UI/UX parity closure — **NOT STARTED (blocked-by UI.19)**

## 15. Pre-start problem ledger (resolve before executing)

> **Directives carried into this ledger (binding).**
> 1. **`complexity:budget` is out of scope for CORE.20.** The ratchet is suspended for the duration; these changes are deliberately large, so obeying a `mustNotIncrease` baseline would be theatre. Keep a *module-layout/ownership map* (P13) — that is about clarity, not the ratchet.
> 2. **"Motor babbling" is renamed "curiosity."** One concept, one name (already applied across the plan). ONA's bootstrap exploration and SeNARS's curiosity drive are the same driver.
> 3. **The non-anthropomorphic stance may be violated for terminology** (`[SATISFIED]` feeling operators, desire-value, "wants") **so long as the semantics stay clear for development and for users.** Clarity governs, not sanitisation. "No sentience claims" (§8) still holds — that is about *claims*, not *naming*.
> 4. **All temporal models are landed first as candidates; the goal is a *unified* model** assembled from the best of them (D31, F2.9). The plan is deliberately *not* finished designing temporality.

Each item below is a **pre-start question**: resolve it — as a decision (D-ledger), a §0.5 edit, or a workstream sub-task — *before* the workstream that depends on it begins. IDs are stable; when resolved, the item moves into that workstream's §14 progress log as a task and this ledger cites the resolution.

### Problems (resolve before executing)

**P1 — Allen's path-consistency is a second reasoning engine (breaks §0.5 invariant 1).**
F2.4's `allen` solver is constraint propagation, not NAL forward chaining; run as a peer it gives SeNARS two symbolic authorities. Also NP-hard for arbitrary disjunctions (only the point algebra is tractable).
→ *Resolution:* express composition as ordinary NAL rules (one composition rule per relation pair producing relation-beliefs), **or** declare the solver an explicitly bounded auxiliary whose outputs re-enter through the admission gate as proposals. Bound it to a focus subnetwork, never the global concept space. **Affects:** F2, I1.

**P2 — Term identity is model-scoped, and SeNARS interns terms globally.**
`&&+N` means "a delta-time temporal term" to NARchy and "an ordinary sequence" to the tense model; `TermFactory`/`termsEqual`/interning assume one meaning per term.
→ *Resolution:* the temporal model is fixed **per NAR at construction** (never per-term, never switched mid-run), persisted in the consistency boundary, and carried in experience files. Pluralism is *across NARs*, never *within* one. **Affects:** F2, U1, U2.

**P3 — "One admission gate" is really one *formalization* gate.**
F3 (tool results, curiosity ops), A1 (`G. :|:` reward/observation), A3 (sensorimotor) are external ingress that are not formalizations.
→ *Resolution:* distinguish ingress *classes* (formalization, observation, reward, operation-result) under **one provenance discipline and one stream**; restate invariant 2 as "one formalization gate + every external event carries provenance." **Affects:** §0.5, F3, A1, A3.

**P4 — Cross-instance provenance is impossible with local ids.**
Ids are a process-local high-water mark and correlation ids are per-NAR; a received `derivationId` is meaningless elsewhere.
→ *Resolution:* cross-instance provenance is **content-addressed** (hash of the proof/term), and received claims are **proposals** admitted through the gate (D17). **Affects:** A3, U2.

**P5 — The wire must negotiate temporal model and truth-function revision.**
Temporal Narsese is only interpretable if sender and receiver share `{stamping, algebra, truthRevision}`.
→ *Resolution:* the wire handshake declares `{temporal, truthRevision, languageVersion}`; a mismatch is a typed refusal, never a best-effort parse. **Affects:** U2, A3.

**P6 — `verifyRecord` is not model-aware (halt rule 6 cannot hold for F2/F3).**
CORE.19 C3 verifies every derivation via `core/src/verify-derivation.ts`; temporal projection and Allen composition do not fit its truth algebra.
→ *Resolution:* `verifyRecord` becomes a **per-model verifier interface** — each stamping model and algebra facet supplies its truth semantics; temporal derivations are verified by *their* model. **Affects:** F2, F3 (an extension to CORE.19 C3).

**P7 — F4 self-rules mutate the rule table mid-iteration.**
A meta-rule admitting an LM rule or tuning a knob mid-cycle breaks determinism (D13) and complicates the budget gates.
→ *Resolution:* meta-rules emit **proposals**; application happens at a **cycle boundary** through the governance gate; the rule table is immutable during a cycle (copy-on-write at the boundary). F4 **depends on F3** (mental operators are operations). **Affects:** F4, I1.

**P8 — F3 `Evaluate` duplicates MeTTa, and the tool bridge conflicts with the threshold rule.**
`Evaluate` (`add(1,2) ⊢ 3`) is exact computation, which MeTTa already provides; and `dispatchToolGoals` removes operation goals *unconditionally* while F3.2 gates on desire ≥ threshold.
→ *Resolution:* one `OperationEvaluator` port that delegates exact computation to MeTTa; a threshold policy — NARS-native operations are desire-gated, explicit tool invocations use a default/pass-through threshold. **Affects:** F3, U2.

**P9 — Operator-term inference risks re-breaking "kind is the recogniser."**
`operation-term.ts` retired the second spelling; generic decomposition (`Decompose1`) could re-introduce structure/​sigil sniffers across files.
→ *Resolution:* operator-term rules are **kind-based** only; name this as a hard constraint. **Affects:** F3.

**P10 — I1.4's "same derived set" is the wrong property and likely unachievable.**
Under bounded drop-oldest rings a different visit order evicts different derivations; forcing set-equality would let the amplifier only reorder, never prune — defeating L4.
→ *Resolution:* restate L4's soundness as **per-derivation soundness** — every derivation produced is independently verified; the amplifier may change *which* derivations fit the budget (its purpose). Drop the set-equality claim from I1.4. **Affects:** I1.

**P11 — Determinism (D13) vs real embeddings and the tick clock.**
Real llama.cpp embeddings risk float nondeterminism across hardware/threads; `tick-window` introduces an implicit clock.
→ *Resolution:* the determinism **contract** is the deterministic encoder + injected clock everywhere; real embeddings are a fixed function whose outputs are **cached**, or an explicit declared exemption. `tick-window` derives its tick from `NARConfig.clock`. **Affects:** F2, A1, I1.

**P12 — The corpus will produce false reds without conformance tiers.**
Vendored OpenNARS/ONA/NARchy cases assume *their* truth functions; a sound-but-different SeNARS derivation is not a failure.
→ *Resolution:* tier every case — `exact` (identical), `semantic` (sound + expected conclusion), `behavioural` (metric within tolerance). **Affects:** M0.

**P13 — Module layout (the ratchet is dropped, but structure still matters).**
CORE.20 adds a port, 3 stamping models, 2 algebra facets, REPL, wire, WASM/Docker, operant loop, motivation, usefulness memory, self rules, operator inference — and `nar.ts` is already at 939/940 code lines.
→ *Resolution:* a **module-layout/ownership map** (`nar/src/temporal/`, `nar/src/integration/`, …), `nar.ts` kept a thin facade, the Allen composition table declared as **data**, and the Allen domain restricted to interval-stamped terms (eternal beliefs excluded — a declared gap). **Affects:** all.

**P14 — X1 is a hard dependency on an unimplemented sibling.**
UI.19 has no progress log and a stub gate-inspector; CORE.20 owns no UI, so "complete UI/UX capability" cannot complete alone.
→ *Resolution:* either restate UI/UX as *jointly delivered*, or elevate the **non-browser** surfaces (REPL, TUI dashboard, MCP-backed inspection, concept-graph export) to first-class CORE.20 deliverables so the capability exists without a browser. **Affects:** X1, C20-close.

**P15 — Anthropomorphic drift in A2.**
Resolved by **note 3**: keep the names (`[SATISFIED]`, desire-value), but require clear, documented semantics for development and users; no sentience *claims*. **Affects:** A2.

### Improvements (adopt where they pay)

**R1 — Generalise the algebra facet to a `RelationAlgebra`.** Allen/point are temporal; RCC-8 (spatial) and a direction calculus are the same shape. Pay the abstraction once while F2 is fresh; embodiment (F3) then falls out. **Affects:** F2, §10.

**R2 — Make the corpus a comparative instrument.** With ≥3 stamping models × ≥2 algebras it answers *which representation wins which task class* — a novel artifact and the empirical spine of `docs/plan/paper.md`. **Affects:** M0, F2.

**R3 — Make L4 an attention strategy, not a subsystem.** Premise/rule selectors already exist; the neural amplifier should be one more `AttentionModel` port — zero new mechanisms. **Affects:** I1.

**R4 — One evaluator port for exact computation.** Funnel operator `Evaluate`, MeTTa, and tool handlers behind a single `OperationEvaluator`. **Affects:** F3, U2.

**R5 — Phase the temporal port conservatively.** Land the simplest stamping model first (`tick-window` has no term-level encoding), get F2's engine path green, then `delta-time` and `tense-interval`, and Allen **last** (it needs the interval domain + the verifier extension). **Affects:** F2.

**R6 — One grand-walkthrough seeded session as the coherence demo.** Make the §9 walkthrough the single artifact exercising all four axes and every invariant; gate completion on it. **Affects:** I1, C20-close.

**R7 — Turn the two-engine risk into a checkable invariant.** Assert: "no symbolic derivation exists that was not produced by a NAL rule or admitted as a proposal." **Affects:** I1, F2.

**R8 — A `unified`-model design session as a deliverable.** After F2's models are green, a dedicated design pass (not a task) assembles the winners into the `unified` model (D31). **Affects:** F2.9.

----

### 3. What is Missing? (The Blind Spots)
While the plan is incredibly rigorous regarding symbolic logic and architecture, it has several critical blind spots regarding the intersection of LLMs, real-world deployment, and security.

#### **A. The "Translation Bottleneck" Benchmark (NL ↔ Narsese)**
*   **The Gap:** The plan focuses heavily on benchmarking the *symbolic* engine (M0). However, the entire system relies on the `Formalizer` to translate Natural Language into Narsese. If the LLM translates *"The cat is not on the mat"* incorrectly, the symbolic engine will flawlessly execute logic on a false premise.
*   **The Fix:** The plan needs a **Translation Conformance Harness**. How do you benchmark the NL-to-Narsese parser against standard NLU datasets (e.g., FraCaS, GLUE) to ensure the LLM isn't silently dropping logical negations or quantifiers before they even hit the symbolic gate?

#### **B. Compute Budgeting for the Neural Stratum (Latency & Cost)**
*   **The Gap:** The plan meticulously tracks memory bounds, bag capacities, and cycle budgets for the *symbolic* core. But what about the LLM? If System One (neural judgment) or the L4 neural amplifier is invoked on every premise selection, the system could trigger thousands of LLM API calls per second, resulting in massive latency and financial ruin.
*   **The Fix:** A strict **Neural Compute Budget** (e.g., token limits, rate limiting, semantic caching). The plan needs a mechanism to decide *when* to invoke the expensive LLM and when to rely on cheap, deterministic heuristics.

#### **C. Adversarial Robustness and "Prompt Injection via Narsese"**
*   **The Gap:** The plan mentions updating `security.md` for wire protocols, but cognitive architectures are highly susceptible to logical paradoxes and infinite loops. If a malicious actor sends a carefully crafted Narsese sentence designed to trigger a cyclic dependency in the temporal solver (e.g., exploiting the NP-hard nature of Allen's interval algebra noted in P1), they could DOS the agent's reasoning core.
*   **The Fix:** A **Logical Fuzzer** and strict depth/complexity limits on incoming formalizations. The admission gate must reject propositions that threaten to cause combinatorial explosions in the derivation recorder.

#### **D. Neural Stratum Drift & Catastrophic Forgetting**
*   **The Gap:** The symbolic memory has "usefulness eviction" (A4). But what about the vector embeddings and System One models? As the agent learns new concepts over thousands of cycles, the semantic space of the embeddings will drift. A concept that meant "danger" on Day 1 might mathematically drift closer to "curiosity" by Day 30.
*   **The Fix:** A mechanism for **Neural-Symbolic Anchoring**. The system needs a way to periodically recalibrate its embeddings against the rigid symbolic definitions to prevent semantic drift from corrupting the LLM's "intuition."

----

This is the most radical and liberating question you can ask when designing a cognitive architecture.

The short answer is: **No, you do not strictly need explicit symbolic temporal reasoning (NAL-7). An atemporal system can still be profoundly useful.**

If you strip away NAL-7 entirely, you avoid 90% of the architectural tar pits (canonicalization, interval math, truth-value decay over time, the frame problem). You are left with a **State-Reactive Associative Engine**, which is exactly how most highly successful modern AI systems (like LLMs and standard Reinforcement Learning agents) operate.

Here is a breakdown of what an atemporal SeNARS looks like, what you lose by dropping time, how to cheat the losses, and why "Implicit Time" might be the smartest architectural choice.

---

### 1. What an Atemporal SeNARS Looks Like
If you restrict SeNARS to NAL 1–6 (atemporal logic) plus Operator execution, the system becomes a powerful **diagnostic, associative, and reactive reasoner**.

*   **Beliefs are static correlations:** It learns `<rooster_crows ==> sun_rises>`. It doesn't know the rooster crows *before* the sun rises; it just knows that when one is present in the context, the other is highly likely to be true.
*   **Tool Use is immediate:** It learns `<goal(reach_target) ==> ^move(forward)>`. If the goal is active, it fires the operation.
*   **Context is King:** Like an LLM, the system relies entirely on its **current sensory input** and **working memory** (the active concepts in the bag) to determine what is happening "now."
*   **Planning is Search, not Timeline:** To achieve a goal, it looks for a chain of implications `<A ==> B>`, `<B ==> C>`. It tries to make `A` true, expecting `C` to eventually become true.

**Where this excels:**
*   Natural Language Q&A and Reasoning.
*   Fault diagnosis (Symptoms $\rightarrow$ Root Cause).
*   Categorization and Ontology building.
*   Simple reflex-based robotics and game-playing (where the screen state *is* the current reality).

---

### 2. The Four Things You Lose (And How to Cheat Them)

If you drop explicit temporal reasoning, you lose four specific cognitive capabilities. However, in modern AI, we usually "cheat" these using the environment or external modules rather than solving them in the core logic.

#### A. Causality vs. Correlation
*   **The Problem:** Without time, the system cannot distinguish between "A causes B" and "B causes A" or "C causes both."
*   **The Cheat:** **Intervention.** In an agentic loop, causality is established by *doing*, not just observing. If the system executes `^turn_switch` and observes `light_on`, the *action-to-effect* link is inherently causal. You don't need temporal logic to know the switch caused the light; the motor-sensory loop proves it.

#### B. The Frame Problem (State Persistence)
*   **The Problem:** If I turn on the light, how does the system know the light is *still on* 10 seconds later if no new sensory input arrives?
*   **The Cheat:** **The Environment Loop / State Vectors.** Instead of the logic engine remembering `<light = on>`, the *environment* (or a dedicated state-tracking module) simply feeds `light=on` into the system's perception stream every cycle until an event changes it. Time is handled by the refresh rate of the sensor loop, not by logical inertia.

#### C. Sequential Planning with Delays
*   **The Problem:** "Bake at 350 degrees for 40 minutes." An atemporal system doesn't understand "40 minutes."
*   **The Cheat:** **External Timers / Promises.** The system executes `^set_timer(40_min)`. The environment handles the waiting. When the timer finishes, the environment injects the event `timer_finished` back into the system's perception. The logic engine just reacts to the event.

#### D. Rhythm and Prediction
*   **The Problem:** Catching a moving ball or predicting a stock trend requires understanding velocity and continuous change.
*   **The Cheat:** **Neural/RL Subsystems.** This is exactly what the "Neural Facilitator" layer in your architecture is for. Let a recurrent neural network, a Kalman filter, or an RL policy handle the continuous physics, and let it feed discrete symbolic events (`ball_interceptable`) to the NARS core.

---

### 3. The "Implicit Time" Paradigm

The most successful cognitive architectures of the last decade do not use symbolic temporal logic. They use **Implicit Time**.

In Implicit Time, **time is not a property of the logic; it is a property of the execution loop.**

*   **Markov Decision Processes (RL):** The state at $t+1$ depends only on the state at $t$ and the action taken. Time is just the index of the loop iteration.
*   **Transformers (LLMs):** Time is just the sequence of tokens in the context window. "Before" and "After" are just left-to-right positioning.
*   **Subsumption Architectures (Robotics):** The robot doesn't plan a timeline; it just constantly reacts to the latest sensor readings.

If SeNARS adopts Implicit Time:
1.  **Drop NAL-7.**
2.  **Make the Sensorimotor Cycle fast.** The system wakes up, reads the current environment state, fires any applicable operations, updates its atemporal beliefs, and goes back to sleep.
3.  **Use RL for Sequences.** If a sequence of actions is required, the RL subsystem (which you already have) learns the policy to navigate the state-space.

---

### 4. Strategic Recommendation: The "Event-Driven Reactive Core"

If you are willing to sacrifice NAL-7 parity with OpenNARS, you can build a much more stable, highly effective SeNARS.

**The Architecture:**
1.  **NAL 1–6 Core:** Handles concepts, inheritance, similarities, sets, and static implications.
2.  **Operator Execution:** Handles tool use and motor commands.
3.  **Sensorimotor Buffer:** A simple FIFO queue of the last $N$ events.
4.  **Pattern Matcher:** Instead of complex temporal induction, use a simple sequence miner on the FIFO buffer. If it sees `Event A` followed by `Event B` frequently, it creates a simple rule: `Context(A) ==> Expect(B)`.
5.  **LLM Integration:** Let the LLM handle complex temporal planning (e.g., "Write a schedule for tomorrow") and output discrete, atemporal goals for SeNARS to execute one by one.

### Summary Verdict

**Do you need it?** No.
**Will it be useful without it?** Yes, incredibly useful. It becomes a highly capable **Associative Reasoner and Reactive Agent**.

By dropping explicit temporal reasoning, you shift the burden of "time" from the **Logic Engine** (which is bad at math and state-tracking) to the **Environment Loop and Neural Subsystems** (which are excellent at it).
