# Cognitive Grounding Specification

This document defines the contracts that ground SeNARS cognition in closed-loop perception, decision, action, learning, and explanation. These contracts are **not** aspirational — they are testable interfaces that must pass before M3.5 is complete.

---

## 1. Belief/Perception Contract

### 1.1 Canonical Form

All environment observations enter SeNARS as **belief tasks** (`type: 'belief'`).

```narsese
<!-- State observation -->
(self --> state:s_3_4). %1.00;0.95%

<!-- Feature observation -->
(feature:wall_north --> present). %1.00;0.90%

<!-- Noisy sensor -->
(feature:wall_north --> present). %1.00;0.45%
```

### 1.2 API Contract

```typescript
// Primary entry point
nar.believe(term: Term, truth: TruthValue): void
nar.input(term: Term, type: 'belief', truth: TruthValue): void

// Query
nar.getBeliefs(): Task[]
nar.queryTerm(term: Term): Task[]
nar.getConcept(term: Term): Concept | undefined
```

### 1.3 Requirements

| Requirement | Test |
|-------------|------|
| Observation becomes belief task via `nar.believe()` or `nar.input()` | `belief-perception.test.ts` |
| `truth.c` represents sensor reliability | `belief-perception.test.ts` |
| Repeated consistent observations invoke `Truth.revision` | `belief-perception.test.ts` |
| Contradictory observations are detectable (conflict analyzers) | `belief-perception.test.ts` |
| Temporal/source stamps preserved (`Stamp` with `source: 'input'`, `evidence`) | `belief-perception.test.ts` |
| Beliefs queryable through memory | `belief-perception.test.ts` |
| Perception alone cannot execute action (no `^tool` goals from perception) | `no-bypass.test.ts` |
| Observation ingestion has no hidden policy side effect | `no-bypass.test.ts` |

### 1.4 Prohibited

- Direct mutation of policy state, action state, environment state, Q-tables, or tool execution state
- Bypassing `Task`/`Truth` machinery

---

## 2. Goal/Action Contract

### 2.1 Canonical Form (Mandatory Native AST)

Actions leave the cognitive system as **goals** (`type: 'goal'`) with native operation AST structure:

```narsese
<!-- Simple operation -->
(^move_north)!

<!-- Argument-bearing operation (native AST) -->
Inheritance(
  Product(state:s_3_4, direction:north),
  Atom('^move_to')
)
```

### 2.2 AST Structure

```
Inheritance
├── subject: Product
│   ├── args[0]: Term (e.g., state:s_3_4)
│   ├── args[1]: Term (e.g., direction:north)
│   └── ...
└── predicate: Atom
    └── name: '^move_to'  // Must start with '^'
```

### 2.3 API Contract

```typescript
// Primary entry point
nar.goal(term: Term): void

// Dispatch (called from NARExecution.dispatchToolGoals)
await toolManager.executeToolGoal(goalTerm: Term): Promise<ToolResult>
```

### 2.4 Requirements

| Requirement | Test |
|-------------|------|
| Goals generated from cognitive state | `goal-action.test.ts` |
| Goals pass through `nar.goal()` | `goal-action.test.ts` |
| Goals reach `ToolManager.executeToolGoal()` | `goal-action.test.ts` |
| Invalid operations fail safely (`ToolResult { success: false }`) | `goal-action.test.ts` |
| Goal priority (`task.budget.priority`) affects dispatch/selection | `goal-action.test.ts` |
| AIKR limits respected (`maxDerivationsPerStep`, `maxDerivationDepth`) | `goal-action.test.ts` |
| No direct `tool.execute()` bypass | `no-bypass.test.ts` |
| No environment step without goal dispatch | `no-bypass.test.ts` |
| Observation alone never causes action | `no-bypass.test.ts` |

### 2.5 Prohibited

- String-pattern hacks (rejected by `ToolManager.executeToolGoal`)
- Direct environment mutation

---

## 3. Reward and Value Representation

### 3.1 Reward Belief

```narsese
(reward:high --> achieved). %0.90;0.90%
```

### 3.2 Goal Satisfaction

```narsese
(reward:high)!
```

### 3.3 State-Action Value (Q-value Analog)

Preferred representation using native operators:

```narsese
((*, state:s_3_4, ^move_north) --> predicts_reward). %0.78;0.62%
```

Where:
- `Product` (`*`) represents state/action association (commutative, n-ary)
- `^move_north` is an `Atom` with symbol starting with `^` (operation)
- `Inheritance` (`-->`) connects state-action to expected reward
- `predicts_reward` = `AtomicTerm` concept
- `truth.f` represents estimated reward (frequency)
- `truth.c` represents evidence/confidence

### 3.4 API Contract

```typescript
// QBeliefStore interface
getValue(state: Term, action: Term): { f: number; c: number }
updateValue(state: Term, action: Term, reward: number): void  // uses Truth.revision
getAllActions(state: Term): Map<Term, { f: number; c: number }>
```

### 3.5 Requirements

| Requirement | Test |
|-------------|------|
| Positive reward represented correctly | `reward-belief.test.ts` |
| Negative reward represented correctly | `reward-belief.test.ts` |
| Reward updates relevant value belief | `reward-belief.test.ts` |
| Confidence reflects evidence | `reward-belief.test.ts` |
| Terminal reward creates satisfaction signal | `reward-belief.test.ts` |

### 3.6 Prohibited

- Silent reward normalization that changes semantics
- Hidden Q-tables outside SeNARS memory

---

## 4. Truth Semantics

### 4.1 Core Operations

```typescript
Truth.revision(t1: TruthValue, t2: TruthValue): TruthValue
Truth.deduction(t1: TruthValue, t2: TruthValue): TruthValue
Truth.induction(t1: TruthValue, t2: TruthValue): TruthValue
Truth.abduction(t1: TruthValue, t2: TruthValue): TruthValue
Truth.expectation(truth: TruthValue): number  // f * c (for value estimation)
Truth.confidence(truth: TruthValue): number   // c
```

### 4.2 Value Update Protocol

When reward `r` is observed for state-action `(s, a)`:

1. Create evidence truth: `Truth.create(r, confidence)`
2. Retrieve current value belief `v` from memory
3. Revise: `v' = Truth.revision(v, evidence)`
4. Store `v'` back to memory

### 4.3 Exploration via Confidence

Low `truth.c` → high uncertainty → curiosity drive stimulation → exploration

```typescript
// In DriveManager or policy
if (valueBelief.c < explorationThreshold) {
  driveManager.stimulate('curiosity', intensity);
}
```

---

## 5. Confidence Semantics

| Confidence Range | Interpretation | Behavior |
|------------------|----------------|----------|
| `c >= 0.9` | High certainty | Exploit, low exploration |
| `0.5 <= c < 0.9` | Moderate certainty | Balanced |
| `c < 0.5` | Low certainty | Explore, curiosity drive |

Confidence is **not** probability. It represents amount of evidence (NAL definition).

---

## 6. Memory Behavior

### 6.1 AIKR-Compliant Bounds

```typescript
interface MemoryStatistics {
  conceptCount: number;
  maxConcepts: number;
  memoryPressure: number;  // 0.0 to 1.0
  bagUtilization: number;
}
```

### 6.2 Required Properties

- **Bounded priority bags** with LRU eviction
- **Truth decay** — concepts lose priority over time unless reinforced
- **Pressure-driven consolidation** — forgetting + archival under memory pressure
- **Revision history** — truth value evolution tracked per concept

### 6.3 Memory Pressure Effects

| Pressure Level | Behavior |
|----------------|----------|
| `< 0.5` | Normal operation |
| `0.5 - 0.8` | Increased eviction, reduced derivation budget |
| `> 0.8` | Aggressive forgetting, only high-priority concepts retained |

---

## 7. Trace Semantics

### 7.1 Required Trace Components

For every consequential action, the following must be reconstructible:

1. **Observation belief** — `(self --> state:s_3_4) %1.00;0.95%`
2. **Relevant value beliefs** — `((*, state:s_3_4, ^move_north) --> predicts_reward) %0.81;0.74%`
3. **Selected goal** — `(^move_north)!`
4. **Goal priority** — `task.budget.priority`
5. **Derivation identifiers** — `nar.getDerivationHistory(task)`
6. **Tool execution** — `ToolManager.executeToolGoal(...)`
7. **Reward** — `reward = +1`
8. **Subsequent belief revision** — value belief updated via `Truth.revision`

### 7.2 API Contract

```typescript
nar.getDerivationHistory(task: Task): Derivation[]
nar.traceTerm(term: Term): TraceNode
nar.explain(conclusion: Term): Explanation
```

### 7.3 Explanation Format

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

### 7.4 Requirements

- Trace reflects **actual causal path**, not post-hoc rationalization
- Uses `nar.getDerivationHistory()`, `nar.traceTerm()`, `nar.explain()`
- No hidden causal path exists

---

## 8. No-Bypass Architecture

### 8.1 Prohibited Paths

| Bypass Type | Detection |
|-------------|-----------|
| Baseline reads state directly | Instrument environment: state only via `nar.getBeliefs()` |
| Policy reads Q-table directly | No hidden Q-table in adapter |
| Action mutates environment directly | Environment steps only through operation execution |
| LM supplies answer | `enableLMRules: false` |
| Self-modification participates | `enableSelf: false` |
| RLFP optimizes policy | `enableRLFP: false` |

### 8.2 Required Test Configuration

```typescript
{
  enableLMRules: false,
  enableTools: true,  // only RL action tools
  enableSelf: false,
  enableRLFP: false,
  persistState: false,
  maxConcepts: 10000,
  maxDerivationsPerStep: 1000,
  maxDerivationDepth: 20
}
```

---

## 9. RL Mapping Summary

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

## 10. Validation Gates

### Level 1 — Interface Parity
Wrap conventional RL in SeNARS interface. Adapter must not materially alter behavior.

| Metric | Target |
|--------|--------|
| Return difference | ≤ 2% |
| Action agreement | ≥ 98% |
| Converged policy agreement | ≥ 95% |
| Value correlation | ≥ 0.98 |

### Level 2 — Cognitive Parity
Replace conventional logic with SeNARS-native mechanisms.

| Metric | Target |
|--------|--------|
| Return | ≥ 85% of baseline |
| Policy agreement | ≥ 85% |
| Value correlation | ≥ 0.85 |
| Convergence time | ≤ 2× baseline |
| Bandit regret | ≤ 1.5× baseline after burn-in |

### Level 3 — Cognitive Advantage
After parity, test properties conventional RL does not provide.

- Explicit confidence under noisy perception
- Contradiction detection
- Belief revision after environment changes
- Memory-pressure behavior
- Explainable action derivation
- Schema induction
- Adaptation after environment changes
- Graceful degradation

---

## 11. Reproducibility Requirements

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

### Statistical Requirements

- Development: 3 seeds
- Standard validation: 10 seeds
- Important claims: 20+ seeds
- Reports: mean, std, median, CI, per-seed results, failure count, convergence distribution

---

## 12. Resource Budget Controls

Every comparison must specify:
- Environment steps
- Episodes
- Derivation budget (`maxDerivationsPerStep`)
- Derivation depth (`maxDerivationDepth`)
- Memory capacity (`maxConcepts`)
- Wall-clock time

Run three regimes:
1. **Normal budget**
2. **Stress budget**
3. **Scaling experiment**

---

## 13. Failure Classification

| Classification | Criteria |
|----------------|----------|
| **Provisional Failure** | Caused by unverified adapter, incorrect Narsese, implementation defect, inappropriate hyperparameters, insufficient budget, memory pressure, reward scaling mismatch, disabled learning path |
| **Corrected Failure** | Suspected defect fixed, experiment rerun under same protocol, performance remains poor |
| **Hard Falsification** | Contract verified, implementation sanity-tested, configuration levers exercised, baseline healthy, multiple seeds reproduce, survives defect audit |

---

## 14. Mandatory Defect Audit

Before declaring a cognitive boundary, verify:

- [ ] Observation reaches memory
- [ ] Correct `TaskType` used
- [ ] Truth values preserved
- [ ] Confidence not pinned/discarded
- [ ] Repeated evidence invokes revision
- [ ] Contradictory evidence represented correctly
- [ ] Reward reaches intended value representation
- [ ] Value updates change beliefs
- [ ] Goal generation reads updated values
- [ ] Goal priority preserved through dispatch
- [ ] Operation AST structurally correct (`Inheritance(Product, Atom('^op'))`)
- [ ] Tool dispatch executes intended environment action
- [ ] No direct environment access
- [ ] Derivation limits not truncating relevant reasoning
- [ ] Memory limits not deleting required concepts
- [ ] Exploration actually enabled
- [ ] RNG seeded
- [ ] No LM/network/self-modification contamination
- [ ] Baseline passes sanity tests

---

## 15. References

- `docs/tech/rl-parity.md` — RL parity experiments, environments, baselines, metrics
- `tests/nar/rl/contract/` — Contract tests
- `tests/nar/rl/baselines/` — Baseline implementations
- `tests/nar/rl/environments/` — Environment implementations
- `tests/nar/rl/adapters/` — Adapter implementations
- `tests/nar/rl/parity/` — Parity experiments
- `scripts/rl-parity.ts` — Parity harness runner