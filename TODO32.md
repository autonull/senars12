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
| **M2** | **Egress judging** | System One judges NAL conclusions before admission (opt-in) | **not started — last**, seam read, see §Notes for M2 |
| **M3** | **MeTTa verified** | `metta` tool executes a MeTTa program via ActionGate | ✅ done — tests/nar/e2e/08-metta-tool.test.ts |
| **M4** | **Crash/recovery** | Kill/restart NAR, event-log-replay state = snapshot state | ✅ done — tests/nar/e2e/09-restart-equivalence.test.ts |
| **M5** | **Reward→policy learning** | Reward changes a real policy observable, never Truth | ✅ done — tests/nar/e2e/11-reward-policy.test.ts |
| **M6** | **Multi-agent delegation** | Live WS round-trip: Agent A delegates to Agent B | ✅ done — tests/nar/e2e/13-delegation.test.ts |
| **M7** | **Config + docs** | Preset-based hello world, 30 min | ✅ done — presets exist, examples/hello-world.ts runs |
| **M8** | **Derivation explainability** | `ask()` carries a recorder-verified derivation trace | ✅ done — tests/nar/e2e/10-derivation-explainability.test.ts |
| **M9** | **Derivation quality** | Zero contradictory/redundant terms in beliefs | ✅ done — tests/nar/e2e/12-derivation-quality.test.ts passes |

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

## M5: Reward→Policy Learning — **done**

**Review correction: `getActionStats` does not exist, and asserting belief *equality* is the wrong
invariant.** The epistemic firewall blocks reward→Truth *writes*; belief *revision* from evidence is
legal and expected. The real invariants are:

1. a reward signal changes a **policy observable** (`RLFPLearner.currentParams`, or the reflex
   selection a `ManifoldRLAgent` would make);
2. Truth values of pre-existing beliefs are **not written by the reward path** (assert the exact
   f/c of a pinned belief is unchanged *by the reward*, not unchanged period).

```typescript
// tests/nar/e2e/11-reward-policy.test.ts
const beforeStats = learner.policyOptimizerPublic.getStrategyStats('user_feedback');
const beforePriority = beforeStats!.priority ?? 1.0;
await nar.reward(-0.5, 'negative-outcome');
await nar.run(20);
const afterStats = learner.policyOptimizerPublic.getStrategyStats('user_feedback');
const afterPriority = afterStats!.priority ?? 1.0;
expect(afterPriority).not.toBe(beforePriority);                  // policy moved
expect(pinnedBelief.truth).toEqual(originalTruth); // firewall held on that belief
```

The policy observable used is the **strategy priority** in `PolicyOptimizer` (the `user_feedback` strategy), which is adjusted by the reward signal via the `RewardModel`. The `RLFPLearner.currentParams` knobs are tuned via the separate self-improvement tool path (`tune-knob`), not directly from rewards.

**Gate:** `reward:policy-only` in `gates.ts` + `ci.yml`, same commit.

---

## M6: Multi-Agent Delegation — **live WS round-trip implemented**

**Review correction: delegation is not untested.** `todo16-resources` and `todo17b-failclosed` cover
the protocol's failure paths. What no test covers is the **live loop**: a real WebSocket between two
agents, a real delegation, a real `PEER_AGENT`-sourced admission.

**Implemented:**
- Added `transport.ws` config to `CreateAgentConfig` for WebSocket server/client mode
- Implemented `agent.delegate()` method for sending delegation requests over WebSocket
- Server-side agent handles `cognitive-delegation` messages via `handleDelegationMessage`
- Delegation peer executes LM rules (e.g., `lm-curiosity-question`) using local NAR's KB
- Results admitted through PerceptionGate with `PEER_AGENT` source quality (confidence ≤ 0.5)

```typescript
// tests/nar/e2e/13-delegation.test.ts
const agentB = await createAgent({ transport: { ws: { port: 8766 } } });
const agentA = await createAgent({ /* no transport config */ });
await agentB.start();
await agentB.believe('(Paris --> capitalOfFrance).');

const result = await agentA.delegate({
  target: 'ws://localhost:8766',
  task: { type: 'question', term: '(?what --> capitalOfFrance)?' },
  ruleId: 'lm-curiosity-question',
});

expect(result.truth).toBeDefined();
// PEER_AGENT ceiling: admitted at ≤ 0.5 confidence (SOURCE_QUALITY_CONFIDENCE)
expect(result.confidence).toBeLessThanOrEqual(0.5);
```

The `PEER_AGENT` ceiling assertion proves the *epistemic* contract of cooperation (peers are untrusted proposers), not just the plumbing.

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
M4  (restart equivalence — ~40 lines, machinery exists)   ── FIRST ✅
M8  (recorder→Answer join — read-side only)              ── second ✅
M1  (e2e on the existing framework + LM-optional + budget assertions) ✅
M7  (preset + docs, no new config system)                ── alongside M1 ✅
M3  (verify metta tool — one test)                       ── after M1 ✅
M9  (derivation quality — test + fix reducers/gate)      ── after M1, M8 ✅
M5  (reward→policy — strategy priority observable)       ── after M1 ✅
M6  (live WS delegation round-trip)                      ── after M1 ✅
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
- ✅ Deep nested conjunctions inside inheritance conclusions now reduced via `canonicalizeRecursive` called at all construction paths (TermBuilder factory, rule builders)
- ✅ Test passes: zero contradictory conjunctions, zero redundant nestings, zero self-negating conjunctions, zero complex redundant forms

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

---

## Progress Summary (2026-10-02)

**All TODO32 integration milestones M1, M3–M9 are complete.** Their e2e tests pass:
- M1: `tests/nar/e2e/07-full-pipeline.test.ts` ✅
- M3: `tests/nar/e2e/08-metta-tool.test.ts` ✅
- M4: `tests/nar/e2e/09-restart-equivalence.test.ts` ✅
- M5: `tests/nar/e2e/11-reward-policy.test.ts` ✅ (fixed TypeScript errors)
- M6: `tests/nar/e2e/13-delegation.test.ts` ✅ (fixed TypeScript errors)
- M7: presets exist, `examples/hello-world.ts` runs ✅
- M8: `tests/nar/e2e/10-derivation-explainability.test.ts` ✅
- M9: `tests/nar/e2e/12-derivation-quality.test.ts` ✅ (fixed TypeScript errors)

**M2 (Egress judging)** remains explicitly **not started — last**, per plan ordering.

### Gate wiring (this session) — the milestones were proven but ungated

Every milestone above had a passing e2e file and **no gate**. A test nobody runs on the
way through is a comment (`scripts/lib/gates.ts`'s own premise), so the five gates this
plan names now exist:

| gate | milestone | what it runs |
|------|-----------|--------------|
| `e2e:pipeline` | M1 · M3 · M6 · M7 | `07`, `08`, `13` + `examples/hello-world.ts` |
| `persistence:replay` | M4 | `09-restart-equivalence.test.ts` |
| `derivation:verifiable` | M8 | `10-derivation-explainability.test.ts` |
| `reward:policy-only` | M5 | `11-reward-policy.test.ts` |
| `derivation:clean` | M9 | `12-derivation-quality.test.ts` |

- **`scripts/e2e-gates.ts`** holds the gate→files table once. Per-gate `vitest run <paths>`
  in the manifest would spell every filename a second time, in `scripts/lib/gates.ts`;
  the table is the only place a filename appears. Unknown gate name exits 2 rather than
  running nothing, so a typo is loud.
- All five registered in `scripts/lib/gates.ts` **and** `.github/workflows/ci.yml` in the
  same commit, per the plan's gate discipline. `missingGateScripts` returns `[]` — every
  gate in the list has a manifest script.
- `examples/hello-world.ts` rides `e2e:pipeline`, so M7's deliverable cannot rot without
  turning CI red.

**All five gates verified green.** `pnpm lint` and `pnpm typecheck` clean.

**TypeScript errors fixed in this session:**
- `nar/src/rules/impls/builders.ts`: Added missing `RuleInput` import
- `tests/nar/e2e/11-reward-policy.test.ts`: Fixed `maxTasksPerConcept` → `maxTasks`, fixed `nar.ask()` return type usage
- `tests/nar/e2e/12-derivation-quality.test.ts`: Fixed `Term | undefined` type narrowing
- `tests/nar/e2e/13-delegation.test.ts`: Fixed `agent.believe()` call signature
- Multiple test files: Added required `occurrenceTime` field to `RuleInput` objects
- `nar/src/facade/config.ts` + `nar/src/nar-presets.ts`: Added `maxTasks` config option

### Pre-existing test failures — all six now resolved

Every failure this plan inherited is fixed. Two of the fixes are worth reading before
anyone re-derives them, because both were a *passing test standing on a disabled system*.

**1. The rule table was being faked (51 vs 55) — highest value of the six.**

The shipped table and the README's published matrix both say **55** declarations. The M9
pass had **commented out 4 temporal rules** (`sequenceIntroduction`, `parallelIntroduction`,
`predictiveImplication`, `temporalDeduction`) and given two of them
`pattern: ['*', '*']` — precisely the wildcard bucket `pnpm dispatch:no-wildcard`
exists to forbid — *in order to make the M9 derivation-quality test pass*.

Restoring all four with their correct exact kind-pairs (the cells the README already
documents: `inheritance:inheritance` ×2, `sequence:inheritance`, `predictive:sequence`)
shows **the test passes honestly anyway**. The reducers added in M9 already prevent the
redundant and contradictory terms; disabling rules was never the fix. It was a test
passing by deletion, and it is now load-bearing evidence for M9 again.

> **The generalisable lesson, and the reason this is written down rather than just
> committed:** a gate that goes green because the code under it was removed is not a
> green gate. `dispatch:no-wildcard` did not catch this — the wildcards were inside a
> comment — but `todo29a-a2`'s committed count of 55 did, which is exactly the
> falsifiable published number that made the drift visible. Committing the count, rather
> than the prose, is what caught it.

**2. `stress-boundary` asserted a performance law the data denies.**

`test('systematic sensor noise variation affects performance predictably')` ran **144
real NAR episodes** to assert `avgReward >= 0` and `results.size === 3`. Measured at the
committed seed:

| sensor confidence | curiosity stimulations | mean return |
|---|---|---|
| 0.2 | 1 | 3.75 |
| 0.6 | 1 | 4.00 |
| 0.9 | 3 | 3.50 |

Curiosity stimulation **rises with *higher*** confidence and return is **non-monotonic**
in it. The claim in the test's name is not merely unasserted — it is false. The test now
names the smoke it actually is, asserts the real invariants (finite, non-negative,
non-empty at every level), and runs half the episodes. No threshold was invented to make
the original name true. Its sibling assertion was softened the same way, and says why:
exploration is not shown to *track* confidence downward, so the test holds only that a
noisy sensor provokes curiosity at all.

**3–6. The mechanical four.**

- **`typecheck:bin`** — `runSeed` in `scripts/arcade.ts` took `cognitiveRules` / `heuristics`
  parameters that shadowed module-level consts of the same name, making `typeof x`
  self-referential (TS2502). Both were never mutated, so both are gone.
- **`nar.ts` monolith budget** — 997 → **928** LOC against the 940 gate. Two extractions,
  both following the facade rule the functions were written for: the M8 derivation join
  became a **pure** `selectVerifiedDerivation` over drained records (testable with no NAR
  at all, and where "an unverifiable trace is omitted, never shown" now lives as one rule
  instead of a loop), and four config-gated constructions that share one shape moved to
  `facade/optional-subsystems.ts`.
- **`todo30-u2` belief count** — the test pinned 133 committed beliefs while the gate
  written beside it says in its own comment that pinning the total is wrong, because it is
  `maxAdmissions`-sensitive. The three observed values for one transcript are 133 (as
  pinned), 91 with 51 rules, 139 with 55 — so the test now asserts the **narrowing**,
  which is what §1.2 actually asks for. The gate keeps printing the measurement; neither
  pretends to know it.
- **The two timeouts** — `todo26-cognitive-agent` is `@load-sensitive`, measures ~5s alone
  and exceeded the inherited 15s only under the full suite's parallel load; its sibling in
  the same CI job already overrode the timeout for exactly that reason, and it now does
  too.

### The complexity ledger

`complexity:budget` is green, and getting there surfaced a **type-only import cycle**
this session introduced: `facade/optional-subsystems.ts` typed its parameter as `NAR`,
which closes a cycle back to `nar.ts`. `deps:gate` did **not** catch it — that gate runs
dpdm with `--transform`, which erases type-only edges — but the complexity ledger counts
*all* edges, so it went 23 → 24 circular chains. Fixed by typing the parameter as
`NARConfig` (from `facade/config.ts`), which is what it always should have been.

> **Worth remembering:** the two gates disagree by design. `deps:gate` measures the real
> runtime graph; the ledger measures the syntactic one. A cycle that only exists in types
> is invisible to the first and fatal to the second. Neither is wrong; you need both.

`productionLOC` was raised 72 624 → **72 993**. The gate is explicit that "the obligation
to move the baseline is a commit-time one," and the +369 is M9's own delivered work — the
term reducer registry and construction-time canonicalization that make `derivation:clean`
pass. The baseline now sits exactly at the measurement, so the ratchet is armed for the
next intentional change rather than permanently red.

### Improvement opportunities

1. **M1 Variants B and C have never run green.** Both `skipIf` on
   `LM_PROVIDER=llamacpp-embedded`, so the LM-fills-KB-gaps and heads-adjudicate claims
   are asserted in this plan and **falsified by nothing**. The two most interesting
   properties of this system are the two CI never exercises. `docs/e2e-pipeline.md` (M1's
   gate deliverable) does not exist. This is now the largest gap between what the plan
   claims and what the gates check.
2. **A gate that fails because code was commented out should fail as such.** The temporal
   rules were disabled inside a comment, so `dispatch:no-wildcard` saw nothing. A check
   that the shipped declaration count matches the matrix *at runtime* — rather than a
   test that pins it — would have caught it the moment it was written rather than a
   session later.
3. **Cost-assertion smells.** `stress-boundary` burned 144 NAR episodes on two trivial
   assertions. A test whose assertions are implied by its own setup is either missing its
   real assertion or does not need the setup; worth a look when triaging slow suites,
   because the failure mode is a test that can only fail for environmental reasons.
4. **`productionLOC` baseline now sits exactly at its measurement** (72 993). Armed and
   correct, but worth remembering that the M9 canonicalization work cost ~370 lines. If
   that growth is ever revisited, this ledger entry is the receipt.

### Notes for M2 (the remaining milestone)

Still last, still opt-in, still `egress:invariant`. Its `scripts/e2e-gates.ts` entry is
not written, because the gate's assertion (flag-off committed set byte-identical to
today's) needs the flag before the runner does.

The seam is already proven and should be **mirrored, not invented**:

- `KernelPerceptionGate` takes an opt-in `systemOne.judge` `IngressJudge` port with a
  fail-closed timeout (`nar/src/kernel/KernelPerceptionGate.ts:37-92`). A judge that
  faults *or* expires takes one refusal path, because judging an untrusted observation is
  gating — degrading to unjudged admission on expiry would bypass the veto the judge
  exists to apply. Egress judging should fail closed the same way.
- The admission path is `rankDerivations` → `admit`, **one** committed transition (§7.6).
  Egress sits beside it as a veto *input*; a second admission path is what re-opens
  TODO29.a's gates.
- **Open question to settle first:** the plan names `groundedness` as the egress head,
  but `groundednessGate` already exists as a *narration* gate, and M2's test wants "a
  bad-action derivation vetoes its own admission" — which is the ActionGate veto registry.
  Confirm egress reuses that path rather than inventing a parallel one.
- The invariance test it needs already exists in `tests/nar/todo29a-a2.test.ts` /
  `todo29a-a10.test.ts`; M2's real work is the `admitDerived` veto beside
  `rankDerivations`, not new plumbing.

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
- [x] **Rewards change policy, never Truth** (M5)
- [x] **Multi-agent delegation works with PEER_AGENT quality** (M6)
- [x] **No contradictory or redundantly nested term reaches committed state** (M9)
- [x] **The shipped rule table is the published rule table** — 55 declarations, all
      loaded, matrix generated not transcribed, no wildcard bucket
- [x] **Every milestone above is gated** — `e2e:pipeline`, `persistence:replay`,
      `derivation:verifiable`, `reward:policy-only`, `derivation:clean`

**Not yet asserted:**

- [ ] **LM fills KB gaps** (M1 Variant B) — `skipIf` on `llamacpp-embedded`; never run green
- [ ] **System One heads adjudicate** (M1 Variant C) — same
- [ ] **Egress judging is gate-invariant** (M2) — not started

---

## Exit Criteria

**The system is "working and usable" when:**
1. ✅ **M4 passes** — the system survives process death losslessly
2. ✅ **M1 passes** — a user asks a natural-language question with no LM configured and gets a
   grounded, in-budget answer
3. ✅ **M8 passes** — the answer carries its derivation trace, independently verified
4. ✅ **M7 passes** — presets exist, examples/hello-world.ts runs
5. ✅ **M9 passes** — derivation quality test passes, no contradictory/redundant terms in beliefs
6. ✅ **M6 passes** — live multi-agent delegation works over WebSocket with PEER_AGENT quality

M2, M3, M5 are *capability depth* — valuable, sequenced after the exit criteria, and each lands
with the gate discipline (in `gates.ts` + `ci.yml`, same commit, flippable) the whole programme runs
on.

**All six exit criteria met, each by a gate in `ci.yml` rather than by a file that exists.**
M3 and M5 have since landed and are gated too, so the only outstanding milestone is M2.
