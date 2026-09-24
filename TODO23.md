## Analysis of SeNARS12's “System One”

The repository is implementing something substantially closer to a **Jev-style bounded judgment subsystem** than a conventional “System 1 = fast LLM” architecture.

The important distinction is that **System One is not the whole agent**. It is a calibrated decision layer embedded inside a larger event-sourced NARS cognitive kernel. The repository explicitly describes LLMs as *untrusted proposers*, while the kernel remains the source of truth. ([GitHub][1])

---

# 1. The core architecture

The conceptual pipeline is:

```text
                    ┌─────────────────────────────┐
                    │        Raw observation      │
                    │       / natural language    │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │       System One            │
                    │     Judgment Manifold       │
                    │                             │
                    │ shared embedding             │
                    │        +                    │
                    │ many bounded heads           │
                    └──────────────┬──────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
              classify          score             select
              /judge           risk/value        candidate
                  │                │                │
                  └────────────────┼────────────────┘
                                   ▼
                         calibrated proposal
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │       Kernel Gates          │
                    │ perception / action /       │
                    │ reward / budget             │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │        System Two           │
                    │ NAL / symbolic reasoning    │
                    │ event log / state           │
                    └─────────────────────────────┘
```

This is explicitly how the repository describes the division: System One judges what incoming/untrusted proposals mean, while the kernel controls admission into state. ([GitHub][1])

That is a significant design choice.

**Jev-like aspect:** the model is being used primarily for **bounded judgments**, not for generating the final answer or executing arbitrary actions.

---

# 2. The Judgment Manifold is the heart of System One

The repository defines System One as a **calibrated decision layer over a shared embedding space**. ([GitHub][1])

Conceptually:

```text
x = Encoder(text)

                    x
                    │
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
   task_type     ambiguity     injection
       │            │             │
       ▼            ▼             ▼
   classifier     score         score

       ┌────────────┼─────────────┐
       ▼            ▼             ▼
     tense      source_quality    ...
```

Instead of:

```text
LLM(text) → giant answer
```

it does:

```text
embedding(text)
    ↓
multiple small decision heads
    ↓
calibrated probabilities/scores
```

The current documentation describes **17 heads** in four groups, while the README currently refers to **19 heads**, suggesting the repository has evolved slightly faster than the user guide. The documented heads include ingress, action, synthesis, and memory judgments. 

### Ingress heads

```text
task_type
illocution
injection
ambiguity
tense
source_quality
```

### Action heads

```text
tool_dispatch
risk
feasibility
strategy
reflex_value
```

### Synthesis heads

```text
candidate_select
conflict
novelty
groundedness
```

### Memory/other

```text
relevance
episodic_match
```

This is one of the most Jev-like aspects of the implementation: **turn language understanding into a collection of narrow decision problems.**

---

# 3. It goes beyond simple classification

A particularly interesting feature is that the heads aren't all ordinary categorical classifiers.

The repository describes:

* boolean judgments
* categorical judgments
* ordinal/evaluate judgments
* probability-weighted scores
* abstention
* confidence routing
* composite scores
* cascaded judgments

The `plausibility` head is explicitly described as the equivalent of a Jev **Noul**, while `truthProbability()` is described as another Noul-like boolean evaluation. ([GitHub][1])

So the abstraction is approximately:

```text
Noul:
    P(property | input)

Choice:
    P(candidate_i | input)

Score:
    calibrated scalar / distribution
```

This maps remarkably well onto the broader **Choice / Noul / Score** philosophy.

---

# 4. The clever part: one embedding, many judgments

The architecture doesn't appear to require a separate large model invocation for every question.

Instead:

```text
raw input
   │
   ▼
encoder
   │
   ▼
384-dimensional embedding
   │
   ├── task_type head
   ├── ambiguity head
   ├── risk head
   ├── feasibility head
   ├── groundedness head
   ├── candidate selection head
   └── ...
```

The documentation explicitly specifies a 384-dimensional encoder in the example configuration. 

That gives the architecture a useful computational property:

> **The expensive semantic representation can be shared across many cheap decisions.**

This is more sophisticated than simply implementing:

```text
ask LLM:
  "Is this risky?"

ask LLM:
  "Is this ambiguous?"

ask LLM:
  "What type is this?"
```

Instead, it resembles a **multi-head semantic decision engine**.

---

# 5. The ingress pipeline is especially interesting

The raw input path is:

```text
nar.input(...)
      │
      ▼
KernelPerceptionGate
      │
      ├── Tier-0 Narsese heuristic parse
      │
      ├── embedding cache
      │
      └── joint judgeBatch
             │
             ├── task type
             ├── illocution
             ├── injection
             ├── ambiguity
             ├── tense
             └── source quality
```

The repository says the judgments are **actually consumed** by the gate rather than computed and discarded. ([GitHub][1])

For example:

### Ambiguity

```text
ambiguity high
       ↓
abstain
       ↓
generate clarification Question
       ↓
curiosity drive
```

### Tense

```text
tense judgment
      ↓
occurrenceTime
      ↓
attach temporal information to task
```

### Source quality

```text
source_quality
      ↓
truth ceiling
      ↓
admitted belief cannot exceed that ceiling
```

That last mechanism is particularly important because it connects a **System One judgment directly to epistemic state without letting System One become the epistemic authority**.

---

# 6. The cortex ladder is effectively System Two/System One delegation

There are three tiers:

| Tier | Component         | Function                         |
| ---- | ----------------- | -------------------------------- |
| 1    | Judgment Manifold | Fast bounded judgment            |
| 2    | `LMServiceCortex` | Generate candidate Narsese terms |
| 3    | Symbolic stub     | Graceful degradation             |

The second tier uses constrained GBNF generation and then sends generated candidates **back through System One for judgment**. ([GitHub][1])

So:

```text
LLM proposes
     ↓
candidate
     ↓
System One judges candidate
     ↓
kernel validates
     ↓
System Two admits
```

rather than:

```text
LLM says X
     ↓
system believes X
```

That is a strong architectural separation.

---

# 7. The calibration system is arguably the most important part

This repository doesn't merely produce raw neural scores.

It has a pipeline:

```text
                    examples / outcomes
                           │
                           ▼
                   JudgmentDataset
                           │
                           ▼
                ridge / logistic heads
                           │
                           ▼
                   trained weights
                           │
                           ▼
                 isotonic calibration
                           │
                           ▼
                  abstention thresholds
                           │
                           ▼
                 calibration-lock.json
                           │
                           ▼
                    runtime manifold
```

The documentation says the training uses Brier loss and produces digest-pinned artifacts; isotonic calibration then generates abstention thresholds. 

This matters because a raw value such as:

```text
risk = 0.83
```

is not necessarily a meaningful probability.

The system is trying to make:

```text
0.83 ≈ calibrated probability
```

rather than simply:

```text
0.83 = neural network confidence
```

That is exactly the kind of infrastructure required if you want **confidence-gated autonomous behavior**.

---

# 8. Abstention is a first-class output

This is another strong Jev-like property.

The system doesn't force:

```text
input → answer
```

It supports:

```text
input
  ↓
judgment
  ↓
┌───────────────┐
│ high confidence│ → ACT
├───────────────┤
│ medium         │ → REVIEW
├───────────────┤
│ low            │ → BLOCK/ABSTAIN
└───────────────┘
```

The repository calls this `ConfidenceRouter`, with **act/review/block** bands and a monotonicity constraint: the router can only make a decision more restrictive. ([GitHub][1])

This is much closer to a production decision system than ordinary LLM confidence estimates.

---

# 9. The most interesting feature: System One learns from System Two

The repository implements a **distillation flywheel**:

```text
System Two / LM / human
           │
           ▼
       decisions
           │
           ▼
    JudgmentDataset
           │
           ▼
       train heads
           │
           ▼
       calibrate
           │
           ▼
     parity / bake-off
           │
           ▼
      new System One
```

Sources of training labels include:

* corrections
* derivation outcomes
* approvals
* shadow judgments
* clarification pairs
* agent-trace grades
* RL outcomes

The repository explicitly describes this as teacher → student distillation, with the student eventually performing the decision at very low inference cost. ([GitHub][1])

This gives the architecture a potentially powerful lifecycle:

```text
LLM-heavy initially
       ↓
collect judgments
       ↓
train specialized heads
       ↓
fast local System One
       ↓
use LLM only for difficult cases
       ↓
collect more labels
       ↺
```

That is arguably the repository's most ambitious System One mechanism.

---

# 10. It can completely remove NAL from the decision loop

This is important.

The repository explicitly demonstrates:

> `ManifoldRLAgent` uses the Judgment Manifold with **no NAL involved**. ([GitHub][1])

The loop is approximately:

```text
environment
    ↓
state embedding
    ↓
judgeBatch
    ├── reflex_value
    ├── feasibility
    └── risk
    ↓
policy
    ↓
action
    ↓
outcome
    ↓
dataset
```

That means System One isn't merely a helper for the NARS engine.

It is becoming a **general-purpose bounded decision substrate**.

This is a significant distinction.

---

# 11. The reflex architecture is the second System One

There are actually **two different meanings of System 1** in this repository.

### A. Judgment-Manifold System One

```text
semantic input
      ↓
embedding
      ↓
calibrated heads
```

### B. Reflex System One

```text
environment state
      ↓
Reflex
      ↓
action proposal
```

The latter supports tabular Q-learning, ε-greedy, UCB and other pluggable policies. The `Negotiator` arbitrates these proposals against NAL derivations, with NAL retaining veto authority. ([GitHub][1])

So the full architecture is closer to:

```text
                 SYSTEM ONE
        ┌─────────────────────────┐
        │ Judgment Manifold       │
        │ Reflex policies         │
        │ semantic value           │
        └───────────┬─────────────┘
                    │ proposals
                    ▼
              Negotiator
                    │
              NAL veto/control
                    │
                    ▼
             Kernel ActionGate
                    │
                    ▼
               environment
```

This is considerably broader than Jev's basic bounded-choice abstraction.

---

# 12. The security model is unusually strong

A major difference from typical Jev-like implementations is that SeNARS doesn't trust System One merely because it is calibrated.

The repository has four kernel gates:

```text
PerceptionGate
ActionGate
RewardGate
BudgetGate
```

and states that every subsystem must pass through them. ([GitHub][1])

So even if System One produces:

```text
tool_dispatch = delete_database
risk = 0.02
confidence = 0.98
```

that isn't sufficient by itself.

The ActionGate still controls whether that operation is authorized.

This creates:

```text
MODEL JUDGMENT ≠ PERMISSION
```

That's an excellent architectural principle.

---

# 13. Reward cannot rewrite truth

The **epistemic firewall** is another unusually important component.

The repository explicitly prevents rewards from directly changing factual `Truth.frequency` or `Truth.confidence`; rewards can affect policies and attention, but not factual belief. ([GitHub][1])

So:

```text
reward
  │
  ├──→ policy weights       ✓
  ├──→ attention             ✓
  └──→ factual confidence   ✗
```

This prevents a classic reinforcement-learning failure mode:

```text
action rewarded
     ↓
"belief" supporting action strengthened
     ↓
agent becomes increasingly convinced its desired outcome is true
```

The separation of **belief** and **goal** is therefore not merely conceptual; it is encoded into the architecture. ([GitHub][1])

---

# 14. Where it most resembles Jev

I'd map the functionality this way:

| Jev/System One concept   | SeNARS implementation                                      |
| ------------------------ | ---------------------------------------------------------- |
| **Noul**                 | `plausibility`, `truthProbability`, boolean heads          |
| **Choice**               | `candidate_select`, `tool_dispatch`, strategy/action heads |
| **Score**                | risk, feasibility, reflex value, relevance, etc.           |
| **Bounded decision**     | individual manifold heads                                  |
| **Confidence**           | calibrated head distributions                              |
| **Abstention**           | per-head abstain thresholds                                |
| **Decision composition** | `ConfidenceRouter`, `compositeScore`, `judgeCascade`       |
| **Fast inference**       | cached embedding + small heads                             |
| **Teacher → student**    | distillation flywheel                                      |
| **System Two fallback**  | LM cortex + NAL                                            |
| **Safety boundary**      | Kernel Gates                                               |
| **Action authorization** | ActionGate                                                 |
| **Learning**             | JudgmentDataset + RL/distillation                          |
| **Auditability**         | event sourcing + provenance                                |

The repository even explicitly labels `plausibility` as **“Jev Noul”** and supports a TypeSafe-compatible remote `/v1/systemone` protocol. ([GitHub][1])

---

# 15. Where it goes beyond Jev

The interesting part is that SeNARS is **not merely cloning Jev**.

It adds a substantial cognitive architecture around the decision layer:

```text
                     SeNARS
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   System One       NAL System Two    Memory
       │               │                │
  Manifold          deduction        episodic
  Reflexes          induction        semantic
  Distillation     abduction         working
       │               │                │
       └───────────────┼────────────────┘
                       │
                 Kernel Gates
                       │
                  Event Log
```

In other words:

**Jev-like layer:** *What should I judge?*

**SeNARS:** *How do I integrate those judgments into a persistent, bounded, provenance-preserving cognitive machine?*

---

# 16. The most novel technique: shared semantic substrate + heterogeneous heads

I think this is the architectural idea worth extracting from the repository.

Instead of training:

```text
one model → one task
```

or:

```text
one LLM → arbitrary reasoning
```

it builds:

```text
                 shared representation
                         │
       ┌─────────┬───────┼───────┬─────────┐
       ▼         ▼       ▼       ▼         ▼
    classify   Noul    score   rank      policy
       │         │       │       │         │
       └─────────┴───────┴───────┴─────────┘
                         │
                    calibration
                         │
                     abstention
                         │
                    policy gates
```

This means a single semantic representation can support an entire **decision ontology**.

That is much more scalable than adding another prompt for every new judgment.

---

# 17. The main technical weaknesses / questions

There are several things I would scrutinize before calling this a mature System One implementation.

### 1. Calibration quality

The architecture depends heavily on calibrated probabilities.

If:

```text
risk = 0.90
```

isn't actually close to a 90% event probability, then the safety thresholds are misleading.

The repository recognizes this and requires calibration before heads become gating authorities. 

The important benchmark is therefore not classification accuracy.

It is:

**calibration + abstention quality under distribution shift.**

---

### 2. Shared-encoder failure correlation

Multiple heads share the same embedding.

That is computationally efficient, but it means:

```text
encoder mistake
       ↓
risk mistake
       +
feasibility mistake
       +
groundedness mistake
       +
candidate mistake
```

could all occur simultaneously.

The heads may look independent while actually sharing a common failure mode.

This is probably the biggest architectural issue I'd investigate experimentally.

---

### 3. “One joint judgeBatch” creates correlated decisions

The system advertises one batched judgment for several dimensions. ([GitHub][1])

That is efficient, but it raises an important question:

> Are the heads statistically independent enough for their outputs to be safely composed?

For example:

```text
risk = .15
feasibility = .95
groundedness = .93
```

doesn't necessarily imply:

```text
safe-to-execute = high
```

unless the composition rule has been empirically validated.

---

### 4. The decision space must remain well specified

Jev works particularly well when:

```text
choose(A | B | C | D)
```

is well defined.

SeNARS pushes this toward:

```text
candidate_select
strategy
tool_dispatch
```

The difficult question becomes:

**Who constructs the candidate space?**

If an LLM constructs the action set, System One can make a very confident choice among an incomplete set.

That is a fundamentally different failure mode from selecting the wrong candidate.

---

### 5. Distillation can freeze teacher errors

The flywheel is:

```text
teacher
 → dataset
 → student
 → student becomes teacher-ish
 → more dataset
```

This can create self-reinforcement.

The repository mitigates this through bake-off/parity gates, calibration and multiple label sources, but I would want explicit **independent evaluation data** that never enters the distillation loop. ([GitHub][1])

---

# 18. My overall architectural reading

The cleanest description of what `senars12` is building is:

> **A bounded cognitive operating system in which System One is a learned, calibrated semantic decision fabric and System Two is a provenance-preserving symbolic reasoning kernel.**

The System One layer itself is approximately:

```text
             semantic state
                   │
                   ▼
             shared encoder
                   │
          ┌────────┴────────┐
          │                 │
    judgment heads      reflex heads
          │                 │
          ▼                 ▼
   calibrated scores    action/value
          │                 │
          └────────┬────────┘
                   ▼
          confidence / risk
                   │
                   ▼
             kernel gates
                   │
                   ▼
             trusted state
```

And the most Jev-like innovation is **not simply “use a small model.”**

It is:

> **Convert general intelligence into a collection of explicit, typed, calibrated decisions, then make ordinary deterministic software responsible for composing and enforcing those decisions.**

That is exactly the direction in which the repository's `Judgment Manifold`, `ConfidenceRouter`, `judgeCascade`, `plausibility`/Noul heads, distillation loop, and System-One-compatible HTTP interface point. ([GitHub][1])

### Bottom line

**SeNARS12's System One is best understood as a Jev-like *decision substrate*, not a Jev clone.**

Its distinctive stack is:

```text
Jev-like bounded judgments
        +
shared embedding manifold
        +
multi-head ontology
        +
probability calibration
        +
abstention
        +
distillation
        +
reflex/RL integration
        +
symbolic veto
        +
event-sourced governance
```

The most technically interesting piece to investigate next is the actual implementation of **`JudgmentManifold` + `HEAD_SPECS` + `judgeBatch` + `ConfidenceRouter`**, because that will reveal whether the architecture is merely *conceptually* Jev-like or whether its runtime semantics genuinely reproduce the useful properties of System One.

----

Based on the current `senars12` architecture, I would **not** refactor the project by adding more System One heads or more cognitive subsystems first. The highest-impact work is to make the existing decision substrate **more compositional, causally measurable, and hard to misuse**.

The repository already has a strong foundation: a declarative `HEAD_SPECS` registry, one batched manifold evaluation, calibration locks, confidence routing, digest-pinned weights, event-sourced gates, and a teacher→student loop. 

## My priority order

| Priority | Refactoring                                                       |      Impact | Main payoff                                          |
| -------- | ----------------------------------------------------------------- | ----------: | ---------------------------------------------------- |
| **P0**   | **Turn System One into a typed Decision Graph**                   |   Very high | Eliminates implicit head composition                 |
| **P0**   | **Separate evidence, judgment, policy, and action**               |   Very high | Prevents calibrated scores becoming hidden authority |
| **P0**   | **Make calibration/evaluation first-class artifacts**             |   Very high | Makes System One scientifically measurable           |
| **P1**   | **Introduce candidate-set semantics for Choice heads**            |        High | Makes the Jev-like layer much more powerful          |
| **P1**   | **Build a cascaded compute budget**                               |        High | Makes System One genuinely fast/cheap                |
| **P1**   | **Decouple distillation from deployment**                         |        High | Prevents self-reinforcing model errors               |
| **P2**   | **Unify RL/reflex and semantic judgments under one decision API** | Medium-high | Removes architectural duplication                    |
| **P2**   | **Make provenance a property of every judgment**                  | Medium-high | Auditable decisions rather than just auditable state |

---

# 1. P0 — Refactor System One into a **Decision Graph**

This is the biggest architectural opportunity.

Today the repository has a very good collection of primitives:

```text
HEAD_SPECS
judgeBatch
truthProbability
ConfidenceRouter
compositeScore
judgeCascade
wake gate
```

but they are still conceptually a **toolbox of functions**. The README describes all of these as separate utilities. 

I would make the central abstraction:

```ts
DecisionGraph
```

with nodes such as:

```text
Input
  │
  ▼
Embedding
  │
  ├── injection ────────┐
  ├── ambiguity ────────┤
  ├── source_quality ───┤
  │                     ▼
  │                Policy node
  │                     │
  └── task_type ────────┤
                        ▼
                    Decision
                        │
               ┌────────┴────────┐
               ▼                 ▼
             act              abstain
```

Each node should explicitly declare:

```ts
type DecisionNode = {
  id: string
  input: Schema
  output: DecisionType
  dependsOn: NodeId[]
  calibration: CalibrationRef
  cost: CostModel
  policy: PolicyRef
}
```

### Why this matters

It lets the system answer:

> **Why did this decision happen?**

not merely:

> Which heads fired?

You can then inspect:

```text
action.execute
 ├─ candidate_select = 0.91
 │   ├─ feasibility = 0.94
 │   └─ risk = 0.08
 ├─ groundedness = 0.87
 └─ policy threshold = PASS
```

That becomes the native representation of a Jev-like workflow.

---

# 2. P0 — Hard-separate **Evidence → Judgment → Policy → Action**

The existing architecture already strongly separates untrusted proposers from the kernel. The four gates enforce this boundary. ([GitHub][1])

I would take it one level further.

Currently the conceptual flow is roughly:

```text
observation
 → manifold judgment
 → gate
 → state/action
```

Refactor it to:

```text
Evidence
   ↓
Judgment
   ↓
Policy
   ↓
Authorization
   ↓
Action
```

These should be **different types**.

For example:

```ts
Evidence<Source>
Judgment<HeadId>
PolicyDecision<PolicyId>
Authorization<Capability>
ActionRequest<ActionId>
```

So this becomes impossible:

```ts
riskScore → executeTool()
```

without passing through policy and authorization.

### Why

A calibrated probability is **evidence**, not permission.

This principle should be structurally enforced rather than merely conventionally followed.

The repository already has the right philosophy through `ActionGate`, `RewardGate`, and the epistemic firewall. ([GitHub][1])

This refactoring would make that philosophy much harder to accidentally violate.

---

# 3. P0 — Make calibration a first-class model artifact

This is probably the most important scientific refactoring.

The current pipeline is already excellent:

```text
training
 ↓
Brier loss
 ↓
weights
 ↓
isotonic calibration
 ↓
calibration-lock
 ↓
sandboxed deployment
```



But I would turn the entire thing into a versioned:

```text
DecisionModelArtifact
```

containing:

```text
encoder digest
head weights
head specification
training dataset digest
calibration dataset digest
calibrator
abstention thresholds
evaluation metrics
OOD metrics
schema version
software version
```

Something like:

```json
{
  "model": "...",
  "encoder": "...",
  "head": "risk",
  "trainingData": "...",
  "calibrationData": "...",
  "calibration": {
    "ece": 0.041,
    "brier": 0.083,
    "abstain": 0.71
  },
  "ood": {
    "ece": 0.12
  }
}
```

Then **deployment requires an artifact, not merely weights**.

This is especially important because the current architecture explicitly depends on calibration and abstention thresholds. 

---

# 4. P1 — Give Choice heads explicit candidate-set semantics

This is where I would push SeNARS substantially further toward the Jev model.

The repository has already solved an important problem: classification heads can judge over the **query's declared space** rather than incorrectly forcing everything into `task_type`. 

Generalize that.

Instead of:

```ts
judge("candidate_select", embedding)
```

use:

```ts
choose({
  context,
  candidates: [
    candidateA,
    candidateB,
    candidateC
  ]
})
```

The result should be:

```ts
{
  selected: candidateB,
  distribution: {
    A: 0.07,
    B: 0.81,
    C: 0.12
  },
  abstain: false
}
```

Now the system can natively express:

```text
Which tool?
Which action?
Which interpretation?
Which memory?
Which strategy?
Which model?
Which plan?
Which candidate formalization?
```

This is the point where the manifold becomes a **general decision engine**, rather than a collection of classifiers.

---

# 5. P1 — Replace “run all heads” with a **cost-aware cascade**

The current design emphasizes one joint `judgeBatch`, which is excellent for amortizing the embedding computation. 

But not every decision needs every head.

I would introduce:

```text
Level 0 — deterministic
Level 1 — cheap heads
Level 2 — expensive heads
Level 3 — LM
Level 4 — System Two / human
```

Example:

```text
incoming request
      │
      ▼
cheap embedding
      │
      ├── injection ── high → BLOCK
      │
      ├── ambiguity ── high → CLARIFY
      │
      └── ordinary
             │
             ▼
       task_type + risk
             │
       confidence?
        /          \
      yes           no
      │              │
      ▼              ▼
    route        expensive heads
                     │
                     ▼
                    LM
```

The repository already has `judgeCascade` and a cortex ladder, so this is an architectural consolidation rather than a new subsystem. 

The objective should become:

> **Minimum computation required to cross the decision boundary.**

not:

> Maximum number of judgments per request.

---

# 6. P1 — Separate **distillation data collection** from **model promotion**

The current flywheel is:

```text
experience
 ↓
JudgmentDataset
 ↓
train
 ↓
calibrate
 ↓
bake-off
 ↓
governed swap
```

which is good. 

But I'd explicitly create three datasets:

```text
Experience
   ↓
┌───────────────┐
│ Raw candidates│
└───────┬───────┘
        │
        ├── Training set
        ├── Calibration set
        └── Frozen evaluation set
```

The frozen set must **never** enter the distillation loop.

Otherwise:

```text
teacher
 → student
 → student
 → student
```

can gradually optimize toward its own inherited errors.

The promotion rule should therefore be:

```text
candidate model
      ↓
calibration
      ↓
frozen benchmark
      ↓
OOD benchmark
      ↓
regression comparison
      ↓
human approval
      ↓
promote
```

---

# 7. P2 — Unify reflex/RL with semantic DecisionGraph

This is currently an architectural seam.

The repository says `ManifoldRLAgent` already uses:

```text
reflex_value
feasibility
risk
```

through a joint `judgeBatch`, with no NAL involved. 

That is strong evidence that the abstraction should become:

```text
DecisionGraph
```

rather than:

```text
SystemOne
RL
```

as separate conceptual systems.

Then:

```text
Semantic agent:
  DecisionGraph → action

RL agent:
  DecisionGraph → action

Tool router:
  DecisionGraph → tool

Model router:
  DecisionGraph → model

Memory:
  DecisionGraph → recall

Safety:
  DecisionGraph → allow/block
```

Same substrate, different policies.

That would make the manifold genuinely **general-purpose**.

---

# 8. P2 — Make provenance intrinsic to every judgment

The kernel already has excellent event sourcing and derivation provenance. ([GitHub][1])

Extend the same principle to System One.

Every judgment should carry:

```ts
type Judgment<T> = {
  value: T
  probability: Distribution
  calibrated: boolean

  modelDigest: string
  encoderDigest: string
  calibrationDigest: string

  inputDigest: string
  candidateSetDigest?: string

  timestamp: number
  decisionGraphNode: string

  abstained: boolean
}
```

Then an action can be traced:

```text
ACTION
  ↓
policy decision
  ↓
risk judgment #a81f
  ↓
model digest X
  ↓
calibration lock Y
  ↓
embedding digest Z
  ↓
input evidence
```

This would make the existing event-sourced architecture and System One architecture converge instead of merely coexisting.

---

# What I would **not** refactor yet

These are tempting but lower-value right now:

### ❌ Add more heads

19 heads are already enough to validate the architecture. The README has deliberately centralized them through `HEAD_SPECS`. 

The next gain comes from **composition**, not head count.

### ❌ Replace the encoder immediately

The shared embedding architecture is currently the right abstraction. First establish head-level calibration and OOD failure characteristics.

### ❌ Merge NAL and System One

Keep them separate.

The repository's strongest architectural property is precisely:

```text
System One proposes/judges
        ↓
System Two verifies/reasons
        ↓
Kernel authorizes
```

([GitHub][1])

### ❌ Build a giant unified “brain” abstraction

That would destroy the useful boundaries already present.

---

# The refactoring I would actually implement

I'd make the next architecture look like this:

```text
                         INPUT
                           │
                           ▼
                    ┌──────────────┐
                    │ EvidenceBus  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ EncoderCache │
                    └──────┬───────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │   DecisionGraph    │
                 │                    │
                 │  Noul              │
                 │  Choice            │
                 │  Score             │
                 │  Rank              │
                 │  Cascade           │
                 └─────────┬──────────┘
                           │
                 ┌─────────┴──────────┐
                 ▼                    ▼
             Confidence           Policy
               Router              Engine
                 │                    │
                 └─────────┬──────────┘
                           ▼
                    Authorization
                           │
                           ▼
                       ActionGate
                           │
                           ▼
                        ACTION
                           │
                           ▼
                     EVENT LOG
                           │
                           ├────→ training dataset
                           │
                           └────→ evaluation
                                      │
                               ┌──────┴──────┐
                               ▼             ▼
                          calibration    frozen eval
                               │             │
                               └──────┬──────┘
                                      ▼
                              Model promotion
```

## The resulting package boundaries

I would aim for:

```text
@senars/decision
    DecisionGraph
    Noul
    Choice
    Score
    Cascade
    DecisionContext

@senars/calibration
    Calibrator
    CalibrationArtifact
    CalibrationRegistry
    OODMonitor

@senars/system-one
    JudgmentManifold
    EmbeddingCache
    HeadRegistry
    ModelArtifact

@senars/policy
    ConfidenceRouter
    PolicyEngine
    Authorization

@senars/provenance
    JudgmentTrace
    DecisionTrace

@senars/rl
    ManifoldRLAgent
    ReflexPolicy
```

The critical point is that **System One becomes an implementation of the decision substrate rather than the owner of the decision abstraction**.

---

## Recommended implementation sequence

### Phase 1 — **DecisionGraph + typed judgments**

Do this first.

Refactor:

```text
HEAD_SPECS
judgeBatch
truthProbability
compositeScore
judgeCascade
ConfidenceRouter
```

behind a single typed decision API.

**Do not change model behavior.**

That makes this a relatively safe architectural refactor.

### Phase 2 — **Evidence/Judgment/Policy/Action types**

Make illegal transitions impossible:

```text
Judgment → Action
```

should not compile.

Instead:

```text
Judgment → PolicyDecision → Authorization → Action
```

### Phase 3 — **CalibrationArtifact**

Move weights + calibration + thresholds + digests into one immutable artifact.

### Phase 4 — **Choice semantics**

Introduce explicit candidate sets.

This is the step that most strongly upgrades the Jev-like functionality.

### Phase 5 — **Cost-aware cascades**

Only compute the decisions needed to resolve uncertainty.

### Phase 6 — **Frozen evaluation + promotion**

Make self-improvement statistically trustworthy before increasing autonomy.

### Phase 7 — **Unify RL/reflex**

Move RL and semantic routing onto the same DecisionGraph API.

---

## The key architectural shift

I would make this the project's north-star invariant:

> **Models produce judgments. Policies compose judgments. The kernel authorizes actions. No layer may silently assume the authority of the next layer.**

SeNARS already has most of the ingredients for this: calibrated heads, explicit gates, digest binding, event sourcing, abstention, and distillation. ([GitHub][1])

The refactoring opportunity is to **turn those ingredients into one explicit decision architecture** rather than a set of increasingly sophisticated System One utilities.

That would give you a cleaner foundation for the next generation of **Jev-like Choice/Noul/Score workflows**, while preserving the strongest existing SeNARS property: the learned layer can become faster and smarter without becoming the authority over system state.
