# Cognitive Grounding Specification

This document specifies the cognitive contracts that SeNARS12 must satisfy for M3.5 (Cognitive Grounding and RL Parity).

---

## 1. Belief/Perception Contract

### 1.1 Canonical Narsese Forms

All environment observations enter SeNARS as **belief tasks** (`type: 'belief'`).

**State observation:**
```narsese
(self --> state:s_3_4). %1.00;0.95%
```

**Feature observation:**
```narsese
(feature:wall_north --> present). %1.00;0.90%
```

**Noisy sensor:**
```narsese
(feature:wall_north --> present). %1.00;0.45%
```

**Reward observation:**
```narsese
(reward:high --> achieved). %1.00;0.90%
```

### 1.2 API Requirements

| Requirement | Implementation |
|-------------|----------------|
| Observation becomes belief task | `nar.believe(term, truth)` or `nar.input(term, 'belief', truth)` |
| Sensor reliability in `truth.c` | Confidence parameter represents sensor reliability |
| Repeated observations invoke revision | `Truth.revision` combines consistent evidence |
| Contradictory observations detectable | Conflict analyzers detect inconsistent beliefs |
| Temporal/source stamps preserved | `Stamp` with `source: 'input'`, `evidence` |
| Beliefs queryable through memory | `nar.getBeliefs()`, `nar.queryTerm()`, `nar.getConcept()` |
| Perception cannot execute actions | No `^tool` goals from perception adapter |
| No hidden policy side effects | Observation ingestion is pure belief input |

### 1.3 Prohibited Bypasses

Perception must not directly mutate:
- Policy state
- Action state
- Environment state
- Q-tables
- Tool execution state

---

## 2. Goal/Action Contract

### 2.1 Canonical Narsese Forms

Actions leave the cognitive system as **goals** (`type: 'goal'`).

**Simple operation (mandatory bare atom form):**
```narsese
^move_north!
```

**Argument-bearing native operation (mandatory AST format):**
```text
Inheritance(
  Product(state:s_3_4, direction:north),
  Atom('^move_to')
)
```

### 2.2 Native AST Structure (Mandatory)

The `ToolManager.executeToolGoal` requires goals in native AST format:
- **Predicate**: `Atom` with symbol starting with `^` (e.g., `^move_north`)
- **Subject**: `Product` of argument terms, or single term
- **Wrapper**: `Inheritance(subject, predicate)`

```typescript
// Simple operation
TermBuilder.inheritance(TermBuilder.atom('true'), TermBuilder.atom('^move_north'))

// With arguments
TermBuilder.inheritance(
  TermBuilder.product(
    TermBuilder.inheritance(TermBuilder.atom('north'), TermBuilder.atom('direction')),
    TermBuilder.inheritance(TermBuilder.atom('s_3_4'), TermBuilder.atom('state'))
  ),
  TermBuilder.atom('^move_to')
)
```

String-pattern hacks are rejected by `ToolManager.executeToolGoal` (see `tool-registry.ts:475-514`).

### 2.3 API Requirements

| Requirement | Implementation |
|-------------|----------------|
| Goals generated from cognitive state | Drive system, value beliefs, curiosity |
| Goals pass through `nar.goal()` | `nar.goal(goalTerm, truth)` or `nar.input(goalTerm, 'goal', truth)` |
| Goals reach `ToolManager.executeToolGoal()` | Called from `NARExecution.dispatchToolGoals()` |
| Invalid operations fail safely | Returns `ToolResult { success: false }` |
| Goal priority affects dispatch | `task.budget.priority` used in `dispatchToolGoals()` |
| AIKR limits respected | `config.maxDerivationsPerStep`, `config.maxDerivationDepth` |
| No direct `tool.execute()` bypass | All actions through goal dispatch |
| No environment step without goal | Every action traced to a goal |
| Observation alone never causes action | Separation of perception and action pathways |

### 2.4 Prohibited Bypasses

- Direct `tool.execute()` calls
- Environment mutation without goal dispatch
- Hidden action-selection state bypassing SeNARS
- LM/network/self-modification paths in RL experiments

---

## 3. Reward and Value Representation

### 3.1 Reward Belief

```narsese
(reward:high --> achieved). %0.90;0.90%
```

### 3.2 Goal Satisfaction Signal

```narsese
reward:high!
```

### 3.3 State-Action Value (Q-value Analog)

**Preferred native representation:**
```narsese
((*, state:s_3_4, ^move_north) --> predicts_reward). %0.78;0.62%
```

**Structure:**
- `Product` (`*`) represents state/action association (commutative, n-ary)
- `^move_north` is an `Atom` with symbol starting with `^` (operation)
- `Inheritance` (`-->`) connects state-action to expected reward
- `predicts_reward` = `AtomicTerm` concept
- `truth.f` represents estimated reward (frequency)
- `truth.c` represents evidence/confidence

### 3.4 Value Update via Truth Revision

```typescript
// Current belief
const current = qStore.getValue(state, action); // { f: 0.7, c: 0.6 }

// New evidence
const evidence = Truth.create(reward, confidence);

// Revision combines evidence
const revised = Truth.revision(currentTruth, evidence);
nar.believe(valueTerm, revised);
```

### 3.5 Expectation for Action Selection

```typescript
const expectation = Truth.expectation(valueTruth); // f * c / (1 + c) approx
// Or simplified: expectation ≈ f * c
```

---

## 4. Truth Semantics

### 4.1 Revision

`Truth.revision(truth1, truth2)` combines two pieces of evidence about the same statement.

Properties:
- Frequency converges to weighted average
- Confidence increases with more evidence
- Asymmetric: order matters for temporal sequences

### 4.2 Expectation

`Truth.expectation(truth)` computes expected truth value for decision making.

Formula: `f * c / (1 + c)` (approximates Bayesian expected value)

For RL: use `f * c` as simplified expectation (value × confidence)

### 4.3 Deduction/Induction/Abduction

Standard NAL inference rules for deriving new beliefs from existing ones.

---

## 5. Confidence Semantics

### 5.1 Interpretation

- `c ≈ 1.0`: High certainty, well-established belief
- `c ≈ 0.5`: Moderate evidence
- `c ≈ 0.1`: Weak evidence, high uncertainty

### 5.2 Exploration Signal

Low confidence → exploration:
```typescript
const lowConfidenceActions = qStore.getLowConfidenceActions(state, actions, 0.5);
// Actions with c < 0.5 or no belief → curiosity-driven exploration
```

### 5.3 Sensor Reliability

Observation confidence directly maps to sensor reliability:
- Perfect sensor: `c = 0.95`
- Noisy sensor: `c = 0.45`

---

## 6. Memory Behavior (AIKR)

### 6.1 Priority Bags

Each concept has bounded priority bags:
- `beliefBag`: Stores belief tasks
- `goalBag`: Stores goal tasks  
- `questionBag`: Stores question tasks

### 6.2 Eviction Policy

- LRU eviction when capacity exceeded
- Priority decay over time
- Pressure-driven consolidation

### 6.3 Memory Pressure

```typescript
const stats = memory.getStatistics();
const pressure = stats.memoryPressure; // 0.0 to 1.0
```

High pressure triggers:
- Accelerated priority decay
- Concept consolidation
- Reduced derivation budget

---

## 7. Trace Semantics

### 7.1 Causal Reconstruction

Every consequential action must be explainable via actual causal path:

```typescript
// Observation belief
const obsTrace = nar.traceTerm(stateTerm);

// Value beliefs
const valueTrace = nar.traceTerm(valueTerm);

// Goal derivation
const goalTrace = nar.traceTerm(goalTerm);

// Explanation
const explanation = nar.explain(conclusionTask);
// Returns: { conclusion, premises, rules, confidence, why }
```

### 7.2 Required Trace Components

| Component | API |
|-----------|-----|
| Observation belief | `nar.queryTerm()`, `nar.traceTerm()` |
| Value beliefs | `nar.traceTerm(valueTerm)` |
| Selected goal | `nar.traceTerm(goalTerm)` |
| Goal priority | `task.budget.priority` |
| Derivation IDs | `task.stamp.derivations` |
| Tool execution | `ToolResult` from `executeToolGoal` |
| Reward | `RewardBeliefAdapter.processReward()` |
| Belief revision | `Truth.revision()` via `nar.believe()` |

### 7.3 Example Explanation Output

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

## 8. No-Bypass Architecture

### 8.1 Instrumented Environment

The environment must be instrumented to detect unauthorized access:

```typescript
// Verify: baseline receives observations ONLY through declared interface
const observations = nar.getBeliefs(); // ✓ Allowed
env.getState(); // ✗ NOT allowed for policy

// Verify: actions ONLY through goal dispatch
nar.tools.executeToolGoal(goalTerm); // ✓ Allowed
env.step(action); // ✗ NOT allowed without prior goal dispatch
```

### 8.2 Required Configuration for RL Experiments

```typescript
{
  enableLMRules: false,    // No LM contamination
  enableTools: true,       // Only RL action tools
  enableSelf: false,       // No self-modification
  enableRLFP: false,       // No RLFP initially
  persistState: false,     // No persistence
  maxConcepts: 10000,
  maxDerivationsPerStep: 1000,
  maxDerivationDepth: 20
}
```

### 8.3 Verification Checklist

- [ ] Baseline receives observations only through `nar.getBeliefs()`, `nar.queryTerm()`
- [ ] State cannot be read directly by policy
- [ ] Actions cannot directly mutate environment
- [ ] Environment stepping occurs only through operation execution
- [ ] No hidden Q-table exists inside adapter
- [ ] No hidden action-selection state bypasses SeNARS
- [ ] No LM call supplies the answer (`enableLMRules: false`)
- [ ] No self-modification mechanism participates (`enableSelf: false`)

---

## 9. RL Mapping Table

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
Adapter-wrapped conventional RL must be statistically close to direct RL:
- Return difference ≤ 2%
- Action agreement ≥ 98%
- Converged policy agreement ≥ 95%
- Value correlation ≥ 0.98

### Level 2 — Cognitive Parity
Native SeNARS mechanisms meet thresholds:
- Return ≥ 85% of baseline
- Policy agreement ≥ 85%
- Value correlation ≥ 0.85
- Convergence time ≤ 2× baseline
- Bandit regret ≤ 1.5× baseline after burn-in

### Level 3 — Cognitive Advantage
After parity, test properties conventional RL lacks:
- Explicit confidence under noisy perception
- Contradiction detection
- Belief revision after environment changes
- Memory-pressure behavior
- Explainable action derivation
- Schema induction from successful sequences
- Adaptation after environment changes
- Graceful degradation rather than abrupt failure

---

## 11. Reproducibility Requirements

- Environment RNG is seeded
- Baseline RNG is seeded
- Exploration RNG is seeded
- LM rules disabled (`enableLMRules: false`)
- Network disabled
- Self-modification disabled (`enableSelf: false`)
- RLFP disabled initially (`enableRLFP: false`)
- Persistence disabled (`persistState: false`)
- Test configuration is version-controlled
- Environment configuration is logged
- Seed included in every report

### Statistical Requirements

- Development: 3 seeds
- Standard validation: 10 seeds
- Important claims: 20+ seeds where practical
- Reports include: mean, std, median, CI, per-seed results, failure count

---

## 12. Defect Audit Checklist

Before declaring a cognitive limitation, verify:

- [ ] Observation actually reaches memory
- [ ] Correct `TaskType` is used
- [ ] Truth values are preserved
- [ ] Confidence is not accidentally pinned or discarded
- [ ] Repeated evidence actually invokes revision
- [ ] Contradictory evidence is represented correctly
- [ ] Reward reaches the intended value representation
- [ ] Value updates actually change beliefs
- [ ] Goal generation reads the updated values
- [ ] Goal priority is preserved through dispatch
- [ ] Operation AST is structurally correct (`Inheritance(Product, Atom('^op'))`)
- [ ] Tool dispatch actually executes the intended environment action
- [ ] No direct environment access exists
- [ ] Derivation limits are not silently truncating relevant reasoning
- [ ] Memory limits are not silently deleting required concepts
- [ ] Exploration is actually enabled
- [ ] RNG is seeded
- [ ] No LM/network/self-modification path contaminates the experiment
- [ ] Baseline itself passes its sanity tests

---

## 13. Failure Classification

| Classification | Criteria |
|----------------|----------|
| **Provisional Failure** | Caused by unverified adapter, incorrect Narsese, implementation defect, inappropriate hyperparameters, insufficient derivation budget, memory pressure, reward/Truth mismatch, disabled learning path |
| **Corrected Failure** | Suspected defect fixed and experiment rerun under same protocol |
| **Hard Falsification** | Contract verified, implementation sanity-tested, configuration levers exercised, baseline healthy, multiple seeds reproduce, survives defect audit |

---

*This specification is the contract for M3.5 validation. All implementations must conform to these contracts before claiming RL parity.*