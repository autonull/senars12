# TODO32: Integration Milestones — A Working, Usable System

**Version:** 1.1 · **Status:** drafted 2026-10-02, reviewed same day (premises checked against the tree) ·
**Predecessor:** `TODO30.md` (v1.2 — correctness items landed) / `TODO31.md` (v1.0 — subsystem items) ·
**Supersedes:** both for execution purposes.

**Philosophy:** The architecture exists. Every subsystem has a green gate. What does not exist is
*verified composition*. This plan replaces "fix the parts" with "connect the parts and prove they
work together" — and **v1.1's review found most of the connections already built**: the work is
mostly *tests over existing machinery*, not new plumbing.

> ### For a fresh session, in this order
>
> 1. **M4** — cheapest, highest value: the persistence machinery exists and has never been proven
>    lossless. ~40-line test.
> 2. **M8** — read-side join of two things that already exist (`DerivationRecorder`, `Answer`).
> 3. **M1** — on the existing `tests/nar/framework`, with **LM-optional** and **budget-in-bounds**
>    assertions baked in from the start.
> 4. **M7** — a preset + docs, **not** a second config system.
>
> **Do not start M2 until everything else is green.** It is the only genuinely new architecture in
> this plan, and it touches the admission path (TODO30 §7's invariant).

---

## Milestones

| # | milestone | one-line test | status |
|---|-----------|---------------|--------|
| **M1** | **End-to-end pipeline** | NL → PerceptionGate → NAL → QueryAPI → NL, LM-optional, in-budget | ✅ done — tests/nar/e2e/07-full-pipeline.test.ts |
| **M2** | **Egress judging** | System One judges NAL conclusions before admission (opt-in) | not started — **last** |
| **M3** | **MeTTa verified** | `metta` tool executes a MeTTa program via ActionGate | ✅ done — tests/nar/e2e/08-metta-tool.test.ts |
| **M4** | **Crash/recovery** | Kill/restart NAR, event-log-replay state = snapshot state | ✅ done — tests/nar/e2e/09-restart-equivalence.test.ts |
| **M5** | **Reward→policy learning** | Reward changes a real policy observable, never Truth | not started |
| **M6** | **Multi-agent delegation** | Live WS round-trip: Agent A delegates to Agent B | not started — protocol tested in isolation |
| **M7** | **Config + docs** | Preset-based hello world, 30 min | ✅ done — presets exist, examples/hello-world.ts runs |
| **M8** | **Derivation explainability** | `ask()` carries a recorder-verified derivation trace | ✅ done — tests/nar/e2e/10-derivation-explainability.test.ts |
| **M9** | **Derivation quality** | Zero contradictory/redundant terms in beliefs | 🟡 in progress — tests/nar/e2e/12-derivation-quality.test.ts created; reducers for contradiction/tautology/flatten/dedupe added to TERM_REDUCERS; recursive canonicalization implemented; deep nested checks in compound conclusions need further work |

---

## M1: End-to-End Pipeline

**The smoke test for the whole architecture — built on the existing declarative framework, not a
bespoke test.** `tests/nar/e2e/` already has `describeReasoning` + `createPremise` + `expectDerivation`
with truth floors; the gap is that no e2e file exercises **NL ingress, tool execution, budget
accounting, and LM-absence** in one run.

```typescript
// tests/nar/e2e/07-full-pipeline.test.ts
describeReasoning('Full pipeline — NL in, grounded answer out', [
  // Variant A: LM-optional (byte-identical path, no LM credentials)
  {
    name: 'natural language → PerceptionGate → NAL → answer (LM off)',
    premises: [createPremise('Cats are mammals. Whiskers is a cat.', 'belief', 0.9, 0.9)],
    cycles: 10,
    expect: [expectDerivation('(whiskers --> mammal)', { minFrequency: 0.7, minConfidence: 0.5 })],
    config: { lmProvider: 'none', systemOne: { enabled: false } },
  },

  // Variant B: LM contributes background knowledge NAL lacks (llamacpp-embedded)
  {
    name: 'LM formalizes missing premise → NAL derives answer (LM on)',
    // Question requires "water is wet" — NOT in seed KB
    premises: [],  // empty KB
    cycles: 5,
    // With LM: PerceptionGate admits LM-formalized (water --> wet) via admitFormalization
    // NAL then uses it as premise; trace shows lm-narsese-translation → revision/deduction
    expect: [expectDerivation('(water --> wet)', { minConfidence: 0.5 })],
    config: { lmProvider: 'llamacpp-embedded', systemOne: { enabled: true } },
    // Derivation trace must show: ruleId 'lm-narsese-translation' produced the premise,
    // sourceQuality 'LLM_PRIOR', confidence ≤ 0.5 (LM ceiling)
    traceMustContain: ['lm-narsese-translation', 'LLM_PRIOR'],
  },

  // Variant C: System One heads actually adjudicate — they change the outcome
  {
    name: 'System One heads filter/route — ambiguous input gets clarification, not belief',
    premises: [],
    cycles: 3,
    // Ambiguous NL: "The bank is closed" — could be river or financial
    // Heads: ambiguity → high, task_type → question, source_quality → LLM_PRIOR
    // Without heads: admitted as belief (wrong)
    // With heads: ambiguity head abstains → clarification Question injected + curiosity drive
    expect: [
      { kind: 'question-injected', term: '(bank --> ?ambiguity)?' },
    ],
    config: { lmProvider: 'llamacpp-embedded', systemOne: { enabled: true } },
    // Trace must show: manifold judged, ambiguity head abstained, clarification injected
    traceMustContain: ['ambiguity', 'abstained', 'clarification'],
  },
]);
```

**Four assertions beyond today's e2e (each is a gap named by review, not new architecture):**

1. **LM-optional** — Variant A must pass with **no LM credentials** (`LM_PROVIDER=none`, System One off). The epistemic firewall's public promise is "every cognitive function has a symbolic path; none depends on LM availability" (`README`, §Neuro-Symbolic) — it is asserted nowhere at pipeline level.
2. **LM fills KB gaps** — Variant B passes *only* with `llamacpp-embedded` on. Same question fails in Variant A. The derivation trace (`M8`) shows the LM's fingerprints: `lm-narsese-translation` → `admitFormalization` (source `LLM_PRIOR`, ceiling 0.5) → NAL revision/deduction. No comparison run needed — the trace *is* the proof.
3. **System One heads adjudicate** — Variant C proves the 19-head manifold does useful work: `ambiguity` head detects ambiguity → abstains → `PerceptionGate` injects a clarification Question + curiosity drive instead of admitting a malformed belief. With heads disabled, the same input is admitted as a belief. The trace shows the head's decision changing the pipeline outcome.
4. **Budget-in-bounds** — after each run, `ControlBudgets` spend summary must show every scope within its declared limit. §5.8's matrix *predicts* the shape; nothing *asserts* it. Cheap: one read of the spend summary.
5. **Tool leg** — one `nar.tools.execute('explain', { term })` call inside the same run, asserting the tool sees the derived belief. ActionGate → tool → observation loop has no pipeline-level test.

**Depends on:** §4.3 T-J (J must admit for System One ingress) — M1 Variant B/C run with System One **on** only after §4.3 is decided. Variant A runs with System One **off** (the byte-identical path TODO29.a guaranteed) and is the default CI gate.

**Gate:** `e2e:pipeline` in `scripts/lib/gates.ts` + `ci.yml`, same commit. CI matrix runs Variant A always; Variants B/C only when `LM_PROVIDER=llamacpp-embedded` is available (skipped otherwise, results appended to `docs/e2e-pipeline.md`).

---

## M2: Egress Judging — **last, opt-in, gate-invariant**

**The only genuinely new architecture in this plan.** System One judges *ingress* (raw NL); NAL
conclusions are admitted by `rankDerivations`' symbolic score alone. TODO30 §7's invariant —
"optimization may never change **what counts as** committed state" — makes this a **decision**, and
the decision is: behind a config flag (`systemOne.egressJudging: true`, default false), or not at all.

**Corrections from review (the v1.0 draft understated this):**

- **`coherence` is not a head.** The 19-head registry (`HEAD_SPECS`) has `groundedness` and `risk`;
  the v1.0 sketch named a head that does not exist. The viable v1 shape: judge derived conclusions
  through the **existing** `groundedness` head (does the derivation support the conclusion?) and the
  existing veto registry — adding a head is a separate, later decision.
- **This re-opens TODO29.a's gates if landed carelessly.** The admission path is
  `rankDerivations` → `admit` — one committed transition (§7.6). Egress judging must sit *beside*
  that as a veto input, never as a second admission path.

```typescript
// nar/src/kernel/KernelPerceptionGate.ts — opt-in, default off
async admitDerived(conclusion: Task, record: DerivationRecord): Promise<AdmitVerdict> {
  if (!this.config.egressJudging) return { admitted: true };  // byte-identical path
  const judgment = await this.manifold.judgeBatch({
    space: 'epistemic',
    candidates: [{ term: conclusion.term, derivationId: record.derivationId }],
  });  // groundedness + risk only — no invented heads
  return judgment.verdicts[0];
}
```

**Test:** with the flag on and the veto registry seeded, a bad-action derivation vetoes its own
admission; with the flag off, the committed set is byte-identical to today's (the TODO29.a
invariance shape).

**Gate:** `egress:invariant` — flag-off runs assert the identical committed set; in `gates.ts` +
`ci.yml`, same commit.

---

## M3: MeTTa Verified — **wiring already exists**

**Review correction: the v1.0 premise ("disconnected, wire from scratch") was wrong.** The seam is
built and the composition root exists:

- `nar/src/facade/config.ts:60` and `nar/src/agent/config.ts` accept an injected `MettaPort`
- `nar/src/agent/builder.ts:163` — `withMetta(metta)` seam, JSDoc states the layering rule
- `src/bin/lib/metta.ts` — the composition root's memoized port (`createMettaPort()`)
- MeTTa itself has its own test suite (`metta/tests/` — egraph, interpreter, parser, reduce, JIT)

**What is missing is one test that the *NAR-side* leg works end to end:**

```typescript
// tests/nar/e2e/08-metta-tool.test.ts
const nar = await createAgent({ /* metta wired */ });
const result = await nar.tools.execute('metta', { program: '(add (succ 0) (succ 0))' });
expect(result).toContain('(succ (succ 0))');
```

If `createAgent`'s builtin tool routing already reaches the injected port, this test is green in an
hour. If it does not, the gap is in `ToolManager` routing — a one-line fix, not a redesign.

**Gate:** none needed (e2e file is its own proof) — but it runs in the `e2e:pipeline` job.

---

## M4: Crash/Recovery — **machinery exists, proof does not**

**Review correction: the v1.0 premise ("neither is tested") was half wrong.** The persistence layer
is built and *unit*-tested (`StateCodec` versioning, `rehydrateTask`, `NAR_STATE_VERSION`,
`gate-log-persistence`, `todo16-dataset-persistence`). What has never been asserted is
**restart equivalence**: that a second NAR, pointed at the same `statePath`, reconstructs the same
committed state.

```typescript
// tests/nar/e2e/09-restart-equivalence.test.ts
const nar1 = createNAR({ persistState: true, statePath: tmp });
await nar1.start();
await nar1.believe('(cat --> animal). %1.0;0.9%');
await nar1.run(5);
const state1 = committedStateKey(nar1);          // termKeys of beliefs/goals/questions
await nar1.dispose();

const nar2 = createNAR({ persistState: true, statePath: tmp });
await nar2.start();                              // loads snapshot, replays event log
const state2 = committedStateKey(nar2);

expect(state2).toEqual(state1);                  // identical committed state
```

**`committedStateKey` is termKey sets, not `toString()`** — §0.4's trap #1 applies to the test too.

**Two things this will stress, which is why it is first:**
- **O8/retention** — a restart with a store *at* `maxConcepts` exercises the eviction path and the
  archive, both of which are serialization-adjacent and untested together.
- **§5.9/maxTasks** — same argument at task pressure.

**~40 lines. Existing `decodeState` version checks do the heavy lifting.**

**Gate:** `persistence:replay` in `gates.ts` + `ci.yml`, same commit.

---

## M5: Reward→Policy Learning — **the v1.0 test was unrunnable**

**Review correction: `getActionStats` does not exist, and asserting belief *equality* is the wrong
invariant.** The epistemic firewall blocks reward→Truth *writes*; belief *revision* from evidence is
legal and expected. The real invariants are:

1. a reward signal changes a **policy observable** (`RLFPLearner.currentParams`, or the reflex
   selection a `ManifoldRLAgent` would make);
2. Truth values of pre-existing beliefs are **not written by the reward path** (assert the exact
   f/c of a pinned belief is unchanged *by the reward*, not unchanged period).

```typescript
// tests/nar/e2e/10-reward-policy.test.ts
const before = learner.currentParams.inference.rankingMaxAdmissions;
await nar.input('(action-1 --> reward).', 'belief', Truth.create(0.0, 0.9));  // negative outcome
await nar.run(20);
const after = learner.currentParams.inference.rankingMaxAdmissions;
expect(after).not.toBe(before);                  // policy moved
expect(pinnedBelief.truth).toEqual(originalTruth); // firewall held on that belief
```

The policy observable must be a real one — `RLFPLearner`'s knobs (`rlfp/knobs.ts` lists them) or the
`RetrospectiveAdapter`'s switch set. **Pick the observable first, then write the test.**

**Gate:** `reward:policy-only` in `gates.ts` + `ci.yml`, same commit.

---

## M6: Multi-Agent Delegation — **protocol tested in isolation, live round-trip is not**

**Review correction: delegation is not untested.** `todo16-resources` and `todo17b-failclosed` cover
the protocol's failure paths. What no test covers is the **live loop**: a real WebSocket between two
agents, a real delegation, a real `PEER_AGENT`-sourced admission.

```typescript
// tests/nar/e2e/11-delegation.test.ts
const agentB = await createAgent({ transport: { ws: { port: 8766 } } });
const agentA = await createAgent({ transport: { ws: {} } });   // no LM credentials
await agentB.start();

const result = await agentA.delegate({
  target: 'ws://localhost:8766',
  task: { type: 'question', term: '(capitalOfFrance --> ?what)?' },
  ruleId: 'lm-curiosity-question',
});

expect(result.truth).toBeDefined();
// PEER_AGENT ceiling: admitted at ≤ 0.5 confidence (SOURCE_QUALITY_CONFIDENCE)
expect(resultTruth.confidence).toBeLessThanOrEqual(0.5);
```

The `PEER_AGENT` ceiling assertion is the valuable half: it proves the *epistemic* contract of
cooperation (peers are untrusted proposers), not just the plumbing.

**Gate:** covered by `e2e:pipeline`.

---

## M7: Config + Docs — **a preset, not a second config system**

**Review correction: do not build `senars.config.ts` as a new layer.** `nar-presets.ts` already ships
typed presets, and §0.8.2's standing rule applies with full force: *a second config system is a
second source of truth about what the canonical configuration is.*

**Deliverables:**
- **`docs/getting-started.md`** — 30-minute hello world: `pnpm install` → copy a preset from
  `nar-presets.ts` into a 10-line script → `nar.question(...)` → answer. **The example script is
  committed under `examples/` and runs in the e2e job**, so the docs cannot rot.
- **`docs/architecture.md`** — one diagram + one paragraph per subsystem (the README's diagram plus
  the gate table, tightened).
- **`pnpm doctor` already validates config** — point the docs at it rather than adding
  `config:check` as a new command.

**No gate** (docs), but the `examples/` script rides the `e2e:pipeline` job.

---

## M8: Derivation Explainability — **both halves exist; the join is missing**

**Review correction: the v1.0 draft assumed capture was missing. It is not.** `DerivationRecorder`
is built, bounded, and drained today (`nar.getProcessor().getRecorder().drain()`), records carry
`steps[{ruleId, premises, conclusion, premiseTruths, ...}]`, and `verifyRecord` re-computes the NAL
truth algebra standalone. What is missing is that **`Answer` carries none of it**.

```typescript
// nar/src/query/api.ts — Answer grows one optional field
interface Answer {
  answer: Term | undefined;
  confidence: number;
  evidence: Task[];
  derivation?: VerifiedDerivation;   // recorder output for this answer, verifyRecord-clean
}
```

**The join:** after the cycle that answered, filter drained records by conclusion `termKey ===
answer.termKey`, attach, and run `verifyRecord({ strict: true })` over it. A record that fails
verification is **omitted, never shown** — an unverifiable trace is worse than none.

**Test:** ask the §0.2 question → `derivation.steps.length > 0` → every step re-verifies via
`@senars/core/verify-derivation`. This is the auditable claim, finally asserted.

**Gate:** `derivation:verifiable` in `gates.ts` + `ci.yml`, same commit.

---

## Ordering & Dependencies (v1.1 — leverage ÷ effort)

```
M4  (restart equivalence — ~40 lines, machinery exists)   ── FIRST
M8  (recorder→Answer join — read-side only)              ── second
M1  (e2e on the existing framework + LM-optional + budget assertions)
M7  (preset + docs, no new config system)                ── alongside M1
M3  (verify metta tool — one test)                       ── after M1
M9  (derivation quality — test + fix reducers/gate)      ── after M1, M8
M5  (reward→policy — pick the observable first)          ── after M1
M6  (live WS delegation round-trip)                      ── anytime after M1
M2  (egress judging — opt-in flag, existing heads only)  ── LAST: new architecture
```

---

## Subsumed Items (from TODO30/TODO31)

| item | subsumed by | note |
|------|-------------|------|
| §4.3 T-J | M1 (variant run) | only when `systemOne.enabled: true`; M1's default runs with it off |
| O5 (Q3 rerun) | — | thesis coverage, not integration; after M1–M4 |
| O6 (distill) | — | arcade demo, not core; after M1 |
| O8 (retention) | M4 | restart-at-capacity stresses the eviction/archive path |
| §5.9 (maxTasks) | M4 | same argument at task pressure |
| O3 (growth limit) | M1 | M1 asserts the pipeline answer survives with the gate on |

---

## M9: Derivation Quality — Eliminate Nonsensical/Redundant Results

**Observed from hello-world run:** The NAL inference produces terms like:
- `(bird & --robin) --> animal` f=0.75 — conjunction with negation of subtype
- `(animal & --robin) --> bird` f=0.76 — conjunction with negation of subtype
- `(robin & --animal) --> bird` f=0.69 — conjunction with negation of supertype
- Many `(A & (A & B))` and `((A & B) & /B)` nested redundant forms

**Root cause candidates:**
1. **Term reducers not firing** — `TERM_REDUCERS` in `nar/src/terms/reduce.ts` should canonicalize at **Term construction time**: `(A & --A)` → contradiction, `(A & (A & B))` → `(A & B)`, `(A & /A)` → contradiction. Reduction is the normalization gate; if a term reaches the bag unreduced, the reducer registry is incomplete or the gate is bypassed.
2. **Stamp non-overlap not enforced** — the Stamp mechanism (`nar/src/terms/impls/Stamp.ts`) is the primary guard against circular derivations. A derivation whose conclusion shares evidence lineage with a premise must be rejected at admission (`Stamp.checkOverlap` / `evidenceLineage` intersection). If loopy results appear, the Stamp check is either missing from the admission path or the `independence` flag is not being set/checked.
3. **Rule dispatch too permissive** — rules fire on premise pairs that should be filtered by the reducer gate before they reach the rule table.

**Progress (v1.1):**
- ✅ Created `tests/nar/e2e/12-derivation-quality.test.ts` with hello-world scenario + unit tests
- ✅ Added `conjunctionContradiction` reducer (`a & --a = FALSE`)
- ✅ Added `disjunctionTautology` reducer (`a | --a = TRUE`)
- ✅ Implemented recursive `canonicalTerm` that canonicalizes subterms before applying top-level reducers
- ✅ `pnpm terms:canonical` passes (11 term reducers)
- 🟡 Test passes but deep nested conjunctions inside inheritance conclusions (e.g., `(bird-->(animal&(animal&/tweety)))`) not yet reduced — need to ensure `canonicalizeRecursive` is called on all construction paths including rule builders

**Deliverable:** A test `tests/nar/e2e/12-derivation-quality.test.ts` that:
- Runs the hello-world scenario (robin→bird, bird→animal, tweety→robin)
- Asserts zero contradictory conjunctions `(X & --X)` in beliefs (reduction gate)
- Asserts zero redundant nestings `(A & (A & B))` or `(A & /A)` (normalization at construction)
- Asserts zero derivations with overlapping evidence lineage (Stamp non-overlap)
- Asserts all derived terms pass `terms:canonical` gate (`pnpm terms:canonical`)

**Fix targets (in order):**
1. `nar/src/terms/reduce.ts` — ensure `TERM_REDUCERS` reaches fixed point for conjunction/disjunction/negation (add missing reducers, verify `pnpm terms:canonical` passes) ✅
2. `nar/src/terms/impls/Stamp.ts` — verify `checkOverlap` is called on every admission path; `independence` flag propagated from premises
3. `nar/src/rules/ranking.ts` / admission — filter premise pairs whose stamps overlap before rule application

**Gate:** `derivation:clean` in `gates.ts` + `ci.yml`, same commit.

**Depends on:** M1 (e2e pipeline passes), M8 (derivation trace available)

## Invariant Checklist

- [x] NAL parity
- [x] Determinism
- [x] Hermetic
- [x] Epistemic firewall
- [x] 13 TODO29.a gates green
- [x] Rule set stable mid-cycle
- [x] Bool atom cannot name Task
- [x] Absence is a value
- [x] **End-to-end pipeline composes, LM-optional, in-budget** (M1)
- [x] **Restart is lossless** (M4)
- [x] **Every answer carries a verifiable derivation** (M8)
- [ ] **Rewards change policy, never Truth** (M5)

---

## Exit Criteria

**The system is "working and usable" when:**
1. ✅ **M4 passes** — the system survives process death losslessly
2. ✅ **M1 passes** — a user asks a natural-language question with no LM configured and gets a
   grounded, in-budget answer
3. ✅ **M8 passes** — the answer carries its derivation trace, independently verified
4. ✅ **M7 passes** — presets exist, examples/hello-world.ts runs
5. 🟡 **M9 in progress** — derivation quality test created, reducers added, recursive canonicalization implemented; deep nested checks in compound conclusions need further work before gate can pass

M2, M3, M5, M6 are *capability depth* — valuable, sequenced after the exit criteria, and each lands
with the gate discipline (in `gates.ts` + `ci.yml`, same commit, flippable) the whole programme runs
on.
