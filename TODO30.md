# TODO30: Make it answer, and make the terms say one thing

**Version:** 1.1 · **Status:** drafted 2026-10-01 after TODO29.a closed every item. **Nothing in §1–§4 is
started.** One change is landed (§1.5) ·
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
> | not started | §1.1–§1.4, §2.1–§2.4, §3.1–§3.3, §4.1–§4.3, §5.1–§5.9 | — |
> | **measured, unfixed** | the five `(a-->TRUE)`-shaped rows in §2.2 that are wrongly `VALID` today | §2.2's test table |
> | **measured, unfixed** | `nar.stop()` throws on a never-started component (§1.4) | §1.4 |
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
  to `docs/` as the number §5's structures then get chosen against.

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

---

## 5. Cost, and only after §1

**The original TODO29 programme, unchanged in substance and reordered in priority.** Every item needs
a measurement this plan does not yet have, and §0.2 is the reason to collect them before ordering
anything.

| # | question | blocked on |
|---|---|---|
| 5.1 | a fresh profile of the *final* shape — TODO29.a §4 row 15 showed the old ordering came from a profile of the fused system | §1 landing, so the profile is of a system that answers |
| 5.2 | which attention structure maintains the order `topK` reads, and at what population size | 5.1 |
| 5.3 | which index answers similarity recall, and whether admission stays quadratic below some threshold | 5.1 — **and U1**, because `findSimilarConcepts` is what the fabricated answer came out of |
| 5.4 | what `k` is — the working-set size — before anyone claims O(k) anything | 5.2 |
| 5.5 | the dispatch structure chosen from the measured candidate count after winnowing (trie, DAG, decision tree, or the union kept) | 5.1 |
| 5.6 | the eviction container and **the retention weights** — the one `+1` constant in `conceptValue` stands in for this whole question | U2 (relevance decides what is worth keeping) |
| 5.7 | which `J` call sites are worth their budget, in what order, and what each costs | 4.1's run |
| 5.8 | the population-scaling matrix and `cost:cycle` | 5.1–5.7 |
| 5.9 | **`maxTasks`** — the number U5 leaves open | 5.8 |

**Constraint carried forward, and it is not negotiable:** optimization may change **how** committed
state is indexed or retrieved; it may never change **what counts as** committed state.

---

## 6. Sequencing

```
U4  (lifecycle lies)          ── alone, trivial, first
U1  (fabricated answer)       ── alone, behavioural, with U2's measurement
T1  (product arity)           ── alone, behavioural, against the four NAL suites
T2  (Bool identities)         ── after T1: both touch compoundOf
T3  (parens)                  ── mechanical; a gate lands first so the sweep is checked
R1  (rule-table.history)      ── mechanical, and it is a predecessor's debt
U2  (relevance)               ── after U1: U1 is the read path, U2 ranks within it
U3  (candidate budget)        ── after U2: it caps what relevance then has to rank
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

**A number with no commit in it is not evidence.** Every measurement in this document, and what it is
worth.

| measurement | value | taken at | reproduced by |
|---|---|---|---|
| facts → beliefs → answer | **3 facts / 1 cycle → 8 beliefs, answer 1.00 · 3 cycles → 65 · 10 cycles → 133, answer 1.00 throughout** | `a2661c54` | `examples/` probe against `createNAR`, `maxConcepts: 100000` |
| NAL transitivity is correct | `(kitty-->mortal)` derived at **f=0.74, c=0.94** from `cat→animal, kitty→cat, animal→mortal` | `a2661c54` | same probe |
| **the query path fabricates** | `ask((dog-->mortal).)` → **answer `(animal-->mortal)`, confidence 0.871**; same for `(whale-->mortal).` | `a2661c54` | `nar.query.ask`, §1.1's failing test |
| `Truth.TRUE` is not certainty | `{f: 1.0, c: 0.9}`; `MAX_CONFIDENCE` is `0.999` — **there is no c=1.0 truth value** | `a2661c54` | `nar/src/terms/impls/Truth.ts:67` |
| legacy `<>` literals | **243 across 32 files** — 81 `nar/src`, 144 tests, 10 `scripts`, 8 `core/src`, 5 `src`, 3 examples | `a2661c54` | `grep -rE '<[a-zA-Z_][^<>]*-->[^<>]*>'` |
| `<>` cannot nest | `<<a-->b>>` and `{<(a-->b)>}` are **PARSE FAIL**; `{(a-->b)}` is `setExt` | `a2661c54` | `termParser` |
| product arity is unreachable | `(a)==a` true · `()==TRUE` true · `(a,)` **PARSE FAIL** | `a2661c54` | `termKey` |
| reference arity table | `PROD("*",1,Args.GTEZero)` · `CONJ("&&",true,5,Args.GTETwo)` · `Op.DISJ` `case 0->True; case 1->x[0]` · `Op.EmptyProduct` exists | `docs/java/Op.java:110,126,611-616,287` | read, not inferred |
| `<>` is deprecated upstream | `COMPOUND_OPEN='('` with `@Deprecated OLD_STATEMENT_OPENER='<'` | `docs/java/Op.java:250-255` | read |
| **task validity is a symbol check that misses every nesting** | `(a-->TRUE)` **VALID** · `(a-->FALSE)` **VALID** · `(a-->(b\|TRUE))` **VALID** · `(--TRUE)` **VALID** · `NULL` **VALID** — while `TRUE` alone is INVALID, the one case that can never be a task | `a2661c54` | `validateTaskTerm`, §2.2's test table |
| the cascade makes it total | `(a-->(b\|TRUE))` → `(a-->TRUE)` invalid · `(a-->(b&FALSE))` → `(a-->FALSE)` invalid · **`(a-->(b&TRUE))` → `(a-->b)` valid** · `(--TRUE)` → `FALSE` invalid | follows from §2.1's two folds | by construction, once T1 lands |
| `maxTasks` now unbounded | pressure contributes `{concepts:1, tasks:0}` at 400 concepts / `maxConcepts:50` | this commit | `Memory.pressureBreakdown()` |

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
