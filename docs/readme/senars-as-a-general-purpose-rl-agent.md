## SeNARS as a General-Purpose RL Agent

SeNARS is not only a reasoning kernel — the same Focus-Game-Reflex substrate makes it a **general-purpose reinforcement learning agent**. Any environment exposing `observe()` / `step(action)` attaches as a `Game` — the **only** environment interface (no separate `Environment` layer; built-in games live in `@senars/nar/game`, see the export index) — and the agent learns to act through its native attention economy, bounded by AIKR like every other cognitive process. The shipped collection is enumerated by the **game registry** (`createArcadeRegistry()`): snake, tetris, 2048, tictactoe, gridworld, bandit, catch, arithmetic, and rps — each a plain `Game` implementation with a seeded, deterministic episode; adding one is implementing `Game` + one `GameSpec`.

**Non-symbolic RL as optional acceleration, not foundation.** The `Reflex` slot is a pluggable System-1 policy engine: tabular Q-learning, ε-greedy, and UCB are built in today; DQN, policy-gradient, or actor-critic backends drop in behind the same `propose(state)` / `learn(event)` interface. Symbolic and sub-symbolic learning are *complementary*: fast neural/heuristic proposals are arbitrated by the `Negotiator`, where NAL retains a veto over every action — so learned reflexes accelerate the agent without ever bypassing epistemic control.

All Game↔Focus interactions pass through the four kernel gates (*The Trusted Cognitive Kernel*), so no learned policy can bypass epistemic control.

**Epistemic firewall:** the `RewardGate` throws if a reward attempts to mutate `Truth.frequency` or `Truth.confidence`; rewards may only affect attention and policy weights — never factual belief.

### Core Primitives

| Primitive | Purpose | Key Types |
|-----------|---------|-----------|
| **`Bag<T>`** | Universal AIKR priority queue (capacity-bounded, probabilistic sampling, decay) | `Bag<Item>`, `add()`, `sample()`, `decay()`, `capacity` |
| **`Focus`** | Isolated reasoning vessel with local `Bag<Task>` + `Bag<Concept>` | `step(budget)`, `weight`, bound `Gates`, bound `Games`/`Reflexes` |
| **`FocusBag`** | System-wide attention economy — samples `Focus` by weight | `allocateBudget()`, `rebalanceWeights()`, `sample()` |
| **`Game`** | Environment interface (external or internal) — the only one | `observe()`, `step(action)`, `legalActions(state)` |
| **`Reflex`** | Fast System-1 policy/value engine (Q-learning, UCB, heuristics) | `propose(state)`, `learn(event)` |
| **`Negotiator`** | Arbitrates Reflex proposals vs NAL derivations (NAL retains veto) | `resolve(proposals, nalDerivations)`, `createLearningEvent()` |

**RL adapter library (`@senars/nar/rl`):** NAL-native learners (`QBeliefStore` with Q-learning/SARSA/TD updates round-tripping through `Truth.revision`), reward/perception/action adapters, `RLParityHarness` (policy agreement + value correlation), and the semantic reflexes + manifold agent (see *System One — RL Without NAL*). Full export list in the export index below.

### RL Domain Split — Unified Substrate, Separated Reward Domains

The shared substrate (`Bag<T>`, `Focus`, `FocusBag`, `Game`, `Reflex`, `Negotiator`) is kept; reward interpretation and mutation authority are split by domain:

| Learner | Domain | Mutates | Risk |
|---------|--------|---------|------|
| `ReflexLearner` | `external-reflex` | Reflex Q-table / policy weights | Low |
| `SchedulerAdapter` | `self-scheduler` | `FocusBag` focus weights | Low |
| `PreferenceRanker` | `self-explanation-rank` | Explanation ranking scores | Low |
| `ConfigOptimizer` | `self-config-proposal` | `knob-tune` proposals (never direct) | Medium |
| `PatchSelector` | `self-patch-score` | `patch-apply` proposals (→ human approval) | High |

`LearnerRegistry.dispatch(event)` routes by `event.domain`; unknown domain → `CrossDomainError` (fail-closed). Self-game rewards (`domain: 'self-*'`) never mutate `Truth` — they produce `SelfImprovementProposal` objects routed through `ProposalRouter` → `SelfMetaGame.applyProposal` (only low-risk `focus-weight` auto-applies; medium/high require validation/approval).

The collapsible record below lists the implemented component slices with their CI test suites, and current environment parity results.

<details>
<summary><b>Implementation & Validation Record (test slices, environment parity)</b></summary>

**Implemented components (CI-verified snapshot):**

| Slice | Components | Tests |
|-------|------------|-------|
| **1** | `Bag<T>`, `Focus`, `FocusBag`, `TabularQReflex`, `Negotiator`, `GridWorldGame`, `GameFocus` | `kernel-slice1.test.ts` (14 tests) |
| **2** | `EpsilonGreedyReflex`, `UCBReflex` (Reflex implementations) | `m35-gridworld-validation.test.ts` |
| **3** | `Negotiator` (NAL veto + `LearningEvent` feedback) | `m35-gridworld-validation.test.ts` |
| **4** | `MetaGame`, `SelfMetaGame`, `MetaFocus` (`^focus_weight`, `^knob_set`) | `meta-game-sandbox.test.ts` (16 tests) |

**Environment parity results:**

| Environment | Level 1 (Adapter) | Level 2 (Native Reflex) | Status |
|-------------|-------------------|-------------------------|--------|
| **Bandit** | Pass | Pass (`EpsilonGreedyReflex`/`UCBReflex`) | Pass |
| **NonStationary** | Pass | Pass (drift detection) | Pass |
| **GridWorld** | Pass | **Pass** (100% success after 200 episodes, `TabularQReflex`) | Pass |

</details>
