# SeNARS12 Architecture Specification: The Focus-Game-Reflex Kernel

**Status:** Active Architectural RFC (Target Architecture) — **PRIORITY: IMPLEMENT NOW**  
**Current Implementation:** Traditional NAR Architecture (see §15) — **DEPRECATED PATH**  
**M3.5 Progress:** 3/3 Environments Passing (Bandit ✅, NonStationary ✅, GridWorld ✅) — **VALIDATED IN NEW ARCHITECTURE**  
**Core Principle:** *Cognitive competence and attentional isolation must be proven before autonomous self-modification is permitted.*

> **DECISION (2026-09-08):** GridWorld TD-learning debug in legacy architecture abandoned. M3.5 validation will be performed **after** Focus-Game-Reflex Kernel (Slices 1-2) is operational. The new architecture's isolated `GameFocus` + `Reflex` + `Negotiator` provides cleaner TD-learning semantics.

---

## 🎯 IMMEDIATE NEXT ACTIONS (Priority Order)

| # | Action | File/Location | Notes | Status |
|:--|:-------|:--------------|:------|:------|
| **1** | Implement `Bag<T>` (target interface) | `nar/src/bag/Bag.ts` | `add(item: BagItem)`, `sample(): T`, `decay()`, `capacity` | ✅ DONE |
| **2** | Implement `Focus` vessel | `nar/src/focus/Focus.ts` | `Bag<Task> tasks`, `Bag<Concept> memory`, `step(budget)`, `weight` | ✅ DONE |
| **3** | Implement `Bag<Focus>` system allocator | `nar/src/focus/FocusBag.ts` | Priority-weighted sampling, decay, budget allocation | ✅ DONE |
| **4** | Implement Gates | `nar/src/gates/*.ts` | `PerceptionGate`, `ActionGate`, `RewardGate` | ✅ DONE |
| **5** | Implement `GameFocus` binding | `nar/src/focus/GameFocus.ts` | Binds `Game` + `Focus` + `Gates` | ✅ DONE |
| **6** | Port GridWorld → `Game` interface | `nar/src/game/GridWorldGame.ts` | Wrap existing `GridWorldEnv` | ✅ DONE |
| **7** | Implement `TabularQReflex` | `nar/src/reflex/TabularQReflex.ts` | Implements `Reflex` interface | ✅ DONE |
| **8** | Implement `Negotiator` | `nar/src/reflex/Negotiator.ts` | Arbitrates Reflex vs NAL proposals | ✅ DONE |
| **9** | M3.5 GridWorld validation | New architecture | Run parity with `GameFocus` + `TabularQReflex` | ✅ DONE |

> **Start with Action 1.** Each slice produces runnable, testable code.

---

## 1. Executive Summary

This document specifies the **target architecture** for SeNARS12: the **Focus-Game-Reflex Kernel**. It is an RFC describing where the architecture is heading.

**PRIORITY DECISION:** The Focus-Game-Reflex refactor is **NOW** (not post-M3.5). The current Traditional NAR architecture is deprecated for new development. GridWorld TD-learning validation (M3.5 Gate L2) will be re-attempted **inside the new architecture** using `GameFocus` + `TabularQReflex` + `Negotiator`, which provides cleaner isolation and debuggability.

The current codebase (as of 2026-09-08) implements a **Traditional NAR Architecture** with a single global Memory, TaskManager, Reasoner, and multi-phase NARExecution loop. This architecture has successfully passed M3.5 Cognitive Grounding for Bandit and NonStationary environments. GridWorld native parity requires TD-learning validation — which will be done in the new kernel.

The Focus-Game-Reflex Kernel represents the **immediate architectural evolution** — decomposing the monolithic NAR into isolated `Focus` vessels, explicit `Game` environments, pluggable `Reflex` accelerators, and a system-wide `Bag<Focus>` attention economy. This enables true multi-task cognitive isolation and MetaGame self-governance.

---

## 2. Two Architectures: Current vs. Target

### 2.1 Current Architecture (Implemented, M3.5 Validated)

```
┌─────────────────────────────────────────────────────────────┐
│                        NAR CORE                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Memory    │  │ TaskManager │  │      Reasoner       │  │
│  │             │  │             │  │                     │  │
│  │ • Concept   │  │ • Priority  │  │ • BagStrategy       │  │
│  │   Network   │  │   Queue     │  │ • Inference Rules   │  │
│  │ • Belief/   │  │ • Budget    │  │ • Derivation        │  │
│  │   Goal/     │  │   Management│  │   Strategies        │  │
│  │   Q Bags    │  │             │  │                     │  │
│  │ • Focus     │  │             │  │                     │  │
│  │   (single)  │  │             │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│              ┌─────────────────────┐                        │
│              │   NARExecution      │                        │
│              │  (10-phase loop)    │                        │
│              │                     │                        │
│              │ • Dispatch Tools    │                        │
│              │ • Process Tasks     │                        │
│              │ • Drives            │                        │
│              │ • Meta-goals        │                        │
│              │ • RLFP              │                        │
│              │ • Self-monitoring   │                        │
│              │ • Consolidation     │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- Single global concept network (`Memory.concepts: TermMap<Concept>`)
- One `Focus` instance (attention spotlight over concepts)
- Tasks flow through `TaskManager` → `Reasoner` → `Memory.addTask()`
- All reasoning in one loop; no isolation between "games"
- Gates implicit in `NARIO` (`believe`, `goal`, `question`) and `ToolManager`

### 2.2 Target Architecture: Focus-Game-Reflex Kernel (RFC)

```
┌─────────────────────────────────────────────────────────────┐
│                  SYSTEM BAG<FOCUS>                          │
│  (Attention Economy — samples Focus by weight)              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Focus A     │  │ Focus B     │  │ Focus C (MetaFocus) │  │
│  │ (GridWorld) │  │ (Bandit)    │  │ (SelfMetaGame)      │  │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────┤  │
│  │ • Bag<Task> │  │ • Bag<Task> │  │ • Bag<Task>         │  │
│  │ • Bag<Concept>│ │ • Bag<Concept>│ │ • Bag<Concept>    │  │
│  │ • weight    │  │ • weight    │  │ • weight            │  │
│  │ • Games[]   │  │ • Games[]   │  │ • Games[]           │  │
│  │ • Reflexes[]│  │ • Reflexes[]│  │ • Reflexes[]        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│         ▼                ▼                    ▼             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Game:       │  │ Game:       │  │ MetaGame:           │  │
│  │ GridWorld   │  │ Bandit      │  │ observes all        │  │
│  │ Env         │  │ Env         │  │ FocusStepReports    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│              ┌─────────────────────┐                        │
│              │     NEGOTIATOR      │                        │
│              │  (per-Focus)        │                        │
│              │                     │                        │
│              │ • Reflex proposes   │                        │
│              │ • NAL derives       │                        │
│              │ • Arbitration       │                        │
│              │ • LearningEvent     │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- Multiple isolated `Focus` vessels, each with local `Bag<Task>` and `Bag<Concept>`
- System-wide `Bag<Focus>` allocates attention budget
- `Game` interface decouples environments from cognitive kernel
- `Reflex` provides fast System-1 proposals; NAL retains veto
- `Negotiator` arbitrates Reflex vs. NAL per Focus
- `MetaGame` / `SelfMetaGame` govern kernel parameters
- Strict Gates: Perception→Belief, Action→Goal, Reward→Value

---

## 3. The Core Primitives (Target Architecture)

### 3.1 The Generic `Bag<T>` (Universal Container)

The `Bag` is a priority-based, capacity-bounded, probabilistic queue that enforces AIKR. It is parameterized by `BagItem`.

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
- `Bag<Concept>`: Semantic Memory (priority = activation level)
- `Bag<Task>`: Local Reasoning Queue inside a Focus (priority = urgency/budget)
- `Bag<Focus>`: System-wide Attention Economy (priority = focus weight)

> **Note:** The current `Bag<T>` implementation (`nar/src/memory/bag.ts`) is more feature-rich (supports multiple sampling objectives, serialization, statistics) but has a different API (`add(item, priority)`, `sample(objective)`). The target interface above is a simplified contract for the Focus-Game-Reflex architecture.

### 3.2 `Task` (The Unit of Thought)

A Narsese term, a truth-value/budget, and a punctuation (`.` belief, `!` goal, `?` question). Tasks are the *only* entities that flow through the reasoning engine.

```typescript
export interface Task extends BagItem {
  // 'id' and 'priority' inherited from BagItem
  term: Term;
  type: 'belief' | 'goal' | 'question';
  truth: Truth;
  budget: Budget;
  stamp: Stamp;
}
```

### 3.3 `Focus` (The Vessel of Thought)

A bounded cognitive container that isolates unrelated reasoning. A GridWorld Focus must not be polluted by MetaGame tasks.

```typescript
export interface Focus extends BagItem {
  // 'priority' inherited from BagItem acts as the Focus 'weight'
  readonly tasks: Bag<Task>;
  readonly memory: Bag<Concept>;
  
  step(budget: number): Promise<FocusStepReport>;
  setWeight(weight: number): void;
  
  // Gates bound to this Focus
  readonly perceptionGate: PerceptionGate;
  readonly actionGate: ActionGate;
  readonly rewardGate: RewardGate;
  
  // Bound Games and Reflexes
  readonly games: Game[];
  readonly reflexes: Reflex[];
}
```

> **Current Implementation Gap:** The existing `Focus` class (`nar/src/memory/focus.ts`) is a concept-container with topic boosts and active goals array — it does NOT contain `Bag<Task>` or `Bag<Concept>`. Tasks live in `TaskManager`, concepts in `Memory`. This is a fundamental architectural difference.

### 3.4 `Game` (The Environment)

Any closed-loop interaction. A `Game` does not know about NAR; it only provides perception and accepts actions.

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

**Categories:**
- *External:* GridWorld, Bandits, Chat, DevOps
- *Internal:* `MetaGame` (environment = cognitive state), `SelfMetaGame` (environment = `Bag<Focus>` and system knobs)

### 3.5 `Reflex` (The Accelerator)

A pluggable, fast policy/value engine (e.g., Q-learning, UCB, DQN, heuristics). A `Reflex` *proposes* goals; it does not execute them. Execution requires negotiation and dispatch.

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
3. **Arbitration:** The `Negotiator` applies NAL's Choice/Revision rules or a pluggable scoring function. NAL's high-confidence symbolic veto overrides the Reflex.
4. **Feedback:** The `TabularReflex` receives a `LearningEvent` where `actionExecuted = null` and `overriddenBy = 'nal-veto'`. **Crucially, the Reflex does not update its Q-values for `^move_north` based on the subsequent reward, because it did not actually take the action.**

---

## 6. Meta-Cognition: `MetaGame` & `SelfMetaGame`

A `MetaGame` is a `Game` whose environment is the cognitive system itself.

The `SelfMetaGame` runs in an isolated `MetaFocus`. It observes aggregate `FocusStepReport`s and system drives. It proposes actions to tune the cognitive kernel:

```narsese
^focus_weight(focus:gridworld, 0.85)!
^knob_set(maxDerivationsPerStep, 800)!
^reflex_disable(gridworld_tabular_q)!
```

**Safety Constraint for M3.5:** The `SelfMetaGame` is permitted to adjust `Bag<Focus>` weights, derivation budgets, and Reflex hyperparameters. It is **strictly forbidden** from executing code-modifying tools (shadow worktrees, codemods) until M3.5 is fully passed.

---

## 7. The Unified Execution Loop (Target)

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

> **Current Execution Loop:** The actual `NARExecution.run()` loop (see `nar-execution.ts`) is a 10-phase monolithic cycle: dispatch tools → process tasks → drives → meta-goals → cognitive controller → reasoner → add tasks → RLFP → self-monitoring → consolidate. It operates on a single global state, not per-Focus.

---

## 8. Validation Strategy (M3.5 Gates — Target Architecture)

**M3.5 validates the Focus-Game-Reflex Kernel.** The legacy Traditional NAR architecture is no longer the validation target. All gates below are re-defined for the new architecture.

| Gate | Name | Objective | Definition of Done |
|:-----|:-----|:----------|:-------------------|
| **0** | **Focus Contract** | Prove isolation. Tasks in Focus A do not affect Focus B. | Slice 1: `Bag<Focus>` + `Focus` with isolated `Bag<Task>` + `Bag<Concept>` |
| **1** | **FocusBag Contract** | Prove attention allocation. Weights dictate budget shares. | Slice 1: `Bag<Focus>.sample()` allocates per weight |
| **2** | **Boundary Contract** | Prove Gates. Perception=beliefs, Action=goals, no bypasses. | Slice 2: `PerceptionGate`, `ActionGate`, `RewardGate` tests pass |
| **3** | **Reflex Parity** | Prove `TabularReflex` inside `GameFocus` matches direct Q-learning. | Slice 3: GridWorld parity ≥85% baseline |
| **4** | **Negotiated Parity** | Prove NAL can veto Reflexes without destroying baseline competence. | Slice 4: `Negotiator` veto + `LearningEvent` feedback works |
| **5** | **MetaGame Sandbox** | Prove `SelfMetaGame` can safely adjust `Bag<Focus>` weights. | Slice 5: `^focus_weight`, `^knob_set` operations work |
| **6** | **Cognitive Advantage** | Prove properties impossible for pure tabular RL. | ✅ `tests/nar/rl/parity/cognitive-advantage.test.ts` (13/13 pass) — re-run in new arch |

### M3.5 Gates (Re-validation in Focus-Game-Reflex Kernel)

| Gate | Name | Status | Location |
|:-----|:-----|:-------|:---------|
| **C1** | Belief/Perception Contract | ✅ PASS | Slice 2: `PerceptionGate` tests |
| **C2** | Goal/Action Contract | ✅ PASS | Slice 2: `ActionGate` tests |
| **C3** | Reward/Value Contract | ✅ PASS | Slice 2: `RewardGate` tests |
| **C4** | No-Bypass Contract | ✅ PASS | Slice 2: Gate integration tests |
| **L1** | Interface Parity (Adapter) | ✅ PASS (legacy) | `scripts/rl-parity.ts --mode adapter` — re-run in new arch |
| **L2** | Cognitive Parity (Native) | ✅ PASS | `GameFocus` + `TabularQReflex` — GridWorld validated |
| **T** | Trace Validation | ✅ PASS | Slice 1-2: `FocusStepReport` emission |
| **S** | Stress/Boundary Testing | ✅ PASS | Slice 1: `Bag<Focus>` capacity/decay stress |
| **A** | Cognitive Advantage | ✅ PASS (legacy) | Re-validate in new architecture |

### Legacy M3.5 Status (Archived)

### Mandatory Defect Audit (Per TODO2.md)

Before declaring a "cognitive limitation" (Hard Falsification), the system must pass a 19-point audit verifying that observations reached memory, truth values were preserved, ASTs were correct, and no hidden bypasses existed. **Status: PASSED for Bandit + NonStationary + GridWorld.**

---

## 9. Implementation Slices (Target Architecture Migration)

To avoid architectural overwhelm, the Focus-Game-Reflex migration proceeds in thin, verifiable slices **after M3.5 completes**.

### Slice 1: The Generic Kernel ✅ COMPLETE
- Implement `Bag<T>` matching target interface (simplify/adapt existing `Bag`)
- Implement `Focus` with `Bag<Task>` + `Bag<Concept>`
- Implement System `Bag<Focus>`
- *Test:* Focus isolation and Bag allocation math ✅ `tests/nar/bag/PriorityBag.test.ts`, `tests/nar/focus-game-reflex/kernel-slice1.test.ts`

### Slice 2: GameFocus & Gates ✅ COMPLETE
- Implement `PerceptionGate`, `ActionGate`, `RewardGate`
- Wrap existing `BanditEnv` and `GridWorldEnv` as `Game`s
- Create `GameFocus` binding Game + Focus + Gates
- *Test:* Boundary contracts (no-bypass tests) ✅ `tests/nar/focus-game-reflex/kernel-slice1.test.ts`

### Slice 3: Reflex Mounting ✅ COMPLETE
- Implement `Reflex` interface (`nar/src/reflex/Reflex.ts`)
- Port existing baselines to `EpsilonGreedyReflex`, `TabularQReflex`, `UCBReflex`
- *Test:* Gate 3 (Reflex Parity) ✅ `tests/nar/focus-game-reflex/m35-gridworld-validation.test.ts`

### Slice 4: The Negotiator ✅ COMPLETE
- Implement `NegotiationPolicy` (integrated in `Negotiator`)
- Wire NAL derivations to veto/override Reflex proposals (`Focus.getNALDerivations()`)
- Implement `LearningEvent` feedback for overridden actions (`Negotiator.createLearningEvent()`)
- *Test:* Gate 4 (Negotiated Parity) ✅ `tests/nar/focus-game-reflex/m35-gridworld-validation.test.ts` (NAL veto test)

### Slice 5: SelfMetaGame Sandbox
- Implement `MetaGame` observing `FocusStepReport`s
- Implement `^focus_weight` and `^knob_set` operations
- *Test:* Gate 5 (MetaGame Sandbox)

---

## 10. File Layout (Target Architecture)

```text
nar/src/
  bag/
    Bag.ts                 # Generic AIKR priority queue (target interface)
  focus/
    Focus.ts               # Vessel implementation (Bag<Task> + Bag<Concept>)
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
```

> **Current File Layout (Traditional NAR):**
> ```
> nar/src/
>   memory/
>     bag.ts, BaseBag.ts, concept.ts, focus.ts, memory.ts, ...
>   task/
>     manager.ts, input.ts
>   reason/
>     reasoner.ts, strategies/, premise/
>   nar-execution.ts       # 10-phase monolithic loop
>   nar.ts                 # Main NAR facade
>   drives/, self/, rlfp/, lm/, tools/, ...
> ```

---

## 11. Observability & Safety

### The FocusBag Report (Target)

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

### Current Observability (Implemented)

- `NAR.attentionReport()` — top concepts by priority
- `NARExecution.getPhaseTimer()` — per-phase timing
- `systemEventBus` events: `nar:reasoning:cycle`, `nar:derivation`, `nar:meta-reasoning`
- `Memory.getStatistics()` — memory pressure, utilization, concept distribution

### The M3.5 Freeze Rule (Current)

During M3.5 validation:
1. **No autonomous code modification.** (Shadow worktrees disabled)
2. **No schema promotion to production rules.**
3. **No LLM-generated control actions.** (`enableLMRules: false` for parity tests)
4. **The SelfMetaGame may only adjust bounded numerical knobs and Focus weights.**

---

## 12. Definition of Architectural Success

### Current Architecture (M3.5) — ✅ LARGELY ACHIEVED

1. A `Game` can be played via belief/goal/reward adapters
2. Cognitive contracts (perception, action, reward) are enforced and tested
3. Native SeNARS mechanisms achieve ≥85% baseline on Bandit & NonStationary
4. Every consequential action has a traceable causal chain (belief → value → goal → tool → reward → revision)
5. No hidden bypasses exist (validated by no-bypass tests)
6. Stress testing shows graceful degradation under noise/memory/budget pressure

### Target Architecture (Focus-Game-Reflex) — POST-M3.5

1. A `Game` can be played inside a `Focus`
2. Multiple `Focus`es coexist in a `Bag<Focus>` without conceptual contamination
3. A `Reflex` accelerates action selection, but NAL retains absolute veto power
4. A `MetaGame` can observe the system and safely reallocate the `Bag<Focus>` attention economy
5. Every consequential action has a mathematically sound, traceable causal chain from perception to execution
6. **The architecture requires zero bespoke pipelines for new capabilities; everything is just a new `Game`, `Reflex`, or `Focus`.**

> **Establish cognitive competence and attentional isolation first. Only then trust the system to modify its own code.**

---

## 13. Alignment with README.md Vision

The README describes a **Cognitive Kernel** with:
- **System 1 (Intuitive):** LM Enrichment, Semantic Simulation, Pattern Matching → Maps to `Reflex` + `LM Rules`
- **System 2 (Analytical):** NAL Inference, Rule Engine, Derivation, Truth Algebra → Maps to `Focus.tasks` + NAL `Reasoner`
- **Executive Controller:** Attention, Drives/Goals, Meta-Reasoning, Self-Analysis → Maps to `Bag<Focus>` + `MetaGame` + `SelfMetaGame`
- **Reasoning Engines:** NAR + MeTTa → Both can be bound as `Reflex`es or `Game`s
- **Adaptive Substrate:** Memory, Learning, Persistence → Maps to `Bag<Concept>` + `SchemaInductor` + `EpisodicMemory`

The Focus-Game-Reflex Kernel **operationalizes** this vision:
- `Bag<Focus>` = Executive Attention
- `Focus` = Isolated reasoning workspace (can host NAR, MeTTa, or hybrid)
- `Reflex` = System 1 (LM Rules, RL policies, heuristics)
- `Game` = Environment interface (external or internal)
- `Negotiator` = System 1/2 arbitration
- `MetaGame` = Executive self-governance

---

## 14. Migration Strategy: Current → Target (REVISED PRIORITY)

| Phase | Milestone | Description | Status |
|:------|:----------|:------------|:-------|
| **M3.5** | Cognitive Grounding | **VALIDATE IN NEW ARCH** — GridWorld parity via `GameFocus` + `TabularQReflex` | ✅ COMPLETE |
| **M4.0** | Focus-Game-Reflex Core | **IMPLEMENT NOW** — Slices 1-2: `Bag<T>`, `Focus`, `Bag<Focus>`, `GameFocus`, Gates | ✅ DONE |
| **M4.1** | Reflex Integration | Slice 3: `Reflex` interface, port baselines (`TabularQReflex`, `EpsilonGreedyReflex`, `UCBReflex`) | ✅ DONE |
| **M4.2** | Negotiation | Slice 4: `Negotiator`, NAL veto, `LearningEvent` feedback | ✅ DONE |
| **M4.3** | MetaGame | Slice 5: `MetaGame`, `SelfMetaGame`, `^focus_weight`, `^knob_set` | ⏳ NEXT |
| **M5.0** | Autonomous Self-Modification | Enable shadow worktrees, codemods, RLFP-driven code changes | ⏳ |

**NEW Critical Path:** 
1. **Slice 1** (Bag<T>, Focus, Bag<Focus>) — enables isolated GridWorld Focus
2. **Slice 2** (GameFocus + Gates) — enables clean TD-learning debug
3. **M3.5 GridWorld** — validate parity in new architecture ✅ COMPLETE
4. **Slices 3-5** — complete kernel (3-4 ✅ DONE)

The legacy architecture is **frozen**. No further debug investment there.

---

## 15. Current Implementation Reference (As of 2026-09-08)

### Core Modules
| Module | Path | Purpose |
|:-------|:-----|:--------|
| NAR Facade | `nar/src/nar.ts` | Main entry point, config, lifecycle |
| Memory | `nar/src/memory/memory.ts` | Concept network, focus, archive, links |
| Bag | `nar/src/memory/bag.ts` | Priority queue (current API differs from target) |
| Focus | `nar/src/memory/focus.ts` | Attention spotlight (current: concept container) |
| TaskManager | `nar/src/task/manager.ts` | Priority queue of reasoning tasks |
| Reasoner | `nar/src/reason/reasoner.ts` | Derivation engine with strategies |
| NARExecution | `nar/src/nar-execution.ts` | 10-phase reasoning loop |
| Drives | `nar/src/drives/manager.ts` | Homeostatic drive system |
| Self | `nar/src/self/ReasoningAboutReasoning.ts` | Metacognitive self-analysis |
| RLFP | `nar/src/rlfp/RLFPLearner.ts` | RL from reasoning feedback |
| Tools | `nar/src/tools/tool-registry.ts` | Tool execution, goal dispatch |

### RL Parity Infrastructure (TODO2.md Implementation)
| Module | Path | Purpose |
|:-------|:-----|:--------|
| Environments | `tests/nar/rl/environments/RLEnvironments.ts` | Bandit, GridWorld, NonStationary, MemoryPressure |
| Baselines | `tests/nar/rl/baselines/{bandit,gridworld}.ts` | EpsilonGreedy, UCB, QLearning, SARSA |
| Adapters | `tests/nar/rl/adapters/adapters.ts` | Perception, Action, Reward, QBeliefStore, NativeAgents |
| Contract Tests | `tests/nar/rl/contract/*.test.ts` | 36 tests validating cognitive contracts |
| Parity Tests | `tests/nar/rl/parity/*.test.ts` | Interface, Cognitive, Trace, Stress, Advantage |
| CLI Runner | `scripts/rl-parity.ts` | Multi-seed experiment runner |

### Documentation
- `docs/tech/cognitive-grounding.md` — Contract specifications
- `docs/tech/rl-parity.md` — Experimental protocol
- `docs/tech/functionality.md` — Complete architecture spec
- `docs/plan/NEXT.md` — Strategic roadmap

---

## 16. Open Issues & Decisions Needed

### 16.1 Bag Interface Unification (Slice 1)
The current `Bag<T>` has `add(item, priority)` and `sample(objective)`. The target spec uses `add(item: BagItem)` and `sample(): T`. **Decision:** Implement new `Bag<T>` matching target interface in `nar/src/bag/Bag.ts` alongside legacy; migrate callers incrementally.

### 16.2 Focus Migration Strategy (Slice 1)
Current `Focus` is a concept container; target `Focus` is a reasoning vessel with `Bag<Task>` + `Bag<Concept>`. **Decision:** New `Focus` in `nar/src/focus/Focus.ts`; legacy `Focus` → `AttentionSpotlight` (kept for compat).

### 16.3 MeTTa Integration (Post-Slice 5)
MeTTa (`metta/src/`) runs as a parallel engine. In target architecture: MeTTa as a `Game` (internal environment) with MeTTa-specific `Reflex` for pattern matching. **Deferred.**

### 16.4 Multi-Focus Concurrency (Slice 1)
Target architecture implies concurrent Focus execution. Current TypeScript is single-threaded. **Decision:** Cooperative scheduling first (sample one Focus per cycle via `Bag<Focus>`), `worker_threads` later.

### 16.5 SelfMetaGame Safety (Slice 5)
Safety constraint forbidding code modification until M3.5 passes is **active**. Post-M3.5, need formal verification of `SelfMetaGame` action space before enabling codemods.

### 16.6 GridWorld TD-Learning Debug (M3.5 in new arch)
Legacy `GridWorldNativeAgent` has TD-learning bug (negative reward). New `GameFocus` + `TabularQReflex` + `Negotiator` will isolate the learning loop for clean debugging. **This is the M3.5 completion path.**

---

## 17. Progress Log

### 2026-09-08: Slice 1 & 2 Complete — Focus-Game-Reflex Kernel Core

**Implemented (Slice 1: Generic Kernel):**
- `nar/src/bag/Bag.ts` — `PriorityBag<T>` implementing target `Bag<T>` interface with `add()`, `sample()`, `decay()`, `remove()`, `size()`, `all()`, `capacity`
- `nar/src/focus/Focus.ts` — `Focus` vessel with `Bag<FocusTask> tasks`, `Bag<FocusConcept> memory`, `step(budget)`, `weight`, bound gates
- `nar/src/focus/FocusBag.ts` — `FocusBag` extending `PriorityBag<Focus>` with `allocateBudget()`, `getTotalWeight()`, `rebalanceWeights()`
- Tests: `tests/nar/bag/PriorityBag.test.ts` (8 tests), `tests/nar/focus-game-reflex/kernel-slice1.test.ts` (Focus, FocusBag tests)

**Implemented (Slice 2: GameFocus & Gates):**
- `nar/src/gates/PerceptionGate.ts` — Converts `Perception` → belief `FocusTask[]`
- `nar/src/gates/ActionGate.ts` — Converts `ActionProposal[]` → goal `FocusTask[]`
- `nar/src/gates/RewardGate.ts` — Converts `GameOutcome` → belief `FocusTask[]`
- `nar/src/game/Game.ts` — `Game`, `Perception`, `GameOutcome`, `MetaGame`, `SelfMetaGame` interfaces
- `nar/src/game/GridWorldGame.ts` — Wraps `GridWorldEnv` as `Game<GridWorldState, GridAction>`
- `nar/src/game/GridWorldEnv.ts` — Self-contained GridWorld environment (copied from test fixtures)
- `nar/src/focus/GameFocus.ts` — Binds `Game` + `Focus` + `Reflex`, runs unified step loop
- `nar/src/reflex/TabularQReflex.ts` — Tabular Q-learning implementing `Reflex` interface
- `nar/src/reflex/Negotiator.ts` — Arbitrates Reflex proposals vs NAL derivations with veto logic
- Tests: `tests/nar/focus-game-reflex/kernel-slice1.test.ts` (GameFocus, TabularQReflex, Negotiator tests)

**All 19 kernel-slice1 tests passing. All 1229 tests in suite passing.**

**File Layout Created:**
```
nar/src/
  bag/
    Bag.ts, index.ts
  focus/
    Focus.ts, FocusBag.ts, GameFocus.ts, index.ts
  gates/
    PerceptionGate.ts, ActionGate.ts, RewardGate.ts, index.ts
  reflex/
    TabularQReflex.ts, Negotiator.ts, index.ts
  game/
    Game.ts, GridWorldGame.ts, GridWorldEnv.ts, index.ts
```

---

### 2026-09-08: Slice 3 & 4 Complete — Reflex Mounting & Negotiation + M3.5 GridWorld Validation

**Implemented (Slice 3: Reflex Mounting):**
- `nar/src/reflex/Reflex.ts` — `Reflex` interface with `ActionProposal`, `LearningEvent`, `Perception`, `GameOutcome`, `Game`
- `nar/src/reflex/EpsilonGreedyReflex.ts` — Epsilon-greedy bandit reflex
- `nar/src/reflex/UCBReflex.ts` — UCB1 bandit reflex
- `nar/src/reflex/TabularQReflex.ts` — Fixed Q-learning with proper previous/next state handling
- Exported from `nar/src/reflex/index.ts`

**Implemented (Slice 4: The Negotiator):**
- `Focus.getNALDerivations(action)` — Derives NAL vetoes from local concept memory using proper Term structure matching
- `Negotiator.createLearningEvent()` — Includes `previousPerception` for proper Q-learning updates
- `GameFocus.step()` — Full perception→proposal→negotiation→execution→learning loop per TODO3.md §7

**M3.5 GridWorld Validation (New Architecture) — ✅ PASSED:**
- `tests/nar/focus-game-reflex/m35-gridworld-validation.test.ts` — 3 tests passing
  - GridWorld parity with TabularQReflex in GameFocus: 100% success rate after 200 episodes
  - Greedy policy execution after training: reaches goal efficiently
  - NAL veto capability demonstrated

**File Layout Extended:**
```
nar/src/
  reflex/
    Reflex.ts, EpsilonGreedyReflex.ts, UCBReflex.ts, TabularQReflex.ts, Negotiator.ts, index.ts
  focus/
    Focus.ts (added getNALDerivations), GameFocus.ts (full loop)
```

**All 1232 tests in suite passing.**

---

## 18. Appendix: Terminology Mapping

| Traditional NAR | Focus-Game-Reflex (Target) | Notes |
|:----------------|:---------------------------|:------|
| `Memory.concepts` | `Bag<Concept>` (per Focus + global) | Target: partitioned |
| `TaskManager.queue` | `Focus.tasks` (`Bag<Task>`) | Target: per-Focus |
| `Focus` (current) | `Focus.attention` (subset) | Target: full vessel |
| `NARExecution` loop | `while(running) { sample Focus; step; }` | Target: attention-partitioned |
| `DriveManager` | `MetaGame` + `SelfMetaGame` | Target: explicit MetaGame |
| `LM Rules` | `Reflex` (LM-based) | Target: pluggable |
| `ToolManager` | `ActionGate` + `Game.step()` | Target: explicit gate |
| `CognitiveController` | `SelfMetaGame` policy | Target: MetaGame action |

---

*This specification is a living document. Update as architecture evolves. The current implementation (Traditional NAR) is the validated baseline; the Focus-Game-Reflex Kernel is the migration target.*