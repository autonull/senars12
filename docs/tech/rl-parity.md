# RL Parity Experimental Protocol

This document specifies the experimental protocol for establishing RL parity in SeNARS12 (M3.5 milestone).

---

## 1. RL Mapping

| Conventional RL | SeNARS12 |
|-----------------|----------|
| Observation/state | `Task { type: 'belief', term, truth }` via `nar.believe()` |
| Sensor reliability | Truth confidence `c` |
| Reward | Reward belief and/or goal satisfaction |
| State-action value | Belief about expected reward |
| Action | Goal, preferably native operation goal |
| Policy | Derived goal tendencies / priorities |
| Exploration | Curiosity drive + low-confidence beliefs |
| Exploitation | High expectation / priority goals |
| Value update | `Truth.revision` and related inference |
| Forgetting | Truth decay / memory dynamics |
| Experience | Episodic memory |
| Generalization | Schema induction / inference |
| Explainability | Derivation trace / `nar.explain()` |
| Memory | Concept network + priority bags |

---

## 2. Environments

### E1 — Multi-Armed Bandit
**Variants:**
- Stationary Bernoulli
- Noisy observations
- Drifting rewards (NonStationaryBanditEnv)

**Tests:** Exploration, exploitation, confidence, reward revision, adaptation

**Baselines:** Epsilon-greedy, UCB1

### E2 — Deterministic GridWorld
**Layout (4×4):**
```
S . . .
. # . .
. . # .
. . . G
```

**Tests:** Perception, action goals, sequential decision making, value learning, goal derivation

**Baselines:** Q-learning, SARSA, Value iteration oracle

### E3 — Stochastic GridWorld
**Tests:** Noisy transitions, uncertain outcomes, confidence calibration, on-policy learning

**Baselines:** SARSA, Expected SARSA, Q-learning

### E4 — Non-Stationary Environment
**Tests:** Forgetting, revision, decay, adaptation, recovery from stale beliefs

**Baselines:** Discounted Q-learning, Sliding-window Q-learning

### E5 — Memory-Pressure Environment (Secondary)
Run same tasks under controlled memory limits (`maxConcepts`).

**Measures:** Return degradation, belief loss, confidence degradation, concept eviction, recovery

### E6 — Stateful/Recurrent Environment
Only after E1–E4 working.

**Candidates:** Delayed reward, partial observability, memory-dependent decisions, sequence recall

---

## 3. Baseline Algorithms

Located at: `tests/nar/rl/baselines/`

| Algorithm | File | Key Parameters |
|-----------|------|----------------|
| Epsilon-greedy | `bandit.ts` | `epsilon`, `seed` |
| UCB1 | `bandit.ts` | `seed` |
| Q-learning | `gridworld.ts` | `alpha`, `gamma`, `epsilon`, `seed` |
| SARSA | `gridworld.ts` | `alpha`, `gamma`, `epsilon`, `seed` |

**Required features:**
- Seeded RNG
- Configurable `alpha`, `gamma`, exploration
- Serializable state
- Deterministic test mode
- Metrics output

**Baselines must first solve environments independently of SeNARS.**

---

## 4. Required Adapters

Located at: `tests/nar/rl/adapters/adapters.ts`

### 4.1 BeliefPerceptionAdapter
```typescript
interface RLObservation {
  stateId: string;
  features?: Record<string, number>;
  reward?: number;
  terminal?: boolean;
  timestamp?: number;
}

interface BeliefPerceptionAdapter {
  perceive(observation: RLObservation): void;
}
```

**Responsibilities:**
- Convert observations to beliefs via `nar.believe()`
- Preserve sensor confidence in `truth.c`
- Preserve temporal information in `Stamp`
- Never execute actions

### 4.2 GoalActionAdapter
```typescript
interface RLAction {
  name: string;
  args?: Record<string, unknown>;
}

interface GoalActionAdapter {
  buildGoalTerm(action: RLAction): Term;
  proposeAction(action: RLAction, priority?: number): void;
  executeGoal(action: RLAction): Promise<ToolResult>;
}
```

**Responsibilities:**
- Build native operation ASTs: `Inheritance(Product(args...), Atom('^' + name))`
- Inject goals via `nar.goal()` or `nar.inputTask()`
- Dispatch through real execution path (`nar.run()` → `dispatchToolGoals()`)
- Return actual tool results
- Never mutate environment directly

### 4.3 QBeliefStore
```typescript
interface QBeliefStore {
  getValue(state: Term, action: Term): { f: number; c: number } | null;
  updateValue(state: Term, action: Term, reward: number, confidence: number): void;
  getAllActions(state: Term): Map<string, { f: number; c: number }>;
  getBestAction(state: Term, availableActions: Term[]): Term | null;
  getLowConfidenceActions(state: Term, availableActions: Term[], threshold: number): Term[];
  shouldExplore(threshold: number): boolean;
  getCuriosityIntensity(): number;
  stimulateCuriosity(amount: number): void;
}
```

**Responsibilities:**
- Store value beliefs in SeNARS memory (`nar.memory`)
- Read state/action values
- Update values using `Truth.revision`
- Expose confidence for exploration
- Support comparison against conventional Q-values
- Integrate with curiosity drive

### 4.4 RewardBeliefAdapter
```typescript
interface RewardBeliefAdapter {
  processReward(state: Term, action: Term, reward: number, confidence: number): void;
  createSatisfactionSignal(reward: number): Term;
  getQStore(): QBeliefStore;
  getRewardHistory(): RewardRecord[];
}
```

**Responsibilities:**
- Normalize rewards (document normalization)
- Preserve reward sign/meaning
- Update state-action value beliefs via `QBeliefStore`
- Record reward history
- Generate terminal satisfaction signals

### 4.5 RLParityHarness
```typescript
interface RLParityHarnessConfig {
  seed: number;
  maxEpisodes: number;
  maxStepsPerEpisode: number;
  narConfig?: any;
}

interface ParityMetrics {
  baselineRewards: number[];
  senarsRewards: number[];
  avgBaselineReward: number;
  avgSenarsReward: number;
  policyAgreement: number;
  valueCorrelation: number;
}

class RLParityHarness {
  runBaseline<Env, Agent>(env, agent, runEpisode): Promise<number[]>;
  computePolicyAgreement(baselineQ, senarsQ): number;
  computeValueCorrelation(baselineQ, senarsQ): number;
}
```

---

## 5. Contract Tests

Located at: `tests/nar/rl/contract/`

### 5.1 Belief Perception Tests
- Correct term
- Correct truth
- Correct confidence
- Revision
- Contradiction detection
- Temporal/source metadata
- No action side effect

### 5.2 Goal Action Tests
- Correct native AST (`Inheritance(Product, Atom('^op'))`)
- Correct dispatch through `executeToolGoal`
- Correct priority (`budget.priority`)
- Correct AIKR behavior
- Invalid goal fails safely
- Exactly one environment action per dispatched goal
- No action without a goal

### 5.3 Reward Tests
- Positive reward represented correctly
- Negative reward represented correctly
- Reward updates relevant value belief
- Confidence reflects evidence
- Terminal reward creates appropriate satisfaction signal

### 5.4 No-Bypass Tests (Mandatory)
- Baseline receives observations only through declared interface
- State cannot be read directly by policy
- Actions cannot directly mutate environment
- Environment stepping occurs only through operation execution
- No hidden Q-table exists inside adapter
- No hidden action-selection state bypasses SeNARS
- No LM call supplies answer (`enableLMRules: false`)
- No self-modification participates (`enableSelf: false`)

---

## 6. Parity Experiments

### 6.1 Bandit — Epsilon-Greedy
**Compare:**
1. Direct baseline
2. Adapter-wrapped baseline
3. SeNARS-native learner

**Metrics:** Cumulative reward, regret, optimal-arm selection, exploration rate, confidence trajectory

**Targets:**
- Direct vs adapter: near-identical (≤2% diff)
- Native vs baseline: ≥85% final performance
- Optimal-arm selection: within 10% of baseline

### 6.2 Bandit — UCB
**Test:** Whether confidence provides useful exploration signal

**Measure:** Regret, low-confidence arm sampling, convergence, confidence calibration

**Target:** Native exploration is systematically uncertainty-sensitive

### 6.3 GridWorld — Q-Learning
**Compare:**
- Direct Q-learning
- Belief/goal Q-learning
- Native SeNARS value beliefs

**Targets:**
| Metric | Target |
|--------|--------|
| Policy agreement | ≥ 90% |
| Return ratio | ≥ 0.90 |
| Value correlation | ≥ 0.90 |
| Convergence | ≤ 2× baseline |

### 6.4 Stochastic SARSA
**Measure:** Average return, policy stability, confidence calibration, recovery after surprising transitions

**Target:** Return within 10% of baseline, no catastrophic oscillation, confidence responds to unexpected evidence

### 6.5 Non-Stationary Revision
**Protocol:** Change reward mapping halfway through training

**Measure:** Adaptation delay, post-change return, old-belief decay, new-belief acquisition

**Target:** Adaptation within 1.5× baseline, old high-value beliefs decrease, new values dominant

---

## 7. Trace Validation

Every consequential action must be explainable via actual causal path:

**Record:**
- Observation belief
- Relevant value beliefs
- Goal
- Goal priority
- Derivation identifiers
- Tool execution
- Reward
- Subsequent belief revision

**APIs:**
- `nar.getDerivationHistory(task)`
- `nar.traceTerm(term)`
- `nar.explain(conclusion)`

**Example trace output:**
```text
Observed:
  (self --> state:s_3_4) %1.00;0.95%

Relevant values:
  ((*, state:s_3_4, ^move_north) --> predicts_reward) %0.81;0.74%
  ((*, state:s_3_4, ^move_south) --> predicts_reward) %0.32;0.55%

Selected:
  ^move_north!

Reason:
  Highest expected value among available actions.

Execution:
  ToolManager.executeToolGoal(...)

Outcome:
  reward = +1

Update:
  value belief revised with new evidence.
```

---

## 8. Observability

For every episode record:
- Seed
- Environment configuration
- Observation beliefs
- Truth values
- Confidence
- Value beliefs
- Selected goals
- Goal priorities
- Derivation traces
- Tool results
- Rewards
- Episode return
- Baseline values
- Memory statistics (`Memory.getStatistics()`)
- Derivation counts
- Execution time

---

## 9. Determinism

**Requirements:**
- Environment RNG seeded
- Baseline RNG seeded
- Exploration RNG seeded
- LM rules disabled (`enableLMRules: false`)
- Network disabled
- Self-modification disabled (`enableSelf: false`)
- RLFP disabled initially (`enableRLFP: false`)
- Persistence disabled (`persistState: false`)
- Test configuration version-controlled
- Environment configuration logged
- Seed included in every report

**Suggested NARConfig:**
```typescript
{
  enableLMRules: false,
  enableTools: true,
  enableSelf: false,
  enableRLFP: false,
  persistState: false,
  maxConcepts: 10000,
  maxDerivationsPerStep: 1000,
  maxDerivationDepth: 20
}
```

---

## 10. Statistical Requirements

- Single successful run is not sufficient
- Development: 3 seeds
- Standard validation: 10 seeds
- Important claims: 20+ seeds
- Reports include: mean, std, median, CI, per-seed results, failure count, convergence distribution
- Do not report only the best seed
- For stochastic environments, compare distributions

---

## 11. Resource and Budget Controls

Every comparison must specify:
- Environment steps
- Episodes
- Derivation budget (`maxDerivationsPerStep`)
- Derivation depth (`maxDerivationDepth`)
- Memory capacity (`maxConcepts`)
- Wall-clock time
- CPU/memory limits

**Regimes:**
1. Normal budget
2. Stress budget
3. Scaling experiment

---

## 12. RL Parity Harness Runner

**Script:** `scripts/rl-parity.ts`

**Usage:**
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

**Outputs:**
```
.reports/rl-parity/summary.json
.reports/rl-parity/gridworld-qlearning.csv
.reports/rl-parity/bandit-ucb.csv
```

**Summary format:**
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

## 13. File Layout

```
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
    trace-validation.test.ts

scripts/
  rl-parity.ts

docs/tech/
  cognitive-grounding.md
  rl-parity.md
```

---

## 14. Reproduction Commands

```bash
# Run all RL tests
pnpm test -- tests/nar/rl

# Run contract tests only
pnpm test -- tests/nar/rl/contract

# Run parity tests
pnpm test -- tests/nar/rl/parity

# Run with specific seed
SEED=42 pnpm test -- tests/nar/rl/parity/bandit-epsilon-greedy.test.ts

# Run parity harness
pnpm exec tsx scripts/rl-parity.ts --env bandit --baseline epsilon-greedy --seeds 10
```

---

## 15. Failure Classification

| Classification | Criteria |
|----------------|----------|
| **Provisional Failure** | Unverified adapter, incorrect Narsese, implementation defect, inappropriate hyperparameters, insufficient derivation budget, memory pressure, reward/Truth mismatch, disabled learning path |
| **Corrected Failure** | Defect fixed, experiment rerun under same protocol |
| **Hard Falsification** | Contract verified, implementation sanity-tested, configuration levers exercised, baseline healthy, multiple seeds reproduce, survives defect audit |

---

*This protocol ensures fair, reproducible comparison between conventional RL and SeNARS-native cognition.*