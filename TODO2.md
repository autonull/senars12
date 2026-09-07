# TODO2.md — Cognitive Grounding Before Self-Modification

## Strategic Direction

SeNARS12 has already built significant self-modification machinery:

- Meta-rules (`nar/src/rules/meta-rules.ts`)
- Drive-based goal injection (`nar/src/drives/manager.ts`, `nar/src/nar-execution.ts:168-206`)
- RLFP reward tracking (`nar/src/rlfp/`, `nar/src/nar-execution.ts:149-155`)
- Shadow worktree execution (external tools)
- Codemod tools (`nar/src/tools/adapters/external-tools.ts`)
- Goal-to-tool dispatch (`nar/src/tools/tool-registry.ts:475-514`)
- Approval-gated self-repair (`nar/src/self/`)

However, before expanding self-modification further, we need to establish that the underlying **cognitive framework** is stable enough to support it.

The next phase is therefore:

> **M3.5: Cognitive Framework Grounding and RL Parity**

This phase temporarily de-prioritizes:

- M4 production loop
- End-to-end sabotage/self-repair demos (`tests/nar/integration/self-improvement-litmus.test.ts`)
- Further self-tool expansion
- Self-modification feature growth

and instead prioritizes:

- Belief-grounded perception (via `nar.input()`, `nar.believe()`)
- Goal-grounded action (via `nar.goal()`, `ToolManager.executeToolGoal()`)
- Value representation via beliefs (truth values: frequency/confidence)
- Reward representation via goals / belief satisfaction
- Parity with conventional RL techniques
- Cognitive trace validation (`nar.traceAPI`, `nar.explain()`)
- Memory and uncertainty behavior under pressure

---

## Core Principle

Self-modification should only occur after the system can demonstrate stable cognitive behavior in controlled environments.

Therefore:

> **No further autonomous self-modification work until the cognitive framework passes RL parity and grounding tests.**

---

## New Active Milestone

### M3.5 — Cognitive Framework Grounding and RL Parity

**Objective:**

Demonstrate that SeNARS12 can function as a grounded cognitive agent in canonical reinforcement learning environments using:

- **Beliefs** (`TaskType = 'belief'`) for perception
- **Goals** (`TaskType = 'goal'`, especially operation goals `Inheritance(Product, Atom('^op'))`) for action
- **Truth values** (`{frequency, confidence}`) for uncertainty / value estimation
- **Revision / decay / learning** (`Truth.revision`, `Truth.induction`, bag decay) for adaptation
- **Derivation traces** (`nar.traceAPI`, `nar.explain()`) for explainability

---

## Non-Goals for This Phase

During M3.5, avoid expanding:

- Autonomous code modification
- Meta-rule generation of codemods
- Shadow worktree self-repair
- RLFP policy optimization for code changes
- Web UI dashboards
- Production deployment tooling
- Long-running unattended loops

These remain valid future work, but are blocked until M3.5 is complete.

---

# RL Parity Concept

We want to show that SeNARS12 can support standard RL semantics without breaking the cognitive contract.

## Conventional RL Mapping (Aligned with Codebase)

| Conventional RL Concept | SeNARS12 Cognitive Representation |
|---|---|
| Observation / state perception | `Task { type: 'belief', term, truth: {f, c} }` via `nar.believe()` |
| Reward | Goal satisfaction `Task { type: 'goal', truth }` or reward belief `(reward --> achieved)` |
| Action selection | Goal generation, especially operation goals `^tool_name(args)` |
| Policy | Derived goal tendencies from beliefs (priority + truth expectation) |
| Value function | Beliefs about expected future reward `((*, state, ^action) --> predicts_reward)` |
| Exploration | Curiosity drive (`nar.driveManager`), low-confidence belief sampling |
| Exploitation | High-confidence, high-expectation goal derivation |
| Learning | Truth revision (`Truth.revision`), belief decay, schema induction, RLFP |
| Memory | Concept network (`Memory`), priority bags (`BagStrategy`), episodic traces (`EpisodicMemory`) |

---

# Belief-Based Perception Contract

All environment perception must enter SeNARS as **belief tasks** (`type: 'belief'`).

Perception must not directly mutate action state, policy tables, or environment variables.

## Example Observation (Actual Narsese)

If the agent observes grid cell `(3,4)`:

```narsese
(state:s_3_4 --> observed). %1.00;0.95%
(self --> state:s_3_4). %1.00;0.95%
```

If the agent observes a wall to the north:

```narsese
(feature:wall_north --> present). %1.00;0.90%
```

If a sensor is noisy, confidence should be reduced:

```narsese
(feature:wall_north --> present). %1.00;0.45%
```

If repeated observations agree, confidence should increase through `Truth.revision`.

---

## Perception Requirements (Codebase-Aligned)

Create tests proving:

- Observations become belief tasks via `nar.believe(term, truth)` or `nar.input(term, 'belief', truth)`.
- Belief truth values encode sensor confidence (`truth.c`).
- Repeated consistent observations increase confidence via `Truth.revision`.
- Contradictory observations reduce confidence or create contradiction (detected via `nar.checkConstitutionViolation` or conflict analyzers).
- Perception does not directly trigger actions (no `^tool` goals from perception alone).
- Perception is queryable through memory / concept network (`nar.getConcept()`, `nar.getBeliefs()`, `nar.queryTerm()`).
- Temporal stamps / evidence prevent naive overwriting (`Stamp` with `source: 'input'`, `evidence`).

---

# Goal-Based Action Control Contract

All actions must leave SeNARS as **goals** (`type: 'goal'`), preferably native operation goals.

Actions must not be executed by direct function calls from perception or baseline code.

## Example Action Goal (Actual AST Format)

```narsese
(^move_north)!
```

Or, with arguments (Product term):

```narsese
^move_to((*, state:s_3_4, direction:north))!
```

Internally, operation goals **must** use the native operation AST (as parsed by `termParser` and executed by `ToolManager.executeToolGoal`):

```
Inheritance(
  Product(state:s_3_4, direction:north),  // subject: arguments
  Atom('^move_to')                         // predicate: operation name
)
```

This is the **only** supported format. String hacks are rejected by `ToolManager.executeToolGoal` (see `tool-registry.ts:475-514`).

---

## Action Requirements (Codebase-Aligned)

Create tests proving:

- High-expected-value beliefs can derive action goals (via reasoning or adapter).
- Action goals are dispatched through `ToolManager.executeToolGoal()` (called from `NARExecution.dispatchToolGoals()`).
- Invalid goals are rejected safely (returns `ToolResult { success: false }`).
- Action execution happens only from goal dispatch (no direct `tool.execute()` from test code).
- Goal priority (`task.budget.priority`) reflects expected utility.
- Exploration goals can arise from low-confidence beliefs or curiosity drive (`DriveManager.stimulate('curiosity', ...)`).
- Action goals respect AIKR budgets (`config.maxDerivationsPerStep`, `config.maxDerivationDepth`).
- The system does not act merely because an observation occurred.

---

# Reward Representation (Codebase-Aligned)

Reward should be represented using beliefs and/or goals, using the existing `Truth` type.

## Reward as Belief

```narsese
(reward:high --> achieved). %0.90;0.90%
```

## Reward as Goal Satisfaction

```narsese
(reward:high)!
```

## State-Action Value Belief (Q-value analog)

Using the native Product operator for state-action pairs:

```narsese
((*, state:s_3_4, ^move_north) --> predicts_reward). %0.78;0.62%
```

Where:
- `(*, ...)` = `Product` term (commutative, n-ary)
- `^move_north` = `Atom` with symbol starting with `^` (operation)
- `-->` = `Inheritance` (implication)
- `predicts_reward` = `AtomicTerm` concept

For early adapter tests, a simplified test-local form is acceptable:

```narsese
(q:s_3_4:move_north --> expected_reward). %0.78;0.62%
```

The simplified form is fine for adapter tests, but the long-term target should use the cognitive Product/Inheritance form.

---

# RL Parity Test Layers

We need three layers of tests.

---

## Layer 1: Interface Parity

Show that wrapping conventional RL algorithms in the SeNARS belief/goal interface does not destroy their behavior.

### Purpose

Prove that:

- Beliefs can carry perception losslessly enough for RL.
- Goals can carry action intent losslessly enough for control.
- The adapter layer is stable.

### Design

Use a conventional baseline such as Q-learning.

Run it in two modes:

1. **Direct Mode**
   - Q-learning receives observations directly.
   - Q-learning chooses actions directly.

2. **Belief/Goal Mode**
   - Observations pass through `BeliefPerceptionAdapter` → `nar.believe()`.
   - Q-learning reads state only from beliefs (`nar.getBeliefs()`, `nar.queryTerm()`).
   - Chosen actions are emitted as goals via `GoalActionAdapter` → `nar.goal(operationGoal)`.
   - Goals pass through `ToolManager.executeToolGoal()`.
   - Environment steps only when goals are dispatched.

### Success Criterion

Direct Mode and Belief/Goal Mode should produce near-identical performance.

Suggested thresholds:

| Metric | Target |
|---|---|
| Cumulative return difference | <= 2% |
| Action agreement | >= 98% |
| Policy agreement after convergence | >= 95% |
| Value estimate correlation | >= 0.98 |

This layer proves the interface is not pathological.

---

## Layer 2: Cognitive Parity

Show that SeNARS-native reasoning can approximate conventional RL behavior.

### Purpose

Prove that:

- Belief revision (`Truth.revision`) can support learning from reward.
- Goal generation can support action selection.
- Confidence (`truth.c`) can support exploration/exploitation.
- NAR mechanisms can produce stable policy improvement.

### Design

Replace the conventional Q-learning update with SeNARS-native mechanisms where possible:

- Truth revision for value updates.
- Priority (`task.budget.priority`) for action preference.
- Confidence for uncertainty.
- Curiosity drive (`DriveManager`) for exploration.
- Goal derivation for action selection.
- Episodic memory (`EpisodicMemory`) for trajectory context.

### Success Criterion

SeNARS-native behavior should be comparable to a conventional RL baseline, though not necessarily identical.

Suggested thresholds:

| Metric | Target |
|---|---|
| Cumulative return | >= 85% of baseline |
| Final policy agreement | >= 85% |
| Value-belief correlation with Q-values | >= 0.85 |
| Convergence steps | <= 2x baseline |
| Regret in bandit tasks | <= 1.5x baseline after burn-in |

---

## Layer 3: Cognitive Advantage Tests

Once parity is established, show where SeNARS can do something conventional tabular RL does not naturally do.

Examples:

- Explicit belief confidence under noisy sensors.
- Contradiction detection between observations (via conflict analyzers).
- Natural-language explanation of action choice (`nar.explain()`, `nar.askNaturalLanguage()`).
- Memory pressure degradation curves (`Memory.getStatistics().memoryPressure`).
- Belief revision after environment changes (`Truth.revision`, `Truth.deductionWeak`).
- Schema induction from repeated successful action sequences (`learning/schema-induction.ts`).

These are not required for the first RL parity milestone, but they are the long-term reason for using SeNARS instead of a plain RL algorithm.

---

# Required RL Environments

Start small, deterministic, and interpretable.

## 1. Multi-Armed Bandit

Purpose:

- Test exploration/exploitation.
- Test reward belief updates.
- Test confidence-based action selection.

Variants:

- Stationary bandit.
- Noisy bandit.
- Drifting bandit.

Baseline algorithms:

- Epsilon-greedy.
- UCB1.

---

## 2. Deterministic GridWorld

Purpose:

- Test state perception.
- Test action goals.
- Test sequential decision making.
- Test convergence to optimal policy.

Example:

```text
S . . .
. . # .
. # . .
. . . G
```

Baseline algorithms:

- Q-learning.
- SARSA.
- Value iteration as oracle.

---

## 3. Stochastic GridWorld

Purpose:

- Test uncertainty.
- Test confidence.
- Test robustness to stochastic transitions/rewards.

Baseline algorithms:

- SARSA.
- Expected SARSA.
- Q-learning.

---

## 4. Non-Stationary Reward Environment

Purpose:

- Test forgetting.
- Test belief revision.
- Test truth decay.
- Test adaptation after reward changes.

Baseline:

- Discounted Q-learning.
- Sliding-window Q-learning.

---

# Baseline Algorithms to Implement

Place these in test utilities, not in the core cognitive engine.

Suggested files:

```text
tests/nar/rl/baselines/epsilonGreedy.ts
tests/nar/rl/baselines/qLearning.ts
tests/nar/rl/baselines/sarsa.ts
tests/nar/rl/baselines/ucb.ts
```

Required baseline features:

- Seeded RNG (deterministic).
- Configurable learning rate (`alpha`).
- Configurable discount factor (`gamma`).
- Configurable exploration (`epsilon`, `c` for UCB).
- Serializable Q-table for comparison.
- Compatible with `BeliefPerceptionAdapter` / `GoalActionAdapter` interfaces.

---

# Required SeNARS RL Adapters

Suggested files:

```text
tests/nar/rl/adapters/BeliefPerceptionAdapter.ts
tests/nar/rl/adapters/GoalActionAdapter.ts
tests/nar/rl/adapters/QBeliefStore.ts
tests/nar/rl/adapters/RewardBeliefAdapter.ts
tests/nar/rl/adapters/RLParityHarness.ts
```

---

## BeliefPerceptionAdapter

Responsibilities:

- Convert environment observations into Narsese belief tasks.
- Encode sensor reliability as confidence (`truth.c`).
- Encode temporal information if needed (`Stamp`).
- Avoid direct state mutation.

Suggested interface:

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

Implementation notes:
- Use `nar.believe(term, truth)` or `nar.input(term, 'belief', truth)`.
- Map `stateId` → `(self --> state:xxx)` belief.
- Map features → `(feature:xxx --> present)` beliefs.
- Confidence = sensor reliability (configurable per feature).

---

## GoalActionAdapter

Responsibilities:

- Convert selected action intentions into operation goals (AST format).
- Dispatch goals through `nar.goal()` → `ToolManager.executeToolGoal()`.
- Return execution result only after goal dispatch.
- Prevent direct environment access.

Suggested interface:

```typescript
interface RLAction {
  name: string;           // e.g., "move_north"
  args?: Record<string, unknown>; // e.g., { direction: "north" }
}

interface GoalActionAdapter {
  proposeAction(action: RLAction): Task; // goal task with operation AST
  dispatchPendingGoals(nar: NAR): Promise<ToolResult[]>; // uses nar.tools.executeToolGoal
}
```

Implementation notes:
- Build `Inheritance(Product(args...), Atom('^' + name))` AST.
- Call `nar.goal(goalTerm)` to inject.
- Call `nar.getExecution().dispatchToolGoals()` or await next `nar.run()` cycle.
- Environment step happens in tool execution (tool must be registered).

---

## QBeliefStore

Responsibilities:

- Store Q-value-like beliefs in SeNARS memory.
- Read value beliefs for a given state.
- Update beliefs from reward (using `Truth.revision`).
- Expose confidence for exploration (low confidence → explore).
- Optionally map to/from conventional Q-table for comparison.

Possible representation:

```narsese
((*, state:s_3_4, ^move_north) --> predicts_reward). %0.78;0.62%
```

Operations:
- `getValue(state, action)` → `truth.f` (frequency = expected reward), `truth.c` (confidence).
- `updateValue(state, action, reward)` → revise existing belief with new evidence.
- `getAllActions(state)` → return beliefs for all actions from that state.

---

## RewardBeliefAdapter

Responsibilities:

- Normalize environment reward into `[0, 1]` (frequency).
- Convert reward into belief and/or goal satisfaction.
- Update value beliefs after action outcomes (via `QBeliefStore`).
- Record reward history for parity metrics.

---

# Required Contract Tests

Suggested files:

```text
tests/nar/rl/contract/belief-perception.test.ts
tests/nar/rl/contract/goal-action.test.ts
tests/nar/rl/contract/reward-belief.test.ts
tests/nar/rl/contract/no-bypass.test.ts
```

---

## Belief Perception Contract Tests

Test cases:

- Observation creates belief task with correct term and truth.
- Noisy observation creates lower confidence (`truth.c`).
- Repeated observation increases confidence via revision.
- Contradictory observations reduce confidence or flag contradiction.
- Terminal observation creates terminal belief.
- Perception does not create action goals (`type !== 'goal'`).
- Perception does not directly call environment step.

---

## Goal Action Contract Tests

Test cases:

- Goal causes exactly one action execution via `executeToolGoal`.
- Goal with invalid operation fails safely (returns error result).
- Goal priority (`budget.priority`) influences action selection order.
- Multiple goals respect budget and priority (AIKR).
- Goal dispatch uses native operation AST (`Inheritance(Product, Atom('^op'))`).
- Action execution returns observation/reward back into perception.
- No action occurs without goal.

---

## Reward Belief Contract Tests

Test cases:

- Positive reward creates reward belief with high frequency.
- Negative reward creates negative/low reward belief.
- Reward updates relevant state-action belief via revision.
- Reward confidence reflects outcome reliability.
- Terminal reward creates goal satisfaction signal.

---

## No-Bypass Tests

Very important.

These tests ensure the RL baseline is not secretly cheating by accessing environment state directly.

Test cases:

- Baseline receives observations only through belief queries (`nar.getBeliefs()`, `nar.queryTerm()`).
- Baseline emits actions only through goals (`nar.goal()`).
- Environment step is only invoked by goal dispatch (tool execution).
- Direct state access is instrumented and fails the test.

---

# Required Parity Tests

Suggested files:

```text
tests/nar/rl/parity/bandit-epsilon-greedy.test.ts
tests/nar/rl/parity/bandit-ucb.test.ts
tests/nar/rl/parity/gridworld-qlearning.test.ts
tests/nar/rl/parity/stochastic-sarsa.test.ts
tests/nar/rl/parity/nonstationary-revision.test.ts
```

---

## Bandit Epsilon-Greedy Parity

Environment:

- 5 or 10 arms.
- Stationary Bernoulli rewards.
- Fixed episode length.

Compare:

- Direct epsilon-greedy.
- Belief/goal epsilon-greedy (adapter-wrapped).
- SeNARS-native belief-driven selection.

Metrics:

- Cumulative reward.
- Regret.
- Optimal arm selection rate.
- Exploration rate.

Pass criteria:

| Comparison | Target |
|---|---|
| Direct vs adapter | near equality |
| SeNARS-native vs baseline | >= 85% final performance |
| Optimal arm selection | within 10% of baseline |

---

## Bandit UCB Parity

Purpose:

Test whether belief confidence can behave similarly to UCB uncertainty bonuses.

Metrics:

- Regret curve.
- Exploration of uncertain arms.
- Convergence to optimal arm.

Pass criteria:

- SeNARS-native exploration should not be random.
- Low-confidence beliefs should be explored more often.
- Regret should be within 1.5x UCB after burn-in.

---

## GridWorld Q-Learning Parity

Environment:

- Deterministic 4x4 or 6x6 grid.
- One terminal goal.
- Step penalty optional.

Compare:

- Direct Q-learning.
- Belief/goal Q-learning adapter.
- SeNARS-native value-belief learner.

Metrics:

- Episode return.
- Steps to goal.
- Policy agreement.
- Q-value / belief-value correlation.

Pass criteria:

| Metric | Target |
|---|---|
| Policy agreement | >= 90% |
| Return ratio | >= 0.9 |
| Q-belief correlation | >= 0.9 |
| Convergence steps | <= 2x baseline |

---

## Stochastic SARSA Parity

Purpose:

Test on-policy behavior under stochastic outcomes.

Metrics:

- Average return.
- Policy stability.
- Confidence calibration.

Pass criteria:

- Return within 10% of baseline.
- No catastrophic oscillation.
- Confidence decreases after surprising outcomes.

---

## Non-Stationary Revision Parity

Purpose:

Test belief revision and forgetting.

Environment:

- Reward mapping changes halfway through training.

Compare:

- Discounted Q-learning.
- SeNARS belief revision / decay.

Metrics:

- Adaptation delay.
- Post-change return.
- Pre-change unlearning.

Pass criteria:

- SeNARS adapts within 1.5x baseline adaptation delay.
- Old high-value beliefs decrease in frequency/confidence.
- New reward structure is learned.

---

# RL Parity Harness

Create a runner script:

```text
scripts/rl-parity.ts
```

Example usage:

```bash
pnpm exec tsx scripts/rl-parity.ts --env bandit --baseline epsilon-greedy --seeds 10
pnpm exec tsx scripts/rl-parity.ts --env gridworld --baseline qlearning --seeds 10
pnpm exec tsx scripts/rl-parity.ts --env stochastic-gridworld --baseline sarsa --seeds 10
pnpm exec tsx scripts/rl-parity.ts --env nonstationary --baseline qlearning --seeds 10
```

The harness should output:

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

Optional output files:

```text
.reports/rl-parity/summary.json
.reports/rl-parity/gridworld-qlearning.csv
.reports/rl-parity/bandit-ucb.csv
```

---

# Determinism Requirements

RL parity tests must be reproducible.

Requirements:

- All environments accept a seed.
- Baselines accept a seed.
- Exploration uses seeded RNG.
- LM providers are disabled or mocked in RL parity tests (`enableLMRules: false`).
- No network calls.
- No self-modification tools enabled (`enableSelf: false`).
- No codemod tools enabled.
- No shadow worktree usage.
- No approval prompts.

Suggested test config (matching `NARConfig`):

```typescript
{
  enableLMRules: false,
  enableTools: true, // only RL action tools (move, observe, etc.)
  enableSelf: false,
  enableRLFP: false, // initially; later optional
  persistState: false,
  maxConcepts: 10000, // large limit for tests
  maxDerivationsPerStep: 1000,
  maxDerivationDepth: 20
}
```

RLFP may be introduced later, but the first parity tests should avoid it to reduce nondeterminism.

---

# Observability Requirements

For each RL episode, record:

- Observation beliefs (from `nar.getBeliefs()`).
- Selected action goals (from `nar.getGoals()`).
- Goal priorities (`task.budget.priority`).
- Truth values of value beliefs (`truth.f`, `truth.c`).
- Confidence values.
- Reward beliefs.
- Derivation trace identifiers (`nar.getDerivationHistory()`, `nar.traceTerm()`).
- Action execution result (`ToolResult`).
- Environment return.
- Baseline Q-values, if applicable.

This allows post-test explanation such as:

```text
The agent chose ^move_north because belief
((*, state:s_3_4, ^move_north) --> predicts_reward)
had truth %0.81;0.74%, higher than alternatives.
```

---

# Documentation Deliverables

Create or update:

```text
docs/tech/cognitive-grounding.md
docs/tech/rl-parity.md
```

## `cognitive-grounding.md`

Should describe:

- Why cognitive grounding precedes self-modification.
- Belief/perception contract (using `nar.believe()`, `Task.type = 'belief'`).
- Goal/action contract (using `nar.goal()`, `Inheritance(Product, Atom('^op'))`).
- Reward representation (using `Truth` frequency/confidence).
- Memory pressure behavior (`Memory.getStatistics().memoryPressure`).
- Trace explainability expectations (`nar.explain()`, `nar.traceTerm()`).

## `rl-parity.md`

Should describe:

- RL mapping (table above).
- Environments.
- Baselines.
- Metrics.
- Pass criteria.
- How to run tests.
- How to interpret reports.

---

# Suggested File Layout

```text
TODO2.md

docs/tech/cognitive-grounding.md
docs/tech/rl-parity.md

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

scripts/
  rl-parity.ts
```

---

# Task Breakdown

## Phase A: Freeze and Reorient

- [x] Create `TODO2.md`.
- [ ] Mark M4 as blocked by M3.5 in project tracking.
- [ ] Mark sabotage/self-repair demo as deferred.
- [ ] Add policy: no new self-modification features until M3.5 passes.
- [ ] Add policy: RL parity tests run with `enableSelf: false`, `enableLMRules: false`, `enableRLFP: false`.

---

## Phase B: Define Cognitive Contracts

- [ ] Document belief/perception contract (using actual `nar.believe()`, `Task`, `Truth`).
- [ ] Document goal/action contract (using actual `nar.goal()`, `Inheritance(Product, Atom('^op'))`).
- [ ] Document reward representation (using `Truth.f`/`Truth.c`).
- [ ] Document value-belief representation (Product/Inheritance form).
- [ ] Document exploration/confidence semantics (curiosity drive, `truth.c`).
- [ ] Decide canonical Narsese forms for RL tests.

Deliverable:

```text
docs/tech/cognitive-grounding.md
```

---

## Phase C: Build RL Contract Tests

- [ ] Implement `BeliefPerceptionAdapter` test doubles.
- [ ] Implement `GoalActionAdapter` test doubles.
- [ ] Add belief perception contract tests.
- [ ] Add goal action contract tests.
- [ ] Add reward belief contract tests.
- [ ] Add no-bypass tests.

Definition of done:

```bash
pnpm test tests/nar/rl/contract
```

passes.

---

## Phase D: Implement Baseline RL Algorithms

- [ ] Add seeded epsilon-greedy.
- [ ] Add seeded Q-learning.
- [ ] Add seeded SARSA.
- [ ] Add seeded UCB.
- [ ] Add baseline sanity tests.

Definition of done:

Baselines solve the environments without SeNARS.

---

## Phase E: Implement RL Environments

- [ ] BanditEnv.
- [ ] GridWorldEnv.
- [ ] StochasticGridWorldEnv.
- [ ] NonStationaryBanditEnv.
- [ ] Environment seed support.
- [ ] Environment metrics logging.

Definition of done:

Baseline algorithms can train in all environments.

---

## Phase F: Interface Parity

- [ ] Run Q-learning directly.
- [ ] Run Q-learning through belief/goal adapters.
- [ ] Compare results.
- [ ] Prove no meaningful performance loss.

Definition of done:

Direct baseline and adapter-wrapped baseline are near-identical.

---

## Phase G: Cognitive Parity

- [ ] Implement SeNARS-native value beliefs (`QBeliefStore` using `nar.memory`).
- [ ] Implement goal derivation from value beliefs (highest `Truth.expectation()` → goal).
- [ ] Implement confidence-based exploration (low `truth.c` → curiosity drive / random goal).
- [ ] Implement reward revision (`Truth.revision` for value updates).
- [ ] Run parity tests against baselines.

Definition of done:

SeNARS-native agent meets parity thresholds on at least:

- Bandit.
- Deterministic GridWorld.
- Non-stationary environment.

---

## Phase H: Parity Reporting

- [ ] Create `scripts/rl-parity.ts`.
- [ ] Emit JSON summary.
- [ ] Emit CSV episode logs.
- [ ] Add pass/fail thresholds.
- [ ] Add CI-compatible short tests (few seeds, few episodes).

Definition of done:

```bash
pnpm exec tsx scripts/rl-parity.ts --env bandit --baseline epsilon-greedy --seeds 3
```

works locally.

---

## Phase I: Cognitive Trace Validation

- [ ] Record action derivation traces (`nar.traceAPI`).
- [ ] Explain action choice from belief values (`nar.explain()`).
- [ ] Validate that action goals are derivable from beliefs.
- [ ] Ensure no hidden control path bypasses goals.

Definition of done:

For any selected action, the system can produce a trace of the form:

```text
Observed state belief:
  (self --> state:s_3_4) %1.00;0.95%

Relevant value beliefs:
  ((*, state:s_3_4, ^move_north) --> predicts_reward) %0.81;0.74%
  ((*, state:s_3_4, ^move_south) --> predicts_reward) %0.32;0.55%

Derived goal:
  (^move_north)!
  Inheritance(Product(state:s_3_4, direction:north), Atom('^move_to'))
```

---

# Recommended Acceptance Criteria for M3.5

M3.5 is complete when:

- [ ] Belief perception contract tests pass.
- [ ] Goal action contract tests pass.
- [ ] Reward belief contract tests pass.
- [ ] No-bypass tests pass.
- [ ] Baseline RL algorithms pass sanity tests.
- [ ] Interface parity tests pass.
- [ ] SeNARS-native parity tests pass on at least three environments.
- [ ] RL parity report can be generated.
- [ ] Action traces explain behavior.
- [ ] LM nondeterminism is disabled/mocked (`enableLMRules: false`).
- [ ] Self-modification is disabled in RL tests (`enableSelf: false`).
- [ ] Documentation exists (`docs/tech/cognitive-grounding.md`, `docs/tech/rl-parity.md`).

---

# Milestone Table Update

Update the milestone table to:

| Milestone | Description | Status |
|---|---|---|
| M0 | Green CI | ✅ |
| M1 | Self-test | ✅ |
| M1.5 | Cognitive scenarios | ✅ |
| M2 | Self-tune | ✅ |
| M2.5 | Imagination | ✅ |
| M3 | Self-improve machinery | ✅ |
| **M3.5** | **Cognitive grounding and RL parity** | **Active** |
| M4 | Production loop | Blocked by M3.5 |

---

# Explicitly Deferred Until After M3.5

- [ ] End-to-end sabotage/auto-fix litmus demo.
- [ ] M4 long-running production loop.
- [ ] Expansion of self-tools.
- [ ] More meta-rules.
- [ ] RLFP-driven code modification.
- [ ] Autonomous schema promotion into production rules.
- [ ] Full observability dashboards.
- [ ] Prometheus metrics unless directly needed for RL parity.

---

# Risks and Mitigations

| Risk | Mitigation |
|---|---|
| NAL truth revision does not match TD update exactly | Use behavioral parity thresholds, not exact numerical equality |
| Belief/goal overhead slows decision loops | Add simple action latch / decision period for RL tests |
| Confidence semantics are unclear | Start with explicit visit-count-derived confidence |
| LLM nondeterminism contaminates tests | Disable LM (`enableLMRules: false`) or use deterministic mock |
| Baseline cheats by reading environment directly | Add no-bypass instrumentation tests |
| Operation-goal parsing issues | Use native operation AST (`Inheritance(Product, Atom('^op'))`), not string patterns |
| Memory pressure causes unstable behavior | Start with large memory limits (`maxConcepts: 10000`), then add pressure tests later |
| Tests become too slow | Use short CI mode with fewer seeds and episodes |

---

# First Concrete Pull Requests

## PR 1: Create `TODO2.md`

Add this roadmap. ✅ Done.

## PR 2: Cognitive Contracts Documentation

Add:

```text
docs/tech/cognitive-grounding.md
```

## PR 3: RL Contract Test Skeleton

Add:

```text
tests/nar/rl/contract/
```

with failing or placeholder tests.

## PR 4: Minimal Environments

Add:

```text
tests/nar/rl/environments/BanditEnv.ts
tests/nar/rl/environments/GridWorldEnv.ts
```

## PR 5: Baselines

Add:

```text
tests/nar/rl/baselines/
```

## PR 6: Belief/Goal Adapters

Add:

```text
tests/nar/rl/adapters/
```

## PR 7: First Parity Test

Add:

```text
tests/nar/rl/parity/bandit-epsilon-greedy.test.ts
```

## PR 8: Parity Runner

Add:

```text
scripts/rl-parity.ts
```

---

# Recommended Decision

Create **`TODO2.md`** as the active roadmap.

Use `TODO.md` for historical implementation logs, completed phases, and session notes.

`TODO2.md` should focus only on the next cognitive validation phase:

> **Establish the cognitive framework through belief-grounded perception, goal-grounded action, and RL parity tests before attempting further self-modification.**