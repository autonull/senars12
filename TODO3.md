# SeNARS12 Architecture Specification: The Focus-Game-Reflex Kernel

**Status:** Active Architectural RFC  
**Supersedes:** All prior RL-adapter and self-modification pipelines  
**Core Principle:** *Cognitive competence and attentional isolation must be proven before autonomous self-modification
is permitted.*

---

## 1. Executive Summary

SeNARS12 is not an RL agent with a symbolic bolt-on, nor is it a symbolic engine with an RL test harness. It is an
**AIKR-bounded cognitive kernel** built on five symmetrical primitives.

By adopting a unified generic `Bag` container and strict one-word NARchy terminology, the architecture achieves profound
elegance: **The system plays `Game`s inside isolated `Focus`es, schedules them via a system-wide `Bag<Focus>`,
accelerates behavior with `Reflex`es, arbitrates action through NAL, and governs itself through `MetaGame`s.**

This specification defines the exact contracts, boundaries, and execution loops required to complete **Milestone 3.5 (
Cognitive Grounding)**, which serves as the mandatory gate before any further autonomous self-modification (M4).

---

## 2. The Core Primitives (The NARchy Synthesis)

The entire cognitive architecture is constructed from a single generic container and four domain entities.

### 2.1 The Generic `Bag<T>` (Universal Container)

The `Bag` is a priority-based, capacity-bounded, probabilistic queue that enforces the Assumption of Insufficient
Knowledge and Resources (AIKR). It is parameterized by `BagItem`.

```typescript
export interface BagItem {
  id: string;
  priority: number; // Context-dependent: Urgency (Task), Weight (Focus), Activation (Concept)
}

export interface BagOptions {
  capacity: number;
  decayRate?: number;
  forgetRate?: number;
}

export interface Bag<T extends BagItem> {
  readonly capacity: number;
  add(item: T): void;
  sample(): T | undefined;      // Probabilistic selection based on priority
  remove(id: string): void;
  decay(): void;                // AIKR temporal forgetting / priority decay
  size(): number;
  all(): IterableIterator<T>;
}
```

**The Symmetry of Attention:**

* `Bag<Concept>`: Semantic Memory (priority = activation level).
* `Bag<Task>`: Local Reasoning Queue inside a Focus (priority = urgency/budget).
* `Bag<Focus>`: System-wide Attention Economy (priority = focus weight).

### 2.2 `Task` (The Unit of Thought)

A Narsese term, a truth-value/budget, and a punctuation (`.` belief, `!` goal, `?` question). Tasks are the *only*
entities that flow through the reasoning engine.

### 2.3 `Focus` (The Vessel of Thought)

A bounded cognitive container that isolates unrelated reasoning. A GridWorld Focus must not be polluted by MetaGame
tasks.

* Contains a local `Bag<Task>`.
* Contains a local `Bag<Concept>` (or a strictly scoped view of global memory).
* Has a `weight` (which serves as its `priority` in the system `Bag<Focus>`).

### 2.4 `Game` (The Environment)

Any closed-loop interaction. A `Game` does not know about NAR; it only provides perception and accepts actions.

* *External:* GridWorld, Bandits, Chat, DevOps.
* *Internal:* `MetaGame` (environment = cognitive state), `SelfMetaGame` (environment = `Bag<Focus>` and system knobs).

### 2.5 `Reflex` (The Accelerator)

A pluggable, fast policy/value engine (e.g., Q-learning, UCB, DQN, heuristics). A `Reflex` *proposes* goals; it does not
execute them. Execution requires negotiation and dispatch.

---

## 3. Canonical Entities & Interfaces

### 3.1 `Game`

```typescript
export interface Perception {
  stateId: string;
  features?: Record<string, number>;
  confidence?: number; // Maps to NAL truth confidence
  terminal?: boolean;
}

export interface GameOutcome {
  reward: number;
  terminal: boolean;
  info?: Record<string, unknown>;
}

export interface Game<S = unknown, A = unknown> {
  readonly id: string;
  observe(): Perception;
  state(): S;
  legalActions(state: S): A[];
  step(action: A): GameOutcome;
}
```

### 3.2 `Focus`

```typescript
export interface Focus extends BagItem {
  // 'priority' inherited from BagItem acts as the Focus 'weight'
  readonly tasks: Bag<Task>;
  readonly memory: Bag<Concept>; 
  
  step(budget: number): Promise<FocusStepReport>;
  setWeight(weight: number): void;
}
```

### 3.3 `Reflex`

```typescript
export interface ActionProposal {
  action: string;
  args?: Record<string, unknown>;
  value: number;       // Expected utility [0, 1]
  confidence: number;  // Certainty in the proposal [0, 1]
  source: string;      // e.g., 'tabular-q', 'nal-derivation'
}

export interface LearningEvent {
  perception: Perception;
  actionProposed: string;
  actionExecuted: string | null; // null if vetoed/overridden
  reward: number;
  terminal: boolean;
  overriddenBy: string | null;   // e.g., 'nal-veto', 'drive-override'
}

export interface Reflex<S = unknown, A = unknown> {
  readonly id: string;
  propose(state: S, legalActions: A[]): ActionProposal[];
  learn(event: LearningEvent): void;
}
```

---

## 4. The Gates (Boundary Contracts)

To prevent architectural bypasses, all interactions between a `Game` and a `Focus` must pass through strict Gates.

### 4.1 `PerceptionGate`

Observations enter *only* as beliefs. Sensor confidence maps to NAL truth confidence.

```narsese
(state:s_3_4 --> observed). %1.00;0.95%
(feature:wall_north --> present). %1.00;0.45% // Noisy sensor
```

### 4.2 `ActionGate`

Actions leave *only* as native AST operation goals.

```typescript
// Internal AST representation mandatory:
Inheritance(Product(...args), Atom('^move_to'))
```

No action may occur without a goal passing through the standard dispatch path.

### 4.3 `RewardGate`

Rewards enter as belief revisions or goal satisfaction signals.

```narsese
((*, state:s_3_4, ^move_north) --> predicts_reward). %0.78;0.62%
```

---

## 5. Negotiation: Reflex vs. NAL

The Negotiator is where System 1 (Reflex) and System 2 (NAL) meet.

1. **Proposal:** The `TabularReflex` proposes `^move_north` with `value=0.82, confidence=0.60`.
2. **Derivation:** NAL derives `(^move_north ==> trap). %1.0; 0.95%` from symbolic memory.
3. **Arbitration:** The `Negotiator` applies NAL's Choice/Revision rules or a pluggable scoring function. NAL's
   high-confidence symbolic veto overrides the Reflex.
4. **Feedback:** The `TabularReflex` receives a `LearningEvent` where `actionExecuted = null` and
   `overriddenBy = 'nal-veto'`. **Crucially, the Reflex does not update its Q-values for `^move_north` based on the
   subsequent reward, because it did not actually take the action.**

---

## 6. Meta-Cognition: `MetaGame` & `SelfMetaGame`

A `MetaGame` is a `Game` whose environment is the cognitive system itself.

The `SelfMetaGame` runs in an isolated `MetaFocus`. It observes aggregate `FocusStepReport`s and system drives. It
proposes actions to tune the cognitive kernel:

```narsese
^focus_weight(focus:gridworld, 0.85)!
^knob_set(maxDerivationsPerStep, 800)!
^reflex_disable(gridworld_tabular_q)!
```

**Safety Constraint for M3.5:** The `SelfMetaGame` is permitted to adjust `Bag<Focus>` weights, derivation budgets, and
Reflex hyperparameters. It is **strictly forbidden** from executing code-modifying tools (shadow worktrees, codemods)
until M3.5 is fully passed.

---

## 7. The Unified Execution Loop

The entire SeNARS12 cycle collapses into one elegant, attentionally partitioned loop:

```typescript
while (running) {
  // 1. ATTENTION: System Bag samples a Focus based on weight/priority
  const focus = systemFocusBag.sample(); 
  const budget = allocateBudget(focus);
  
  // 2. PERCEPTION: Bound Games inject observations into the Focus
  for (const game of gamesBoundTo(focus)) {
    const perception = game.observe();
    focus.tasks.addAll(perceptionGate.toBeliefs(perception));
  }
  
  // 3. PROPOSAL: Reflexes inject goals into the Focus
  for (const reflex of reflexesBoundTo(focus)) {
    const proposals = reflex.propose(game.state(), game.legalActions());
    focus.tasks.addAll(actionGate.toGoals(proposals));
  }
  
  // 4. REASONING & NEGOTIATION: Process Tasks, resolve conflicts
  const decision = negotiator.resolve(focus.tasks, nalDerivations);
  
  // 5. EXECUTION: Dispatch the winning Goal
  if (decision.action) {
    const outcome = game.step(decision.action);
    focus.tasks.addAll(rewardGate.toBeliefs(outcome));
    
    // 6. LEARNING: Reflexes update based on actual execution (or veto)
    for (const reflex of reflexesBoundTo(focus)) {
      reflex.learn({ ...outcome, overriddenBy: decision.vetoedBy });
    }
  }
  
  // 7. AIKR: Decay priorities, enforce capacity limits
  focus.tasks.decay();
  systemFocusBag.decay();
}
```

---

## 8. Validation Strategy (M3.5 Gates)

M3.5 is no longer just "RL parity." It is the validation of the Focus-Game-Reflex kernel.

| Gate  | Name                    | Objective                                                                                          | Definition of Done                                 |
|:------|:------------------------|:---------------------------------------------------------------------------------------------------|:---------------------------------------------------|
| **0** | **Focus Contract**      | Prove isolation. Tasks in Focus A do not affect Focus B.                                           | `tests/nar/focus/contract` passes.                 |
| **1** | **FocusBag Contract**   | Prove attention allocation. Weights dictate budget shares.                                         | `tests/nar/focus/bag` passes.                      |
| **2** | **Boundary Contract**   | Prove Gates. Perception=beliefs, Action=goals, no bypasses.                                        | `tests/nar/rl/contract` passes.                    |
| **3** | **Reflex Parity**       | Prove a `TabularReflex` inside a `GameFocus` matches direct RL.                                    | Return $\ge$ 95% of baseline.                      |
| **4** | **Negotiated Parity**   | Prove NAL can veto Reflexes without destroying baseline competence.                                | Overrides are traceable; safe behavior maintained. |
| **5** | **MetaGame Sandbox**    | Prove `SelfMetaGame` can safely adjust `Bag<Focus>` weights.                                       | `^focus_weight` executes and alters allocation.    |
| **6** | **Cognitive Advantage** | Prove properties impossible for pure tabular RL (e.g., symbolic override, contradiction handling). | Demonstrated in stress tests.                      |

### Mandatory Defect Audit

Before declaring a "cognitive limitation" (Hard Falsification), the system must pass a 19-point audit verifying that
observations reached memory, truth values were preserved, ASTs were correct, and no hidden bypasses existed.

---

## 9. Implementation Slices

To avoid architectural overwhelm, implementation proceeds in thin, verifiable slices.

### Slice 1: The Generic Kernel

* Implement `Bag<T>`.
* Implement `Focus` (containing `Bag<Task>`).
* Implement System `Bag<Focus>`.
* *Test:* Focus isolation and Bag allocation math.

### Slice 2: GameFocus & Gates

* Implement `PerceptionGate`, `ActionGate`, `RewardGate`.
* Wrap existing `BanditEnv` and `GridWorldEnv` as `Game`s.
* *Test:* Boundary contracts (no-bypass tests).

### Slice 3: Reflex Mounting

* Implement `Reflex` interface.
* Port existing baselines to `EpsilonGreedyReflex`, `TabularQReflex`, `UCBReflex`.
* *Test:* Gate 3 (Reflex Parity).

### Slice 4: The Negotiator

* Implement `NegotiationPolicy`.
* Wire NAL derivations to veto/override Reflex proposals.
* Implement `LearningEvent` feedback for overridden actions.
* *Test:* Gate 4 (Negotiated Parity).

### Slice 5: SelfMetaGame Sandbox

* Implement `MetaGame` observing `FocusStepReport`s.
* Implement `^focus_weight` and `^knob_set` operations.
* *Test:* Gate 5 (MetaGame Sandbox).

---

## 10. File Layout

```text
nar/src/
  bag/
    Bag.ts                 # Generic AIKR priority queue
  focus/
    Focus.ts               # Vessel implementation
    FocusBag.ts            # System-wide Bag<Focus> allocator
    GameFocus.ts           # Binds Game + Focus + Gates
    MetaFocus.ts           # SelfMetaGame vessel
  gates/
    PerceptionGate.ts
    ActionGate.ts
    RewardGate.ts
  reflex/
    Reflex.ts              # Interface
    Negotiator.ts          # Arbitration logic
  game/
    Game.ts                # Interface
    MetaGame.ts            # Cognitive state environment

tests/nar/
  focus/
    contract/              # Gate 0 & 1
  rl/
    contract/              # Gate 2
    reflexes/              # TabularQ, UCB, etc.
    parity/                # Gate 3 & 4
  meta/
    sandbox/               # Gate 5
```

---

## 11. Observability & Safety

### The FocusBag Report

Every cycle emits a structured JSON report detailing the attention economy:

```json
{
  "cycle": 128,
  "allocations": [
    { "focusId": "gridworld", "weight": 0.85, "budget": 720, "derivations": 142 },
    { "focusId": "self-meta", "weight": 0.15, "budget": 80, "derivations": 12 }
  ],
  "negotiations": [
    { "focus": "gridworld", "reflex": "tabular-q", "proposed": "^move_north", "executed": "^move_east", "vetoed_by": "nal-trap-belief" }
  ]
}
```

### The M3.5 Freeze Rule

During M3.5 validation:

1. **No autonomous code modification.** (Shadow worktrees are disabled).
2. **No schema promotion to production rules.**
3. **No LLM-generated control actions.** (`enableLMRules: false` for parity tests).
4. **The SelfMetaGame may only adjust bounded numerical knobs and Focus weights.**

---

## 12. Definition of Architectural Success

The SeNARS12 Focus-Game-Reflex architecture is successful when:

1. A `Game` can be played inside a `Focus`.
2. Multiple `Focus`es coexist in a `Bag<Focus>` without conceptual contamination.
3. A `Reflex` accelerates action selection, but NAL retains absolute veto power.
4. A `MetaGame` can observe the system and safely reallocate the `Bag<Focus>` attention economy.
5. Every consequential action has a mathematically sound, traceable causal chain from perception to execution.
6. **The architecture requires zero bespoke pipelines for new capabilities; everything is just a new `Game`, `Reflex`,
   or `Focus`.**

> **Establish cognitive competence and attentional isolation first. Only then trust the system to modify its own code.**

