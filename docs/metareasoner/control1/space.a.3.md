# Control Algebra for Bounded Reasoners

## 0. Motivation

SeNARS hard-codes ~150 component types into a fixed topology: 6 stages, 8 phases, 4 gates, 6 budget scopes, 5 strategy slots, fixed failure policies. Each is a **design decision frozen as code**. A control algebra makes every such decision a **variable in a structured space**, so that:

- SeNARS becomes one **point** in a continuum of possible reasoners.
- Architectural changes become **algebraic operations** (compose, restrict, refine, lift).
- Invariants become **equational laws** that hold across the entire space.
- New reasoner designs become **evaluations** of algebraic expressions.

---

## 1. Primitives — The Type System

Every reasoner is built from seven irreducible primitives. Each is a **sort** in a many-sorted algebra.

| Sort | Signature | Intuition |
|---|---|---|
| **Stage** `S` | `S → S × E` | An atomic cognitive operation that transforms state and emits events |
| **Gate** `G` | `S × Context → {admit, refuse} × Event` | A decision point over stage admission |
| **Budget** `B` | `Dimension × ℕ → {grant, deny} × B'` | A resource accounting function |
| **Strategy** `Θ` | `State × Slot → S'` | A behavioral choice function for a slot |
| **Memory** `M` | `Term × Truth × Budget → M'` | Persistent cognitive state |
| **Event** `E` | Typed, append-only | Observable occurrence |
| **Loop** `L` | `(S → S) → S` | A fixpoint operator over stages |

These are **not classes**. They are the generators of a free algebra. Everything else is composed from them.

---

## 2. The Configuration Space `𝒞`

A **reasoner configuration** is a tuple in a structured product space:

```
𝒞 = Topology × StageGraph × GateAlgebra × BudgetLattice
    × StrategyProfile × MemoryModel × TrustModel × FailurePolicy
```

Each component is itself an algebraic structure:

### 2.1 Topology `𝒯`

A **directed hypergraph** whose nodes are loops and whose edges are invocation relations.

```
𝒯 = (V, E, nest, drive)
  V    = {ℓ₁, ℓ₂, …, ℓₙ}          -- loop vertices
  E    ⊆ V × V                      -- "ℓ₁ invokes ℓ₂"
  nest : E → {serial, parallel, detached}
  drive: V → {stimulus, step-count, signal, event}
```

**SeNARS point:** `V = {macro, micro, inference}`, `E = {(macro, micro), (micro, inference)}`, all `serial`, driven by `{stimulus, step-count, deadline}`.

**Generalization:** Arbitrary DAGs. Multiple micro-ticks per macro-phase. Parallel inference cycles. Event-driven loops. Loops that invoke each other bidirectionally (with cycle detection as a gate).

### 2.2 Stage Graph `𝒮`

An **edge-labelled DAG** replacing the fixed stage sequence:

```
𝒮 = (Vₛ, Eₛ, guard, effect)
  Vₛ    = {s₁, …, sₖ}              -- stage nodes
  Eₛ    ⊆ Vₛ × Vₛ × Pred           -- edges guarded by predicates
  guard : Eₛ → Pred                 -- condition for traversal
  effect: Vₛ → State → State × E   -- stage semantics
```

**SeNARS point:** `Vₛ = {perceive, attend, reason, authorize, propose, learn}`, a **chain** (each edge's guard = `true`). The macro-cycle is a separate chain of 8.

**Generalization:**
- **Conditional edges:** `reason → authorize` only if `derivations.length > 0`; otherwise `reason → learn`.
- **Cyclic edges:** `learn → perceive` with a cooldown guard.
- **Parallel fan-out:** `attend → {reason, propose}` concurrently, joined at `authorize`.
- **Optional stages:** `narrate` only if `cortex ∈ host`.

This is the **single highest-leverage change** identified in `flow.md §13.3` — making stage order data rather than code.

### 2.3 Gate Algebra `𝒢`

Gates form a **monoid under composition** with three composition operators:

```
G₁ ∘ G₂     -- serial: admit only if both admit
G₁ ∥ G₂     -- parallel: admit if both admit (same as serial for decisions)
G₁ ⊕ G₂     -- voting: admit if majority admits (for n > 2)
G₁ ▹ G₂     -- fallback: try G₁; if fault, try G₂
¬G          -- complement: admit iff G refuses
```

Each gate carries a **failure policy**:

```
FailurePolicy = {fail-open, fail-closed, fail-degrade(δ)}
```

**SeNARS point:** Four gates in series: `Perception ∘ Budget ∘ Action ∘ Reward`. Perception is `fail-closed` at ingress, `fail-open` at cycle. Egress veto is `fail-open`.

**Generalization:**
- **Weighted voting gates:** `Σ wᵢ·Gᵢ(x) > θ → admit`.
- **Temporal gates:** admit only if the last refusal was > τ ago (circuit breaker as algebra).
- **Hierarchical gates:** a gate that invokes a sub-gate-algebra.
- **Parametric failure:** `fail-degrade(δ)` where `δ` is a degradation function, not a boolean.

### 2.4 Budget Lattice `ℬ`

Budgets form a **bounded distributive lattice** under the operations:

```
B₁ ⊓ B₂   -- meet: grant only if both grant (tighter)
B₁ ⊔ B₂   -- join: grant if either grants (looser)
B₁ ⊗ B₂   -- product: independent dimensions
¬B        -- complement: the dual budget
```

Each budget is a tuple:

```
B = (Dimension, Ceiling, ResetPolicy, ExhaustionBehavior)
  Dimension         ∈ {cycles, memoryOps, llmCalls, depth, ...}
  Ceiling           ∈ ℕ ∪ {∞}
  ResetPolicy       ∈ {lifetime, per-cycle, per-run, on-demand}
  ExhaustionBehavior ∈ {halt, degrade, skip, backpressure}
```

**SeNARS point:** Main budget (lifetime, 4 dimensions) ⊗ 6 control scopes (per-cycle, one dimension each). Reset = `beginCycle()`. Exhaustion = `skip` (silent drop).

**Generalization:**
- **Hierarchical budgets:** A tree of budgets where parent exhaustion propagates down.
- **Adaptive ceilings:** Ceiling as a function of observed throughput: `ceiling(t) = f(history)`.
- **Borrowing:** A scope can borrow from a sibling if the sibling is under-utilized.
- **Dual budgets:** A "cost budget" and a "quality budget" in tension.

### 2.5 Strategy Profile `Θ`

A strategy profile is a **section of a fiber bundle**:

```
π: Θ → Slots    (projection: each strategy lives over a slot)
σ: Slots → Θ    (section: a choice of strategy for each slot)
```

Slots form a **set**; strategies for each slot form a **monoid under composition** (strategies can be composed into pipelines). The profile space is:

```
Θ = Π_{slot ∈ Slots} Strategy(slot)
```

**SeNARS point:** 5 slots: `{sampling, premise, derivation, lmRule, attention}`. Each has a finite set of named implementations. Composition is not supported.

**Generalization:**
- **Strategy expressions:** `(priority ∘ novelty) ▹ diverse` — try priority sampling composed with novelty; on failure, fall back to diverse.
- **Parameterized strategies:** `top-n(k)` where `k` is a continuous parameter.
- **Adaptive strategies:** `Θ(t) = argmax_{θ ∈ Θ} R(θ, history(t))` — the strategy is itself a learned function.
- **Strategy morphisms:** A function `f: Strategy(A) → Strategy(B)` that transforms one strategy into another (e.g., "make any strategy anytime-interruptible").

### 2.6 Memory Model `𝓜`

```
𝓜 = (Store, Decay, Capacity, Sampling, Persistence)
  Store       : Term → Truth × Metadata
  Decay       : Truth × Time → Truth
  Capacity    : Bag semantics (bounded, LRU, priority-weighted)
  Sampling    : Memory × Budget → Concept*
  Persistence : {event-log, snapshot, hybrid, none}
```

**SeNARS point:** Bounded priority bags, truth-value decay, event-log + JSON snapshot.

**Generalization:**
- **Graded memory:** Multiple tiers with different decay rates (working / episodic / semantic as a lattice).
- **Probabilistic memory:** Store = probability distribution over terms.
- **Reversible memory:** Every write is invertible (for rollback).

### 2.7 Trust Model `𝒯ᵣ`

Trust is a **monad** on the category of cognitive events:

```
T(A) = A × TrustAnnotation
  TrustAnnotation = (source, quality, provenance, verification)
```

The monad operations:
- `return(a) = (a, ⊤)` — fully trusted
- `bind(T(A), f) = f(a) with trust propagated` — trust flows through computation
- `join(T(T(A)))` — flatten nested trust contexts

**SeNARS point:** Source quality table (`PRIMARY=0.9, …, LLM_PRIOR=0.5`), reputation multiplier, fail-closed ingress. Trust is a scalar.

**Generalization:**
- **Vector trust:** Trust as a vector over multiple dimensions (accuracy, relevance, recency, authority).
- **Algebraic trust:** Trust as an element of a semiring, with `⊕` (aggregate) and `⊗` (propagate).
- **Adversarial trust:** Trust as a game-theoretic value (minimax over possible deceptions).

### 2.8 Failure Policy `𝒫`

A failure policy is a **natural transformation** between the identity functor and the error functor:

```
η: Id → Error
  η(X) = {propagate, swallow, degrade(f), retry(n), escalate}
```

Policies compose:
```
P₁ ⊕ P₂  -- try P₁, then P₂
P₁ ⊗ P₂  -- apply P₁ to the error of P₂
```

**SeNARS point:** Mostly `swallow` (fail-open). Ingress is `fail-closed`. Two unprotected sites (`rlfp.optimize`, `emitCognitiveStateSummary`) propagate.

---

## 3. The Semantic Function

The configuration space `𝒞` is mapped to **behavior** by a semantic function:

```
⟦·⟧: 𝒞 → Coalgebra
```

where a **coalgebra** is a tuple `(State, observe, transition)`:

```
observe   : State → Output      -- what the reasoner produces
transition: State × Input → State  -- how it evolves
```

The semantic function is **compositional**:

```
⟦(c₁ ∘ c₂)⟧  = ⟦c₁⟧ ∘ ⟦c₂⟧     -- sequential composition
⟦(c₁ ∥ c₂)⟧  = ⟦c₁⟧ × ⟦c₂⟧     -- parallel composition
⟦(c | P)⟧    = ⟦c⟧ restricted to P  -- projection
```

This means you can **reason equationally** about reasoner behavior:

```
⟦(reason ∘ authorize)⟧ = ⟦reason⟧ ∘ ⟦authorize⟧
```

---

## 4. SeNARS as a Point

The current SeNARS architecture is the configuration:

```
SeNARS₀ = (
  𝒯₀,     -- 3 loops, serial nesting, one-way invocation
  𝒮₀,     -- 6-stage chain + 8-phase chain, all guards = true
  𝒢₀,     -- 4 gates in series, mixed failure policies
  ℬ₀,     -- lifetime main budget ⊗ 6 per-cycle scopes
  Θ₀,     -- 5 named slots, no composition
  𝓜₀,     -- bounded bags, event-log + snapshot
  𝒯ᵣ₀,   -- scalar trust, source quality table
  𝒫₀      -- mostly fail-open, ingress fail-closed
)
```

This is a **single point** in `𝒞`. The algebra lets us ask: what's the neighborhood of this point? What are the adjacent designs?

---

## 5. Algebraic Operations on Configurations

### 5.1 Restriction `c | P`

Project a configuration onto a subset of its capabilities:

```
SeNARS₀ | {no LM, no tools, no drives}
  = (𝒯₀, 𝒮₀, 𝒢₀, ℬ₀, Θ₀', 𝓜₀, 𝒯ᵣ₀, 𝒫₀)
  where Θ₀' has empty LM slots
```

This models **degradation**: what does SeNARS do without its cortex?

### 5.2 Refinement `c₁ ⊑ c₂`

Configuration `c₁` **refines** `c₂` if every behavior of `c₁` is a behavior of `c₂`:

```
⟦c₁⟧ ⊆ ⟦c₂⟧
```

This is the **substitution principle**: a refined reasoner can replace a general one.

### 5.3 Lifting `lift(c, f)`

Apply a **functor** `f` to every component of a configuration:

```
lift(SeNARS₀, parallelize)
  = a configuration where every serial stage becomes parallel
```

### 5.4 Composition `c₁ ⊗ c₂`

Compose two reasoners into one:

```
SeNARS₀ ⊗ MeTTa = a reasoner with both NAL and exact computation
```

The composition rule determines how they share memory, gates, and budgets.

### 5.5 Abstraction `α(c)`

Map a concrete configuration to its **behavioral equivalence class**:

```
α(c) = {c' | ⟦c'⟧ ≅ ⟦c⟧}
```

Two configurations are equivalent if they produce the same observable behavior, regardless of internal structure.

---

## 6. Invariants as Equational Laws

The algebra is quotiented by **equational laws** that hold across all valid configurations:

| Law | Statement | SeNARS Instance |
|---|---|---|
| **Admission Uniqueness** | `∃! admit : Stage → Memory` | `authorize` is the only write path |
| **Budget Closure** | `∀ scope, charge(scope) ∈ ℬ` | Every `charge()` names a `BudgetScopeId` |
| **Gate Monotonicity** | `G₁ ∘ G₂ ⊑ G₁` | Adding a gate never widens admission |
| **Failure Transparency** | `P(swallow) ∘ observe = observe ∘ P(swallow)` | Swallowed errors don't change observables |
| **Trust Propagation** | `T(f ∘ g) = T(f) ∘ T(g)` | Trust flows through composition |
| **Loop Well-Foundedness** | `∀ℓ, ∃n, ℓⁿ terminates` | No infinite loops without abort |
| **Epistemic Separation** | `Belief ∩ Goal = ∅` | Reward never mutates truth |
| **Provenance Completeness** | `∀ mutation, ∃ event` | Every state change is logged |

These laws define the **valid subspace** `𝒞_valid ⊆ 𝒞`. Any configuration satisfying all laws is a valid reasoner.

---

## 7. The Design Space — Exploring Adjacent Points

### 7.1 SeNARS with Conditional Stages

```
SeNARS₁ = SeNARS₀ with 𝒮₁ where:
  reason → authorize    [guard: derivations.length > 0]
  reason → learn        [guard: derivations.length = 0]
  propose → authorize   [guard: proposals.length > 0]
  propose → learn       [guard: proposals.length = 0]
```

**Effect:** Empty stages are skipped. The cycle is shorter when there's nothing to admit.

### 7.2 SeNARS with Parallel Inference

```
SeNARS₂ = SeNARS₀ with 𝒯₂ where:
  micro invokes {inference₁, inference₂} in parallel
  inference₁ handles belief tasks
  inference₂ handles goal tasks
  authorize joins both
```

**Effect:** Doubles inference throughput. Requires a join gate at `authorize`.

### 7.3 SeNARS with Adaptive Budgets

```
SeNARS₃ = SeNARS₀ with ℬ₃ where:
  ceiling(derivations, t) = min(100, throughput(t) × latency_target)
  ceiling(premises, t)    = f(memory_pressure(t))
```

**Effect:** Budgets adapt to observed throughput. No more "premises exhausted at 64" when the system could handle 200.

### 7.4 SeNARS with Strategy Composition

```
SeNARS₄ = SeNARS₀ with Θ₄ where:
  sampling = priority ∘ novelty    -- try priority, fall back to novelty
  premise  = resolution ▹ bag      -- try resolution, degrade to bag
  derivation = (focused ∥ sampled) -- run both in parallel, merge
```

**Effect:** Strategies are no longer atomic choices but composable pipelines.

### 7.5 SeNARS with Voting Gates

```
SeNARS₅ = SeNARS₀ with 𝒢₅ where:
  admission = Perception ⊕ Budget ⊕ TrustVote
  TrustVote = weighted majority of {source_quality, reputation, manifold}
```

**Effect:** Admission is no longer a single gate's decision but a committee.

### 7.6 SeNARS with Reversible Memory

```
SeNARS₆ = SeNARS₀ with 𝓜₆ where:
  Store is a persistent data structure (every write creates a new version)
  Rollback(version) restores any prior state
```

**Effect:** The system can "undo" reasoning. Useful for self-correction and exploration.

---

## 8. The Control Algebra — Formal Definition

Putting it all together:

**Definition.** The **Control Algebra** `𝔄` is the tuple:

```
𝔄 = (𝒞, ⊗, ⊕, |, ⊑, ⟦·⟧, ℒ)
```

where:
- `𝒞` is the configuration space (Section 2)
- `⊗` is sequential composition
- `⊕` is parallel composition
- `|` is restriction (projection)
- `⊑` is refinement
- `⟦·⟧` is the semantic function
- `ℒ` is the set of equational laws (Section 6)

**Theorem (Compositionality).** For all `c₁, c₂ ∈ 𝒞`:

```
⟦c₁ ⊗ c₂⟧ = ⟦c₁⟧ ∘ ⟦c₂⟧
⟦c₁ ⊕ c₂⟧ = ⟦c₁⟧ × ⟦c₂⟧
⟦c | P⟧    = ⟦c⟧|P
```

**Corollary.** SeNARS is a point: `SeNARS₀ ∈ 𝒞_valid`. Every algebraic operation on `SeNARS₀` produces another valid reasoner (if the result satisfies `ℒ`).

---

## 9. Implications for SeNARS Redesign

If we implement this algebra, several SeNARS fundamentals change:

| Current | Algebraic | Consequence |
|---|---|---|
| 6 hard-coded stages | Stage graph as data | Stages become conditional, parallel, optional |
| `for` loop over steps | Loop as fixpoint | Loops can be nested, parallel, event-driven |
| 4 fixed gates | Gate monoid | Gates compose, vote, degrade |
| 6 fixed budget scopes | Budget lattice | Budgets adapt, borrow, compose |
| 5 named strategy slots | Strategy fiber bundle | Strategies compose, parameterize, adapt |
| Scalar trust | Trust monad | Trust propagates, aggregates, composes |
| `try/catch {}` | Failure natural transformation | Failure policies are algebraic, composable |
| `Agent.setMacroPipeline()` | Restriction `c | P` | Pipeline modification is projection |
| `CognitiveController.adapt()` | Strategy morphism | Adaptation is a structure-preserving map |

The algebra doesn't just describe SeNARS — it **replaces** the hard-coded architecture with a **parameterized framework** where SeNARS is the default evaluation.

---

## 10. Implementation Sketch

The algebra maps to code as:

```typescript
// A configuration is a first-class value
interface ReasonerConfig {
  topology:    TopologyGraph;
  stageGraph:  StageGraph;
  gates:       GateExpression;
  budgets:     BudgetLattice;
  strategies:  StrategyProfile;
  memory:      MemoryModel;
  trust:       TrustModel;
  failure:     FailurePolicy;
}

// Composition is an operation
function compose(c1: ReasonerConfig, c2: ReasonerConfig): ReasonerConfig;
function restrict(c: ReasonerConfig, projection: Projection): ReasonerConfig;
function refine(c: ReasonerConfig, constraint: Invariant): ReasonerConfig;

// Evaluation produces a runnable reasoner
function evaluate(c: ReasonerConfig): Reasoner;

// SeNARS is a constant
const SeNARS: ReasonerConfig = { /* the current architecture */ };

// Exploration
const variant = restrict(
  compose(SeNARS, lift(SeNARS, parallelize)),
  { remove: ['narrate', 'act'] }
);
const reasoner = evaluate(variant);
```

This is the **design space as a programmable object**.

---

## Appendix: Notation

| Symbol | Meaning |
|---|---|
| `𝒞` | Configuration space |
| `𝒞_valid` | Valid configurations (satisfying all laws) |
| `⊗` | Sequential composition |
| `⊕` | Parallel composition |
| `\|` | Restriction / projection |
| `⊑` | Refinement |
| `⟦·⟧` | Semantic function |
| `ℒ` | Equational laws |
| `𝒯` | Topology |
| `𝒮` | Stage graph |
| `𝒢` | Gate algebra |
| `ℬ` | Budget lattice |
| `Θ` | Strategy profile |
| `𝓜` | Memory model |
| `𝒯ᵣ` | Trust model |
| `𝒫` | Failure policy |