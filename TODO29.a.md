# TODO29.a: Runtime Architecture — S/J/P over a closed core

**Version:** 3.0 · **Predecessor:** `TODO29.md` (v2.5 — superseded as an execution plan, retained
unchanged as the measurement and provenance record; §0.4 maps its sections onto this one) ·
**Successor:** `TODO30.md`, blocked on this.

**Scope: architecture and semantics. Nothing here has landed.** No latency, throughput, complexity,
population-scaling or index-shape requirement appears in this document's acceptance criteria. Every
one of those is `TODO30` §1–§10, deliberately, because they are measurable only after the seams they
are measured through exist. What stays here is what is testable on the tree in its current state:
dependency direction, proposal semantics, state ownership, read purity, and declared resource
lifecycle.

> **A fresh session reads §0.1 (two minutes), then §1.2 and §1.3 (the two invariants everything else
> follows from), then §5.12 (the item summary — one command, one gate, one risk per item).** §4 row 16
> is the finding that makes A11 cheap instead of an invention, and §12's two kill criteria should be
> checked *before* anything is built. Start at A0 and A5; they need no decisions and they unblock
> everything else.

---

## 0. Orientation

### 0.1 The two-minute answer

| question | answer | where |
|---|---|---|
| **What am I changing?** | Where model reasoning is reachable from, and therefore which parts of the core depend on it; who owns each cycle-path quantity; what a proposal is and when it may land; whether the rule set is data or code | §5 |
| **What must result?** | A closed synchronous cycle over committed state, with S / J / P composed through one seam and one set of gates | §1, §2 |
| **What must not change?** | NAL parity, determinism, `test:hermetic`, one inference path, the six packages, the epistemic firewall | §7 |
| **How do I know it worked?** | Twelve new gates, each landing with its item and each shipped with a test proving it can fail | §10 |
| **What belongs to TODO30 instead?** | Every data-structure choice, every cost target, `k`, the index shapes, the scaling gates | §11.2 |

### 0.2 Decided, and load-bearing

| decision | where | why settled |
|---|---|---|
| The thesis is **composition**, not optionality: symbolic and model reasoning coexist in one system | §0 | the project's author |
| The cycle **never depends** on a model response for completion — a model may be called anywhere on the cycle path | §1.3 | a call-count-of-zero rule was too strict *and* passed while a real dependency remained (§4, row 5) |
| **One model-reasoning capability, two profiles**: `J` = a typed *decision* (`classify` / `evaluate`, bounded, inline) and `P` = `synthesize` (open, boundary). They are **not** in a gate relationship | §2.1 | `JudgmentQuery = ClassifyQuery \| EvaluateQuery` and `SynthesisQuery` are committed types; the primitive names and the `Noul` fold were decided in `TODO16.md` §2 and are in the code |
| A decision layer's reach over `Truth` is whether it asked about a **Belief** or a **Goal**, and its probabilities are admissible **because its calibration is measured and pinned** — not because it is a model | §2.1.1, §2.6 | the field is required on every query and proposition, enforced at the transducer and validated in the schema; isotonic calibrators with a digest-pinned `calibration-lock.json` |
| Both profiles are **optional** (the model may not be provided) and both **fail closed** | §7 inv. 14 | the author; and a judged input that cannot be judged must not be admitted unjudged |
| The rule set is **loaded data**, admitted through a port, versioned and revertable — never mutated by an import | §7 inv. 15, §5.10 | the alternative leaves the rule set as code, which makes learnability a claim about a message format |
| NARchy **winnows** rules with a predicate trie and stays interpreted; its rule set is **selected at startup** | §3.4 | stated by NARchy's author — the earlier "precompiles" reading came from filenames and was wrong |
| NARchy's data structures live in a **separate module** (`jcog`) from its reasoning | §3.4 | the monorepo layout; makes "storage is a port" a module-boundary precedent |
| Structural work precedes behavioural work | §6 | so the one attribution (A4's RL/parity baselines) is measured on the final shape |

### 0.3 What this unlocks, in the README's terms

This is a substrate plan, so it claims nothing about SeNARS being better at anything. What it does
do is make four README promises structurally true rather than aspirational, and each row is a
§7 invariant plus the item that establishes it:

| README promise | what makes it structural | item |
|---|---|---|
| "a bounded, event-sourced cognitive runtime … deterministic replay, standalone verification" | one committed state transition per admission; proposals are events, not fixtures | A3, A9 |
| "bounded priority bags, cooperative yielding, anytime algorithms … graceful degradation" | every unbounded resource has a declared owner, capacity, retention rule, overflow behaviour and pressure signal | A8 |
| "every proposer output … is judged … before it can influence state" | `J`/`P` reach state only through the kernel's four gates; the port is advisory | A3, A11 |
| "TypeScript enforces internal representational invariants at compile-time" | `Concept.priority` loses its public setter; the core's extension contract stops naming `LMRule` | A2, A4 |
| "Dynamic Neuro-Symbolic Fusion … bidirectional feedback" | bidirectional feedback is only safe once the symbolic side is closed and every return path is gated | A1, A2 |

### 0.4 Section map from `TODO29.md`

`TODO30` cross-references the old numbering. `§0 → §0 · §1 → §4 · §2 → §3.4 · §3 → §1–§3 ·
§3.7 → §2 · §4 → §5 · §4.1 → §5.13 · §5 → §0.3 · §6 → §6 · §7 → §7 · §8 → §8 · §9 → §9 ·
§10 → §10 · §11 → §13 · §12 → §11 · §13 dropped · §14 → §4, §12 · §15 → §12`

### 0.5 Open, and needing a decision before the named item

| question | blocks | where |
|---|---|---|
| The in-cycle induction inventory: which behaviours the layer performs *inside* a cycle, each with a disposition (`boundary` / `synchronous` / `dropped`) and a "who would notice its absence" column | A1 | §5.13 |
| A3's eight protocol decisions — unit of work, trigger, overflow per proposal kind, denied-batch behaviour, staleness, evicted references, versioning, cancellation | A1's cost, A2's contract shape | §5.3 |
| The `J` placement order and budget across the eight candidate sites | nothing architectural; TODO30 §1 measures it | §2.5 |
| Q3's hypothesis — which arm should beat which, by how much, on which games, and what would count as "the model does not earn its place" | the plan's only falsifiable claim | §11.1 |
| Is the induction layer ever a seventh workspace package (answered for the *contracts*; the rest open) | nothing | §11.1 |
| A census test asserting the core's shipped table is exactly the registered NAL rules | A2 | §11.1 |

### 0.6 Next actions, in order

1. **A0** — instrumentation, including provider-*dependency* detection, not presence detection.
2. **§5.13 + A3's eight protocol decisions** — *produced* before A1, because A1's acceptance depends on
   them. A3's **implementation** lands after A2, once the queue's real behaviour is known (§6).
3. **A1** — close the cycle's dependency on the model, bound the `J` profile, require a symbolic
   fallback on every model-backed rule.
4. **A2** — the dependency inversion, with the seam contracts in `@senars/core/schemas`.
5. **A5 → A4** — the mechanical split, then the one deliberate behaviour change.

### 0.7 What this plan is not

Not performance work, not the capability thesis, not the `lm/` internals, not UI, not NAL. §9 has
the list. Read this as the floor, not the claim.

---

## 1. The contract

### 1.1 The architecture contract

> **Every cycle-path responsibility has exactly one owner and an interface through which its
> implementation can be replaced. No cycle-path component may require an induction provider, hidden
> global state, or an implicit traversal of the whole population.**

Three clauses, each falsifiable, none needing a stopwatch:

- **one owner** — a mutation of `Concept.priority` or of the decay clock is reachable from one
  owner only, and the write surface is enumerable (§7 inv. 5).
- **replaceable** — each cycle-path responsibility is reached through a port whose contract does
  not mention the concrete type (§3.1, A5, A6).
- **no implicit population traversal** — a read that must consider the whole population is a
  *declared* decision with a named owner and a budget, not a side effect of a getter (A4, A8).

This holds for a tree that is currently O(N) everywhere, and it is what TODO30 needs in place
before it can measure anything.

Each clause prefers the strongest mechanism available, in this order, because a rule nobody enforces
is a comment:

```text
representational   the type forbids it           (Concept.priority has no public setter)
structural         the package graph forbids it   (seam contracts in @senars/core/schemas)
declarative        a ledger of the sites          (accumulator ledger, call-site manifests)
mechanical         a gate that can fail           (attention:write-surface, deps:gate)
```

Three of the four have a precedent in this tree: `verify-derivation`'s dependency floor, the
accumulator ledger's "declare it as data", and `deps:gate` itself. The one to build from nothing is
the first.

### 1.2 Committed state versus advisory computation

**This is the single sentence the rest of the plan is made of.** Three qualitatively different
things exist in this system:

```text
Core committed state ──▶ gates ──▶ events        authoritative; replayable; the only input
                                                     deterministic reasoning may read
Advisory computation  ──▶ J/P answers            bounded, optional, timeout-failing, never
                                                     authoritative until admitted
Uncommitted producer work ──▶ proposal queue      out of band; no cycle participation; may not
                                                     mutate state at any price
```

> **Only committed core state may influence deterministic reasoning. Advisory computation and
> uncommitted producer state must never become implicit inputs to a cycle.**

Three consequences that are easy to lose:

1. **A proposal has no authority until it is committed.** Not when it is produced, not when it is
   queued, not when it is validated — when it is *committed*, at a declared boundary, through the
   gates, as an event (A3). This is why "apply whenever it arrives" reopens the cycle.
2. **A conclusion and a proposal are different acts, and only the second is boundary-governed.** A
   `J` answer that concludes something is an **in-band derivation**: produced inside the cycle and
   admitted through the normal derivation-admission path under budget, like any other conclusion. A
   *proposal* — a `P` output, or any untrusted write attempted from outside the cycle — has no
   authority until the declared boundary. So the boundary rule does not forbid inline `J`; it
   governs **writes attempted from outside the cycle**, and an in-band derivation is not one. Both
   readings of §2.3's "may produce derivations" are otherwise available and only one of them keeps
   §2.3 true: treating a `J` conclusion as a proposal makes inline `J` illegal, and treating every
   proposal as a conclusion makes "never mid-cycle" unenforceable.
3. **TODO30's licence is bounded.** Optimization may change **how** committed state is indexed or
   retrieved; it may never change **what counts as** committed state. An index that silently admits
   uncommitted producer work has crossed from an optimization into an architecture change, and this
   is the line it crosses.

### 1.3 The cycle invariant, stated correctly

The online reasoner is **closed, synchronous, and has no required external dependency on the cycle
path**:

```text
ONLINE REASONER — closed, synchronous
  deterministic with respect to committed state and its inputs
  optional model calls may occur on the cycle path
  a model result never gates completion
  every model call is budget- and timeout-bounded
  no provider mutates core state directly
```

**"No I/O, no model" was the wrong sentence** and this document does not use it. A `J` call on the
cycle path is permitted, wanted, and safe — precisely *because* the invariant below holds:

> **The synchronous cycle must never depend on an external model response for completion.**

Every wording of that requirement — "no model in the cycle", "zero in-cycle calls" — is a proxy,
and §4 row 5 is the demonstration: the proxy would pass on today's tree while `KernelPerceptionGate`
awaits a judge with no timeout (§4, §5.1 step 7). Assert the property, not the count.

What *is* forbidden on the cycle path:

- an **unbounded** wait on a provider (timeout, then treated as failing);
- a provider writing core state without passing a gate;
- a proposal landing mid-cycle;
- a provider's *absence* or *failure* changing which path the consumer takes, other than by taking
  its own declared path or the fail-closed path.

---

## 2. S/J/P: the architecture

### 2.1 The vocabulary, defined once

The runtime has three reasoning modes, and **two of the three are already implemented and typed** in
`nar/src/lm/system-one/`. This plan does not invent them; it makes them reachable from the reasoning
cycle.

| mode | meaning | already exists as |
|---|---|---|
| **`S` — Symbolic** | deterministic reasoning over the shipped NAL/extended-NAL rule table | `RuleEngine` / `InferenceTable` (A6) |
| **`J` — Decision** | answer one bounded, *typed* question: pick from a closed option set, or rate against ordered levels. Returns probabilities, never text | `ClassifyQuery` / `EvaluateQuery` → `ClassifyProposition` / `EvaluateProposition` (`types.ts:66-141`) |
| **`P` — Proposal** | open-ended generation: explain, propose, generalise, derive | `SynthesisQuery` → `SynthesisProposition`, plus the A3 proposal seam |

**Two primitives, not three, and that is deliberate.** The decision layer's canonical form is
`Choice` / `Score` / `Noul`. SeNARS folds `Noul` into `Evaluate` — a yes/no is an evaluation whose
level anchors are `["false", "true"]`, so it *is* the NAL frequency judgement with a different label —
and names the surviving pair `classify` / `evaluate`. `SynthesisQuery` is the third query kind and is
`P`. **The vocabulary is committed code** (`JudgmentQuery = ClassifyQuery | EvaluateQuery`), not a
naming choice made by this document; the lineage and the reasoning behind the fold are in
`TODO16.md` §2 and `TODO16b.md` Appendix A.

**`J` and `P` are two profiles of one seam; `S` is a different capability.** They share the seam and
the event log. `S` and `J` share a *representation* — typed values, calibrated scalars and probability
distributions are natively what NAL deals in — while `S` and `P` cannot (§2.6).

### 2.1.1 The three properties that make `J` safe, and all three are implemented

This is the substance the plan was missing, and none of it is new:

1. **Every query declares what it is about: a `Belief` or a `Goal`.** The field is called `axis` in
   the code (`CognitiveAxis`, `types.ts:63`) and its two values are `'epistemic'` and `'teleological'`,
   but the meaning is exactly the README's own split: **epistemic = Belief, teleological = Goal.** A
   **Belief** answer may speak to `Truth`; a **Goal** answer may only touch `Desire` and is
   *mathematically forbidden* from mutating factual `Truth` — enforced at the transducer
   (`action-transducer.ts:37` refuses any proposition whose axis is not the goal side or which
   abstained), validated in the schema (`http-endpoint.ts:21,29`), and defaulted to the safe side
   (`decide.ts:293`). Every shipped head declares which it is in `head-specs.ts`. **This is the
   epistemic firewall as a required field rather than a convention** — and it answers a question this
   document previously left open.
2. **Every proposition reports how it failed.** `PropositionBase` carries `abstained: boolean` and
   `abstainReason: 'low-confidence' | 'out-of-domain' | 'timeout' | 'breaker-open'`
   (`types.ts:114-121`). So "not configured", "did not answer", "out of domain", "timed out" and
   "circuit open" are five distinguishable facts at the type level — which is what lets `absent` and
   `failed` take different paths without a comment.
3. **Every proposition carries its own calibration and cost.** `Calibration { version, ece, fitted }`
   and `ResourceCost { tokensIn, tokensOut, computeMs, memoryMb }`, plus per-head isotonic calibrators
   and a digest-pinned `calibration-lock.json`. **A provider's probability is admissible because its
   calibration is measured and pinned, not because it is a model** — and an uncalibrated provider's
   scores are clamped at the gate rather than believed.

Consequence for this plan: **`J` is not a new capability and A11 is not an invention.** It is a
completed, typed, calibrated layer that is currently wired to the *agent* side (§5.11).

The names are the tree's own: `IngressJudge` and `admitViaJudge` are `J` at ingress;
`judgment-pipeline.ts`, `ClassifyQuery`/`EvaluateQuery` and the `RubricId` heads are what already
builds it; `P` is `SynthesisQuery`, the tick stage `propose`, the `TickContext.state.proposals` array,
and the `Proposal` contract of A3.

**Anti-drift note, because "judgment" can still be misread.** A decision layer answers a typed
question and returns probabilities; it is not a verdict on another tier. `J` does not authorize,
gate, approve or reject `P`, and it never speaks about `P` at all. What the consumer does with an
answer — admit it, derive from it, select with it, prioritise with it — is a separate decision
belonging to the consumer. This is the v2.4 error the plan corrected, and the
word "judgment" is not licence to reintroduce it.

### 2.2 The shape

```text
             ┌────────────────────────────────┐
             │   S — symbolic core            │
             │   closed · synchronous         │
             │   no required external dep     │
             └───────────────┬────────────────┘
                             │ shared derivation context
             ┌───────────────┴───────────────┐
             │                               │
   ┌─────────▼─────────┐          ┌──────────▼──────────┐
   │  J — decision     │          │  P — proposal       │
   │  bounded question │          │  open-ended work    │
   │  inline · optional│          │  boundary · optional│
   │  may derive       │          │  produces proposals │
   └─────────┬─────────┘          └──────────┬──────────┘
             │                               │
             └───────────┬───────────────────┘
                         ▼
              admission through the kernel gates
                         ▼
                 committed state  +  event log
```

### 2.3 The table

| | **`S`** | **`J`** | **`P`** |
|---|---|---|---|
| question answered | — | one specific question, bounded | an open-ended request |
| result | a conclusion, computed | a bounded answer | proposals, abstractions, derivations |
| latency | microseconds | **microseconds** — linear heads over a frozen backbone; `ResourceCost.computeMs` is recorded per proposition so the claim is measured, not asserted | unbounded; boundary only |
| **may produce derivations** | yes | **yes** | yes |
| where it may run | anywhere in the cycle | **anywhere in the pipeline**, cycle included | at a declared boundary |
| trust | trusted: the shipped table | untrusted: judged on arrival, admitted through a gate | untrusted: provisional until admitted |
| lifecycle | fixed; changed by a release | shares the model's configuration | runtime, versioned, **revertable** (§5.10) |
| absent | n/a | **no answers; the consumer takes its own path** | **no proposals; the system reasons unchanged** |
| failing | must be total; NAL parity is the gate | **fail closed**, bounded, cycle unaffected | **fail closed**; nothing applied |
| hanging | must be impossible | **timeout, then treated as failing** | timeout, then nothing applied |

"Optional" means **absence**, not graceful degradation, and the distinction is the design:

- **absent** ⇒ the consumer takes its own path, unchanged. With no model at all the core is a
  complete NARS-like reasoner — this is the `systemOne.enabled: false` path that already ships.
- **failing** ⇒ **fail closed.** An unobtainable answer is not a pass and not a negative: the
  consumer refuses the decision and records why. A model-backed *rule* that cannot call its model
  runs its **symbolic fallback** — a deterministic body, not a degraded one.
- **hanging** ⇒ bounded by a timeout, then treated as failing. Never awaited.

### 2.4 Four configurations, and the one property worth stating

The design is defined for four configurations — {`J` present or absent} × {`P` present or absent} —
and the system must initialise, reason and pass NAL parity in all four.

| configuration | `S` | `J` | `P` | expected effect |
|---|---|---|---|---|
| S | ✓ | — | — | symbolic baseline |
| S+J | ✓ | ✓ | — | `J` may add or adjudicate derivations |
| S+P | ✓ | — | ✓ | rule/content induction may alter future state |
| S+J+P | ✓ | ✓ | ✓ | composition |

> **`S` must be invariant across all four, while the whole system's derivations may legitimately
> differ.**

That consequence is counter-intuitive enough to state as a rule: a test demanding identical
derivations across the four configurations is demanding that `J` and `P` do nothing. What must match
across the four is the *core's* behaviour. `config:model-matrix` gates it.

### 2.5 Where `J` could earn its place

Ordered by what is measurable, not by what is imaginable. **None of this is mandated here** — the
capability is general and the *placement* is an experiment. The ordering and the budget are
TODO30 §1's to decide. The second column is the point that makes each row actionable: a decision
layer answers a *typed* question, so each site declares which primitive it asks, and the answer is
validated against that declaration at the seam.

| site | question it would answer | primitive | answers about | exists? |
|---|---|---|---|---|
| ingress | what is this observation, what task type, is it an injection | `classify` + `evaluate` | Belief | **yes** — `KernelPerceptionGate` + System One |
| rule selection | which of the applicable rules to try first | `classify` over the applicable set | Belief | partly — `LMRuleSelector` is exactly this shape |
| premise formation | which premises should be paired, given this task | `classify` over candidate pairs | Belief | partly — a `PremiseSource` slot exists |
| contradiction | which of two conflicting beliefs to prefer, and why | `evaluate` against a legend, or `classify` | Belief | no |
| attention | a bounded priority suggestion, applied **by the owner**, never written directly | `evaluate` against priority levels | Goal | no — and it must go through A4's owner |
| consolidation | what is worth keeping, what is worth forgetting | `evaluate` × `compositeScore` | Goal | partly — the pressure/consolidation path |
| goal handling | is this goal worth decomposing now; which tool would serve it | `evaluate`, then `classify` over tools | Goal | partly — drive/decompose strategies |
| explanation | explain this derivation, on demand | `synthesize` | — | partly — NL generation |
| rule induction | a new reaction, admitted at a boundary | `synthesize` → A3's rule path | — | **no — this is A10 + A3** |

Three constraints on all eight, from this plan and not from taste: the answer is **advisory until a
gate admits it**; anything that writes state writes through the owner A4 establishes, never
directly; anything on the cycle path is bounded by §1.3. A `J` that could write `Concept.priority`
directly would undo A4, and a `J` in the cycle without a budget would undo A1.

The pipeline shape, so an implementation does not re-create the v2.4 confusion:

```text
J asks ──▶ J returns an answer or candidate conclusion
         ──▶ the consumer decides what that answer means
         ──▶ the normal admission / derivation / selection path
```

### 2.6 Three consequences of the split

1. **`S` shares a representation with `J`, and cannot share one with `P`.** A symbolic rule is a
   total function from premises to conclusion; an open generation is a request whose result may be
   absent, and modelling those uniformly produces either an `async` hole in a supposedly synchronous
   engine or a prompt-shaped wrapper around NAL. But `J`'s output is *already typed* — a distribution
   over a declared option set, or a calibrated scalar against a declared legend, on a declared axis —
   which is the same kind of thing NAL reasons over. So `S` and `J` share a data representation and
   `S` and `P` share only the seam and the event log.

   **What a decision-layer conclusion may touch follows from whether it is a Belief or a Goal, and is
   already decided and implemented** (§2.1.1): a **Belief** answer's probability is admitted to
   `Truth` at the gate's source-quality ceiling, and a **Goal** answer is confined to `Desire` and
   cannot reach `Truth` at all. So a decision layer does not need a special rule about truth — it needs
   to declare which kind of question it asked, which is already a required field on every query.
2. **Fusion is preserved by sharing derivation context, not by sharing an execution path.** The model
   is told what the symbolic tier concluded — after the fact, or inline if `J` answered within
   budget. Both keep the reasoner closed while the model sees the reasoning.
3. **Content proposals and rule proposals are different acts** and may not share a queue, an
   overflow policy or an admission path (A3, §5.3). A content proposal is a task to be admitted; a
   rule proposal mutates the table every future derivation depends on. **A wrong belief poisons one
   derivation; a wrong rule poisons all of them.** One `Proposal` interface with one overflow policy
   erases that asymmetry.

And the seam that already exists, which the plan makes load-bearing rather than invents:
`nar/src/lm/rule-templates/fallbacks.ts` gives every model-backed rule a symbolic body, and
`executeLM` already returns `null` on failure. **The best-of-both seam is already built.** What is
missing is that nothing *requires* it — so a new `P` rule with no fallback would be accepted
silently. A1 makes the fallback a schema requirement.

### 2.7 Why composition, and not optionality

Three earlier passes framed the thesis as "the core does not depend on the model". That is
*necessary* and reads as the claim; it is the floor. The claim is **composition**: the best of a
NAR-shaped symbolic reasoner *and* a model, which requires the two to have different
representations, different schedules and different trust levels, and to meet at exactly one place.

- **The core becomes falsifiable.** A NAR-shaped core can be held to NAR's own standards — NAL
  parity, determinism, a replay — and `J`/`P` earn their place by beating them. If the two are
  inseparable, neither claim can be tested.
- **Optionality is a deployment requirement.** Latency budgets, air-gapped deployments, regulated
  environments and the deterministic test tier all need a core that runs with no model.
- **It makes the hermetic tier free.** The question "how does a background model survive
  `test:hermetic`" answers itself: the hermetic run *is* the no-provider run plus a recorded
  proposal stream replayed through the same seam (A9). No gate is weakened and no test is skipped —
  which removes the failure mode that produced §4 row 4.
- **It does not require the innovation to live outside the core.** Admitting a *rule* into a running
  system belongs to the **core**, and it survives the layer's absence (A11).

The differentiator is **selected vs learned**, not fixed vs configurable: NARchy lets you choose
which pre-written rules to enable, at boot. The claim here is that rules are *produced*, admitted
through gates, versioned and revertable **while the system runs**. Loading a table is not novel —
NARchy does that at startup. *Admitting a rule into a running system through a gated, recorded,
revertable path* is the difference, and it is a smaller and more defensible claim than "NARS has a
fixed rule set".

---

## 3. Seams and ports

### 3.1 The ports

Five **cycle-path** ports, in dependency order, plus the two seam contracts declared alongside them
(§3.3, §5.11) — seven contracts in all. Each port replaces part of the god-object rather than adding
a layer. **None of
these is an index**; choosing implementations is TODO30 §4–§7.

```text
ConceptStore     get(term, create) · set · remove · size · summary · clear
Attention        touch(term, event) · topK(n) · commit(now) · forget(term)
BeliefTable      per-concept: insert · peek · size · retention policy
InferenceTable   lookup(antecedentKind, consequentKind) · dispatch(...)
CycleExecutor    one cycle, under a budget, with a pluggable concurrency strategy
```

Two of them matter most. `ConceptStore` and `Attention` are the ones NARchy's precedent speaks to
(§3.4); the other three are consequences of their existing members. One shape change is deliberate:
`Attention` is an *interface with a mutation surface*, not an index with an update method, because
"one owner" is the property and "index" is an implementation.

Two further contracts, from A2 and A11:

```text
Proposal / ProposalSource   declared in @senars/core/schemas; data, never a closure over NAR
                            internals; content and rule kinds are separate types (§5.3)
DecisionPort               one optional port onto the *existing* decision layer; advisory; every
                            call site declares query kind, axis, budget and position at the type
                            level (§5.11). Reuses `JudgmentQuery` / `SynthesisQuery` verbatim
```

### 3.2 The cycle

The shape, with no cost claims attached:

```text
input ──▶ attention.touch(term, event)          replaces the O(N) relevance scan
      ──▶ admission                            through the store's neighbour port
      ──▶ attention.commit(now)                 the only decay in the system, on a clock
      ──▶ workingSet = attention.topK(n)       replaces sample() + the decorative scorer
      ──▶ for each premise pair:
             inference.dispatch(...)
      ──▶ budgeted admit of conclusions
      ──▶ drive / meta / self — on a budget, opt-in
```

One owner per quantity, one cadence per clock, one write path per fact, one seam for `J` and `P`.
The cycle has *no* prohibition on model calls in it; it has the invariant of §1.3.

### 3.3 The spine and the proposal lifecycle

```text
                   ┌──────────────────────────────────────────┐
  input ──▶ gate ─▶│  ONLINE REASONER — closed, sync, bounded │
                   │  no required external dependency        │
                   │  (model calls permitted, bounded, never │
                   │   required for completion)              │
                   └───────────────┬──────────────────────────┘
                                   │ commits only
                                   ▼
                        ┌─────────────────────┐
                        │  THE SEAM           │  versioned · validated
                        │  rule table         │  gated · revertable
                        │  proposals          │  replayable
                        └──────────┬──────────┘
                                   │ proposes
                                   ▼
                   ┌──────────────────────────────────────────┐
  un-committed ────▶│  INDUCTION LAYER — out of band          │
  derivations       │  bounded queue · its own budget · no    │
                    │  cycle participation · every output a   │
                    │  proposal · provisional until applied   │
                    └──────────────────────────────────────────┘
```

**What the seam does not do.** It does not let the reasoner read the inducer's intermediate state,
and it does not let a proposal land mid-cycle. A proposal applies at a declared boundary or not at
all (§5.13).

**The seam runs through the kernel gates, not around them.** This is a README-level invariant the
split must not erode: `PerceptionGate` admits, `BudgetGate` accounts, `RewardGate` holds the
epistemic firewall, `ActionGate` authorises, and *"four gates mediate every state mutation; every
subsystem operates through them; none can bypass them."* The requirement here is therefore stronger
than "a provider proposes":

> **A proposal is a request to a gate, and the gate is the only thing that may write state.**

In particular a proposal may propose a rule, an abstraction or an attention weight; it may never
propose a truth value to be written without `PerceptionGate`'s source-quality ceiling, and it may
never reach `Truth.frequency` or `Truth.confidence` through a reward path. The existing
`provisionalConfidence` 0.3 is the correct instinct and must survive the payload change.

#### Two kinds of proposal

| | **content proposal** | **rule proposal** |
|---|---|---|
| payload | a formalized term / provisional belief / goal / abstraction | a reaction: pattern + truth function + priority |
| frequency | continuous, driven by ingress and derivation | rare, and deliberate |
| trust | untrusted, admitted through `PerceptionGate` at the source-quality ceiling | untrusted, and must clear the rule schema |
| cost of dropping one | low — the next derivation produces another | high — it *is* the learned capability |
| overflow | drop-oldest is acceptable; the context is regenerable | **never silently dropped**; overflow must be reported |
| reversibility | n/a — a task's provenance is its admission event | must be revertable, and the revision recorded (A10) |
| where it lands | memory, via a gate | the rule table, behind `InferenceTable` (A6, A10) |

**One queue with one policy for both is the specific mistake to avoid**, and it is the mistake a
single `Proposal` interface invites. The distinction belongs in the *type*, not in a field.

#### The applicability rule

```
Provider observes revision R
        ↓
Provider emits proposal P with schemaVersion v, baseRevision R
        ↓
Core reaches a declared synchronization boundary
        ↓
Core checks P.schemaVersion      → incompatible ⇒ reject loudly
Core checks P.baseRevision       → stale        ⇒ reject as stale
Core checks referenced objects   → evicted      ⇒ reject, do not salvage
        ↓
apply(P) through the gates  |  reject(P) as a recorded event
```

"Apply whenever it arrives" is prohibited: it reopens the cycle.

#### Atomicity with the event log

**Proposal admission is a single committed state transition.** This is the invariant that makes
`revertable` a state-machine property rather than a feature claim, and it is required by §1.2:

> The event that records admission is the source of truth for the resulting table revision.
> In-memory indexes are **derived** from that state and are **never independently authoritative**.

The failure this forecloses, in both directions:

```text
event log says rule R exists      +      in-memory table says R does not      (after a crash)
in-memory table says R exists     +      event log has no admission event      (a direct write)
```

There is exactly one write. A crash cannot occur between two, because there are not two. A rule
added at runtime therefore appears in dispatch, is in the event log, carries a version, and reverts —
and those four facts are the *same fact*, not four that can drift.

### 3.4 NARchy: the precedent, briefly

Reference `github.com/narchy/narchy` pinned at `f3a9bcc` (§13). NARchy is derived from OpenNARS and
modifies it substantially, so every divergence below is a deliberate decision by someone — a stronger
reference than two unrelated systems.

| | SeNARS today | NARchy |
|---|---|---|
| concept store | one 646-line class doing 9 jobs | a port, 6 abstract methods, 8 implementations |
| priority / decay | a field with 10 external writers, re-ranked on read; swept inside `sample()`, 8× per cycle | one owner (`PriTree`), committed on a duration-derived clock (`Focus.commit`) |
| what a cycle selects from | the whole population | a declared working set |
| rule dispatch | 4-bucket union + full sort per application | a predicate trie that **winnows**, still interpreted |
| beliefs / eviction | 3 fixed capacity constants × concepts; trigger is concept count | policy-based bags, 8 table types; per-container, by policy |

Two corrections are load-bearing and both came from NARchy's author rather than from its filenames:

- it **winnows** rules with a predicate trie and stays **interpreted**; deeper bytecode compilation
  was available and deliberately not taken. `RuleIndex`'s 2-tuple kind key is the depth-1 case of
  exactly that structure, so A6 is incremental and parity-gated rather than a rewrite.
- its rule set is **selectable at runtime startup**, by enabling chosen rulesets. So the
  differentiator is *selected vs learned* (§2.7), not *fixed vs configurable*, and A10's job is
  admission, not loading.

Its data structures live in a **different module** (`jcog`) from its reasoning (`narchy`), which
makes "storage is a port" a *module-boundary* precedent rather than a convention — A5's exact claim.

---

## 4. Findings that justify the work

The evidence for these is in `TODO29.md` §1 (read it once, then use this table as the trace). An
empty owner means the finding has no gate, and a finding with no gate is a finding with no owner.

| # | finding | evidence | owner |
|---|---|---|---|
| 1 | a read mutates the heap: `sample()` calls `decayAll()`, so one cycle does ~8 decay writes and ~8 population rankings; the decay clock advances `min(sampleSize, N)` times per cycle | `memory/memory.ts:354,370` → `:557`; measured 8.2/8.0/5.0 per cycle | **A4** |
| 2 | every memory read is a full scan and the index that exists is bypassed; the *default* premise source is a scan-and-sort | `memory.ts:216,206,244,471,542`; `strategies/premise/primitives.ts:56` | **A5**; structures → TODO30 §4 |
| 3 | the scorer is decorative: its only call site passes no context, so `novelty ≡ 1`, `relevance ≡ 0` and ranking by retrieval score *is* ranking by `priority` | `memory/pressure/scorer.ts:22-28,84-88`; one caller, `memory/lifecycle/forgetting.ts:46` | **A4** (the decision) |
| 4 | eviction measures concept count, not tasks, and its candidate filter is *anti-correlated* with pressure — the only evictable concepts are empty shells | `memory/pressure/consolidation.ts:24`; `memory.ts:519` | **A8** |
| 5 | `getGoals()` mints a fresh `Stamp.createInput()` per goal per call, so anything keyed on stamp overlap reasons about an id that never repeats | `memory.ts:253` | **A4** |
| 6 | `Concept.priority` has ten external and six internal writers; `linkedConcepts`/`subConcepts`/`parentConcepts` are written only by `mergeWith`, so `SpreadingActivation.prime` is a no-op wearing a real cost | call-site audit | **A4** |
| 7 | two rules document a fix they did not get: `stepScalars` is never invalidated (a shadowed `resetMetaBudget` means the memo is process-stale), and the `RuleIndex` tie-break orders nothing because `recordRuleHit` has no callers | `rules/impls/processor.ts:156-181`; `nar-execution.ts:76,116,179,368`; `rules/impls/RuleIndex.ts:131-140` | **A1** (delete), **A6** (tie-break) |
| 8 | three of four dispatch buckets are empty: 0 of 55 registered rules use a wildcard, 21 share one hot cell | census, §13 | **A6** |
| 9 | **the seam exists, is bounded and gated, and has no caller.** `StreamReasoner` is committed, exported and tested; its only caller in the repository is a test. Meanwhile the cycle reaches the model by a different route — `processLMRules`, called synchronously, 33× per cycle | `stream/reasoner.ts`; `strategies/derivation/DefaultDerivation.ts:26,30`; `nar-execution.ts:234` `step(5000, …)` | **A1** |
| 10 | the seam spends against the **process-global** `gateRegistry`, not the per-instance one `createGateRegistry()` exists to provide, so two NARs in one process share an LM budget | `stream/reasoner.ts:2,80`; `kernel/GateRegistry.ts:117,120` | **A1** |
| 11 | a **present-but-hung** `J` at ingress is awaited with no timeout. Absence and throw are both handled correctly (absent ⇒ unjudged path; throw ⇒ fail closed, D1) | `kernel/KernelPerceptionGate.ts:72-73,117-118,154` | **A1** |
| 12 | the core's *strategy extension contract* is typed in terms of the induction layer's rule type, in **39** files | `strategies/types.ts:1,71` | **A2** |
| 13 | optionality is not operational: `enableLMRules: false` still constructs and registers the layer — 33 invocations per cycle with the flag off | `nar.ts:762,823,837`; `facade/index.ts:98` | **A2** |
| 14 | the rule set is a **module-global mutated by an import**, so it cannot be loaded, versioned, swapped or reverted, and a well-formed rule proposal has no path to becoming a rule | `rules/impls/registration.ts`; `rules/impls/rule-registry.ts` | **A10** |
| 15 | the growth arithmetic: quadratic admission via `neighborsOf`, a linear-shift `TermCollection`, a full-map victim scan, a bounded-buffer `selectTopN` | `memory.ts:308-314`; `terms/impls/term-collection.ts:57-65`; `util/src/utils/bounded-map.ts:210-216` | **TODO30 §4, §7** |
| 16 | **the decision layer is wired to the agent side, not the reasoning side.** A complete typed/calibrated layer — `classify`/`evaluate`/`synthesize`, `CognitiveAxis`, `abstainReason`, isotonic calibrators with a digest-pinned lock, `ConfidenceRouter`, `judgeCascade` — is attached to a **`GameFocus`**, while the reasoning cycle reaches a model only via the ingress judge and `processLMRules` | `facade/system-one.ts:337`; `nar.ts:571`; `types.ts:63-141` | **A11** |
| 17 | the three primitives are `classify` / `evaluate` / `synthesize` — `Noul` was folded into `evaluate` because a yes/no is a frequency judgement with two anchors. The plan must not reintroduce `Noul` as a fourth primitive or restate it as three | `types.ts:66-89`; `TODO16.md` §2; `TODO16b.md` App. A | **A11** (terminology, enforced by the types) |

**#15 is entirely TODO30's.** A4 fixes *who* may write `priority`, not with what structure it is
read. **#14 is not justified by a finding at all** — it is justified by the thesis, and §1 has no
entry for "the rule set is code" because the obvious way to find it is to read the plan rather than
the tree. It is the only item whose absence is invisible from the diagnosis, which is why §12
carries the risk row.

---

## 5. The work

Twelve items. **A0 first and separately** — it is the harness that decides whether the rest worked.
**A1 second, alone** — finding 9 makes it a wiring change and a one-line test makes it the cheapest
behaviour change available. **A2 immediately after**, because the seam and the dependency direction
are one change and only the first half is testable alone.

Each item below states: what it is for, the change, **acceptance** (demonstrable, not aspirational),
one verifying command, the gate it lands, and its risk.

### 5.1 A1 — Close the cycle: make the committed seam the only seam

*For findings 7, 9, 10, 11. This item wires in the channel that exists and deletes the other route.*

Nothing in `cpuThrottleMs` / `maxRulesPerCycle` / `callTimeoutMs` / `Promise.all` on the induction
path is a design decision — it is the cost of a model living inside a cycle meant to close in
microseconds. `inferenceController.step(5000, …)` (`nar-execution.ts:234`) is a five-second deadline
on such a step, and that is the tell.

1. `DefaultDerivation.ts:26,30` stops calling `processor.processLMRules`. The synchronous path is
   `applySyncRules` (`rules/impls/processor.ts:246`) and nothing else.
2. The production path constructs a `StreamReasoner` (or its A2 generalisation) at the cycle boundary
   and reaches a provider only through `flush` / `reasonHook`.
3. **The seam takes its gates by injection.** Replace the module-global `gateRegistry` import with a
   `GateRegistry` passed at construction, taken from the same place `nar.ts:136` takes it. Two lines,
   and it is the difference between the seam being usable in a process with two agents and not.
4. `stepScalars` and the shadowed `resetMetaBudget` are **deleted, not fixed** — with the layer out
   of the cycle the memo has no reason to exist.
5. `cpuThrottleMs` and `callTimeoutMs` lose their reason to exist. Either they go or they become
   properties of the *offline* pass. Do not leave them bounding a cycle that no longer contains the
   thing they were written for.
6. Overflow policy moves from drop-oldest to A3's decided policy, in `StreamReasoner`, with a test
   that fills the queue and asserts what survives.
7. **The `J` profile gets a bound, not a fallback.** Its optionality is already correct — absent ⇒
   unjudged path, throws ⇒ fail closed (D1). What is missing is the third case: a hung judge has no
   timeout, so `nar.input()` waits forever. Add one, and on expiry take the **same** fail-closed path
   a throw takes. **Do not degrade to unjudged admission on timeout** — that bypasses the injection
   veto, which is the one thing D1 exists to prevent.
8. **Every model-backed rule keeps its symbolic body, and the schema requires it.** The path is
   implemented and nothing requires it, so a new `P` rule with no fallback would be accepted
   silently. Make it a rule-schema requirement with a test.

**Acceptance**

1. **A test that injects a provider that never resolves, calls `run()`, and asserts the cycle
   finishes.** One line, written failing-first.
2. A cycle completes *and derives the same conclusions* with a `J` judge and a `P` rule backend that
   both never resolve — and the recorded trace shows no `propose`-stage work inside a `reason` stage.
3. Two NARs in one process each see their own `BudgetGate` accounting, and a NAR built with an
   injected registry spends against that registry rather than the process global.
4. **The causal model of a producer's effect, as four separate assertions** — not one, because they
   are four properties:

   ```text
   For a fixed cycle-start state and fixed inputs:
     · registering a producer does not change the current cycle's required progress;
     · a producer that returns no proposal produces the same committed state;
     · a proposal cannot affect state before the declared application boundary;
     · after an accepted proposal is applied, subsequent cycles may legitimately differ.
   ```

   The last clause is what makes the first three safe: a proposal *does* change future state, and a
   stronger assertion than the first three would forbid the system from learning anything.
5. A proposal that arrives is applied at a declared boundary or not at all — never mid-cycle.
6. A NAR with **zero** proposal producers registered still reasons.
7. There is still exactly one `InferenceController` construction site and one `.step(` call site.
8. **All four S/J/P configurations are complete systems** — four runs, each initialising, reasoning
   and passing NAL parity. What matches across the four is the *core's* behaviour.
9. A hung `J` is rejected on a timeout, and the rejection is the fail-closed one.
10. NAL parity, `test:determinism` and `test:hermetic` green.


### 5.2 A2 — Move the induction layer beyond the core

*Deliberately not a separate letter from A1 step 3: the seam and the layer boundary are one change,
and you cannot have a core-owned seam interface while the core imports the layer's rule type.*

- The core declares the proposal contract in core vocabulary, and a proposal is **data** — never a
  closure over NAR internals, which would re-create the coupling the type boundary just removed.
- **The contracts live in `@senars/core/schemas/proposal`, with a dependency floor of `util`.** Not
  "somewhere in `nar/src`, policed by a gate row". Two precedents are already in the tree:
  `core/verify-derivation` exists so that "a verifier bug cannot hide behind an engine bug", and the
  induction layer **already imports from `@senars/core/schemas`**. The boundary then stops being a
  lint rule and becomes a structural fact: `core` imports `util` and its own schemas, `nar` imports
  `core`, and a provider reaching into `nar` internals breaks the build.
- `stream/reasoner.ts` is generalised **in place** rather than duplicated: `LMRequest` /
  `ProvisionalBelief` are already a request/response pair with a provisional-truth discipline, which
  is the shape a `Proposal` needs. The seam gets a schema version and a base revision; it does not
  get a second class.
- `strategies/types.ts` stops importing `LMRule`. The five strategy types are re-expressed so a
  producer is not typed in the layer's vocabulary — the cleaner answer is that selection is a
  *proposal-time* concern and `LMRuleSelector` is not a reasoning-cycle strategy type at all.
- `nar.ts`'s unconditional `initializeLMRules` / `LMRules` / `NARLM` / `wireSystemOne` become
  assembly in the composition root (`src/`), which already exists for that purpose.
- The 39 imports are inverted or removed because the thing they reached for moved down.
- `lm` leaves the core config schema, on the precedent of `bagSize` and `interactionGuide`: an
  optional component must not shape a required one. It becomes plugin configuration, validated where
  the plugin is assembled.

**Blast radius**, because finding it by `typecheck` wastes a day:

| surface | where | consequence |
|---|---|---|
| `NARConfig.enableLMRules` | `facade/config.ts`, README config block, `docs/api/nar.md` | removed, docs regenerated |
| the `lm` config category | `config/cognitive-parameters.ts` | moves out of `CognitiveParameters` into plugin config |
| the four presets | `DEFAULT_` / `FAST_` / `LM_HEAVY_` / `RESEARCH_COGNITIVE_CONFIG` | `FAST_COGNITIVE_CONFIG` and `LM_HEAVY_CONFIG` exist *because of* the layer; they leave or narrow |
| the strategy slots | `cognitive/registrations.ts` + README's five-category table | `LMRuleSelector` ceases to be a cycle strategy; registry and README table change together |
| the export index | README's "Complete API Export" block | `LMRule`, `LMRuleFactory`, `lmCommands` move to the plugin side |

**Acceptance**

1. `deps:gate` gains a row: `nar` core may not import `nar/src/lm/`. One line in a ledger, and it is
   the only enforcement a well-meaning import cannot cross.
1a. The seam contracts are in `@senars/core/schemas`, and `core`'s import list still contains only
   `util` and its own schemas.
2. A no-provider NAR reasons, green with the layer's directory removed from the build graph.
3. NAL parity green with no producer registered, and a census asserts the core's shipped table is
   exactly the registered NAL rules and grows only through a proposal.
4. `enableLMRules` is gone — replaced by absence, because a flag on an always-constructed component
   is a comment.
5. No provider implementation can reach private core state, and no layer-typed value appears in a
   core extension contract.
6. `README.md`, `docs/api/nar.md` and the export index no longer advertise `enableLMRules` or an `lm`
   config block; `pnpm docs:drift` is green. Every blast-radius row is either changed or consciously
   left, in the same commit.


**Settled: no seventh package, for the contracts.** Moving `Proposal` / `ProposalSource` to
`@senars/core/schemas` makes the boundary structural for the thing that matters, at the price of one
directory. A seventh package would additionally force everything the layer *reads* — concepts,
memory statistics, derivation chains — to become public API, a much larger change to a much larger
surface. §11.1 keeps the question open for the day the layer needs to be genuinely un-buildable.

### 5.3 A3 — Specify the proposal lifecycle

*This is the one area the plan expands rather than contracts, because it is the boundary the whole
plan exists to make real, and prose is not a protocol.*

Decide, and write each into the schema document rather than a comment:

- unit of work (one derivation, one consolidation window, one episode);
- trigger semantics — a trigger, not a rate, expressed as **cycles per proposal**;
- the maximum pending proposals and the **overflow policy** per proposal kind;
- the stale-proposal policy;
- behaviour when referenced concepts no longer exist;
- schema and version compatibility;
- cancellation semantics;
- replay semantics.

What the code already answers, which is the best possible starting position:

| question | today | must be decided |
|---|---|---|
| overflow (content) | drop-oldest, twice (`pushCapped`, `trimCapped`) | acceptable for regenerable context — say so explicitly, so it is a decision and not an accident |
| overflow (rule) | **nothing exists** | a rule proposal must never be dropped silently: a bounded queue with an explicit refusal event the operator can see |
| backpressure | defer above `highPressure`; on `BudgetGate` denial re-queue at the head and trim the tail | what happens to a *denied* batch — retry, drop, or a recorded rejection event; and does a denial emit a `TerminationReason`? |
| provisionality | `provisionalConfidence` 0.3, revised by `Truth.revision` on settle | whether a content proposal is a *truth claim* at all (it should be a claim about a term, judged at admission — not a direct write) |
| staleness | none — `ProvisionalBelief` carries no revision | the applicability rule in §3.3 |
| symbolic fallback | exists per rule, required by nothing | a schema requirement: no `P` rule registers without one, and the fallback runs when the provider is absent |

**Acceptance**

- each of the eight decisions is in the schema document, not a comment;
- the content/rule distinction is in the *type*, and a rule proposal cannot be routed down the
  content path — with a test that tries;
- every registered `P` rule has a symbolic fallback that runs with no provider present;
- a recorded proposal stream replays deterministically against recorded core state, through the same
  seam (A9);
- **proposal admission is one committed state transition** (§3.3): a test that replays the event log
  reconstructs the admitted table with no in-memory state carried across, and a test that interrupts
  between admission and index update still reconstructs the admitted table;
- a test fills the queue past capacity and asserts the chosen overflow policy, including a denied
  batch;
- a test applies a proposal whose `baseRevision` is stale and asserts rejection, not silent
  application;
- a test applies a proposal referencing an evicted concept and asserts rejection.


### 5.4 A4 — Establish state ownership, and make reads observational

*The one deliberate behaviour change in this plan. Everything else is a data structure or a wiring
change.*

```ts
interface Attention {
  touch(term: Term, reason: AttentionEvent): void
  topK(limit: number): readonly Term[]
  commit(now: number): void
}
interface DecayClock { tick(now: number): void }
```

The interface is not the important part; the important part is that callers stop writing
`Concept.priority` and stop invoking decay as a side effect of reading.

- `decayAll` leaves `sample()` and `sampleWindow()` (`memory.ts:354,370`). Both become pure reads.
  `consolidate` (`:381`) is the only clock tick left, called from one place.
- `activationDecayRate` means what the configuration says. §13's sweep table collapses to one row.
- `getGoals()` stops minting stamps: minted at write, stored, read on get. `Stamp.overlaps` and
  `noStampOverlap` become well-defined for goals, which they are not today.
- **Make the invariant a type before making it a rule.** `priority`'s public setter is the root of
  finding 6, and sixteen sites compile against it, so "one owner" could otherwise only be policed by
  review or a grep. The fix is representational, and it is this repository's own stated philosophy:
  `priority` becomes a read-only getter, and mutation moves behind an internal writer only the
  attention owner holds. A new writer then fails to compile rather than failing a gate, and the
  write-surface test becomes a backstop.
- The ten external writers become a small set of named operations — input touch, related touch, decay,
  reinforce, replay, deserialise, self-tune. Each has one caller and one reason type.
- **Decide the scorer's fate** (finding 3): either wire novelty and relevance to real signals —
  relatedness from the link port, recency from `lastAccessedAt` — and keep four factors, or delete
  two and select by attention order. The current answer is neither, and this is a *design* decision
  to be recorded with its reason. It belongs here because it decides what `topK` means, and `topK` is
  the contract TODO30 will measure.
- `SpreadingActivation` and `Concept.updateLinks` either get a populated link graph or are deleted.
  `linkedConcepts` is written only by `mergeWith`, so today they are no-ops wearing a cost, and
  `inference-controller.ts:104-110` applies their boost regardless.

**Acceptance**

- `Concept.priority` has no public setter, and the only module that can write it is the attention
  owner's — asserted by the compiler, with a test enumerating the surface as a backstop;
- `decayAll` has exactly one call site, and `maxSampledConcepts` appears in no decay measurement;
- reading a concept twice without an intervening write returns the same identity and the same stamp;
- the attention and clock implementations are replaceable without changing any caller;
- the RL/parity baselines are re-established **here, once**, and committed in the same change.


### 5.5 A5 — Make `Memory` a set of ports

*For finding 2. Split the 646 lines along the responsibilities §1.2 of `TODO29.md` already
enumerates: storage → `ConceptStore`, per-concept beliefs → `BeliefTable`, links → a link port, goals
→ a goal enumeration port, statistics → a statistics view. **Start with the simplest correct
implementation plus a test double**; sophisticated backends are TODO30 §4 and §7, and are only
possible once the ports exist.*

The purpose is dependency inversion:

> reasoning code depends on the concept of storage, not on one concrete all-purpose implementation.

`MemoryView` (`memory/view.ts`, 34 lines) is already the seam the strategies use; this widens it
rather than inventing a parallel one.

**This item lands before A4, and the reason is attribution, not risk.** A4 is the one deliberate
behaviour change and A5 is the largest mechanical diff; in one window the behavioural delta is
unattributable, because every learned value moves *and* every call site moves. Splitting the lines
first costs nothing — it is mechanical and parity-guarded — and leaves A4 as a small diff against a
structure that is already final.

**Acceptance**

- cycle code depends on ports, not on `Memory`;
- storage details do not leak into reasoning code;
- each port has focused unit tests that construct it directly;
- existing semantic tests still cover current behaviour through the ports;
- the port contracts mention no concrete type, so an implementation can be swapped without touching a
  caller.


### 5.6 A6 — Define inference dispatch as an architectural port

*For findings 7 and 8.*

```text
InferenceTable
  lookup(antecedentKind, consequentKind)
  dispatch(...)
```

Three decisions, none of them "make it faster", two of them already made by measurement:

- the rule representation and the dispatch implementation become separate, so a replacement costs one
  file;
- **`*:*` goes, and it is safe to say so**: zero of 55 registered rules use a wildcard bucket, so the
  three wildcard lookups are dead work on the innermost path. Make `createRulePattern`'s two
  parameters required — the type already forbids wildcards for DSL rules — delete the three lookups,
  and keep the census as the test that fails when a rule arrives without a kind pair. The durable
  invariant is *"a rule declares its kinds or it does not register"*, which is a better contract than
  "there is a catch-all";
- the `RuleIndex` tie-break is either exercised by a test — `recordRuleHit` is called and the field
  has data — or deleted. It is currently a comparator that orders nothing, wearing a comment that
  explains why it orders nothing. This is the one decision left, and it is semantic, not structural.

**Do not** require tries, DAGs, decision trees or generated code here. TODO30 §6 chooses among them
from a measured workload, after measuring the candidate count that survives winnowing.

**Acceptance**

- inference code depends on the dispatch interface;
- `createRulePattern` requires both kinds, and a test fails if any registered rule sits under a
  wildcard key — the census, as a gate;
- the tie-break is either specified-and-tested or gone;
- NAL parity green;
- existing rule-ordering behaviour is explicitly preserved or explicitly recorded as a semantic
  change, with the NAL suites as the gate;
- any cache keyed on rule ordering invalidates on the state its ordering depended on — the shape
  `RuleIndex.ordered` already gets right with `rankingEpoch`, and the shape `stepScalars` gets wrong.


### 5.7 A7 — Define control budgets as semantics

*For the per-cycle-caller half of finding 2.*

**Use the budget system the kernel already has.** `ReasoningBudget` is a schema in
`@senars/core/schemas/reasoning-budget`; `KernelBudgetGate` accounts it per-focus by `scopeId` and
already names its failure modes — `cycle-budget`, `depth-budget`, `llm-budget`, `deadline`,
`backpressure` — as a `TerminationReason` enum. A second budget concept would be a second accounting
of the same resource, and the two would drift.

So the bounds below are `ReasoningBudget` scopes with named `scopeId`s, not a new mechanism:
derivations per step; secondary premise consideration; proposal application; control/meta work; and
**decision-layer derivations** — its own scope, deliberately *not* shared with `derivations per step`.

**That last separation is load-bearing.** §2.4 requires `S` to be invariant across all four
configurations. If decision-layer output drew on the same derivation budget as symbolic output, then
decision-layer load would change how many symbolic derivations a cycle can afford — and `S`'s
behaviour would become budget-dependent, which is the coupling §1.2's committed-state rule exists to
prevent. Separate scopes mean decision-layer load can exhaust *its own* budget and stop, while `S`'s
derivations are untouched. The **relative** cost of the two scopes is a configuration value, so the
trade-off can be tuned (eventually from measured feedback, via `SelfOptimizer`) without either scope
absorbing the other — which is only expressible because they are separate `scopeId`s.

`NARExecution.run` (`nar-execution.ts:184-379`) runs a fixed sequence of control and meta steps per
cycle, including two population-sized `getGoals()` calls (`:417` in `emitCognitiveStateSummary`,
`:455` in `injectMetaGoals`) and an O(N)-plus-two-sorts `getStatistics()` (`:424`). **The bound is
architectural — "a step may not be unbounded merely because no cost model has been written yet" — and
how cheaply the budget is executed is TODO30's.** Naming them now gives A4's read-purity work and
A6's dispatch work a place to *stop*.

**Acceptance**

- every budget is a `ReasoningBudget` scope with a named owner, a default, a configuration source, a
  `TerminationReason` for overflow, and a test demonstrating enforcement;
- **`decision-derivations` is a distinct `scopeId` from the symbolic derivation scope**, and a test
  shows the symbolic derivation count for a fixed episode is unchanged when the decision-layer budget
  is set to zero — i.e. `S`'s invariance across the four configurations is budgeted, not asserted;
- the shadowed `resetMetaBudget` name is gone from one of the two places it exists;
- the per-cycle `getGoals` / `getStatistics` callers are budgeted or removed, and the decision is
  recorded;
- `proposal-application` is a budget scope with A3's overflow behaviour, so a full queue and a spent
  budget are the same kind of event with the same kind of reason.


### 5.8 A8 — Define memory and resource contracts

*For finding 4.*

> **Every unbounded resource has an explicit owner and a declared lifecycle policy** — what it holds,
> who owns it, its capacity, its retention rule, its overflow behaviour, and the signal it raises
> when capacity cannot be reclaimed.

For each resource, a reviewable record:

```text
resource · owner · capacity · retention policy · overflow behaviour · pressure signal
```

Specifically for memory:

- `capacityPressure()` accounts for the dominant consumer, not only `concepts.size`. `totals()`
  already reports `totalTasks`; eviction does not read it.
- the candidate filter stops being anti-correlated with pressure: a concept must be able to age out
  *while holding tasks*, ranked by age × value.
- eviction must be able to **report that it could not free anything** rather than returning a silent
  `{ archived: 0, forgotten: 0 }`.
- the accumulator ledger grows from its 2 declared sites to every production container that can grow,
  and the textual `LruCache`/`maxSize` check is replaced by gating the *declaration*.

**Do not redesign the eviction data structures here** — that is TODO30 §7.

**Acceptance**

- a reviewable inventory exists for every production accumulator that can grow without an explicit
  bound;
- memory pressure is monotonically related to every bounded resource it reports;
- a memory at 99% with nothing evictable says so, and a test asserts it says so;
- the ledger covers every site the accumulator gate declares as cycle-path;
- `capacityPressure()` and the policy it names are the same quantity, asserted by a test rather than
  by a comment — finding 4 is a disagreement between a signal and a policy, and it survived because
  nothing compared them.


### 5.9 A9 — Deterministic replay

**A proposal is a `CognitiveEvent`, and the fixture is the event log the kernel already keeps.** The
repository is event-sourced — README: "the event log is the cryptographic source of truth", with
`SqliteEventLog` / `InMemoryEventLog` and pure reducers (`kernel/replay.ts`,
`replayCognitiveState`, `EventLogPersistence.ts`). A proposal *is* an untrusted write attempt, so
inventing a parallel fixture format would be the same mistake as inventing a parallel budget system
in A7: a second representation of state that can disagree with the first. A9 therefore extends the
existing reducer with `proposal.*` event kinds and nothing else.

```text
core state
+ recorded proposal events
+ configuration
+ deterministic inputs
```

with no live provider involved. Schema/version mismatches must fail explicitly rather than silently
replaying against incompatible state — and the proposal schema is the *first* thing in this
repository that a recorded fixture from a future commit would silently mis-apply.

**Acceptance**

- a live provider is unnecessary for the hermetic tier;
- `replayCognitiveState` reconstructs the same state from a log containing `proposal.*` events, and
  the reduction is a pure function of the log;
- a recorded proposal stream replays identically, twice;
- an incompatible proposal version fails loudly, with a test that asserts the failure;
- a proposal stream recorded against revision *R* is rejected against *R+1*.


### 5.10 A10 — The rule path: the reaction table is admitted data, not an import side effect

*For finding 14. **This is the item that carries the thesis.** Everything else here makes the
existing system well-bounded; this is the one that makes the rule set grow while the system runs.*

Today `rules/impls/registration.ts` assembles the 55 NAL and extended-NAL rules and registers them
on a global `RuleRegistry` **as a module side effect** — importing the module changes the rule set.
Three consequences, and they compound:

1. **The rule set cannot be loaded, versioned, swapped or rolled back.** It is code, and it is
   whatever the import graph happened to contain. A schema migration has no meaning for it.
2. **A proposal can carry a perfectly well-formed new reaction and there is no path by which it
   becomes one.** A3 delivers bytes to a door with nothing on the other side. Until this item lands,
   "the rule set is a learnable, versioned artifact" is a claim about a transport.
3. **It is the same hidden-global defect A1 fixes for the gate registry, in the place where it is
   most consequential**: a global mutated by an import, which no test can distinguish from a global
   mutated by a caller.

- **Registration moves behind the `InferenceTable` port** (A6). No module other than the port's
  implementation may mutate the rule set, and the port can enumerate it.
- **The built-in table becomes a versioned artifact** with a schema version, loaded through the seam:
  validated, recorded, revertable. README's rule matrix is then *generated* from it rather than
  transcribed, which closes the second hand-maintained source of truth in the tree.
- **This is the rule-proposal path of A3, and only that path.** A content proposal lands in memory
  through `PerceptionGate` and needs none of this. A *rule* proposal is the only thing in the system
  that changes what every future derivation can conclude — which is why it is the only thing that
  gets versioning, a schema, a refusal event on overflow, and a revert.
- **Absence becomes a value.** "No table loaded" is a state the core runs in — the same "absent, not
  disabled" property §2.3 demands of the induction layer, applied to the rules. A NAR with an empty
  table initialises, runs cycles and reports zero derivations; it does not fall over, and it does not
  silently reach the NAL rules through some other import.
- **Learned rules are revertable.** A seam whose outputs cannot be undone is a deployment, not an
  artifact. *Roll the rule set back* is an operation, not a restart.
- **A rule may not change the rule set mid-cycle.** That is A3's boundary rule, and it is why this
  item follows A3 rather than preceding it.

#### Rule artifact identity

Every entry in the table carries its own identity, so that "revertable" is a state-machine property
rather than a claim:

```ts
interface RuleArtifactEntry {
  artifactVersion: string;        // the shipped table artifact's version
  ruleSetRevision: number;        // monotonic; the table revision this entry entered at
  ruleId: string;
  ruleSchemaVersion: number;
  parentRevision: number | null;  // the baseRevision it was admitted against (null if builtin)
  provenance: RuleProvenance;     // { kind: 'builtin' | 'proposal' | 'import'; producer?; eventId? }
}
```

The durable requirements, each testable:

- **two table revisions are comparable** — a diff of *R* against *R+1* is enumerable (added, removed,
  superseded), which is what a revert needs and what `git diff` gives for code;
- **a previous revision is restorable without reconstructing the original import graph** — the entry's
  `parentRevision` and `provenance` are sufficient, because the import graph is exactly the thing A10
  deletes;
- **admission is one committed transition** (§3.3), so the table revision and the event that created
  it cannot disagree.

**Acceptance**

- deleting the registration import leaves a core with an empty rule table that still initialises,
  runs a cycle and reports zero derivations — absence, not a crash;
- a rule added at runtime through the seam appears in dispatch, is in the event log, carries its
  `ruleSetRevision` and `provenance`, and can be reverted to the previous revision;
- **two revisions are diffable and a prior revision is restored from the artifact alone** — no import
  graph, no replay of the admission sequence, no reconstruction;
- the in-memory dispatch index is reconstructed from committed state and is never independently
  authoritative — a test that mutates the index alone does not change the reconstructed table, and a
  test that replays the log does;
- a table artifact with an incompatible schema version fails loudly at load, and a recorded artifact
  replays identically;
- the loaded table and the code-registered table produce **identical derivations** on the NAL suites —
  this item adds a capability, and parity is how you prove it added one without changing anything
  else;
- the table is enumerable at runtime: ids, kinds, revisions, provenance, artifact version.


### 5.11 A11 — make the decision layer reachable from the reasoning cycle

*Small, and it is what makes §2's central claim true rather than aspirational. It follows A1,
because the port is only safe once every call through it is bounded.*

**The premise of the earlier draft of this item was wrong, and the correction makes it cheaper.**
The plan previously said the only model-reasoning capability reachable from core is the `J`
injected into `PerceptionGate`, so A11 was an invention. It is not. `nar/src/lm/system-one/` is a
**complete, typed, calibrated, open-technique decision layer**: `classify` and `evaluate` queries,
`synthesize` for open generation, `CognitiveAxis` on every query and proposition, `abstainReason` on
every result, isotonic calibrators with a digest-pinned lock, `ConfidenceRouter`, `compositeScore`,
`judgeCascade`, per-head rubrics, and `ResourceCost` on every answer.

**The actual finding is that it is wired to the wrong side of the system.** `facade/system-one.ts:337`
attaches a `ManifoldReflex` to a **`GameFocus`** — the agent/game apparatus — and `nar.ts:571` only
forwards that. So a rich decision capability is reachable from the RL side of the boundary and not
from the reasoning cycle, while the reasoning cycle reaches a model by two *other* routes: the ingress
judge and `processLMRules`. §9 already excludes `game/` and `focus/` as targets, so this item is not
"wire the manifold in" — it is **give the reasoning cycle its own typed port to the layer that already
exists**, and leave the agent-side binding alone.

- The core declares **one optional port**, typed in the layer's own vocabulary rather than a new one,
  so §9's "no new abstraction where one already exists" holds:

  ```ts
  /** Reuses the committed decision-layer contracts verbatim. */
  type DecisionRequest = JudgmentQuery | SynthesisQuery;        // types.ts:87
  type DecisionResult  = JudgmentProposition | SynthesisProposition;

  interface DecisionPort {
    ask(request: DecisionRequest): Promise<DecisionResult | null>   // null = no port bound
  }
  ```

  `null` is safe **only** because absence is per-*call-site*: a call site with no port bound takes its
  own declared path, and a bound port's own failure modes are already distinguished in-band by
  `PropositionBase.abstained` / `abstainReason` (`types.ts:114-121`). A proposal that *is* a write
  attempt still goes through A3's seam; `SynthesisQuery` produces candidates, not admissions.
- **Axis, budget and position are declared in the request**, so each is a compile-time requirement:

  ```ts
  type CycleDecisionRequest =
    | (JudgmentQuery & { budget: BudgetScope; position: 'cycle' })
    | (SynthesisQuery & { budget: BudgetScope; position: 'boundary' })
  ```

  `SynthesisQuery` is excluded from `'cycle'` in the type, which is §2's "`P` at a boundary"
  constraint made unrepresentable-away rather than documented.
- Every stage that could use a bounded answer takes the port **injected and optional**: premise
  formation, rule selection, contradiction adjudication, goal handling, attention, consolidation,
  explanation. A stage with no port configured follows its own path — the four-configuration matrix in
  miniature, per stage.
- **The port is advisory.** An answer never writes state directly: a **Belief** answer is admitted
  through `PerceptionGate` at the source-quality ceiling, a **Goal** answer may only move
  `Desire`, and anything that writes priority writes through the owner A4 establishes. A port
  reachable from every stage that can also write is the shape of the bug this whole plan is about, so
  the port's return type is a decision, not an effect.
- **The cascade and router are reused, not rebuilt.** `judgeCascade` (stage 2's space derived from
  stage 1), `ConfidenceRouter` (bands → act / review / block / abstain) and `compositeScore` are the
  decision-layer's own composition, and they are exactly the "where `J` earns its place" question —
  already answered as a mechanism, pending a measurement of which sites pay.

**Acceptance**

- **a stage without a model port follows the existing symbolic path with identical observable
  semantics** — same admitted tasks, same derivations, same stamps; *not* "byte-identical to today",
  which is not an architectural property and which the implementation cannot deliver;
- **a stage with a decision port may obtain additional information, but absence, refusal, timeout,
  breaker-open and out-of-domain cannot prevent completion or bypass the normal gate/admission
  path** — asserted separately per `abstainReason`, and by a stage whose backend hangs;
- **Belief and Goal are honoured per call site**: a `Goal` answer that reaches `Truth` fails
  `config:model-matrix`, and a `Belief` answer admitted above its head's source-quality ceiling
  fails it too;
- the port is unreachable from any write path without going through a gate (a test, not a review);
- **an answer that concludes something is an in-band derivation**: admitted through the normal
  derivation-admission path, never by direct write, counted against the A7 derivation budget, on the
  Belief/Goal split it declared (§1.2 clause 2, §2.6); and the NAL suites still pass with the
  port bound;
- every call site is in a declared manifest with its query kind, Belief/Goal, budget and position, and
  an undeclared one — or a `SynthesisQuery` declaring `position: 'cycle'` — fails
  `config:model-matrix`;
- `J` never authorizes, gates, approves or rejects `P` — a test, because the word "judgment" invites
  exactly that confusion (§2.1);
- **an uncalibrated or lock-mismatched provider's scores are clamped at the gate, not believed** — the
  existing `calibration-lock.json` digest check is the gate, and this item's manifest is where a head
  is bound.


### 5.12 Item summary — one command, one gate, one risk

Every acceptance criterion above is demonstrated by a command and a gate. Gates are wired into
`pnpm gates` **with the item that needs them** (§10).

| item | verified by | gate lands with it | risk |
|---|---|---|---|
| **A0** | `pnpm bench:cycle -- --selftest && pnpm test:hermetic` | `cycle:no-provider`, `induction:inventory` (shared with A1) | **none** — pure instrumentation |
| **A1** | `pnpm run cycle:no-provider`, `pnpm test:determinism`, NAL suites | `cycle:no-provider`, `rule:has-fallback`, `config:model-matrix`, `gates:one-cycle-path`, `induction:inventory` | **medium** — the only item that changes reasoning behaviour: not the derivations, but the *timing* of when rules exist, which changes the sequence over a fixed episode |
| **A2** | `pnpm run core:no-lm`, `pnpm run deps:gate`, `pnpm run docs:drift` | `core:no-lm`, `deps:gate` +1 row | **medium-high** — a large mechanical diff (39 files). The price of a boundary that cannot be crossed by accident, and it is mechanical: reviewable by the compiler |
| **A3** | `pnpm test:unit` (new seam tests), `pnpm run core:no-provider` | — (gates land with A1/A9/A10) | **low** — the one item the plan expands rather than contracts |
| **A4** | `pnpm test:unit` + a diff on the committed baseline file | `attention:write-surface` | **high, and confined to this item.** Every learned value moves: why it is alone, why it lands after A5, and why the baselines are regenerated here rather than left to drift through A6–A8 |
| **A5** | `pnpm test:unit` — parity is the only gate, because this changes nothing | — | **low** — mechanical, and the boundary is already implied by `MemoryView` |
| **A6** | `pnpm test:unit` (NAL suites + dispatch tests) | `dispatch:no-wildcard` | **medium** — dispatch order changes, so parity is the gate |
| **A7** | `pnpm test:unit` (budget-enforcement tests) | — | **low-medium** — the behaviour change is "steps stop running by default" |
| **A8** | `pnpm test:unit` (resource-policy tests) | `resource:policy` | **medium** — retention policy *is* behaviour; policy and structure together is how a semantic change hides inside a refactor |
| **A9** | `pnpm test:hermetic` — the tier this item exists to make possible | `replay:proposal` (`slow`) | **low** — extends an existing reducer with new event kinds |
| **A10** | `pnpm run rules:loaded-data`, `pnpm test:unit` | `rules:loaded-data` | **medium-high** — the only item that changes what the system can do rather than how it is arranged. Last in sequence for that reason |
| **A11** | `pnpm run config:model-matrix`, `pnpm test:unit` | `config:model-matrix` (re-landed, with the manifest) | **medium** — the item that can spread. A capability available everywhere is as safe as each call site, so its acceptance is mostly *declarations*, and an ungated declaration is a comment |

### 5.13 The questions A1–A3 will be decided by

The split is easy to half-do. These are the decisions a half-done split defers, listed so they get
answered deliberately rather than by whoever next opens the queue.

- **Unit of asynchronous work.** One proposal over one derivation, one consolidation window, or one
  episode. Too small and the model is prompted into trivia; too large and its latency becomes the
  wall. Most worth answering before the schema is written.
- **Trigger.** Not a rate — a trigger: a budget of un-committed derivations accumulated, a
  consolidation interval elapsed, or a salience signal fired. Express the balance as **cycles per
  proposal**: "one proposal per 10 000 cycles of un-committed derivations, dropping X when full" is a
  contract; "run every N seconds" is not.
- **Overflow policy.** The code already drops the oldest, twice. Drop-newest is simplest and probably
  right initially; drop-lowest-priority needs a priority the payload must then carry. **This cannot be
  left implicit**: a queue with no declared policy is an unbounded queue with extra steps.
- **A denied batch.** The reasoner re-queues at the head and trims. Retry, drop, or a recorded
  rejection? Whether a denied proposal produces a `backpressure` `TerminationReason` is the
  difference between "the queue is full" being visible and being inferred.
- **A proposal referencing evicted concepts.** Reject, or salvage what still resolves? Rejecting is
  simpler and more honest. Say so before the first eviction bug.
- **When the reasoner has moved on.** If applicability is "at the next declared boundary", staleness
  is bounded and irrelevant; if it is "whenever", coupling is reintroduced. **This decision determines
  whether the cycle is actually closed**, and it belongs in the schema, not a comment.
- **The proposal format's version story.** A run recorded against schema v3 must not replay against v4.
  Small, boring, genuinely hard, and it belongs to whoever writes the schema.
- **Dependency or component?** A dependency means no deterministic core, no hermetic tier and no
  reliable suite. A component means the hermetic answer is "replay a fixture". **Upstream of the
  others** — this is §3.3, decided.

**The hermetic question is retired, not deferred.** If the layer is optional, the hermetic run *is*
the no-provider run, and the with-provider path is covered by recorded proposals replayed through the
same seam. Neither gate is weakened and neither is skipped. A9 is where that lands.

---

## 6. Sequencing

```
A0 ─▶ A1 ─▶ A2 ─▶ A3 ─▶ A5 ─▶ A4 ─┬─▶ A6 ─▶ A10 ─▶ A11
                              └─▶ A7 ─▶ A8
                    A9 (after A3, parallel thereafter)
```

**The ordering rule: structural before behavioural.** A5, A2 and A6 are mechanical — they move code
and change no derived value. A1, A4 and A8 change what the system concludes or how fast it forgets.
Pairing a mechanical item with a behavioural one in the same window is what makes a behaviour delta
unattributable, and this plan has exactly one attribution to protect: A4's RL and parity baselines,
which every later item must hold stable.

- **A0** alone, first. Everything else is judged against it.
- **A1** alone, second, for the same reason as A4. Its acceptance is three short tests: a hanging
  provider, a zero-producer NAR, and a trace with no `propose` inside `reason`.
- **A2** immediately after A1, and **A3**'s *implementation* immediately after A2: the boundary is
  cheapest while the seam is fresh, and implementing against the queue's real behaviour (§4 row 9)
  rather than an assumed one is worth more than the days it costs. A3's eight protocol *decisions*
  are produced earlier — §0.6 item 2, before A1 — and only their landing is sequenced here.
- **A5** before A4, for the attribution reason, and because it makes A4 and A6 testable in
  milliseconds rather than through a NAR.
- **A4** alone, on the split structure, with the RL/parity baselines re-established and committed in
  the same change.
- **A6** after A4 — it changes dispatch order, so it is measured against A4's baselines.
- **A7 and A8** depend on A0 only and can be interleaved; A8 is the third and last behavioural item.
- **A9** lands once A3 has decisions worth replaying, and is orthogonal to the rest.
- **A10** follows A6, because it needs the dispatch port it registers through, and A3, because a rule
  must not enter the table mid-cycle. It is the last structural item and the most valuable one; if the
  sequence is cut short, cutting here costs the floor and keeping it costs the thesis.
- **A11** last of all. A capability available everywhere is only as safe as each call site, so it
  lands after the port's contract exists (A2) and after calls are bounded (A1).

> **A10 must not wait on performance evidence.** It is late for architectural reasons — it depends on
> A6's port and A3's boundary rule — and not because a measurement should precede it. TODO30 measures
> candidate counts and dispatch shapes through A6's port; nothing in A10 depends on any of it. **If
> TODO30 slips, A10 does not.** Letting TODO30 become a hidden prerequisite for the feature this plan
> exists to establish is the failure this sentence exists to prevent.

**A formal handoff to TODO30 follows A2 + A3:** at that point the architecture is what the rest of the
plan is measured through, and TODO30 §1 requires a fresh profile before it orders anything. This plan
carries no performance ordering forward, because §4 row 15 shows the old ordering came from a
profile of the wrong system.

---

## 7. Invariants that must not move

1. **NAL parity.** The suites are `tests/nar/nal1-rules`, `nal2-copula`, `nal7-temporal`,
   `nal8-procedural` and `nal9-self` — there is no `nal3`–`nal6` file, and that gap is narrower than
   this plan's language has implied for several passes (§11.1). Nothing here changes what is derived
   from what. A6 touches dispatch and is gated on those suites.
2. **Determinism.** `test:determinism` and `test:hermetic` green at every commit.
3. **`test:load-sensitive` green under full load.** This plan *adds* no timing assertions, deliberately
   — latency assertions in unit tests produced every load-sensitive flake in this repository.
4. **Every unbounded resource has an owner and a lifecycle policy** (A8). This replaces the older
   "the complexity budget ratchets downward and every change must lower `productionLOC`", which
   describes a gate that does not exist — `complexity:budget` is `mustNotIncrease` with ceilings.
   **Forcing production LOC downward during an architecture refactor optimises for the wrong thing.**
   The gate is left untouched.
5. **Each cycle-path quantity has one owner, and the type says so.** For `priority` this is
   representational — no public setter, writes confined to the attention owner's module — because an
   invariant that can only be enforced by review is not one. For everything else it is enumerable, and
   a test enumerates it.
6. **The core does not depend on the induction layer**, in either direction: `nar` core may not import
   the layer's directory, and the layer may not reach core internals by any route weaker than public
   API. Enforced by the dependency gate, not by review.
7. **The no-provider configuration is a real system, not a stub.** It must pass NAL parity, reason and
   produce derivations with zero producers registered. **This is the invariant most worth testing,
   because it is the one that would falsify the thesis** (§12).
8. **`lm.enabled` and `enableLMRules` disappear** rather than being extended. A boolean on an
   always-constructed component is a comment, and this repository is full of accurate comments about
   behaviour that is not what they say.
9. **Proposals enter through the kernel gates.** A proposal may not write `Truth.frequency` or
   `Truth.confidence` through a reward path. Pre-existing — listed because A1–A3 create a new way to
   reach state, and the new way must go through the same doors.
10. **The six workspace packages do not merge**, and the README's documented public surface is updated
    in the same commit that changes it.
11. **One inference path, many producers.** `InferenceController` is constructed in exactly one place
    (`cognitive/impls/CognitiveController.ts:167`) and `step` is called in exactly one place
    (`nar-execution.ts:234`). A1 adds producer assembly around the cycle, which is the moment this is
    most likely to be broken by accident — hence a gate.
12. **One budget system.** Budgets are `ReasoningBudget` scopes accounted by `KernelBudgetGate` (A7).
13. **The seam reaches state only through gates it was given.** The reasoner receives its
    `GateRegistry` by injection and holds no module-global. Today it violates this (§4 row 10).
14. **`J` and `P` are both optional, and both fail closed.** The model may not be provided: the system
    is a complete reasoner in all four configurations. *Failing* is not *degrading* — an answer that
    cannot be obtained is refused rather than assumed, and a model-backed rule that cannot call its
    model runs its symbolic fallback. The one thing a model may never do is **hang**. And `J` is a
    **reasoning participant, not a gate on `P`**: it may be consulted anywhere in the pipeline and it
    may produce derivations.
15. **The rule set is loaded data, never an import side effect** (A10). No module outside the
    `InferenceTable` port's implementation may register a rule; the table carries a schema version,
    every entry carries its identity (§5.10), it is enumerable at runtime, and it is revertable.
    **This is the invariant the thesis rests on**: while registration is a side effect of an import,
    the rule set is code, and "learnable, versioned artifact" is a claim about a message format.
16. **Only committed state is authoritative** (§1.2). Advisory computation and uncommitted producer
    state never become implicit cycle inputs, and a proposal has no authority until a committed,
    gated, recorded transition.

---

## 8. What is being deleted

Named, so the plan is falsifiable by diff:

- `processLMRulesImpl` from the cycle path, and its `await Promise.all` over model calls (A1).
- `RuleProcessor.stepScalars` and the shadowed `resetMetaBudget` on both the port and `NARExecution`
  (A1).
- `enableLMRules` and `lm` from the core config schema, plus the README and `docs/api` references
  (A2).
- `MemoryScorer`'s `novelty` and `relevance` factors, or the whole class — A4's recorded decision.
- `Stamp.createInput()` from any getter (A4).
- The public `Concept.priority` setter itself, not just its external uses: the invariant is enforced
  by the type, not by ten call sites (A4).
- `Memory.sample` and `Memory.sampleWindow`, or their `decayAll` side effects (A4).
- `Concept.linkedConcepts` / `subConcepts` / `parentConcepts`, and with them
  `SpreadingActivation.prime`, `Concept.updateLinks`, `findOrphanedLinks` — unless A4 populates them.
- The three wildcard lookups in `RuleIndex.candidatesFor` — `*:right`, `left:*`, `*:*` — and
  `createRulePattern`'s optional parameters. Measured safe: 0 of 55 registered rules use a wildcard
  bucket (A6).
- `RuleIndex.hitStats` with its tie-break, unless A6 makes them real.
- The `totalTasks === 0` candidate filter in `evictUnderPressure` (A8).
- The per-cycle `getGoals()` / `getStatistics()` calls from the summary and meta-goal steps, or their
  budgets (A7).
- **Module-side-effect rule registration** (A10). This is the only deletion here that removes a
  *convenience*, and it is worth doing anyway, because that convenience is why the rule set cannot be
  versioned.

---

## 9. Not doing

- **No performance work.** Attention structures, premise indexes, dispatch compilation, eviction
  containers, admission indexes, statistics placement, population scaling, the cost gates and the
  definition of `k`. Naming a data structure in this document would be a scope error.
- **Not the capability thesis.** System One, the Judgment Manifold, governance, the game/RL loop and
  the `lm/` internals are out of scope, and so is any claim about SeNARS being better at anything.
  **This plan is substrate.** Whether that is worth more than a NAR-shaped reasoner is Q3's
  experiment (§11.1).
- **The induction layer's internals are not a target** — 15 226 lines, 25% of `nar/src`. A1 changes
  *where it is called from*; A2 changes *which way the dependency points*. Whether the 19 rule
  templates are the right granularity is a real question this plan deliberately does not answer.
- **The game and RL focus subsystems are not targets.** `game/` and `focus/` are an agent-side
  apparatus, and they are the only reason several of these APIs are shaped as they are.
- **No NAL changes.** Not one. If an item here appears to need one, that item is mis-specified.
- **No timing assertions in the default suite.**
- **No new abstraction where one already exists.** Three times in this plan the cheapest
  implementation was a mechanism the repository had already built: the kernel's gates (§3.3),
  `ReasoningBudget` (A7), and the event log with `replayCognitiveState` (A9). If a proposal needs a
  queue, a budget, a replay fixture or a gate decision, use the one that is there; a parallel
  mechanism is a second source of truth about the same fact.
- **UI untouched**, and the Judgment Manifold's heads, calibration and distillation loop are untouched.
  A2 moves *where* System One's adapter is constructed, not what it judges.

---

## 10. Gates

New gates are wired into `pnpm gates` (`scripts/lib/gates.ts`) **with the item that needs them, not
after** — that file records a gate present only in `ci.yml` staying red for a whole pass of TODO28
without anyone noticing, because the way these are run by hand is `typecheck && lint && test:unit`. A
gate listed here and not wired is the exact failure mode this plan is about.

| gate | asserts | lands with | tier |
|---|---|---|---|
| `cycle:no-provider` | a cycle completes with `J` and `P` backends that never resolve **and** derives identically; no `propose`-stage work appears inside a `reason` stage in a recorded trace; a producer that returns nothing produces the same committed state. **Dependency, not presence** (§1.3) | A0 + A1 | `gate` |
| `rule:has-fallback` | every registered `P` rule declares its symbolic fallback, and the fallback is what runs when the model call fails | A1 | `gate` |
| `config:model-matrix` | all four S/J/P configurations initialise, reason and pass NAL parity; a hung `J` is rejected on a timeout rather than awaited; every model call site is in the manifest with its profile, budget and position | A1, A11 | `gate` |
| `gates:one-cycle-path` | exactly one `InferenceController` construction site and one `.step(` call site | A1 | `gate` |
| `induction:inventory` | every behaviour the layer currently performs inside a cycle is declared with a disposition — `boundary` / `synchronous` / `dropped` — and an unaccounted item fails | A0 + A1 | `gate` |
| `core:no-lm` | NAL suites plus a reasoning episode with **zero** producers, with the layer removed from the build graph; a census asserts the shipped table is exactly the registered NAL rules | A2 | `gate` |
| `deps:gate` +1 row | `nar` core may not import the layer's directory; `core` imports only `util` and its own schemas | A2 | `gate` |
| `attention:write-surface` | every `Concept.priority` write is inside the attention owner's module; a new one fails | A4 | `gate` |
| `dispatch:no-wildcard` | no registered rule sits under a wildcard bucket | A6 | `gate` |
| `resource:policy` | every production accumulator is in the ledger, and a memory at capacity with nothing evictable says so | A8 | `gate` |
| `rules:loaded-data` | no module-side-effect registration survives; the table is enumerable, versioned, revertable; two revisions are diffable and a prior one is restorable; an empty table is a runnable state | A10 | `gate` |
| `replay:proposal` | `replayCognitiveState` reconstructs the same state from `proposal.*` events, and a version mismatch fails loudly | A9 | `slow` |

Deliberately **not** here, and in TODO30: `cost:cycle`, the population-scaling matrix, and the
`bench:cycle` entry in the gate list. Note what that means for §5: **no item in this plan is verified
by a number of milliseconds**, and an item that needs one belongs to TODO30.

### 10.1 The intent-to-gate rule

The pattern behind §4 is general, and it is this repository's most expensive habit: **an
architectural intent lives in a doc comment, and nothing in the build can tell you when the code
stops implementing it.** Three instances today — a memo never invalidated (§4 row 7), a tie-break
nobody records into (§4 row 7), and a bounded, gated, tested `StreamReasoner` with one caller, a test
(§4 row 9).

Two rules follow, and they are cheap:

> **A gate ships with a test that proves it can fail, written before the gate exists.**

1. **When a metric's source can silently fail, that is a defect in the metric, not the source.**
2. **A doc comment that explains a bug the code still has is a failing test that was never written.**
   `RuleIndex.ts:131-140` is the clearest example in the tree: a precise, correct diagnosis of a
   comparator collapse, sitting next to the collapse.
3. **A correct, bounded, tested component that nothing calls is a failing test that was never
   written too.** The Stream Reasoner is that shape, and it is the most expensive instance in the
   tree, because the intent it encodes is the name of this architecture.

### 10.2 The architecture review gate

Before this document closes, review the dependency graph and answer these in writing. Each maps to a
test:

```text
Can the core be built without the induction layer?
Can the core be run without it?
Can the core be replayed without it?
Can a provider hang without blocking a cycle?
Can a provider mutate core state directly?
Can a provider write state without passing a gate?
Can a proposal be applied mid-cycle?
Can a proposal reference state that no longer exists, and what happens?
Can attention state be mutated without going through its owner?
Can a read silently change reasoning state?
Can any resource grow without a declared policy?
Is there a second inference path?
Can committed state and in-memory index disagree?
Can J authorize, gate or reject P?
```

The last two are new since v2.5 and are the two most likely to be violated by this plan's own work:
the second by A10's index reconstruction, the last by the vocabulary of §2.1.

---

## 11. Open questions

### 11.1 Must be answered here, before the named item

**Q1′ — the in-cycle induction inventory.** Which behaviours currently happen *inside a cycle*
because of the induction layer, and what happens to each once the cycle is closed? A1 is mostly this
work, and the dispositions are a decision, not a derivation. Procedure: enumerate the *behaviour*,
not the call sites; give each a disposition declared as data (`boundary` / `synchronous` /
`dropped`, with a "who would notice its absence" column); gate it; record it in
`docs/architecture/`, one page, dated. That column is the whole point: it is the difference between
moving a behaviour and losing one. Note the one behaviour that *stays* synchronous by design —
System One judging untrusted input before admission is **gating, not learning**.

**Q3 — what is the falsifiable claim.** The experiment exists; the hypothesis, the aggregate and a
clean control do not. `scripts/arcade.ts` runs `nal` and `manifold` arms with the **same actuator**
(`EpsilonGreedyReflex`, `numArms: 10, epsilon: 0.1`), Brier-scores every decision, and forces the
`nal` arm into cognitive mode "so it is always a comparable row in the summary". So the controlled
comparison is one command:

```text
pnpm arcade -- --games snake,bandit,tictactoe --arms nal,manifold,lm --resume
```

What is missing is three things, not a programme: **a stated hypothesis**, written before the run or
it is a rationalisation afterwards; **an aggregate** — per-game Brier means exist, a single number
across the matrix with a variance estimate over seeds does not; and **a clean control** — the `nal` arm
is only a true no-`J`/no-`P` control *after* A1, because until the cycle stops calling
`processLMRules` the arm runs a constructed, fully registered layer with execution gated. **A
falsification experiment whose control arm has a vestigial inducer cannot falsify anything.** Q3 is
therefore sequenced after A1/A2 and after A10.

**Q8 — does the induction layer become a seventh workspace package?** Answered for the *contracts*
(§5.2); the rest stays open for the day the layer needs to be genuinely un-buildable rather than
merely un-importable.

**Q9 — what does the no-provider core's table contain?** Measurably answered: the 55 rules registered
by `nar/src/rules/impls/registration.ts`, 21 of them `inheritance:inheritance`, all NAL and
extended-NAL, none layer-typed. So "reduces to NARS-like capability" is literally true today. What is
missing is the test that says so, which is what makes the claim falsifiable rather than descriptive.
Cheap; lands with A2.

**Q10 — is the model the only proposal producer we expect?** Designing the contract for one producer
is how you get an interface that is really a call site. A rule-miner, a human author and a recorded
fixture are cheap to name now and expensive to retrofit.

**Is NAL3–6 tested anywhere?** There is no `nal3`–`nal6` file in the tree. Worth ten minutes before
A6, not after — and if they are not covered, the parity claim is narrower than this plan's language
has implied.

**Q11 — ~~what truth does a `J`-derived conclusion carry?~~ — answered by committed code, not by this
plan.** Every decision query must declare whether it is about a **Belief** or a **Goal** — the field
is `CognitiveAxis`, whose two values mean exactly that (`types.ts:63,70,82,126,134`). The safe side is
the default (`decide.ts:293`), the transducer refuses a mismatched write (`action-transducer.ts:37`),
and the schema validates it (`http-endpoint.ts:21,29`). A **Belief** answer is admitted to `Truth` at
the gate's source-quality ceiling; a **Goal** answer is confined to `Desire`. `TODO16.md` §2 records
the decision and its reasoning: *"mathematically forbidden from mutating factual `Truth` beliefs."*
A11's job is to make this reachable from the reasoning cycle and to gate it there, not to invent a
rule.

**Known-broken, inherited, not this plan's:** `docs/api/util.md` drifts from its generator on the
unmodified tree, so `docs:drift` is red independently of §5; `test:load-sensitive` has a wall-clock
assertion (`todo16-batching`, < 50 ms) that fails under load and passes in isolation; README names
`nar/src/rules/registration.ts` as the source of truth for the rule matrix and that path does not
exist (the real one is `nar/src/rules/impls/registration.ts`) — fixed in A2's documentation sweep,
and the matrix should be *generated*, for the reason §10.1 gives.

### 11.2 Deferred to TODO30, not unresolved here

These are questions this plan deliberately does **not** answer, and each is a measurement rather than
a decision:

- which attention structure maintains the order `topK` reads, and at what population size;
- which index answers similarity recall, and whether admission stays quadratic below some threshold;
- what `k` is — the working-set size — before anyone claims O(k) anything;
- the dispatch structure chosen from the measured candidate count after winnowing (trie, DAG,
  decision tree, or the union kept);
- the eviction container, the retention weights, and where the policy's cost lands;
- which `J` call sites are worth their budget, in what order, and what each costs;
- the population-scaling matrix and `cost:cycle`.

**Constraint carried into TODO30:** optimization may change **how** committed state is indexed or
retrieved; it may never change **what counts as** committed state (§1.2).

---

## 12. Risks, and what would make this plan wrong

| risk | likelihood | signal | response |
|---|---|---|---|
| **A1 is not the cheap change believed.** The committed channel is wired in and something *else* reaches the layer from the cycle | **medium** — the cycle path is `DefaultDerivation`, `RuleProcessor`, the tick bindings and `PerceptionGate`, and only part of it was traced | a cycle that does **not** complete with a hanging `J` and `P`, or derivations that change when a provider is added | widen A1 rather than declaring victory. The acceptance is a test and the test is the arbiter — not a call count, which §4 row 11 shows can be zero while a real dependency remains |
| **A2 is a swamp.** 39 files, and the layer reaches into core internals | medium | the diff stops being mechanical and starts having semantic content | A2 is after A1, so the `Proposal` interface is known. If it is still hard, take Q8 (seventh package) early — a compiler error is a better boundary than a review convention |
| **A4 or A5 land as wrappers.** A5 adds a layer without removing the god-object, and A4's "one owner" invariant survives only as a comment | medium | `Memory` keeps its responsibilities behind a forwarding interface; or a new external `priority` writer appears and no test fails | A5's acceptance is that the cycle depends on ports, and if `Memory` is still on the cycle path it is not done. A4's mitigation is the type-level removal of the setter, with `attention:write-surface` as the backstop landing in the same change. A4 is gated on NAL parity, and its baselines are re-established in the same change so later drift is attributable |
| **A10 never lands and the thesis stays prose** | **medium** — the largest item, last in sequence, and the easiest to defer because the other nine all look like progress | the plan closes with A1–A9 done and "the rule set is a learnable artifact" still describing a message format | if the sequence is cut, cut here *explicitly*: record in §7 and §8 that the rule set is code, and stop claiming otherwise. A floor delivered honestly beats a thesis claimed and not built |
| **The thesis is negative.** S+J+P is not better than S alone | unknown — but no longer unknowable | the `nal` vs `manifold`/`lm` arcade run comes out flat or negative | Q3: write the hypothesis, run it with a seed count that survives the noise, publish the number either way. **A command, not a project** — but it needs A1 for a clean control and A10 for a meaningful with-`P` arm |
| **"Judgment" re-imports the gate reading** | medium — the vocabulary invites it | `J` starts authorizing, filtering or scoring `P` | §2.1's anti-drift note, the Belief/Goal-typed `CycleDecisionRequest`, and a test in A11's acceptance |
| **The plan measures the wrong thing** | already happened once | an ordering derived from a profile of the fused system | fixed by construction: this plan makes no ordering claims about cost, and TODO30 must re-profile before ordering anything |

**The kill criteria, plainly.** Two things would mean this is not the right plan. If the induction
layer turns out to be genuinely an *online* learner whose work cannot leave the cycle, the cycle
cannot close, §1.1 is unenforceable and the architecture is moot. And if §7 invariant 7 fails — the
no-provider core turns out inert, meaning the layer was load-bearing — then §2.7's falsifiability
argument was never true. Both are checkable before much is built, and both should be checked first.

---

## 13. Provenance

Every number this plan cites, and what it is worth. **A number with no commit in it is not
evidence**, and **the load-sensitive rows are the ones that will lie to you** — which is why
wall-clock figures are absent from this document and TODO30 §1 owns them.

| measurement | value | taken at | reproduced by |
|---|---|---|---|
| per-cycle counts with the layer "disabled" | **33 inducer invocations**, 8.2 `decayAll`, 8.0 `sample`, 5.0 `forEachConcept`; decay rate tracks `maxSampledConcepts` (5.2 → 9.0 as the knob goes 5 → 40) | `eb394d4a` | `pnpm bench:cycle` (counts, not times) and `-- --knob-sweep` |
| static facts, unchanged by this plan | 39 LM-importing core files · 10 external / 6 internal `priority` writers · 55 rules, 0 wildcard buckets, 21 in the hot cell · 1 `InferenceController` construction and 1 `.step(` call site | `919c21ab` | `grep`, call-site audit, `RuleRegistry.getAll()` census |
| NARchy reference | pinned `f3a9bcc` (2026-08-25) | — | `github.com/narchy/narchy` |

**`scripts/cycle-bench.ts` is committed, with `--selftest` proving each hook observes its own
invocation** — because a hook that silently observes nothing produces a table of confident zeroes,
and this repository already had two of those (§4 rows 7 and 9).

**What was read of NARchy versus inferred.** Read and quoted: `nars/memory/Memory.java`,
`nars/focus/util/PriTree.java`, `nars/Focus.java`. **Stated by NARchy's author and load-bearing**:
the reaction "compilers" build a predicate trie that winnows the applicable rules, still interpreted,
with deeper bytecode compilation deliberately not taken; the rule set is selectable at runtime startup
by enabling chosen rulesets, with dynamic online recompile available and never necessary; the
`jcog`/`narchy`/`spacegraph` module split. **Inferred from the tree listing, not read:** the eight
`Memory` implementations' individual behaviour, the `table/` hierarchy, `control/exec/*`,
`TaskAttention`'s sampling, term interning — none load-bearing. **One obligation stands:** the
winnowing claim is still not read from source, and TODO30 §6 is scoped so nothing depends on the
difference — its first measurement is the candidate count after winnowing, which holds true
whichever way the question goes.

**Coverage limit.** The plan names 14 of the 47 `nar/src` directories. **Thirty-three were not
examined** — neither presumed clean nor presumed broken. A session that finds itself editing one
should treat that as new scope and say so.
