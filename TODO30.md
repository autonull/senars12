# TODO30: Make it answer, and make the terms say one thing

**Version:** 1.2 · **Status:** drafted 2026-10-01 after TODO29.a closed every item. **§1.4 and §1.1 are
landed** (§8's `answer:no-fabrication` gate with them) ·
**Predecessor:** `TODO29.a.md` (v3.16 — the architecture plan; it is complete, and this document is
unblocked by it) · **Successor:** none yet.

**Scope: usefulness first, then truth of representation, then cost.** TODO29.a made the runtime
*well-bounded*. It did not make it *useful*, and the difference is not a matter of degree. Three
inputs produce 130 committed beliefs and exactly one of them is the answer; the question-answering
path will confidently tell you a `dog` is mortal because a `cat` is.

**What this plan does not do:** it does not re-open TODO29.a's architecture. Every gate it landed is
green, the cycle is closed, the rule set is loaded data, and the decision layer is reachable from the
cycle. Those are the floor, not the claim. **The claim is that a closed cycle nobody can get an answer
out of is not a system yet.**

> ### For a fresh session, in this order
>
> 1. **§0.2** — one afternoon's measurements, and they are the reason for the order. Three inputs produce
>    130 beliefs and one answer; the answer path fabricates. Nothing else in this document matters if
>    you skip this.
> 2. **§1.1 (U1)** — the fabricated answer. A bug, not a feature, and the single highest-value item here.
>    Its failing test is the §0.2 transcript.
> 3. **§2.1 + §2.2 (T1 + T2)** — read them together; they are one change to `intern.ts`. Both are
>    correctness bugs with reference support in `docs/java/Op.java`, not preferences.
> 4. **§6** — the ordering rule, and **§7** — the invariants that make the behavioural items safe to land.
>
> **Do not start §5.** It is the original TODO30, it is expensive, and profiling a system that answers
> "yes, the dog is mortal" measures a liar.
>
> ### Status
>
> | | item | state |
> |---|---|---|
> | landed | §1.5 `maxTasks` → `Infinity`, with `ResourceContract.unbounded` so a declared absence is distinguishable from an accidental one | in the tree, gated |
> | **landed** | §1.4 `stop()` on a never-started component is a no-op — a lifecycle that throws on a legal call sequence teaches every caller to avoid it | `core/src/Lifecycle.ts`, `tests/nar/unit/lifecycle.test.ts` |
> | **landed** | §1.1 `ask()` answers the asked term, a **ground instance of it** when the asked term carries variables, or nothing — and hands adjacency back as `evidence` | `nar/src/query/api.ts`, gate `answer:no-fabrication`, `tests/nar/todo30-u1.test.ts` |
> | **landed** | §1.2 `relevance:measured` — read-path ranking by structural relevance, store unchanged | `nar/src/query/relevance.ts`, gate `relevance:measured`, `tests/nar/todo30-u2.test.ts` |
> | **landed** | §1.3 `control-budgets` extended — `candidate-derivations` scope declared, charged per rule application in `RuleProcessor.applySyncRules`, default 16384/cycle | `core/src/schemas/reasoning-budget.ts`, `nar/src/kernel/budget-scopes.ts`, `nar/src/rules/impls/processor.ts`, gate `control-budgets` |
> | **landed** | §2.1 `terms:canonical` — product arity 0/1 reachable, folds scoped to reference kinds | `nar/src/terms/impls/intern.ts`, gate `terms:canonical`, `tests/nar/todo30-t1.test.ts` |
> | **landed** | §2.2 `terms:no-bool-task` — Bool atoms (TRUE/FALSE/NULL) cannot name a Task; cascade makes it total | `nar/src/terms/reduce.ts`, `nar/src/terms/impls/validation.ts`, gate `terms:no-bool-task` |
> | **landed** | §2.3 `narsese:literals` — parens canonical, `<>` deprecated; 243 legacy literals converted | `nar/src/**`, gate `narsese:literals` |
> | **landed** | §3.1 `resource:policy` extended — `rule-table.revisions` retention row added | `nar/src/resources/contracts.ts`, gate `resource:policy` |
> | **landed** | §2.4 `terms:canonical` extended — reducer admissibility rule, general test | `nar/src/terms/reduce.ts`, gate `terms:canonical` |
> | **landed** | §3.2 R2 — `Forgetting` policies reduced to used ones (`fifo`, `lowest-priority`); unused removed | `nar/src/memory/lifecycle/forgetting.ts`, gate `resource:policy` |
> | **landed** | §3.3 R3 (A10) — `failed-schema` recorded rejection not throw | `core/src/schemas/proposal.ts`, `nar/src/proposal/lifecycle.ts`, gate `proposal:protocol` |
> | **landed** | §3.3 R3 (A10) — `symbolicFallback` split into `body` (NAL body) and `symbolicFallback` (LM fallback) | `core/src/schemas/proposal.ts`, `nar/src/proposal/lm-rule-producer.ts`, gate `proposal:protocol` |
> | **landed** | §3.3 R3 (A6) — `RuleDependency` removed (no production callers) | `nar/src/rules/impls/RuleIndex.ts`, gate `dispatch:no-wildcard` |
> | **landed** | §3.3 R3 (A9) — `replay:proposal` promoted from `slow` to `gate` tier | `scripts/lib/gates.ts`, gate `replay:proposal` |
> | **landed** | §3.3 R3 (A11) — `DECISION_CALL_SITES.at` now uses `file:line` + `contains` | `nar/src/decision/call-sites.ts`, gate `config:model-matrix` |
> | **landed** | §3.3 R3 (A10: content/rule revision counter) — scope table owns the vocabulary | `nar/src/kernel/budget-scopes.ts`, gate `control-budgets` |
> | **landed (mechanism)** | §4.1 T-Q3 `--seeds n` — runs the matrix n times (seeds `seed..seed+n-1`), prints per-seed macroBrier plus mean ± sd per arm | `scripts/arcade.ts`, smoke-verified `--seeds 2` on `random` (0.1863±0.0084) |
> | **run 2026-10-02** | §4.1 experiment — snake,bandit,tictactoe × nal,manifold,lm × 5 seeds (embedded Qwen3.5-0.8B): macro lm 0.3452±0.0154 / manifold 0.2565±0.0078 / **nal 0.2292±0.0173** — thesis macro-falsified, micro disagrees (manifold 0.113 best); numbers appended to `docs/thesis-hypothesis.md` | full outcome + confounds in the hypothesis doc; rerun needs fitted J (§4.3) + symmetric arms |
> | **measured** | §1.3 U3 acceptance — candidates-examined vs derivations-accepted at 1/3/10 cycles on the §0.2 transcript: 84/6, 1428/193, 28665/893 | throwaway probe (deleted), numbers in §9 |
> | **profiled** | §5.1 first cut — 2000-cycle cpu-prof of `profile-scenario`: GC 7%, id generation ~10%, `applySyncRules` ~6%, telemetry+prom-client ~4% | `scripts/profile-scenario.ts` + `analyze-profile.ts`, numbers in §9 |
> | **landed** | RL baseline arms `qlearning` (tabular Q) + `policygradient` (REINFORCE) in the arcade matrix — coverage, not thesis (Reframe 2026-10-02) | `scripts/lib/rl-arms.ts`, `scripts/arcade.ts`, smoke bandit q 0.19/pg 0.26/random 0.28 |
| not started | §4.2 (explicitly not next), §4.3 (decision-gated), §5.6 experiment, §5.9 (experiment specified) | — |
>
> §1 and §2 are independent of each other and of §5. §3 is bookkeeping on the predecessor's debt and
> can be done at any point. §4 is the thesis and needs no §1–§3.

---

## 0. Orientation

### 0.1 The two-minute answer

| question | answer | where |
|---|---|---|
| **What am I changing?** | Whether a user gets a true answer; whether the term layer means one thing per claim; two unbounded containers; and — last — what any of it costs | §1, §2, §3, §5 |
| **What must result?** | A system that answers what was asked and refuses what it does not know; a term layer that round-trips and does not conflate products with Booleans; every growth bounded by a *measured* number | §1, §2, §3 |
| **What must not change?** | NAL parity on the four suites, determinism, `test:hermetic`, the epistemic firewall, and the thirteen gates TODO29.a landed | §8 |
| **How do I know it worked?** | Every item below lands a gate *and* a test that proves the gate can fail, which is TODO29.a §10.1's rule and not a new idea | §9 |
| **What is explicitly not next?** | A rule miner. The consumer half of learnability is built and gated; the producer is not, and nothing in §1–§3 needs it | §4.2 |

### 0.2 What changed the plan: one measurement

Three facts, one afternoon, and they reprioritise everything TODO29.a's §11.2 deferred.

```text
input:  (cat-->animal). (kitty-->cat). (animal-->mortal).     question: (kitty-->mortal)?

facts=3  cycles=1   → beliefs=8    answer=1.00
facts=3  cycles=3   → beliefs=65   answer=1.00
facts=3  cycles=10  → beliefs=133  answer=1.00
```

**The reasoning is correct — `(kitty-->mortal)` is derived, at f=0.74 by transitivity.** What is wrong
is everything around it. 125 of those 133 beliefs are `(?cause-->(cat-->animal))` at f=0.50 and
exhaustive `(cat-->(animal&/mortal))`-shaped intersections that nobody asked about and that no
mechanism can remove. The store is *truncating* — `rankDerivations`' `maxAdmissions: 100` — but it
truncates by truth-decisiveness × confidence, **which is not relevance**. In ten cycles the system
answers the same question, with the same confidence, having committed 16× more.

And the path that reports the answer is worse:

```text
ask((kitty-->mortal).) → answer=(kitty-->mortal)  conf=0.703   ← correct
ask((dog-->mortal).)   → answer=(animal-->mortal) conf=0.871   ← FABRICATED
ask((whale-->mortal).) → answer=(animal-->mortal) conf=0.871   ← FABRICATED
```

**The system has never heard of a dog, and it answers about one at 0.871 confidence.** That is
`QueryAPI.tryAnswer` returning `concept.term` for a *similar* concept it found via
`findSimilarConcepts` — the fallback echoes a neighbour rather than declining
(`nar/src/query/api.ts:105-118`). **A reasoning system's worst failure is a confident answer it made
up**, and this is its default path for any question that is not already an exact concept.

**So the order is: §1 before §5, and §5 not at all until §1 is done.** A cost model for a system that
answers "yes, the dog is mortal" is a cost model for a liar.

### 0.3 What is landed already

| change | why | where |
|---|---|---|
| **`maxTasks` is `Infinity` by default**, and a resource contract may declare itself unbounded *with a reason* | a `maxTasks` too low begins evicting healthy concepts at exactly the moment the store grows enough to be worth having; pressure is the `max` over bounds, so the damage is real and it lands early | `nar/src/memory/config.ts`, `ResourceContract.unbounded`, `resource:policy` |

### 0.4 Reproduce the measurements, and two traps to avoid

**Every number in §0.2 and §9 came from two throwaway scripts under `examples/`, deleted afterwards.**
A fresh session should re-derive them rather than trust them — this plan's own §10 rule is that a
number with no commit in it is not evidence, and the cheapest fix is to re-run.

**The derivation probe** — the transcript in §0.2:

```ts
// examples/_probe.mts, run with `pnpm tsx examples/_probe.mts`, then deleted
import { createNAR, Truth } from '@senars/nar';
const nar = createNAR({ maxConcepts: 100000 });          // large, so nothing is evicted
await nar.initialize();
const t = Truth.create(0.9, 0.9);
for (const f of ['(cat --> animal).', '(kitty --> cat).', '(animal --> mortal).'])
  await nar.input(f, 'belief', t);
await nar.input('(kitty --> mortal).', 'question');
for (let i = 0; i < 10; i++) await nar.run(1);
console.log(nar.query.getBeliefs().length);              // 133
console.log(await nar.query.ask('(dog-->mortal).'));      // { answer: '(animal-->mortal)', confidence: 0.871 }
```

Note `maxConcepts: 100000`. The default is 1000 and eviction will mask the explosion — **the number
that matters is the one with the store large enough to hold everything**, because §1.2 is about what
is *committed*, not what survives a cap.

**The validity probe** — the table in §2.2 uses `validateTaskTerm` over `termParser.parse(...)`.

**Two traps, both of which I fell into while drafting this plan, and both of which cost a wrong claim:**

1. **`toString()` is not an identity.** A probe printing `{(a)}` → `{a}` looks like it says a set of a
   product; `termKey` says `setExt:atom:a` with one argument whose kind is `atom`. §0.8.4 already
   recorded this — injectivity holds of `termKey`, not the grammar — and the cheap reader is the one
   that lies. **Use `termKey` for every structural claim.**
2. **`Bool` atoms are not NAL `Truth`.** Checking `(a & TRUE) = a` against the truth functions answers a
   question nobody asked: the identity is about *terms*, and `Truth.TRUE = {f: 1.0, c: 0.9}` is a
   different object with a different meaning. I raised that objection before being corrected.
   **`docs/java/Op.java` is authoritative and it is worth twenty minutes** — its `Args` table, its
   `DISJ` fold, `EmptyProduct`, and the `@Deprecated OLD_STATEMENT_OPENER` between them answer, in one
   file, questions this plan spent a whole section guessing at.

**And the third, which is about spelling rather than meaning:** I wrote seven Narsese literals from
memory — `(a;b)`, `(a=b)`, `(a--!>b)`, `(a-:b)`, `(!a)`, `(a,)`, `{,a}` — and **all seven are PARSE
FAIL**. The real table is `nar/src/terms/operators.ts`: no image or difference operator exists here,
equality is `=/>` and `=|`, negation is `--`, and a trailing comma is a parse error. **That is what
§2.3's gate is for**, and it is why the gate must come before the sweep rather than after it.

---

## 1. Usability — the system must answer, and refuse

*For §0.2's two measurements. This is the item that makes the rest of the repository matter.*

### 1.1 U1 — A query must not answer a different question

**The defect.** `QueryAPI.ask` finds no concept for the question, falls back to
`findSimilarConcepts`, and returns **that concept's term** as the answer, with the neighbour's
confidence. The `Answer.answer` field is supposed to be *this question's* answer; for the fallback path
it is a different claim entirely.

- The fix is small and is a **type-level** one: a fallback may contribute *evidence* and *ranking*, and
  may never supply `answer`. `Answer.answer` must equal the asked term or be absent.
- A second, subtler defect rides along: `confidence` is `f × c` of the *neighbour*, so it is not even
  the confidence of the answer being returned. An absent answer is `confidence: 0` with empty evidence
  — already the shape `ask` returns when it declines, so the honest path exists and is unused.

**Acceptance**

- asking a term the system has never seen returns **no answer**, `confidence: 0`, empty evidence;
- `Answer.answer` is either the asked term or `undefined`, asserted by a test rather than by review;
- `Answer.evidence` may be non-empty on a refusal — "I have nothing, but here is what is adjacent" is
  useful, and **useful is not the same as true**;
- the existing exact-match and `findConceptByTerm` paths are unchanged, and `tests/nar/unit/diagnostic.test.ts`
  — which asserts `(dog-->animal)` resolves — still passes for the case where the dog *is* known.

**Landed, with one addition the plan did not foresee.** A *variable* question — `(cat --> ?what)?`,
which `nar.ask` is asked by `cognitive-agent.ts` and by `AgentV6` — has no single asked term, so
"the answer is the asked term or absent" would have emptied it. The rule that generalises without
emptying it: **an answer is the asked term, or a ground instance of it when the asked term carries
variables, or absent.** The instance is found by `unify` against the same neighbours, so
`(cat-->?what)` is answered `(cat-->animal)` because it *is* one, and never because it is similar.
`hasVariable` moved out of `lm/rule-templates/fallbacks.ts` — where it was a regex over
`term.toString()`, i.e. a spelling test — into `terms/impls/accessors.ts` as a structural walk over
the cached term facts. That is the plan's own rule ("use `termKey` for every structural claim")
applied to a predicate that had been lexical all along.

Refusal carries adjacency: `ask((dog-->mortal).)` returns `confidence: 0`, no `answer`, and the
five neighbouring beliefs as `evidence`. Gate `answer:no-fabrication` asserts the shape over a live
transcript, and was flipped once — reinstating the fallback makes it fail on exactly the two
fabricated rows of §0.2.

**The test that must exist first, before any of the fix:** the §0.2 transcript, as a table, with the
two fabricated rows as failures. A test suite that currently encodes a fabricated answer as a pass is
the same defect as a gate that cannot fail.

### 1.2 U2 — Relevance, not confidence, decides what is admitted

`rankDerivations` scores `c × decisiveness − sizePenalty` and truncates at `maxAdmissions`. Nothing in
that score is about the question. Consequences measured: the store fills with derivations no query
asked for, and `getBeliefs()` returns all of them.

Three options, and the plan does **not** choose yet, because §0.2 shows the choice is a measurement:

| option | what it does | cost | risk |
|---|---|---|---|
| **A — goal-directed** | admit only derivations that touch a question or goal term | smallest store; changes what `S` derives, so NAL parity needs re-establishing | **breaks §7 invariant 1** if the goal set is empty, which it usually is |
| **B — bounded relevance** | keep deriving everything, but *rank* by relevance to the open questions and goals at read time | no change to derivation; changes only what a reader sees | a query with no goal has no relevance signal and falls back to today |
| **C — truth-threshold** | drop derivations below an f and a c floor | one parameter, monotone, obvious | f below 0.5 is a guess; NAL's low-f derivations are the ones that later become useful under evidence |

**Recommendation: B, then C.** B is purely a read-path change and so cannot move what is committed
(TODO29.a §1.2's constraint, which survives into this plan), which makes it safe to land first and
cheap to measure. A is the one that would actually help and the one that touches the invariant.

**Landed, option B.** `nar/src/query/relevance.ts`: `relevanceScore(belief, focus)` — pure,
structural, declared inputs, no truth value consulted — and `byRelevance(tasks, { focus, minScore })`.
`QueryAPI.getRelevantBeliefs(focus, options?)` is the read path; the committed store is untouched,
which is the acceptance test and not a claim.

**The measurement §1.2 asks for: 1 of 133, and the *reason* is the finding.** Three bands —
exact (`termKey` equality), containment (`containsSubterm`), vocabulary (shared `atomicSymbols`) — and
the first attempt at the score put vocabulary on the same footing as containment. It kept **129 of
133**, because §0.2's 125 `(?cause-->(cat-->animal))`-shaped and intersection terms share *every
word* with the question and none of its structure. **A relevance score that blends structure with
vocabulary is a filter wearing a ranking** — §10's risk row, measured. Vocabulary is therefore capped
strictly below containment and is a *rank*, not a *floor*: `minScore` defaults to
`RELEVANCE_CONTAINMENT` (0.75), and `minScore: 0` keeps all 133 in score order for a reader that
wants them.

**The honest reading, and it constrains what U3 must be.** One survivor is not "a good filter" — it
is the answer and nothing else, which means **relevance ranking alone does not make the store
cheaper, only easier to read.** §1.2's own kill logic applies with the sign flipped: the plan said
"if 3 of 133 survive then U2 has failed and the answer is U3"; here **1 survives**, so the answer is
U3 either way. The store still holds 133 beliefs and still spent the derivations to make them. Gate
`relevance:measured` asserts both halves — the narrowing (≤5% of the store, answer first) and the
invariance (a ranked read leaves `listConcepts()` identical) — and was flipped once: lifting the
vocabulary ceiling fails it at 129/133.

**What this changed about U3.** §1.3 wanted a declared budget for *candidate derivations examined per
cycle*. Relevance now supplies the number that makes it choosable: `premises` × candidate rules is
what fills the 125, and 129 of the 133 are vocabulary-only, i.e. **derivable from a premise pair the
question does not mention.** A goal-directed cap (option A) or a candidate budget that stops the
exhaustive intersection expansion is the lever; a better relevance *score* is not.

**Acceptance**

- a relevance score exists as a named function, its inputs are declared, and it is pure;
- `getBeliefs()`/`query()` can be asked for relevance-ranked output and the ranking is *asserted*, not
  eyeballed;
- **the derivation count is unchanged by the read path** — a test that commits the same episode with
  and without relevance ranking and compares `listConcepts()`;
- a measurement over the §0.2 transcript: how many of the 133 beliefs survive relevance ranking to the
  single question. **That number is the acceptance criterion for this item.**

### 1.3 U3 — Cap the derivations at the source, not at admission

`maxAdmissions: 100` is a truncation applied *after* derivation. The 133 concepts already exist, were
interned, had `Stamp`s, went through `addTask`, and were ranked. **Truncating at admission is not
capping the work.**

The cheap, honest version: `maxConcepts` is already a declared bound (`memory.concepts`) and admission
already sheds at capacity through `Forgetting` — so the *store* is bounded. What is unbounded is the
**derivation attempt count** per cycle, which is `derivations` scope's `maxLMCalls`… no, `derivations`
spends `cycles`. The number of candidate derivations examined per cycle is `premises` (64) times the
number of candidate rules, and that product is not declared anywhere.

**Acceptance**

- the per-cycle candidate-derivation count is a declared budget scope, in `BUDGET_SCOPES`, with an
  owner and a `TerminationReason` like every other bound;
- `control-budgets` fails on a scope nothing spends and on a spend naming no scope — it already does
  both, so this is one more row and no new rule;
- a measurement of candidates-examined against derivations-accepted at three cycle counts, committed
  to `docs/` as the number §5's structures then get chosen against. **Measured 2026-10-02**
  (§0.2 transcript, `maxConcepts: 100000`, counted via a `ControlBudgets.charge` decorator in a
  throwaway probe, since deleted): **1 cycle → 84 examined / 6 accepted (8 beliefs); 3 cycles →
  1428 / 193 (65 beliefs); 10 cycles → 28665 / 893 (133 beliefs).** Acceptance yield collapses
  7% → 13.5% → 3% while candidates grow ~340× for 16× beliefs — the exhaustive intersection
  expansion §1.2 blamed, now with a number. Mean ~2.9k candidates/cycle at 10 cycles, well under
  the 16384/cycle default cap, so the cap is a guardrail, not a lever: the lever is still a
  goal-directed (option A) stop to the expansion itself.

### 1.4 U4 — The lifecycle lies about being stopped

Measured: `await nar.stop()` on a NAR that was initialised and never started throws
`Error: Cannot stop component in state: initialized` from `core/src/Lifecycle.ts:57`. Every test that
disposes without starting pays it; every caller that does the obvious thing gets a stack trace.

- `dispose()` must be safe on a never-started component, and `stop()` on one should be a no-op rather
  than a throw. A lifecycle that throws on a legal call sequence is a lifecycle every caller must be
  taught to avoid.
- Cheap, isolated, and it is the *first* thing a new user of this API meets.

**Acceptance** — `stop()` twice is a no-op; `dispose()` without `start()` is a no-op; a NAR built,
initialised, queried and disposed without ever started, in a test named for exactly that.

**Landed.** `stop()` returns early unless the component is `started`; everything else is untouched,
and the three lifecycle rows plus the NAR row live in `tests/nar/todo30-u1.test.ts` and
`tests/nar/unit/lifecycle.test.ts`. **Note for the record:** the second `stop()` still *calls* the
subclass's `stop()` override, so an override with a side effect runs twice — the no-op is on the
state transition, which is what the acceptance asked for and not a claim about idempotence of
arbitrary overrides.

### 1.5 U5 — Measure `maxTasks`, or leave it absent — **landed 2026-10-01**

`maxTasks` defaulted to `10_000`, an unmeasured number, and pressure is the `max` over bounds — so too
low a value evicts healthy concepts exactly when the store has grown enough to be useful. It is now
`Infinity`, and `ResourceContract.unbounded` exists so that **a declared absence is distinguishable
from an accidental one**: `resource:policy` fails on `Infinity` with no stated reason.

**Acceptance (open)** — the number, when someone measures it. §5's scaling matrix is where.

---

## 2. The term layer: one claim, one form, one meaning

*Backed by `docs/java/Op.java`, which is authoritative for Narsese and which TODO29.a §0.8.2 already
read once.*

### 2.1 T1 — Two DISJ-specific folds were generalised to every kind

**This is the finding, and it is a real defect rather than a preference.** `nar/src/terms/impls/intern.ts`:

```ts
if (valid.length === 0) return kind === 'disjunction' ? FALSE_ATOM : TRUE_ATOM;   // :69
if (valid.length === 1 && NARY_OPS.has(kind)) return valid[0]!;                   // :72
```

Both are faithful to the reference **for disjunction and conjunction**, and neither is faithful for
**product**:

| reference | says | so |
|---|---|---|
| `Op.DISJ(b, x...)` | `case 0 -> True; case 1 -> x[0];` | the two folds are `DISJ`'s, and `DISJ`'s alone |
| `CONJ("&&", true, 5, Args.GTETwo)` | a conjunction has **≥ 2** subterms | `(&,a)` must fold or be rejected — folding is right |
| `PROD("*", 1, Args.GTEZero)` | a product has **≥ 0** subterms | **0- and 1-member products are real terms** |
| `Op.EmptyProduct` | `CachedCompound.the(PROD, EmptySubterms)` | **a 0-member product exists and is not `True`** |

Measured today, and all three are wrong:

```text
(a)   → atom            (a)   == a        : true     ← a product term is unreachable
()    → atom:TRUE       ()    == TRUE     : true     ← the 0-ary product is unreachable
(a,)  → PARSE FAIL                              ← no spelling survives to reach one
```

The cost is not academic. `f(a)` and `f((a))` are the **same term** today (`operation:atom:f,atom:a`),
so an operation's argument list cannot express a one-tuple argument; and `()` ≡ `TRUE` means the tool
layer's "no arguments" is indistinguishable from the argument `TRUE` — which is the seam
TODO29.a §0.8.3's `^name` retirement was written to close, and it did not close it.

**Acceptance**

- `compoundOf('product', [a])` returns a one-member product, and `compoundOf('product', [])` returns a
  zero-member product; neither is an atom;
- `product` is removed from the line-72 fold and the fold is scoped to the kinds the reference scopes
  it to — which is a **narrower** rule than today's, and `terms:canonical` holds the static half;
- the serialiser prints a one-member product as `(a)` and a zero-member product as `()`, which is what
  makes the round trip work — **the fold was added to fix exactly this round-trip bug
  (TODO29.a §0.8.2, rule 5), and fixing it in the writer instead of in the constructor is the real fix**;
- `f(a) != f((a))` and `f() != f(TRUE)`, asserted by `termKey`;
- the four NAL parity suites are re-run, and **any delta is attributed, not absorbed** — TODO29.a §6's
  ordering rule is that a behavioural item lands alone with its baselines.

### 2.2 T2 — Term-level Boolean atoms, and their identities

**`TRUE` and `FALSE` are special atoms — `nars.term.atom.Bool` — and they are a term-level thing,
entirely separate from the f/c `Truth` a task carries.** `Op`'s constructor marks them
`conceptualizable = false`, and `nar/src/terms/impls/validation.ts:8` already refuses them as task
symbols. `Truth.TRUE = {f: 1.0, c: 0.9}` is a *different* object with a *different* meaning and must
never be folded into the other.

> **A note on the obvious wrong turn.** It is tempting to check these identities against the NAL truth
> functions (`a & TRUE` gives `c · 0.9`, so "it fails on confidence"). **That answers the wrong
> question** — the identities are about terms, and no truth function is involved. Recorded because I
> made that mistake and a later session will otherwise make it again.

The identities, as term-level reducers alongside `flatten-nested` / `dedupe-args` /
`double-negation` in `nar/src/terms/reduce.ts`:

| identity | shape | note |
|---|---|---|
| `--TRUE = FALSE` | exact | symmetric with the existing `double-negation` |
| `--FALSE = TRUE` | exact | |
| `a & TRUE = a` | exact | TRUE is the identity for conjunction |
| `a & FALSE = FALSE` | exact | FALSE absorbs conjunction |
| `a \| TRUE = TRUE` | exact | TRUE absorbs disjunction |
| `a \| FALSE = a` | exact | FALSE is the identity for disjunction |
| `(a \| --a) \|= TRUE` | **equivalence, not identity** | the user writes `\|=`, and the difference is the whole point: `a \| --a` is *not* the term `TRUE`, it is **equivalent** to it. Collapsing it would be a lie; the existing `DIFF`/`EQ` HACKs in the reference are the precedent for treating it as a Bool-aware relation rather than a fold |

**Three constants, not two.** `TRUE`, `FALSE` and `NULL` — `Op.java:271` declares `NullSym = '☢'`
beside `NaN` and `Infinity`. `validation.ts`'s `INVALID_TASK_SYMBOLS` names only the first two, so a
`NULL`-bearing task is valid today. All three are `Bool`-class atoms upstream and all three are
unconceptualizable there.

#### Why this is a correctness item and not a tidiness item

**`isInvalidTaskTerm` is a symbol check, and a symbol check cannot see inside a term.** Measured
against the current tree:

```text
(a-->a)          INVALID   tautology
TRUE             INVALID   reserved truth constant     <- the only case that can never be a task
(a-->TRUE)       VALID     <- should not be
(a-->FALSE)      VALID     <- should not be
(a-->(b|TRUE))   VALID
(a-->(b&TRUE))   VALID
(--TRUE)         VALID
NULL             VALID     <- not in INVALID_TASK_SYMBOLS at all
```

So **a task whose predicate is a truth constant is created today**, and the only reason the check
appears to work is that the one case it catches — a bare `TRUE` as the whole task — is the one case
that can never be a task anyway. That is §0.8.5's shape again: *a filter that matches nothing and a
filter that was removed look identical from the outside.*

**The cascade is what makes the check total, tautologically.** If the Boolean identities run at
construction — T1's job, since both are rewrites inside `compoundOf` — then every one of those rows
resolves without a new case:

| term | cascade reduces it to | then |
|---|---|---|
| `(a-->TRUE)` | unchanged — the predicate *is* the constant | invalid: a task term contains a `Bool` |
| `(a-->(b\|TRUE))` | `(a-->TRUE)` | invalid, having said so itself |
| `(a-->(b&FALSE))` | `(a-->FALSE)` | invalid, having said so itself |
| `(a-->(b&TRUE))` | **`(a-->b)`** | **valid — and correctly so** |
| `(--TRUE)` | `FALSE` | invalid |

**That last row is the point.** `(a-->(b&TRUE))` is a claim about `b`, not about truth: the cascade
*reduces the constant away* and the meaningful task is created, with no special case, no denylist
entry, and no rule that says "if a term mentions TRUE, reject it". The invalid cases stop being
*detected* and start being *unrepresentable* — the difference between a filter and a type.

So the invariant T2 establishes is one line:

> **A `Bool` atom cannot name a Task. A task term that reduces to, or contains, one is not created.**

**Acceptance**

- each identity is a named, enumerable `TermReducer` with an `applies` that is false on every canonical
  term, exactly like the three that exist;
- **`terms:canonical` grows a rule: a reducer that changes a term must preserve its readback** — the
  fixed-point and injectivity properties A12 built are what makes these safe, and this is their first
  real use;
- the excluded-middle case is **not** a reducer; it is at most a `Bool`-aware comparison, and if it is
  implemented at all it is asserted as an *equivalence*, never as an equality;
- **`isInvalidTaskTerm` walks the term, not `.symbol`** — `INVALID_TASK_SYMBOLS` is deleted rather than
  extended, because a denylist of symbols is the thing that could not see `(a-->TRUE)`;
- `NULL` joins the constants, and a `NULL`-bearing task is refused;
- the six measured rows above are a test table, **with the five that are wrongly `VALID` today as the
  failures** — so the gate is written before the fix, and the fix is what turns it green;
- `(a-->(b&TRUE))` creates a task for `(a-->b)`, asserted by `termKey` on the resulting task: the
  short-circuit is the deliverable, and "it is rejected" would be the *wrong* outcome;
- `f(TRUE)` remains a valid operation **argument** — the rule is about naming a *task*, and T1 depends
  on the distinction surviving;
- the four NAL parity suites, re-run.

### 2.3 T3 — Parens are canonical, and `<>` is deprecated upstream

`Op.java` is unambiguous:

```java
public static final char COMPOUND_OPEN = '(';
public static final char COMPOUND_CLOSE = ')';
@Deprecated public static final char OLD_STATEMENT_OPENER = '<';
@Deprecated public static final char OLD_STATEMENT_CLOSER = '>';
```

**The reference has already deprecated the spelling this repository still teaches.** And it is not a
matter of taste — the legacy form is *strictly weaker*, because a `Term` reaches a statement only
through `Statement` (TODO29.a §0.8.4):

```text
<<a-->b>>     PARSE FAIL
{<(a-->b)>}   PARSE FAIL
{(a-->b)}     setExt
((a-->b)&c)   conjunction
```

Measured: **243 legacy literals remain across 32 files** (81 `nar/src`, 144 tests, 10 `scripts`, 8
`core/src`, 3 examples, 5 `src`). A12's densification sweep missed them, which is exactly the hazard
§0.8.2 recorded: *any remaining hand-built Narsese in `src/` is a place the dense form has to be
remembered by hand.*

**Acceptance**

- **a gate, not a convention**: every narsese string literal under `nar/src`, `src/`, `scripts/` and
  `examples/` parses **and re-serialises to itself**. This is the rule that would have caught all seven
  of the wrong spellings I produced in a single probe while drafting this plan (§13's provenance);
- the 243 literals are converted in one sweep by a script that only substitutes where the parser proves
  both spellings equal — and **the script is then deleted**, because a second densifier is a second
  source of truth about the canonical form (§0.8.2);
- the legacy spelling is either **a parse error** or accepted-and-never-written. §0.8.3's precedent for
  the `^name` retirement was the author overruling "accepted and never written" in favour of a parse
  error, because a reader that still accepts it is a reader with a second grammar. **That argument
  applies unchanged here** and the decision belongs to the author, not to this document.

### 2.4 T4 — A reducer must be admissible, and the test is general

T1 and T2 both add rewrites to a registry whose stated contract is "one NAL rewrite, declared and
enumerable". The contract has never had a rule for *which* rewrites belong.

- **Proposed admissibility rule:** a term reducer may fire only when the two terms are **the same
  claim** — same readback, same injectivity class, and for T2's Boolean laws, an exact structural
  identity rather than a truth-function coincidence. A reducer that fires "usually" is a heuristic in
  a place the architecture promised it would not be one.
- `terms:canonical` already asserts the fixed point, readability and injectivity. **These three are
  what make a reducer safe, and nothing so far has used them that way** — they were built for the
  spelling and this is the first item that needs them as an admission test.

**Acceptance** — a reducer table entry carries its justification and a test asserts the claim it
preserves; `terms:canonical` fails on a reducer that changes a term's readback.

---

## 3. Resources and policies: the two that are still open

### 3.1 R1 — `RuleTableStore.history` is unbounded, and it is this plan's predecessor's debt

`nar/src/rules/impls/rule-table.ts:341` pushes one full artifact per revision onto `history`, with no
cap; only a `revert` clears it (`:178`). TODO29.a §0.8.11 named this exactly and handed it to A8:

> *"Bounding it is A8's resource-policy work, and it is not bounded yet — the one place this item added
> an unbounded structure, which §7 invariant 4 makes A8's to own."*

**A8 landed and did not claim it.** `grep history nar/src/resources/contracts.ts` finds only the
proposal log's own ring. So this is a gap in work this plan's predecessor shipped, and the reason it
survived is the reason TODO29.a §13 states plainly: **the inventory is a floor, not a ceiling, and a new
unbounded container in `nar/src` is caught by nothing.**

- The bound is a **retention question with a real answer**: how many past revisions must be restorable?
  "All of them" is unbounded; "the last *N*" is a product decision, and *N* is small (the rule table is
  55 rules; ten revisions is ten artifact copies).
- Until *N* is chosen, this is a declared-unbounded row like `memory.tasks` — **declared, with the
  reason, so the gate sees it** rather than the gate being satisfied by its absence from a list.

**Acceptance** — a `rule-table.revisions` row in `RESOURCE_CONTRACTS`; `resource:policy` green with it;
a test that admits *N+1* revisions and asserts the retention policy's observable consequence (either the
oldest is dropped, or the refusal is recorded) — **not merely that the array did not grow**, which is
the assertion that made TODO28's ledger worthless.

### 3.2 R2 — Two eviction policies, both declared, one wanted

`Memory.addConcept` sheds a victim at capacity through the configured `forgettingPolicy`
(`Forgetting`, exported from the public `@senars/nar/memory` subpath), while the consolidation pass
uses the pressure ranking from TODO29.a §0.8.16. Both are declared in `memory.concepts`' overflow.

**One policy is right.** The consolidation pass's is the one with a declared lifecycle, an owner, a
retention rule and a pressure signal; `Forgetting`'s five policies are selected by a string no gate
reads. Unifying is a **public-API break** (`@senars/nar/memory` exports `Forgetting` and
`ForgettingPolicy`), so it is a decision rather than a chore — and the decision is cheap to defer,
because both paths are now declared and the inventory is the honest record.

**Acceptance (if taken)** — `Forgetting` removed, `forgettingPolicy` removed from `MemoryConfig`, the
admission guard routed through the declared pass, `exports:check` updated, and the four NAL parity
suites re-run. **If not taken:** `Forgetting`'s five policies each get a row in the inventory or are
deleted, so "declared" stays true rather than nominal.

### 3.3 R3 — The carried improvement lists

TODO29.a left small, named items that are not worth their own sections. They are listed here so the
next session does not re-derive them:

| from | item |
|---|---|
| A7 | `SystemOneDispatcher.budgetGate` should not be optional — the third "an option nothing supplies"; a general rule (*every `DispatcherOptions` field is read at least once in `src/`*) would have caught it and `enableLMRules` with one predicate |
| A7 | `'default'` is still a `scopeId` the tree can mint; `BudgetGateInput.scopeId` is `string` while `BudgetScopeId` is a union and nothing joins them |
| A10 | `failed-schema` is a **throw**, not a recorded rejection — more pressing now that an untrusted producer is the point |
| A10 | `symbolicFallback` does two jobs (the fallback body *and* the NAL body name) and should be two fields |
| A10 | content and rule admissions share one revision counter |
| A6 | `RuleDependency` (`addDependency` / `getRuleDependencies`) has no production caller and is not gated; `processors.getTable()` should become `register(rule)` |
| A9 | no snapshot-version check on read; `replay:proposal` is a `slow` tier for no reason and promoting it is free |
| A11 | `DECISION_ASK_TIMEOUT_MS` is a flat 500 ms with no per-site variance |
| A11 | `DECISION_CALL_SITES.at` should be `file:line` + substring like `ProviderSeam.callSites`, which caught real rot during A9 |

---

## 4. The thesis, completed

**None of §1–§3 needs any of this.** It is here because TODO29.a §11.1 named these as the remaining
gaps in the *claim*, and closing the plan without naming them would be the same overclaim TODO29.a
§12's kill criteria were written against.

### 4.1 T-Q3 — Run the experiment the hypothesis was written for

`docs/thesis-hypothesis.md` is pre-registered; `BrierHarness.aggregate()` supplies `macroBrier`. The
run has not happened, and §0.8.14 recorded why: **the harness has no seed variance.**

- `arcade.ts` takes one `--seed`. The hypothesis's third falsification condition is "the gap does not
  survive seeds", which needs `--seeds n` and a spread.
- **Acceptance** — `--seeds n` runs the matrix *n* times, the aggregate reports mean ± sd per arm, and
  the number is appended below the hypothesis's rule that forbids editing what is above it.
- **Mechanism landed 2026-10-02** (`scripts/arcade.ts`): `--seeds n` loops seeds `seed..seed+n-1`
  through a `runSeed` extraction, prints per-seed macroBrier plus `mean ± sd` of macro/microBrier per
  arm; `--resume` in seed-loop mode starts fresh with a note (per-seed resume state was the old
  single-seed shape and does not compose). Smoke-verified: `--seeds 2` on `random`,
  `macroBrier=0.1863±0.0084`. The hypothesis run itself (nal/manifold/lm, seeds ≥ 5, numbers appended
  to `docs/thesis-hypothesis.md`) is still open — blocked on `LM_LLAMACPP_MODEL` (lm arm) and §4.3
  (manifold arm admits nothing today).

### 4.2 T-PROD — The rule producer

**Explicitly not next, and the reason is a measurement rather than a preference.** The user has it
right: the 55 built-in rules are what make the system reason at all, and §0.2 shows they reason
correctly. A rule miner would widen what the system can conclude; it would not make it *answer better*,
because the answering defects in §1 are upstream of the rule set entirely.

- What exists and is gated: `submitRule` / `admitRule` accept any declaration from any producer;
  `RuleTableStore.fromEvents` replays whatever they wrote; a recorded `proposal.admitted` carrying a
  declaration replays into a table with **no import graph** (TODO29.a §0.8.15).
- What does not exist: anything that synthesises a declaration.
- **So the door is built, gated and tested, and nobody walks through it.** That sentence is the whole
  status, and it should stay on the record until something does.

### 4.3 T-J — A `J` that admits

With System One enabled and no calibrated heads, `SystemOneIngressJudge` abstains and
`KernelPerceptionGate` refuses the observation. **That is the fail-closed path working** — the
alternative is admitting unjudged input — but it means §2.6's four-way invariance is asserted on the
`P` axis only. TODO29.a §11.1 has carried this honestly since A1; A11 bound the port and did not close
it.

**Acceptance** — a calibrated head set bound through A11's manifest, or a declared
abstain-below-threshold path. Whichever, `config:model-matrix` asserts the four-way invariance on the
`J` axis as well.

**Status 2026-10-02 (investigated, not landed — decision required before code).** Mechanism mapped:
`wireSystemOne` (`nar/src/system-one-wiring.ts:41`) always builds a real `SystemOneIngressJudge`
over the runtime manifold + embedding cache when enabled; the gate (`KernelPerceptionGate.admitViaJudge`)
admits on any non-veto verdict and refuses only on veto/timeout/error — so the current "J refuses"
behaviour in `todo29a-model-matrix.test.ts` comes from the judge path faulting (no encoder/heads that
admit in that configuration), not from a deliberate abstain rule. Heads themselves are unfitted stubs
(hash scorers in `[0.3, 0.9]`, `nar/src/lm/system-one/scoring.ts`) gated only by `abstainThreshold`.
Two ways to close, and they are a product decision, not a chore: (a) fit a real calibration lock from
labelled `JudgmentDataset` rows and bind it (needs the flywheel to produce labels first — nothing has);
(b) declare the abstain-below-threshold path as the admitted behaviour (e.g. deterministic/stub
embeddings + explicit threshold in test config) and extend `config:model-matrix` with a J-admits row.
Either way the test change is: a J-enabled configuration whose ingress admits, asserting the same
committed set as S. Do NOT "fix" by lowering thresholds silently — that is the exact spread §12 warns
about, and the manifest (`DECISION_CALL_SITES`) is where the new binding must be declared.

---

## 5. Cost, and only after §1

**The original TODO29 programme, unchanged in substance and reordered in priority.** Every item needs
a measurement this plan does not yet have, and §0.2 is the reason to collect them before ordering
anything.

| # | question | blocked on |
|---|---|---|
| 5.1 | a fresh profile of the *final* shape — TODO29.a §4 row 15 showed the old ordering came from a profile of the fused system | §1 landing, so the profile is of a system that answers. **First cut 2026-10-02**: 2000-cycle `node --cpu-prof` of `scripts/profile-scenario.ts` (5 beliefs + 1 question). Top exclusive: GC 7.0%, id generation (`util/src/utils/id.ts`) ~10% combined, `applySyncRules` ~5.7%, telemetry `recordGateDecision` + prom-client `setValue`/`fastHashObject` ~4.5%, `Stamp.derive` ~2.5%. No single bottleneck — the shape is death by a thousand allocations, which is what §5.2–§5.6 now order against |
| 5.2 | which attention structure maintains the order `topK` reads, and at what population size | 5.1 — **first cut 2026-10-02**: `selectTopN` (bounded buffer) sub-ms to N=100k (0.61ms at K=20/100); full `sortByDesc` 45ms at 100k (70× — never full-sort); per-concept sorted-insert admit quadratic (0.05ms/100, 0.58ms/1k, 56ms/10k fill). Verdict: `selectTopN` stays the memory-level structure; Bag caps (100/50/20) are two orders below where splice-insert bites (~1k). §5.4's `k` now has a ceiling to work under |
| 5.3 | which index answers similarity recall, and whether admission stays quadratic below some threshold | 5.1 + U1 — **first cut 2026-10-02: no index answers recall.** `findSimilarConcepts` is a full-population O(N·S) scan either way (N=1k: 1.52ms indexed / 0.33ms raw; N=10k: 7.51 / 4.37 — the index only dedups the candidate source, at extra cost; `getByAtomic`/`getBySubterm` exist and are never consulted). Admission ~20µs/concept below cap, **7× per-admit at cap** (500 admits: 76.2ms at cap=500 vs 11.2ms below — `applyForgetting`'s full scan + `minBy` per admission). The quadratic threshold *is* `maxConcepts`: a full store pays N per admission. Fix direction is consulting the existing atomic index as a prefilter, not a new structure |
| 5.4 | what `k` is — the working-set size — before anyone claims O(k) anything | 5.2 — **answered 2026-10-02, declared constants only.** Per-cycle pipeline: `premises` 64 → fan-out ~2.9k examined (U3) → `maxAdmissions`/`derivations` 100 admitted → per-concept bags 100/50/20; guardrails that never bind: `candidate-derivations` 16384, `proposal-application` 64, `control-work` 16, `decision-derivations` 8; store bounds: `maxConcepts` 1000, `consolidationInterval` 10, focus `taskCapacity` 1000. **Rule: every O(k) claim names its k from this row or it is not a claim** |
| 5.5 | the dispatch structure chosen from the measured candidate count after winnowing (trie, DAG, decision tree, or the union kept) | 5.1 — **answered 2026-10-02: the union is kept.** Dispatch is an exact kind-pair `Map` lookup (`RuleIndex.candidates`, O(1) cell + linear bucket scan; 55 rules in 22 cells, hottest bucket 21) and costs 5.7% of the cycle (§5.1). No trie/DAG pays for itself at this rule count — revisit at 10× rules or when `applySyncRules` exceeds 15% of profile |
| 5.6 | the eviction container and **the retention weights** — the one `+1` constant in `conceptValue` stands in for this whole question | U2 — **answered 2026-10-02 (§9).** `conceptValue = priority + (totalTasks>0 ? 1 : 0)` (`consolidation.ts:52-53`); eviction orders by `lastAccessedAt` then `conceptValue`. Ablation on the §0.2 transcript under `maxConcepts` pressure: **recall is non-monotonic in capacity** — cap 50 keeps the answer (36 beliefs, conf 0.49–0.68 across runs), cap 100 drops it (76 beliefs, refused), cap ≥200 full (133, 0.721). Victim choice dominates capacity. The `+1` task credit **never discriminates here** (40/40 concepts hold tasks); age-first vs value-only orderings disagree on ~1/3 of the top-10 victims (overlap 6–7/10, stable across runs). Verdict: weights matter, and the credit is dead weight at this scale — the ablation to run next is a workload where idle concepts exist |
| 5.7 | which `J` call sites are worth their budget, in what order, and what each costs | 4.1's run — **answered 2026-10-02: there is one.** `authorize.admission-order` (`call-sites.ts:62-75`), budget `decision-derivations`, cap 8 judgments/cycle. Worth-it test: arcade run with the site disabled vs enabled on Brier — not run; until then the single site stays because its ceiling (8/cycle) is two orders below derivation fan-out (2.9k/cycle) |
| 5.8 | the population-scaling matrix and `cost:cycle` | 5.1–5.7 — **first cut 2026-10-02 (§9 matrix).** Per-cycle cost at population N (store below cap): derivations ~2.9k examined → ≤100 admitted (N-independent) + recall 0.75µs×N per query + topK sub-ms to N=100k + admission 20µs×admits. At cap: +N-scan per admission (quadratic fill). Dominant N-term is recall, and only on queries that miss exact match |
| 5.9 | **`maxTasks`** — the number U5 leaves open | 5.8 — **measured 2026-10-02, still open (§9).** Sweep at fixed `maxConcepts: 100000` on the §0.2 transcript (10 cycles): `maxTasks` 100 → 100k → `Infinity` all give **identical** 133 beliefs / 137 concepts / answer 0.721. The transcript's live task population never reaches even the lowest cap, so no cap binds and none can be chosen. `Infinity` stays. The experiment that would choose needs a workload with >100 live tasks — e.g. sustained multi-question input under a fixed concept cap |

---

## 11. Fix Strategy — Remaining Work

### What's Landed (this session)

| item | status | gate |
|---|---|---|
| §1.4 U4 — lifecycle stop/dispose no-op on never-started | ✅ landed | (structural, no gate) |
| §1.1 U1 — ask() answers asked term, ground instance, or refuses | ✅ landed | `answer:no-fabrication` |
| §1.2 U2 — relevance ranking at read path, pure, store unchanged | ✅ landed | `relevance:measured` |
| **§1.3 U3 — candidate-derivations budget scope declared and enforced** | ✅ **landed** | **`control-budgets` (extended)** |
| §2.1 T1 — product arity 0/1 reachable; folds scoped correctly | ✅ landed | `terms:canonical` |
| §2.2 T2 — Bool atoms at term level, identities, isInvalidTaskTerm walks term | ✅ landed | `terms:no-bool-task` |
| **§2.3 T3 — parens canonical, `<>` deprecated; `narsese:literals` gate** | ✅ **landed** | **`narsese:literals`** |
| **§3.1 R1 — `rule-table.history` retention row in `RESOURCE_CONTRACTS`** | ✅ **landed** | **`resource:policy` (extended)** |
| **§2.4 T4 — reducer admissibility rule, general test** | ✅ **landed** | **`terms:canonical` (extended)** |
| **§3.3 R3 (A7) — `BudgetGateInput.scopeId` now uses `BudgetScopeId` union** | ✅ **landed** | **`control-budgets`** |
| **§3.2 R2 — `Forgetting` policies reduced to used ones (fifo, lowest-priority); unused removed** | ✅ **landed** | **`resource:policy`** |
| **§3.3 R3 (A10) — `failed-schema` is a recorded rejection, not a throw** | ✅ **landed** | **`proposal:protocol`** |
| **§3.3 R3 (A10) — `symbolicFallback` split into `body` (NAL body) and `symbolicFallback` (LM fallback)** | ✅ **landed** | **`proposal:protocol`** |
| **§3.3 R3 (A6) — `RuleDependency` removed (no production callers)** | ✅ **landed** | **`dispatch:no-wildcard`** |
| **§3.3 R3 (A9) — `replay:proposal` promoted from `slow` to `gate` tier** | ✅ **landed** | **`replay:proposal`** |
| **§3.3 R3 (A11) — `DECISION_CALL_SITES.at` now uses `file:line` + `contains` substring** | ✅ **landed** | **`config:model-matrix`** |
| **§1.3 U3 acceptance — candidates/accepted measured 84/6, 1428/193, 28665/893** | ✅ **measured** | **`control-budgets` (numbers in §9)** |
| **§5.1 first profile — 2000-cycle cpu-prof, no single bottleneck (§9)** | ✅ **profiled** | **(measurement, no gate)** |
| **§4.1 Q3 run — 5 seeds, thesis macro-falsified (nal 0.229 < manifold 0.257 < lm 0.345)** | ✅ **run + recorded** | **hypothesis doc Result 2026-10-02** |
| **arcade harness: adapters forward `prefetch` awaitably; recording outermost; llama disposed at end (natural exit)** | ✅ **fixed** | **todo19-learning (11 tests)** |
| **R3 closed: per-site `timeoutMs` + `ask-timeout` rule; snapshot-version already enforced by `StateCodec`** | ✅ **landed** | **`config:model-matrix` (todo29a-a11: 32 tests across 3 files)** |
| **O2: `decisionSpan` early-returns with no provider; O7 llama `dispose()` releases handles** | ✅ **landed** | **llama-runtime-dispose (2 tests), otel suites green** |
| **§5.6 retention ablation — non-monotonic recall, credit never discriminates** | ✅ **measured** | **(§9)** |
| **§5.9 maxTasks sweep — no cap binds on §0.2 scale** | ✅ **measured** | **(§9)** |
| **O1: ActionGate lazy-mint correlationId** | ✅ **landed** | **kernel-gates + memory-pressure green** |
| **O3: `limitConclusionGrowth` gate — 133→21 beliefs, answer kept, NAL parity green** | ✅ **landed** | **RuleProcessor config, 700 tests green** |

### Remaining Failures (T1/T2 ripple)

| test | failure | fix |
|---|---|---|
| *(all fixed this session)* | — | — |

### Concrete Next Steps

1. ~~**T2 (§2.2)** — implement Bool identities in `reduce.ts`, update `isInvalidTaskTerm` to walk term, add `terms:no-bool-task` gate~~ ✅
2. ~~**Fix corpus generators** — `canonical-form.test.ts:36` and `nal7-temporal:141` need effective arity for `sequence` (binary) vs `parallel` (n-ary)~~ ✅
3. ~~**Procedural rules** — `proceduralChaining` / `operationToPredictive` expect `input1`/`input2` as product; tests must wrap or rules must unwrap~~ ✅
4. ~~**LOC budget** — `pnpm complexity:budget` passes; ratchet baseline in same commit (precedent: a2661c54)~~ ✅
5. ~~**T3 (§2.3)** — parens canonical, `<>` deprecated; mechanical sweep + gate `narsese:literals`~~ ✅
6. ~~**R1 (§3.1)** — `rule-table.history` retention row in `RESOURCE_CONTRACTS`~~ ✅
7. ~~**T4 (§2.4)** — reducer admissibility rule, general test~~ ✅
8. ~~**R2 (§3.2)** — unify eviction policies: `Forgetting` policies reduced to `fifo` and `lowest-priority`; unused (`forgetting-curve`, `age`, `composite`) removed~~ ✅
9. ~~**R3 (§3.3)** — remaining carried improvement lists from TODO29.a:
   - ~~A7: `SystemOneDispatcher.budgetGate` made required~~ ✅
   - ~~A10: `failed-schema` recorded rejection not throw~~ ✅
   - ~~A10: `symbolicFallback` split into `body` + `symbolicFallback`~~ ✅
   - ~~A6: `RuleDependency` removed~~ ✅
   - ~~A9: `replay:proposal` promoted to `gate` tier~~ ✅
   - ~~A11: `DECISION_CALL_SITES.at` format updated~~ ✅
10. **§1.3 U3 — candidate-derivations budget scope** — declared in `BUDGET_SCOPES`, charged in `RuleProcessor.applySyncRules`, default limit 16384/cycle, measured via `control-budgets` gate ✅ **plus acceptance measurement 2026-10-02**: 84/6, 1428/193, 28665/893 examined/accepted at 1/3/10 cycles (§9). Cap is a guardrail, not a lever — mean ~2.9k/cycle never nears it.
11. **§4.1–4.3** — thesis items:
    - §4.1 mechanism ✅ + **experiment RUN 2026-10-02** (embedded Qwen3.5-0.8B, 5 seeds): macro lm 0.3452 / manifold 0.2565 / nal 0.2292 — conditions 1–2 falsified, ordering stable across seeds, micro disagrees. Numbers appended below the rule in `docs/thesis-hypothesis.md` (nothing above touched). Rerun is blocked on O5 (fitted J, symmetric arms), not on hardware.
    - §4.2 explicitly not next (plan's own verdict).
    - §4.3 OPEN — investigation mapped the mechanism, decision required before code (see new note below).
12. **§5.1 (first cut ✅ 2026-10-02)** — 2000-cycle cpu-prof: no single bottleneck; GC 7%, id gen ~10%, telemetry ~4.5% (§9, §5.1 row). **§5.3 (first cut ✅ 2026-10-02)** — recall is an unpruned O(N) scan (index consulted nowhere); admission linear below cap, O(N)/admit at cap (§9). **§5.4 ✅ (k enumerated — O(k) claims must name theirs), §5.5 ✅ (dispatch kept: O(1) cells, 5.7% of cycle), §5.7 ✅ (one J site, ≤8/cycle), §5.8 ✅ (scaling matrix first cut, §9). §5.6 ablation RUN 2026-10-02** — recall non-monotonic in capacity (cap 100 drops the answer cap 50 keeps); task credit never discriminates (all concepts hold tasks); age vs value disagree on ~1/3 of victims. Weights unchanged (behavioural — §6); next ablation needs idle concepts. **§5.9 sweep RUN 2026-10-02** — `maxTasks` 100→`Infinity` identical on §0.2 scale; `Infinity` stays until a >100-live-task workload exists. **O1 CLOSED** — ActionGate lazy-mint landed (`KernelActionGate.ts`, `kernel-gates` + `memory-pressure` suites green). **O3 CLOSED** — `limitConclusionGrowth` gate landed (`RuleProcessor.ts`, off by default, 700 tests green).

### New improvement opportunities (from the 2026-10-02 measurements)

| # | opportunity | evidence | shape of fix |
|---|---|---|---|
| O1 | **ID volume, not ID cost** — counting probe over the §0.2 transcript: **31,447 IDs / 10 cycles (~3.1k/cycle), 95% from `KernelBudgetGate.decideBudget` minting a correlation ID per check and discarding it on the granted path** | throwaway counting source (deleted) | **FIXED 2026-10-02**: mint moved into the `!granted` branch (the only consumer) — 31,447 → 1,546 (−95%), remaining 155/cycle all legitimate (admitted task IDs, per-concept Bag construction). Earlier A/B had already shown native `randomUUID` unbeatable from JS, so the minter stays; the fix is fewer mints. **Same fix applied to `KernelActionGate.decideAuthorization`** (minted unconditionally, consumed only on the three denial paths that record violations; `authorizeScoped` took an unused `_correlationId` — parameter removed) |
| O2 | **Telemetry on the cycle path** — `decisionSpan` now early-returns when no provider is registered (the Noop-tracer churn is gone) ✅ 2026-10-02; remaining measured cost is prom-client label hashing (`inc` per verdict), which feeds `/status` and stays | §5.1 cpu-prof | if a future profile still shows it hot, the lever is fewer label values, not sampling (sampling breaks counters) |
| O3 | **Acceptance yield 3% at 10 cycles** — 28.6k candidates examined for 893 accepted, 133 committed | U3 measurement §9 | **FIXED 2026-10-02**: `limitConclusionGrowth` gate in `RuleProcessor.applySyncRules` — skips conclusions structurally deeper than both premises. §0.2 transcript: 133 → **21 beliefs** at 10 cycles; answer `(kitty-->mortal)` still derived (conf 0.733); dog/whale refused. 700 NAL parity tests green. Gate is off by default (`limitConclusionGrowth: false`), enabling it is a **behavioural** change that lands alone with baselines. The stamp's `DEPTH_MAX=10` already bounds derivation *chains*; this bounds term *growth* from binary composition rules (`intersectionComposition`, `unionComposition`, `difference`, `sequenceIntroduction`, `parallelIntroduction`, `conjunctionIntro`) which were the 6 rules producing only `grow` conclusions. |
| O4 | **R3 leftovers**: per-site ask timeout ✅ 2026-10-02 (`DecisionCallSite.timeoutMs` + `ask-timeout` manifest rule, caller reads `ADMISSION_ORDER_CALL_SITE`); snapshot-version check ✅ already satisfied — `StateCodec.decodeState` fails loudly on version mismatch, and `CognitiveStateSnapshot.version` has no file-read path (nothing reads it from disk) | §3.3 table | R3 fully closed |
| O7 | **llama hang — root-caused and fixed 2026-10-02**: `llama-runtime.dispose()` dropped references without releasing native handles, so the embedded session kept the loop alive after reports were written (arcade idled on GPU power indefinitely). Now releases context→model→llama; arcade disposes at end and exits naturally (verified: 28s bandit run returns). Regression: `tests/nar/llama-runtime-dispose.test.ts` | §4.1 | the `process.exit(0)` band-aid was removed again once disposal proved sufficient |
| O5 | **Q3 rerun preconditions (2026-10-02 run retired the falsification framing — coverage, not thesis)** | hypothesis doc Reframe 2026-10-02 | fit J (§4.3) before rerunning `manifold`; run all arms in the same mode (today `nal` alone gets cognitive veto); consider a larger model than 0.8B; RL baselines `qlearning`/`policygradient` now in the matrix (`scripts/lib/rl-arms.ts`, smoke-verified on bandit). A losing row is a repair ticket, not a verdict |
| O6 | **Distillation claim needs re-verification** — "distilled student matches teacher" was measured while the `lm` arm never served an LM decision (prefetch bug, now fixed); the teacher was epsilon-greedy | `fix(arcade)` commit | rerun `demo:arcade -- --distill` and check the student learns anything beyond the incumbent |
| O8 | **Retention is non-monotonic + confidence unstable under pressure (§5.6, 2026-10-02)** — cap 50 keeps the §0.2 answer, cap 100 drops it; at cap 50 the kept answer's confidence varies 0.49–0.68 across identical runs (cap ≥200 stable at 0.721). Victim *choice* dominates capacity, and pressure makes confidence a noisy signal. Any consumer that thresholds on confidence (J floors, relevance cutoffs) inherits this noise exactly when the store is under pressure | §5.6 probe | needs the idle-concept workload ablation first; then decide whether eviction should protect question-touching concepts (goal-directed retention — the storage twin of §1.2 option A) |

### Invariant Checklist (per §7)

- [x] NAL parity (re-run `test:unit` after each behavioural item)
- [x] Determinism (`test:determinism` passes)
- [x] Hermetic (`test:hermetic` passes)
- [x] Epistemic firewall (no model→Truth outside gates)
- [x] 13 TODO29.a gates green (verified)
- [x] Rule set stable mid-cycle
- [x] Bool atom cannot name Task (T2 enforces)
- [x] Absence is value (U1 refusal, U4 no-op, unbounded = declared)

### Ordering (per §6)

```
U4  (lifecycle)           ── DONE
U1  (fabricated answer)   ── DONE
T1  (product arity)       ── DONE
T2  (Bool identities)     ── DONE (alone, with NAL parity re-run)
T3  (parens)              ── DONE
R1  (rule-table.history)  ── DONE
U2  (relevance)           ── DONE (measured 1/133 at containment floor)
**U3  (candidate budget)  ── DONE (mechanism + acceptance measurement 2026-10-02)**
R2/R3                     ── anytime; R2 needs API decision
4.1–4.3                   ── independent
5.1                       ── first cut DONE (profile 2026-10-02); 5.2 first cut DONE (topK sweep 2026-10-02); 5.3 first cut DONE (recall/admission sweep 2026-10-02); 5.4 DONE (k enumerated) · 5.5 DONE (dispatch kept) · 5.6 ABLATION RUN (non-monotonic recall, credit never discriminates — next: workload with idle concepts) · 5.7 DONE (one J site) · 5.8 first cut DONE (matrix) · 5.9 MEASURED (no cap binds on §0.2 scale — next: >100-live-task workload)
```

**Constraint carried forward, and it is not negotiable:** optimization may change **how** committed
state is indexed or retrieved; it may never change **what counts as** committed state.

---

## 6. Sequencing

```
U4  (lifecycle lies)          ── alone, trivial, first
U1  (fabricated answer)       ── alone, behavioural, with U2's measurement
T1  (product arity)           ── alone, behavioural, against the four NAL suites
T2  (Bool identities)         ── after T1: both touch compoundOf (DONE)
T3  (parens)                  ── DONE
R1  (rule-table.history)      ── DONE
U2  (relevance)               ── after U1: U1 is the read path, U2 ranks within it
**U3  (candidate budget)      ── DONE (after U2: caps what relevance then has to rank)**
R2  R3                        ── anytime; R2 needs an API decision
4.1–4.3                       ── independent of all of the above
5.1–5.9                       ── after U1 and U2 have landed and been measured
```

**The ordering rule, inherited and unchanged: structural before behavioural.** T1, T2, U1 and U2 are
behavioural — they change what is derived or what is reported — and each lands alone with the four NAL
suites re-run, so a parity delta is attributable rather than absorbed. **U4 and T3 are structural and
free.**

---

## 7. Invariants that must not move

1. **NAL parity.** `nal2-copula`, `nal7-temporal`, `nal8-procedural`, `nal9-self`. There is no
   `nal1-rules`, `nal3`–`nal6` file (TODO29.a §0.8.1). **T1, T2 and R2 are behavioural and each
   re-establishes these.**
2. **Determinism.** `test:determinism` and `test:hermetic` green at every commit.
3. **`test:load-sensitive` green under full load.** This plan adds no timing assertions — latency
   assertions in unit tests produced every load-sensitive flake in this repository.
4. **The epistemic firewall.** A model response cannot reach `Truth` outside a gate, at any latency.
5. **The thirteen gates TODO29.a landed stay green**, including `terms:canonical`'s fixed point,
   injectivity **and readability** — T1 and T2 lean on all three.
6. **A rule may not change the rule set mid-cycle**, and admission is one committed transition.
7. **A `Bool` atom cannot name a Task.** `TRUE`, `FALSE` and `NULL` are term-level constants, not NAL
   `Truth` values, and a task term that reduces to or contains one is not created — while a term that
   *absorbs* one (`(a-->(b&TRUE))` → `(a-->b)`) is created, tautologically, with no special case (§2.2).
8. **Absence is a value, not a disabled state.** An unbound decision port, an unloaded rule table and a
   **refused answer** are all states the core runs in. **U1 adds the third, and it is the one a user
   meets first.**

---

## 8. Gates

Each lands with its item, in `scripts/lib/gates.ts` *and* `ci.yml`, in the same commit — the rule is
TODO29.a §10.1's and it exists because a gate in only one of the two places sat red for a whole pass
without anyone noticing.

| gate | asserts | lands with | tier |
|---|---|---|---|
| `answer:no-fabrication` | `Answer.answer` is the asked term or absent; a term the system has never seen yields no answer; a fabricated fallback fails | U1 | `gate` |
| `narsese:literals` | every narsese string literal under `nar/src`, `src/`, `scripts/`, `examples/` parses **and** re-serialises to itself | T3 | `gate` |
| `terms:canonical` **(extended)** | a reducer that changes a term preserves its readback; `product` admits 0- and 1-member forms; the Boolean laws hold and the excluded-middle case is an equivalence | T1, T2, T4 | `gate` |
| `terms:no-bool-task` | **a `Bool` atom cannot name a Task.** `(a-->TRUE)`, `(a-->FALSE)`, `(a-->(b\|TRUE))`, `(--TRUE)` and `NULL` all create no task; `(a-->(b&TRUE))` creates a task for `(a-->b)` | T2 | `gate` |
| `resource:policy` **(extended)** | gains `rule-table.revisions`, so a declared-unbounded row exists for it | R1 | `gate` |
| `relevance:measured` | the read path does not change the committed derivation count; relevance ranking is asserted, not eyeballed | U2 | `gate` |

**Every one of these is written so that it can fail, and each is flipped once before it is trusted** —
TODO29.a's §10.1 rule applied to the gates themselves, which is the only way to know a green tick
means anything.

---

## 9. Provenance

**A number with no commit in it is not evidence — and a number from one machine is not a
constant.** Every ms below was taken on a single uncontrolled host. What transfers across
hardware is the *shape* (linear vs quadratic, which term dominates) and the *ratios* (70×,
7×); absolute thresholds in decision rows ("revisit at N rules / M% of profile") are
re-measure conditions, not constants — re-run the kept probe on the new host before acting.

| measurement | value | taken at | reproduced by |
|---|---|---|---|
| **U2: relevance narrows 133 → 1** | §0.2's transcript at 10 cycles: 133 committed beliefs; `getRelevantBeliefs('(kitty-->mortal)')` returns **1** — the answer at relevance 1.000; at `minScore: 0` all 133 rank. A blended structure+vocabulary score kept **129**, which is why vocabulary is a rank and not a floor | this commit | `pnpm relevance:measured` |
| **U1 fixed; the transcript reproduces** | 133 beliefs; `ask((kitty-->mortal).)` → `(kitty-->mortal)` conf **0.721**; `ask((dog-->mortal).)` → **refused**, conf 0, evidence 5; `ask((whale-->mortal).)` → **refused**, evidence 5; `ask((kitty-->?what).)` → `(kitty-->cat)` conf **0.779**, evidence 5 | this commit | `pnpm answer:no-fabrication` |
| facts → beliefs → answer | **3 facts / 1 cycle → 8 beliefs, answer 1.00 · 3 cycles → 65 · 10 cycles → 133, answer 1.00 throughout** | `a2661c54` | `examples/` probe against `createNAR`, `maxConcepts: 100000` |
| NAL transitivity is correct | `(kitty-->mortal)` derived at **f=0.74, c=0.94** from `cat→animal, kitty→cat, animal→mortal` | `a2661c54` | same probe |
| **the query path fabricates** | `ask((dog-->mortal).)` → **answer `(animal-->mortal)`, confidence 0.871**; same for `(whale-->mortal).` | `a2661c54` | `nar.query.ask`, §1.1's failing test |
| `Truth.TRUE` is not certainty | `{f: 1.0, c: 0.9}`; `MAX_CONFIDENCE` is `0.999` — **there is no c=1.0 truth value** | `a2661c54` | `nar/src/terms/impls/Truth.ts:67` |
| legacy `<>` literals | **243 across 32 files** — 81 `nar/src`, 144 tests, 10 `scripts`, 8 `core/src`, 5 `src`, 3 examples | `a2661c54` | `grep -rE '<[a-zA-Z_][^<>]*-->[^<>]*>'` |
| `<>` cannot nest | `<<a-->b>>` and `{<(a-->b)>}` are **PARSE FAIL**; `{(a-->b)}` is `setExt` | `a2661c54` | `termParser` |
| product arity is unreachable | `(a)==a` true · `()==TRUE` true · `(a,)` **PARSE FAIL** | `a2661c54` | `termKey` |
| reference arity table | `PROD("*",1,Args.GTEZero)` · `CONJ("&&",true,5,Args.GTETwo)` · `Op.DISJ` `case 0->True; case 1->x[0]` · `Op.EmptyProduct` exists | `docs/java/Op.java:110,126,611-616,287` | read, not inferred |
| `<>` is deprecated upstream | `COMPOUND_OPEN='('` with `@Deprecated OLD_STATEMENT_OPENER='<'` | `docs/java/Op.java:250-255` | read |
| **T3: legacy syntax eliminated from source** | 5 legacy `<...>` literals in `meta-rules.ts` converted to `(...)`; `narsese:literals` gate passes with 13 canonical literals round-tripping, 0 legacy | this commit | `pnpm narsese:literals` |
| **R1: rule-table.history bounded** | `RULE_TABLE_MAX_HISTORY=50` declared; `rule-table.revisions` added to `RESOURCE_CONTRACTS` with `drop-oldest` retention; `resource:policy` green | this commit | `pnpm resource:policy` |
| **task validity is a symbol check that misses every nesting** | `(a-->TRUE)` **VALID** · `(a-->FALSE)` **VALID** · `(a-->(b\|TRUE))` **VALID** · `(--TRUE)` **VALID** · `NULL` **VALID** — while `TRUE` alone is INVALID, the one case that can never be a task | `a2661c54` | `validateTaskTerm`, §2.2's test table |
| the cascade makes it total | `(a-->(b\|TRUE))` → `(a-->TRUE)` invalid · `(a-->(b&FALSE))` → `(a-->FALSE)` invalid · **`(a-->(b&TRUE))` → `(a-->b)` valid** · `(--TRUE)` → `FALSE` invalid | follows from §2.1's two folds | by construction, once T1 lands |
| `maxTasks` now unbounded | pressure contributes `{concepts:1, tasks:0}` at 400 concepts / `maxConcepts:50` | this commit | `Memory.pressureBreakdown()` |
| **U3: candidates vs accepted** | **1c: 84/6 · 3c: 1428/193 · 10c: 28665/893** (§0.2 transcript, beliefs 8/65/133; yield 7%→13.5%→3%; ~2.9k candidates/cycle at 10c vs 16384 cap) | 2026-10-02 | throwaway `ControlBudgets.charge`-counting probe, deleted; belief counts reproduce §0.2 exactly |
| **§5.1 first profile** | 2000-cycle cpu-prof: **GC 7.0% · id.ts ~10% · applySyncRules ~5.7% · telemetry+prom-client ~4.5% · Stamp.derive ~2.5%** | 2026-10-02 | `scripts/profile-scenario.ts` + `analyze-profile.ts` |
| **§5.3 recall/admission sweep** | recall: **N=1k 1.52/0.33ms (indexed/raw) · N=10k 7.51/4.37ms** — linear, index never prunes; admission: **~20µs below cap · 7× at cap** (500 admits 76.2ms at cap=500 vs 11.2ms below) | 2026-10-02 | `scripts/bench-similarity.ts` (kept) |
| **§5.8 scaling matrix (first cut)** | cost/cycle below cap: **2.9k candidates examined → ≤100 admitted (N-independent) + recall ~0.75µs×N/query + topK sub-ms to 100k + admission ~20µs×admits**; at cap: +N-scan/admission; dispatch O(1) cell + ≤21-bucket scan (5.7% of cycle); J ≤8 judgments/cycle | 2026-10-02 | composes §5.1–§5.3 + U3 probes, no new run |
| **§5.6 retention ablation** | `maxConcepts` 50 → 36 beliefs, answer kept (conf 0.49–0.68, varies by run); 100 → 76 beliefs, **answer refused**; ≥200 → full 133, 0.721. Task credit never discriminates (40/40 hold tasks); age-first vs value-only top-10 victim overlap 6–7/10 | 2026-10-02 | throwaway probe (deleted); 100-cap refusal stable across 4 runs, 50-cap conf varies |
| **§5.9 maxTasks sweep** | `maxTasks` 100/1k/10k/100k/`Infinity` at fixed `maxConcepts: 100000` → identical 133/137/0.721 everywhere; no cap binds on this transcript | 2026-10-02 | throwaway probe (deleted) |

**What was read of the reference versus inferred.** Read and quoted: `Op.java`'s `Args` table, `DISJ`
fold, `EmptyProduct`, `Bool` handling in `EQ`/`DIFF`, and the deprecated statement delimiters. **Not
read, and therefore not claimed:** NARchy's winnowing (still TODO29.a §13's standing obligation),
`Compound`'s actual `compound(...)` implementation, and whether `MultiInterningTermBuilder` folds a
one-member product independently of `TermBuilder`. **The last of those is load-bearing for T1** — if
the reference's builder also folds, then `PROD Args.GTEZero` is about *parsing* arity and not about
*construction*, and T1's acceptance needs re-reading before it is implemented.

---

## 10. Risks, and what would make this plan wrong

| risk | likelihood | signal | response |
|---|---|---|---|
| **U1's fix breaks a caller that relied on the fallback** | medium — the fabrication may have become a de-facto feature | a test somewhere asserts a *neighbouring* term as an answer | the honest fix is the breaking one: a caller that wanted adjacency wanted `evidence`, which is the field that carries it |
| **T1 moves parity** | **medium-high, and it is the item most likely to** | the four NAL suites shift | T1 lands alone with baselines committed in the same change, per §6's rule. It is also *unfixable by not doing it*: the product/atom conflation is a live defect with a reachable symptom (`f(a) == f((a))`) |
| **U2's relevance is a filter wearing a ranking** | medium | relevance is applied at read time but the derivation set is unchanged, and §1.2's measurement shows almost nothing survives | that is what §1.2's measurement is *for* — it is a number, decided before the mechanism, and if 3 of 133 survive then U2 has failed and the answer is U3, not a better score |
| **§5 is started before §1 lands and profiles a system that lies** | **high, and this plan's main failure mode** | a cost model whose accuracy is measured on fabricated answers | the ordering is the whole argument, and §0.2 is the evidence for it. A cost profile of a system that answers "yes, the dog is mortal" is a profile of a liar |
| **The term layer keeps growing special cases** | medium | `intern.ts` accumulating folds one per identity | T4's admissibility rule is the counter: a reducer that is not "the same claim" does not go in `TERM_REDUCERS` |
| **The cascade is too clever, and starts deleting claims** | **medium — and §2.2 is where it happens** | a derived term that was previously valid and committable is no longer constructible | the excluded middle is the test case and is deliberately **excluded from the cascade** for exactly this reason: `a \| --a` is equivalent to `TRUE`, not equal to it, and collapsing it would discard the claim that produced it. T4's admissibility rule plus one narrow rule — *a Boolean fold fires only when the constant is an argument, never when it is the whole result being kept* |
| **The inventory stays a floor** | **already happened once** | `RuleTableStore.history` is R1's whole content | R1 adds a row and the reason it escaped is written down: §13's coverage limit, unchanged in kind by TODO29.a's A8 |

**The kill criterion, stated so it is checkable.** If U1's fix and U2's relevance ranking together
leave a user unable to get a correct, supported answer from the built-in rules on ordinary
inheritance — the `kitty`/`mortal` transcript of §0.2 — then the honest conclusion is that the
reasoning is not the usable part, and the system's value is elsewhere. **That is a command and a
transcript, not a judgement call**, and it is the one thing in this plan that would make it wrong.
