# TODO2.md — Cognitive Grounding Before Self-Modification

## Strategic Direction

SeNARS12 has already built substantial self-modification machinery:

* Meta-rules (`nar/src/rules/meta-rules.ts`)
* Drive-based goal injection (`nar/src/drives/manager.ts`, `nar/src/nar-execution.ts:168-206`)
* RLFP reward tracking (`nar/src/rlfp/`, `nar/src/nar-execution.ts:149-155`)
* Shadow worktree execution
* Codemod tools (`nar/src/tools/adapters/external-tools.ts`)
* Goal-to-tool dispatch (`nar/src/tools/tool-registry.ts:475-514`)
* Approval-gated self-repair (`nar/src/self/`)

The next phase should **not** add more self-modification capability.

Before allowing an agent to modify its own code, we need evidence that the underlying cognitive substrate can:

1. perceive an environment through beliefs,
2. represent uncertainty explicitly,
3. select actions through goals,
4. learn from reward,
5. adapt when the environment changes,
6. preserve these properties under memory and reasoning pressure,
7. expose an auditable derivation trace for consequential actions.

Therefore the active milestone is:

> **M3.5 — Cognitive Grounding and RL Parity**

The central question is:

> **Can SeNARS perform closed-loop learning and control using its native belief/goal/truth/memory machinery, without bypassing the cognitive architecture?**

---

# Core Principle

Self-modification should be downstream of cognitive competence.

Therefore:

> **No further autonomous self-modification work until the cognitive framework passes the M3.5 gates.**

This is a validation gate, not merely a feature milestone.

A result only counts if:

* the environment is not accessed through hidden shortcuts,
* actions pass through the goal/action interface,
* observations enter through beliefs,
* reward enters through the documented cognitive representation,
* deterministic controls exist,
* the result survives multiple seeds,
* known implementation defects have been audited,
* and the comparison to conventional RL is fair.

---

# Scientific Falsification Policy

M3.5 must avoid both premature pessimism and moving goalposts.

## Failure Classification

Every negative result receives one of three labels:

### Provisional Failure

The result may be caused by:

* an unverified adapter,
* incorrect Narsese representation,
* an implementation defect,
* inappropriate hyperparameters,
* insufficient derivation budget,
* memory pressure,
* a mismatch between reward scaling and `Truth`,
* an accidentally disabled learning path.

A provisional failure does **not** establish a cognitive limitation.

### Corrected Failure

The suspected defect has been fixed and the experiment rerun under the same protocol.

If performance remains poor, the result becomes evidence against the hypothesis.

### Hard Falsification

A failure is promoted to hard falsification only when:

* the contract is verified,
* the implementation is independently sanity-tested,
* known configuration levers have been exercised,
* the baseline is healthy,
* multiple seeds reproduce the result,
* and the result survives a reasonable defect audit.

This prevents both:

> "It failed once, therefore SeNARS cannot do RL."

and:

> "It failed ten times, therefore we keep inventing new explanations."

---

# Mandatory Defect Audit Before Declaring a Boundary

For every important negative result, check:

* [ ] Observation actually reaches memory.
* [ ] Correct `TaskType` is used.
* [ ] Truth values are preserved.
* [ ] Confidence is not accidentally pinned or discarded.
* [ ] Repeated evidence actually invokes revision.
* [ ] Contradictory evidence is represented correctly.
* [ ] Reward reaches the intended value representation.
* [ ] Value updates actually change beliefs.
* [ ] Goal generation reads the updated values.
* [ ] Goal priority is preserved through dispatch.
* [ ] Operation AST is structurally correct (`Inheritance(Product, Atom('^op'))`).
* [ ] Tool dispatch actually executes the intended environment action.
* [ ] No direct environment access exists.
* [ ] Derivation limits are not silently truncating the relevant reasoning.
* [ ] Memory limits are not silently deleting required concepts.
* [ ] Exploration is actually enabled.
* [ ] RNG is seeded.
* [ ] No LM/network/self-modification path contaminates the experiment.
* [ ] Baseline itself passes its sanity tests.

A failed audit blocks interpretation of the result.

---

# M3.5 Scope

## In Scope

* Belief-grounded perception
* Goal-grounded action
* Reward/value representation
* Truth revision and decay
* Confidence-aware exploration
* Memory behavior
* RL parity
* Cognitive trace validation
* Deterministic benchmark environments
* Non-stationary environments
* Controlled memory-pressure experiments
* Stateful/recurrent environments after basic parity

## Explicitly Out of Scope

During M3.5 do not expand:

* Autonomous code modification
* Meta-rule generation of codemods
* Shadow-worktree self-repair
* RLFP policy optimization for code changes
* Production deployment
* Long-running unattended loops
* Web dashboards
* Autonomous schema promotion
* New self-modification tools

These remain downstream of M3.5.

---

# RL Parity Concept

The first goal is not to prove that SeNARS beats conventional RL.

The first goal is to establish:

> **The cognitive representation does not destroy ordinary RL competence.**

Then:

> **Native SeNARS mechanisms can reproduce useful RL behavior.**

Only after those two claims are established should we test:

> **What does the cognitive architecture provide beyond conventional RL?**

---

# Conventional RL → SeNARS Mapping (Codebase-Aligned)

| Conventional RL    | SeNARS12                               |
| ------------------ | -------------------------------------- |
| Observation/state  | `Task { type: 'belief', term, truth }` via `nar.believe()` |
| Sensor reliability | Truth confidence `c`                   |
| Reward             | Reward belief and/or goal satisfaction |
| State-action value | Belief about expected reward           |
| Action             | Goal, preferably native operation goal |
| Policy             | Derived goal tendencies / priorities   |
| Exploration        | Curiosity drive + low-confidence beliefs |
| Exploitation       | High expectation / priority goals      |
| Value update       | `Truth.revision` and related inference |
| Forgetting         | Truth decay / memory dynamics          |
| Experience         | Episodic memory                        |
| Generalization     | Schema induction / inference           |
| Explainability     | Derivation trace / `nar.explain()`     |
| Memory             | Concept network + priority bags        |

The mapping must be implemented rather than merely documented.

---

# Belief-Based Perception Contract

All environment observations must enter SeNARS as **belief tasks** (`type: 'belief'`).

Perception must not directly mutate:

* policy state,
* action state,
* environment state,
* Q-tables,
* or tool execution state.

## Canonical Example (Actual Narsese)

```narsese
(state:s_3_4 --> observed). %1.00;0.95%
(self --> state:s_3_4). %1.00;0.95%
```

Wall observation:

```narsese
(feature:wall_north --> present). %1.00;0.90%
```

Noisy sensor:

```narsese
(feature:wall_north --> present). %1.00;0.45%
```

Repeated observations should be combined through the cognitive truth machinery (`Truth.revision`) rather than naïvely overwritten.

## Requirements

* [ ] Observation becomes a belief task via `nar.believe(term, truth)` or `nar.input(term, 'belief', truth)`.
* [ ] `truth.c` represents sensor reliability.
* [ ] Repeated consistent observations invoke `Truth.revision`.
* [ ] Contradictory observations are detectable (via conflict analyzers).
* [ ] Temporal/source stamps are preserved (`Stamp` with `source: 'input'`, `evidence`).
* [ ] Beliefs are queryable through memory (`nar.getBeliefs()`, `nar.queryTerm()`, `nar.getConcept()`).
* [ ] Perception alone cannot execute an action (no `^tool` goals from perception).
* [ ] Observation ingestion has no hidden policy side effect.

---

# Goal-Based Action Contract

Actions must leave the cognitive system as **goals** (`type: 'goal'`).

Preferred canonical operation (native AST format, mandatory):

```narsese
(^move_north)!
```

or an argument-bearing native operation:

```text
Inheritance(
  Product(state:s_3_4, direction:north),
  Atom('^move_to')
)
```

This native AST representation is mandatory. String-pattern hacks are rejected by `ToolManager.executeToolGoal` (see `tool-registry.ts:475-514`).

## Requirements

* [ ] Goals are generated from cognitive state.
* [ ] Goals pass through `nar.goal()`.
* [ ] Goals reach `ToolManager.executeToolGoal()` (called from `NARExecution.dispatchToolGoals()`).
* [ ] Invalid operations fail safely (returns `ToolResult { success: false }`).
* [ ] Goal priority (`task.budget.priority`) affects dispatch/selection.
* [ ] AIKR limits are respected (`config.maxDerivationsPerStep`, `config.maxDerivationDepth`).
* [ ] No direct `tool.execute()` bypass exists.
* [ ] No environment step occurs without goal dispatch.
* [ ] Observation alone never causes an action.

---

# Reward and Value Representation

## Reward Belief

```narsese
(reward:high --> achieved). %0.90;0.90%
```

## Goal Satisfaction

```narsese
(reward:high)!
```

## State-Action Value (Q-value analog)

Preferred representation using native operators:

```narsese
((*, state:s_3_4, ^move_north) --> predicts_reward). %0.78;0.62%
```

Where:

* `Product` (`*`) represents the state/action association (commutative, n-ary).
* `^move_north` is an `Atom` with symbol starting with `^` (operation).
* `Inheritance` (`-->`) connects the state-action representation to expected reward.
* `predicts_reward` = `AtomicTerm` concept.
* `truth.f` represents estimated reward (frequency).
* `truth.c` represents evidence/confidence.

A simplified test-local representation may be used during adapter development, but the long-term implementation should use the native Product/Inheritance form.

---

# Three-Level Validation Strategy

## Level 1 — Interface Parity

Wrap a conventional RL algorithm in the SeNARS interface.

### Direct

```text
observation → Q-learning → action
```

### Cognitive Interface

```text
observation
  ↓
BeliefPerceptionAdapter → nar.believe()
  ↓
SeNARS belief
  ↓
Q-learning (reads only from beliefs)
  ↓
GoalActionAdapter → nar.goal()
  ↓
SeNARS goal (native AST)
  ↓
ToolManager.executeToolGoal()
  ↓
environment
```

The adapter must not materially alter behavior.

### Targets

| Metric                     | Target |
| -------------------------- | -----: |
| Return difference          |   ≤ 2% |
| Action agreement           |  ≥ 98% |
| Converged policy agreement |  ≥ 95% |
| Value correlation          | ≥ 0.98 |

Failure here is primarily an **interface/architecture bug**, not evidence against native cognition.

---

## Level 2 — Cognitive Parity

Replace conventional Q-table updates and selection logic with SeNARS-native mechanisms.

Use:

* `Truth.revision` for value updates
* `Truth.confidence` for uncertainty
* `Truth.expectation()` for value
* Goal priority (`task.budget.priority`) for action preference
* Curiosity drive (`DriveManager`) for exploration
* Episodic memory (`EpisodicMemory`) for trajectory context
* Schema induction (`learning/schema-induction.ts`) where appropriate

### Targets

| Metric            |                        Target |
| ----------------- | ----------------------------: |
| Return            |             ≥ 85% of baseline |
| Policy agreement  |                         ≥ 85% |
| Value correlation |                        ≥ 0.85 |
| Convergence time  |                 ≤ 2× baseline |
| Bandit regret     | ≤ 1.5× baseline after burn-in |

The thresholds are practical validation thresholds, not claims of theoretical equivalence.

---

## Level 3 — Cognitive Advantage

After parity, test properties that conventional tabular RL does not naturally provide.

Examples:

* Explicit confidence under noisy perception
* Contradiction detection (via conflict analyzers)
* Belief revision after environment changes
* Memory-pressure behavior (`Memory.getStatistics().memoryPressure`)
* Explainable action derivation (`nar.explain()`, `nar.traceTerm()`)
* Schema induction from repeated successful sequences
* Adaptation after environment changes
* Graceful degradation rather than abrupt policy failure

These experiments determine whether the cognitive architecture provides meaningful advantages rather than merely reproducing an RL algorithm through a different API.

---

# Required Environments

## E1 — Multi-Armed Bandit

Variants:

* Stationary Bernoulli
* Noisy observations
* Drifting rewards

Tests:

* Exploration
* Exploitation
* Confidence
* Reward revision
* Adaptation

Baselines:

* Epsilon-greedy
* UCB1

---

## E2 — Deterministic GridWorld

Example:

```text
S . . .
. . # .
. # . .
. . . G
```

Tests:

* Perception
* Action goals
* Sequential decision making
* Value learning
* Goal derivation

Baselines:

* Q-learning
* SARSA
* Value iteration oracle

---

## E3 — Stochastic GridWorld

Tests:

* Noisy transitions
* Uncertain outcomes
* Confidence calibration
* On-policy learning

Baselines:

* SARSA
* Expected SARSA
* Q-learning

---

## E4 — Non-Stationary Environment

Change reward dynamics during training.

Tests:

* Forgetting
* Revision
* Decay
* Adaptation
* Recovery from stale beliefs

Compare against:

* Discounted Q-learning
* Sliding-window Q-learning

---

## E5 — Memory-Pressure Environment (Secondary)

Run the same tasks under controlled memory limits (`maxConcepts`).

Measure:

* Return degradation
* Belief loss
* Confidence degradation
* Concept eviction
* Recovery after pressure is removed

This is a **secondary test**, not a prerequisite for basic parity.

---

## E6 — Stateful/Recurrent Environment

Only after E1–E4 are working.

Candidate tasks:

* Delayed reward
* Partial observability
* Memory-dependent decisions
* Sequence recall

The purpose is to determine whether the cognitive memory architecture provides useful temporal state without introducing uncontrolled complexity.

---

# Baseline Algorithms

Place baseline implementations under:

```text
tests/nar/rl/baselines/
```

Required:

```text
epsilonGreedy.ts
qLearning.ts
sarsa.ts
ucb.ts
```

Each baseline must provide:

* Seeded RNG
* Configurable `alpha`
* Configurable `gamma`
* Configurable exploration
* Serializable state
* Deterministic test mode
* Metrics output

Baselines must first solve their environments independently of SeNARS.

---

# Required Adapters

```text
tests/nar/rl/adapters/
  BeliefPerceptionAdapter.ts
  GoalActionAdapter.ts
  QBeliefStore.ts
  RewardBeliefAdapter.ts
  RLParityHarness.ts
```

## BeliefPerceptionAdapter

```typescript
interface RLObservation {
  stateId: string;
  features?: Record<string, number>;
  reward?: number;
  terminal?: boolean;
  timestamp?: number;
}

interface BeliefPerceptionAdapter {
  perceive(observation: RLObservation): Task[]; // belief tasks
}
```

Responsibilities:

* Convert observations to beliefs via `nar.believe()`.
* Preserve sensor confidence in `truth.c`.
* Preserve temporal information in `Stamp`.
* Never execute actions.

---

## GoalActionAdapter

```typescript
interface RLAction {
  name: string;
  args?: Record<string, unknown>;
}

interface GoalActionAdapter {
  proposeAction(action: RLAction): Task; // goal task with native AST
  dispatchPendingGoals(nar: NAR): Promise<ToolResult[]>;
}
```

Responsibilities:

* Build native operation ASTs: `Inheritance(Product(args...), Atom('^' + name))`.
* Inject goals via `nar.goal(goalTerm)`.
* Dispatch through the real execution path (`nar.getExecution().dispatchToolGoals()` or next `nar.run()` cycle).
* Return actual tool results.
* Never mutate the environment directly.

---

## QBeliefStore

Responsibilities:

* Store value beliefs in SeNARS memory (`nar.memory`).
* Read state/action values.
* Update values using truth mechanisms (`Truth.revision`).
* Expose confidence for exploration (low confidence → explore).
* Support comparison against conventional Q-values.

Required API:

```text
getValue(state, action) → { f, c }
updateValue(state, action, reward) → revises belief
getAllActions(state) → beliefs for all actions
```

---

## RewardBeliefAdapter

Responsibilities:

* Normalize rewards where necessary (document the normalization).
* Preserve reward sign/meaning.
* Update state-action value beliefs via `QBeliefStore`.
* Record reward history.
* Generate terminal satisfaction signals.

Reward normalization must be documented rather than silently changing semantics.

---

# Contract Tests

```text
tests/nar/rl/contract/
  belief-perception.test.ts
  goal-action.test.ts
  reward-belief.test.ts
  no-bypass.test.ts
```

## Belief Tests

* [ ] Correct term
* [ ] Correct truth
* [ ] Correct confidence
* [ ] Revision
* [ ] Contradiction detection
* [ ] Temporal/source metadata
* [ ] No action side effect

## Goal Tests

* [ ] Correct native AST (`Inheritance(Product, Atom('^op'))`)
* [ ] Correct dispatch through `executeToolGoal`
* [ ] Correct priority (`budget.priority`)
* [ ] Correct AIKR behavior
* [ ] Invalid goal fails safely
* [ ] Exactly one environment action per dispatched goal
* [ ] No action without a goal

## Reward Tests

* [ ] Positive reward represented correctly
* [ ] Negative reward represented correctly
* [ ] Reward updates relevant value belief
* [ ] Confidence reflects evidence
* [ ] Terminal reward creates appropriate satisfaction signal

---

# No-Bypass Tests

These are mandatory.

The tests must instrument the environment so that unauthorized direct access fails.

Verify:

* [ ] Baseline receives observations only through the declared interface (`nar.getBeliefs()`, `nar.queryTerm()`).
* [ ] State cannot be read directly by the policy.
* [ ] Actions cannot directly mutate the environment.
* [ ] Environment stepping occurs only through operation execution.
* [ ] No hidden Q-table exists inside the adapter.
* [ ] No hidden action-selection state bypasses SeNARS.
* [ ] No LM call supplies the answer (`enableLMRules: false`).
* [ ] No self-modification mechanism participates (`enableSelf: false`).

A parity result obtained through a bypass is invalid.

---

# Required Parity Experiments

## Bandit — Epsilon-Greedy

Compare:

1. Direct baseline
2. Adapter-wrapped baseline
3. SeNARS-native learner

Metrics:

* Cumulative reward
* Regret
* Optimal-arm selection
* Exploration rate
* Confidence trajectory

Targets:

* Direct vs adapter: near-identical
* Native vs baseline: ≥ 85% final performance
* Optimal-arm selection: within 10% of baseline

---

## Bandit — UCB

Test whether confidence can provide a useful exploration signal.

Measure:

* Regret
* Low-confidence arm sampling
* Convergence
* Confidence calibration

Target:

> Native exploration is systematically uncertainty-sensitive rather than effectively random.

---

## GridWorld — Q-Learning

Compare:

* Direct Q-learning
* Belief/goal Q-learning
* Native SeNARS value beliefs

Targets:

| Metric            |        Target |
| ----------------- | ------------: |
| Policy agreement  |         ≥ 90% |
| Return ratio      |        ≥ 0.90 |
| Value correlation |        ≥ 0.90 |
| Convergence       | ≤ 2× baseline |

---

## Stochastic SARSA

Measure:

* Average return
* Policy stability
* Confidence calibration
* Recovery after surprising transitions

Target:

* Return within 10% of baseline.
* No catastrophic oscillation.
* Confidence responds to unexpected evidence.

---

## Non-Stationary Revision

Change the reward mapping halfway through training.

Measure:

* Adaptation delay
* Post-change return
* Old-belief decay
* New-belief acquisition

Target:

* Adaptation within 1.5× baseline.
* Old high-value beliefs decrease.
* New values become dominant.
* No permanent commitment to obsolete evidence.

---

# Trace Validation

Every consequential action must be explainable via the actual causal path, not a post-hoc explanation.

Record:

* Observation belief
* Relevant value beliefs
* Goal
* Goal priority
* Derivation identifiers
* Tool execution
* Reward
* Subsequent belief revision

Example expected explanation:

```text
Observed:
  (self --> state:s_3_4) %1.00;0.95%

Relevant values:
  ((*, state:s_3_4, ^move_north) --> predicts_reward)
    %0.81;0.74%

  ((*, state:s_3_4, ^move_south) --> predicts_reward)
    %0.32;0.55%

Selected:
  (^move_north)!

Reason:
  Highest expected value among available actions.

Execution:
  ToolManager.executeToolGoal(...)

Outcome:
  reward = +1

Update:
  value belief revised with new evidence.
```

The trace must reflect the actual causal path using:
* `nar.getDerivationHistory(task)`
* `nar.traceTerm(term)`
* `nar.explain(conclusion)`

---

# Observability

For every episode record:

* Seed
* Environment configuration
* Observation beliefs
* Truth values
* Confidence
* Value beliefs
* Selected goals
* Goal priorities
* Derivation traces
* Tool results
* Rewards
* Episode return
* Baseline values
* Memory statistics (`Memory.getStatistics()`)
* Derivation counts
* Execution time

---

# Determinism

RL parity must be reproducible.

Requirements:

* [ ] Environment RNG is seeded.
* [ ] Baseline RNG is seeded.
* [ ] Exploration RNG is seeded.
* [ ] LM rules disabled (`enableLMRules: false`).
* [ ] Network disabled.
* [ ] Self-modification disabled (`enableSelf: false`).
* [ ] RLFP disabled initially (`enableRLFP: false`).
* [ ] Persistence disabled (`persistState: false`).
* [ ] Test configuration is version-controlled.
* [ ] Environment configuration is logged.
* [ ] Seed is included in every report.

Suggested configuration (matches `NARConfig`):

```typescript
{
  enableLMRules: false,
  enableTools: true, // only RL action tools
  enableSelf: false,
  enableRLFP: false,
  persistState: false,
  maxConcepts: 10000,
  maxDerivationsPerStep: 1000,
  maxDerivationDepth: 20
}
```

---

# Statistical Requirements

A single successful run is not sufficient.

Default:

* Development: 3 seeds
* Standard validation: 10 seeds
* Important claims: 20+ seeds where practical

Reports should include:

* Mean
* Standard deviation
* Median
* Confidence interval where practical
* Per-seed results
* Failure count
* Convergence distribution

Do not report only the best seed.

For stochastic environments, compare distributions rather than individual trajectories.

---

# Resource and Budget Controls

Every comparison must specify:

* Environment steps
* Episodes
* Derivation budget (`maxDerivationsPerStep`)
* Derivation depth (`maxDerivationDepth`)
* Memory capacity (`maxConcepts`)
* Wall-clock time
* CPU/memory limits where relevant

Do not declare a cognitive advantage merely because one system received substantially more computation.

Likewise, do not declare cognitive failure because an artificially restrictive derivation budget prevented required reasoning.

Run:

1. **Normal budget**
2. **Stress budget**
3. **Scaling experiment**

This separates algorithmic failure from resource failure.

---

# RL Parity Harness

Create:

```text
scripts/rl-parity.ts
```

Example:

```bash
pnpm exec tsx scripts/rl-parity.ts \
  --env bandit \
  --baseline epsilon-greedy \
  --seeds 10

pnpm exec tsx scripts/rl-parity.ts \
  --env gridworld \
  --baseline qlearning \
  --seeds 10
```

Outputs:

```text
.reports/rl-parity/summary.json
.reports/rl-parity/gridworld-qlearning.csv
.reports/rl-parity/bandit-ucb.csv
```

Example summary:

```json
{
  "environment": "gridworld-4x4",
  "baseline": "qlearning",
  "mode": "senars-native",
  "seeds": 10,
  "baselineReturn": 0.82,
  "senarsReturn": 0.79,
  "policyAgreement": 0.93,
  "valueCorrelation": 0.91,
  "convergenceStepsBaseline": 420,
  "convergenceStepsSenars": 610,
  "pass": true
}
```

---

# Documentation

Create:

```text
docs/tech/cognitive-grounding.md
docs/tech/rl-parity.md
```

## cognitive-grounding.md

Document:

* Belief/perception contract (using `nar.believe()`, `Task`, `Truth`)
* Goal/action contract (using `nar.goal()`, `Inheritance(Product, Atom('^op'))`)
* Reward representation (using `Truth.f`/`Truth.c`)
* Truth semantics (`Truth.revision`, `Truth.expectation`, etc.)
* Confidence semantics
* Memory behavior (`Memory.getStatistics().memoryPressure`)
* Trace requirements (`nar.explain()`, `nar.traceTerm()`)
* No-bypass architecture

## rl-parity.md

Document:

* RL mapping
* Environments
* Baselines
* Adapter architecture
* Metrics
* Thresholds
* Seeds
* Reports
* Reproduction commands
* Failure classification

---

# Suggested File Layout

```text
TODO2.md

docs/tech/
  cognitive-grounding.md
  rl-parity.md

tests/nar/rl/
  contract/
    belief-perception.test.ts
    goal-action.test.ts
    reward-belief.test.ts
    no-bypass.test.ts

  environments/
    BanditEnv.ts
    GridWorldEnv.ts
    StochasticGridWorldEnv.ts
    NonStationaryBanditEnv.ts
    MemoryPressureEnv.ts

  baselines/
    epsilonGreedy.ts
    qLearning.ts
    sarsa.ts
    ucb.ts

  adapters/
    BeliefPerceptionAdapter.ts
    GoalActionAdapter.ts
    QBeliefStore.ts
    RewardBeliefAdapter.ts
    RLParityHarness.ts

  parity/
    bandit-epsilon-greedy.test.ts
    bandit-ucb.test.ts
    gridworld-qlearning.test.ts
    stochastic-sarsa.test.ts
    nonstationary-revision.test.ts
    memory-pressure.test.ts

scripts/
  rl-parity.ts
```

---

# Task Breakdown

## Phase A — Freeze and Reorient

* [x] Create `TODO2.md`.
* [ ] Mark M4 blocked by M3.5 in project tracking.
* [ ] Defer sabotage/self-repair litmus (`tests/nar/integration/self-improvement-litmus.test.ts`).
* [ ] Freeze new self-modification features.
* [ ] Disable self-modification in RL tests (`enableSelf: false`).
* [ ] Disable LM rules in RL tests (`enableLMRules: false`).
* [ ] Disable RLFP initially (`enableRLFP: false`).
* [ ] Establish reproducible test configuration.

**Definition of done:** project tracking explicitly treats M3.5 as the gate for further autonomous self-modification.

---

## Phase B — Cognitive Contracts

* [ ] Belief/perception contract.
* [ ] Goal/action contract.
* [ ] Reward contract.
* [ ] Value-belief representation (native Product/Inheritance form).
* [ ] Confidence semantics.
* [ ] Exploration semantics (curiosity drive + low confidence).
* [ ] Canonical Narsese forms.
* [ ] Trace semantics.

**Definition of done:** contracts are documented in `docs/tech/cognitive-grounding.md` and independently testable.

---

## Phase C — Contract Tests

* [ ] Belief perception tests.
* [ ] Goal action tests.
* [ ] Reward belief tests.
* [ ] No-bypass tests.

```bash
pnpm test tests/nar/rl/contract
```

**Definition of done:** all contracts pass.

---

## Phase D — Baseline RL

* [ ] Epsilon-greedy (seeded).
* [ ] UCB (seeded).
* [ ] Q-learning (seeded).
* [ ] SARSA (seeded).
* [ ] Baseline sanity tests.
* [ ] Baseline solves each environment without SeNARS.

**Definition of done:** conventional RL works independently of SeNARS cognitive mechanisms.

---

## Phase E — Environments

* [ ] BanditEnv.
* [ ] Deterministic GridWorldEnv.
* [ ] Stochastic GridWorldEnv.
* [ ] Non-stationary environment.
* [ ] Memory-pressure environment.
* [ ] Seed support.
* [ ] Metrics logging.

---

## Phase F — Interface Parity

* [ ] Direct Q-learning.
* [ ] Belief/goal Q-learning (adapter-wrapped).
* [ ] Compare trajectories.
* [ ] Compare policies.
* [ ] Compare values.
* [ ] Run multiple seeds.

**Gate F:**

> Adapter-wrapped conventional RL must be statistically close to direct RL.

If this gate fails, fix the interface before evaluating native cognition.

---

## Phase G — Cognitive Parity

* [ ] Implement `QBeliefStore` using `nar.memory`.
* [ ] Implement value-belief updates via `Truth.revision`.
* [ ] Implement expectation-based action selection (`Truth.expectation()`).
* [ ] Implement confidence-aware exploration (low `truth.c` → curiosity drive / random goal).
* [ ] Integrate curiosity drive (`DriveManager.stimulate('curiosity', ...)`).
* [ ] Integrate reward revision.
* [ ] Run bandit parity.
* [ ] Run deterministic GridWorld parity.
* [ ] Run non-stationary parity.

**Gate G:**

Native SeNARS meets the agreed parity thresholds on at least three environments (Bandit, Deterministic GridWorld, Non-stationary).

---

## Phase H — Trace Validation

* [ ] Record derivation traces (`nar.traceAPI`).
* [ ] Connect beliefs to selected goals.
* [ ] Connect goals to tool execution.
* [ ] Connect execution to reward.
* [ ] Connect reward to subsequent belief revision.
* [ ] Verify no hidden causal path.

**Gate H:**

Every selected action can be causally reconstructed from the cognitive trace using `nar.explain()` and `nar.getDerivationHistory()`.

---

## Phase I — Stress and Boundary Testing

Only after basic parity:

* [ ] Increase noise.
* [ ] Increase environment size.
* [ ] Increase memory pressure (reduce `maxConcepts`).
* [ ] Increase derivation depth.
* [ ] Introduce partial observability.
* [ ] Introduce delayed rewards.
* [ ] Introduce non-stationarity.
* [ ] Measure graceful degradation.

The goal is not merely to obtain a pass/fail number.

The goal is to map:

> **Where does the cognitive architecture remain competent, and where does it break?**

---

## Phase J — Cognitive Advantage

After parity and stress testing:

* [ ] Demonstrate confidence-aware behavior.
* [ ] Demonstrate contradiction handling.
* [ ] Demonstrate explainable decisions.
* [ ] Demonstrate adaptation after environmental change.
* [ ] Demonstrate memory-pressure behavior.
* [ ] Demonstrate schema induction where appropriate.

Only results that survive the earlier gates should be presented as cognitive advantages.

---

# Acceptance Criteria for M3.5

M3.5 is complete when:

### Architecture

* [ ] Belief contract passes.
* [ ] Goal contract passes.
* [ ] Reward contract passes.
* [ ] No-bypass contract passes.

### RL

* [ ] All baseline algorithms pass sanity tests.
* [ ] Interface parity passes (Level 1).
* [ ] Native cognitive parity passes on ≥3 environments (Level 2).
* [ ] Non-stationary adaptation passes.
* [ ] Multiple seeds reproduce the result.

### Explainability

* [ ] Action derivation can be reconstructed.
* [ ] Goal dispatch is traceable.
* [ ] Reward updates are traceable.
* [ ] No hidden action path exists.

### Reproducibility

* [ ] Deterministic mode works.
* [ ] Reports contain seeds/configuration.
* [ ] CI test mode exists (short: 3 seeds, few episodes).
* [ ] No LM/network/self-modification contamination.

### Documentation

* [ ] `docs/tech/cognitive-grounding.md`
* [ ] `docs/tech/rl-parity.md`

### Scientific Hygiene

* [ ] Negative results receive provisional/corrected/hard classification.
* [ ] Known defects are audited before claiming a boundary (Mandatory Defect Audit).
* [ ] Thresholds are fixed before final evaluation.
* [ ] No successful result relies on a bypass.

---

# Milestone Table

| Milestone | Description                           | Status              |
| --------- | ------------------------------------- | ------------------- |
| M0        | Green CI                              | ✅                   |
| M1        | Self-test                             | ✅                   |
| M1.5      | Cognitive scenarios                   | ✅                   |
| M2        | Self-tune                             | ✅                   |
| M2.5      | Imagination                           | ✅                   |
| M3        | Self-improve machinery                | ✅                   |
| **M3.5**  | **Cognitive grounding and RL parity** | **ACTIVE**          |
| M4        | Production loop                       | **BLOCKED BY M3.5** |

---

# Explicitly Deferred Until M3.5

* [ ] End-to-end sabotage/auto-fix litmus.
* [ ] M4 long-running production loop.
* [ ] New self-modification tools.
* [ ] More autonomous meta-rules.
* [ ] RLFP-driven code modification.
* [ ] Autonomous schema promotion.
* [ ] Production observability dashboards.
* [ ] Prometheus integration unless directly required by experiments.

---

# Risks and Mitigations

| Risk                                                  | Mitigation                                   |
| ----------------------------------------------------- | -------------------------------------------- |
| Truth revision differs from TD learning               | Compare behavior, not exact internal numbers |
| Confidence semantics are ambiguous                    | Start with explicit, documented semantics    |
| Adapter overhead changes behavior                     | Interface-parity gate (Level 1)              |
| Baseline secretly bypasses cognition                  | Instrumented no-bypass tests                 |
| Operation AST is malformed                            | Assert native AST structure (`Inheritance(Product, Atom('^op'))`) |
| LM nondeterminism contaminates results                | Disable/mocking (`enableLMRules: false`)     |
| Memory pressure creates accidental failures           | Separate normal and stress regimes (E5)      |
| Derivation budget masks capability                    | Run budget-scaling experiments               |
| One seed produces a misleading result                 | Multi-seed validation (≥10 seeds)            |
| Negative result is caused by implementation defect    | Mandatory defect audit                       |
| Repeated failures are rationalized indefinitely       | Predefine corrected/hard-falsification rule  |
| Cognitive system receives unfair compute advantage    | Record and match resource budgets            |
| Cognitive system receives unfair compute disadvantage | Include scaling/budget sweeps                |
| Tests become too slow                                 | Short CI mode + full offline validation      |
| Explanation is post-hoc rather than causal            | Require trace-backed explanations            |

---

# First Concrete Pull Requests

## PR 1 — Roadmap

* [x] Create `TODO2.md`.

## PR 2 — Cognitive Contracts

Create:

```text
docs/tech/cognitive-grounding.md
```

## PR 3 — Contract Test Skeleton

Create:

```text
tests/nar/rl/contract/
```

## PR 4 — Minimal Environments

Create:

```text
tests/nar/rl/environments/BanditEnv.ts
tests/nar/rl/environments/GridWorldEnv.ts
```

## PR 5 — Baselines

Create:

```text
tests/nar/rl/baselines/
```

## PR 6 — Adapters

Create:

```text
tests/nar/rl/adapters/
```

## PR 7 — First Parity Experiment

Create:

```text
tests/nar/rl/parity/bandit-epsilon-greedy.test.ts
```

## PR 8 — Parity Runner

Create:

```text
scripts/rl-parity.ts
```

## PR 9 — Trace Validation

Create tests proving the causal chain:

```text
belief
  ↓
value belief
  ↓
goal
  ↓
tool execution
  ↓
reward
  ↓
belief revision
```

## PR 10 — Stress/Boundary Suite

Add:

```text
tests/nar/rl/parity/nonstationary-revision.test.ts
tests/nar/rl/parity/memory-pressure.test.ts
```

---

# Recommended Execution Order

The shortest path to useful evidence is:

1. **Freeze self-modification.**
2. **Verify cognitive contracts.**
3. **Build deterministic bandit.**
4. **Prove direct-vs-adapter parity (Level 1).**
5. **Implement native value beliefs (`QBeliefStore`).**
6. **Pass bandit cognitive parity (Level 2).**
7. **Pass deterministic GridWorld.**
8. **Pass non-stationary adaptation.**
9. **Validate causal traces.**
10. **Run noise/memory/budget stress tests.**
11. **Only then investigate cognitive advantages (Level 3).**
12. **Only after M3.5 passes, resume autonomous self-modification.**

---

# Final Decision Rule

The purpose of M3.5 is not to make SeNARS look good.

It is to establish a trustworthy answer to:

> **Can the SeNARS cognitive substrate perceive, value, decide, act, learn, remember, adapt, and explain itself under controlled closed-loop conditions?**

If **yes**, M4 becomes scientifically justified.

If **no**, the resulting failures should identify exactly which cognitive contract breaks and under what conditions.

If a result appears negative, first determine whether it is:

1. **implementation defect,**
2. **representation mismatch,**
3. **resource/budget limitation,**
4. **adapter/interface failure,**
5. **hyperparameter/configuration failure,**
6. or finally a **genuine cognitive limitation**.

That ordering is the required standard before using RL results to justify or reject further self-modification.

> **Establish cognitive competence first. Then trust self-modification.**