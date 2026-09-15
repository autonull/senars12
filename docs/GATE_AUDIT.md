# Gate Audit Report — Direct State Mutations & Gate Insertion Points

**Generated:** 2026-09-10  
**Scope:** `nar/src/` — NAR reasoning kernel  
**Purpose:** Map all direct state mutations to required Gate interceptions (Perception, Action, Reward, Budget)

---

## Executive Summary

The codebase currently has **3 Gate implementations** (`PerceptionGate`, `ActionGate`, `RewardGate`) used within `Focus` class. However, **direct state mutations bypass gates** in multiple locations outside the Focus kernel. The Trusted Kernel architecture requires ALL mutations to pass through gates that emit `CognitiveEvent` proposals.

---

## 1. Existing Gates (Implemented)

| Gate | Location | Current Use | Coverage |
|------|----------|-------------|----------|
| `PerceptionGate` | `nar/src/gates/PerceptionGate.ts` | `Focus.step()` → `game.observe()` → beliefs | Focus-internal only |
| `ActionGate` | `nar/src/gates/ActionGate.ts` | `Focus.getNALDerivations()` → proposals → goals | Focus-internal only |
| `RewardGate` | `nar/src/gates/RewardGate.ts` | `GameFocus` → game outcomes → beliefs | Focus-internal only |
| `BudgetGate` | **MISSING** | — | **Not implemented** |

---

## 2. Direct State Mutations Requiring Gate Interception

### 2.1 Perception Mutations (→ PerceptionGate)

| File:Line | Mutation | Current Path | Required Gate |
|-----------|----------|--------------|---------------|
| `nar-io.ts:59` | `this.addTask(parsedTerm, type, truth)` | Direct CLI/IRC input | **PerceptionGate** |
| `nar-io.ts:92` | `this.memory.addConcept(term)` | Import/deserialization | **PerceptionGate** |
| `nar-io.ts:121` | `this.memory.addTask(term, type, truth, budget)` | Programmatic API | **PerceptionGate** |
| `nar.ts:336` | `this.taskManager.addTask(task)` | Public `nar.believe()/goal()/question()` | **PerceptionGate** |
| `nar.ts:616` | `this.memory.addTask(task.term, task.type, task.truth, task.budget)` | Internal task processing | **PerceptionGate** |
| `nar-execution.ts:200` | `this.memory.addTask(task.term, task.type, task.truth, task.budget, task.stamp)` | Execution loop input | **PerceptionGate** |
| `nar-execution.ts:307` | `this.taskManager.addTask(task)` | LLM enrichment output | **PerceptionGate** |
| `nar-execution.ts:398` | `this.taskManager.addTask(createTask(...))` | Goal creation | **PerceptionGate** |
| `task/manager.ts:119` | `this.memory.addTask(...)` | Task manager internal | **PerceptionGate** |
| `lm/enrichment.ts:258` | `this.memory.addTask(hyp.term, hyp.type, hyp.truth, ...)` | LM hypothesis injection | **PerceptionGate** |
| `lm/enrichment.ts:262` | `this.memory.addTask(bridge.term, ...)` | LM bridge beliefs | **PerceptionGate** |
| `lm/feedback.ts:179` | `this.memory.addTask(hyp.term, ...)` | LM feedback correction | **PerceptionGate** |
| `lm/feedback.ts:390` | `this.memory.addTask(...)` | LM feedback injection | **PerceptionGate** |
| `tools/guided.ts:29` | `this.memory.addTask(term, 'belief', Truth.NEUTRAL, ...)` | Tool result injection | **PerceptionGate** |
| `tools/guided.ts:32` | `this.memory.addTask(atomTerm, 'belief', Truth.NEUTRAL, ...)` | Tool result injection | **PerceptionGate** |
| `tools/adapters/external-tools.ts:550` | `deps.memory.addConcept(term)` | External tool concept creation | **PerceptionGate** |
| `tools/adapters/external-tools.ts:566` | `deps.memory.addTask(...)` | External tool belief injection | **PerceptionGate** |
| `tools/adapters/external-tools.ts:574` | `deps.memory.addTask(...)` | External tool belief injection | **PerceptionGate** |
| `memory/state/serialization.ts:106` | `memory.addConcept(term)` | State deserialization | **PerceptionGate** (with `source: 'replay'`) |
| `memory/state/serialization.ts:127` | `concept.addTask(...)` | State deserialization | **PerceptionGate** (with `source: 'replay'`) |

### 2.2 Belief Revision Mutations (→ RewardGate / Epistemic Firewall)

| File:Line | Mutation | Current Path | Required Check |
|-----------|----------|--------------|----------------|
| `memory/concept.ts:255` | `TruthOps.revision(data.truth, existing.truth)` | Core belief revision | **RewardGate** must verify `independence` before allowing revision |
| `stream/reasoner.ts:66` | `prov.truth = Truth.revision(prov.truth, truth)` | Streaming belief update | **RewardGate** must verify `independence` |
| `terms/truth.ts:60` | `result = Truth.revision(result, op(t1, t2))` | Multi-step revision | **RewardGate** must verify `independence` |

**Critical Finding:** Current revision logic **does not check evidence independence**. When lineage is truncated (AIKR bounds), the system must conservatively reject revision rather than silently double-count evidence.

### 2.3 Action/Goal Mutations (→ ActionGate)

| File:Line | Mutation | Current Path | Required Gate |
|-----------|----------|--------------|---------------|
| `nar-execution.ts` | Goal/task creation from operations | Tool execution results | **ActionGate** |
| `reflex/Negotiator.ts:90-97` | Reflex proposals → learning events | Reflex negotiation | **ActionGate** (with NAL veto) |
| `focus/GameFocus.ts:78-82` | Reward beliefs from game outcomes | Game loop | **RewardGate** |
| `focus/GameFocus.ts:88` | Learning event with reward | Game loop | **RewardGate** |

### 2.4 Priority/Attention Mutations (→ BudgetGate)

| File:Line | Mutation | Current Path | Required Gate |
|-----------|----------|--------------|---------------|
| `memory/concept.ts:126-129` | `boost(amount)` / `decay(rate)` | Concept activation | **BudgetGate** (track attention budget) |
| `memory/concept.ts:131-144` | `applyTimeDecay()` | Temporal decay | **BudgetGate** (separate truth vs attention decay) |
| `memory/concept.ts:146-165` | `addLink()` / `removeLink()` | Associative links | **BudgetGate** |
| `memory/concept.ts:186-194` | `updateLinks()` | Link decay | **BudgetGate** |
| `memory/concept.ts:204-219` | `mergeWith()` | Concept merging | **BudgetGate** + **PerceptionGate** |
| `memory/memory.ts:462` | `attentionModel.decay()` | Memory decay | **BudgetGate** |
| `memory/focus.ts:105` | `attentionModel.decay()` | Focus decay | **BudgetGate** |
| `strategies/attention/CompositeAttention.ts:18` | Weighted decay aggregation | Attention model | **BudgetGate** |

### 2.5 Reward Signal Mutations (→ RewardGate / Epistemic Firewall)

| File:Line | Mutation | Current Path | Required Firewall |
|-----------|----------|--------------|-------------------|
| `gates/RewardGate.ts:11-21` | Creates belief with `truth.f = reward >= 0 ? 1.0 : 0.0` | Game reward → belief | **ALREADY CORRECT** — only creates belief, doesn't mutate existing truth |
| `rlfp/RewardModel.ts` | Reward calculation features | RLFP training | **Must not mutate `Truth.frequency`/`confidence`** |
| `rlfp/PolicyOptimizer.ts` | Policy weight updates | RL optimization | **Must not mutate `Truth`** |
| `nar-execution.ts:111-114` | `recordRLFPReward()` | Reward history | **Must not mutate `Truth`** |

---

## 3. Required Gate Architecture Changes

### 3.1 PerceptionGate — Expand to Kernel Boundary

**Current:** Only used in `Focus.step()` for game perceptions  
**Required:** Single admission point for ALL external inputs

```typescript
// NEW: Kernel-level PerceptionGate
class KernelPerceptionGate {
  admit(input: PerceptionGateInput): PerceptionGateOutput {
    // 1. Validate source quality → truth.confidence
    // 2. Check budget (BudgetGate)
    // 3. Create TaskAdmittedEvent
    // 4. Append to event log
    // 5. Return admitted task or rejection
  }
}
```

**Insertion Points:** All 20+ locations in Section 2.1 must route through `KernelPerceptionGate.admit()`

### 3.2 ActionGate — Add NAL Veto Enforcement

**Current:** Converts reflex proposals to goals  
**Required:** Must enforce NAL veto — no action without goal dispatch

```typescript
// ENHANCED: ActionGate with NAL veto
class KernelActionGate {
  authorize(input: ActionGateInput): ActionGateOutput {
    // 1. Check NAL derivations for veto (contradiction, safety)
    // 2. Verify autonomy mode permits execution
    // 3. Check budget (BudgetGate)
    // 4. Create tool.call event or rejection
  }
}
```

### 3.3 RewardGate — Implement Epistemic Firewall

**Current:** Converts game rewards to beliefs (correct)  
**Required:** **THROW** if reward signal targets `Truth.frequency` or `Truth.confidence`

```typescript
// ENHANCED: RewardGate with epistemic firewall
class KernelRewardGate {
  process(input: RewardGateInput): RewardGateOutput {
    if (input.targetType === 'truth-frequency' || input.targetType === 'truth-confidence') {
      throw new EpistemicFirewallViolation(
        `Reward signal cannot mutate ${input.targetType}. ` +
        `Allowed targets: attention-priority, policy-weights`
      );
    }
    // Allow mutation of attentionPriority, policyWeights
    // Emit BeliefRevisedEvent for audit trail
  }
}
```

### 3.4 BudgetGate — NEW Implementation Required

```typescript
// NEW: BudgetGate for all resource accounting
class KernelBudgetGate {
  check(input: BudgetGateInput): BudgetGateOutput {
    const { budget, operation, estimatedCost } = input;
    const remaining = this.getRemaining(budget, operation);
    
    if (remaining < estimatedCost) {
      return {
        granted: false,
        terminationReason: this.getTerminationReason(budget, operation),
        updatedBudget: budget,
      };
    }
    
    budget.consumed[operation] += estimatedCost;
    return { granted: true, updatedBudget: budget };
  }
}
```

---

## 4. Event Log Integration

All gates must emit `CognitiveEvent` to the append-only log:

| Gate | Event Types Emitted |
|------|---------------------|
| PerceptionGate | `task.admitted` (source: user/llm/derivation/reflex/sensor) |
| ActionGate | `tool.request` / `tool.response` / `policy.violation` |
| RewardGate | `belief.revised` (with `independenceCheck`) / `policy.violation` (epistemic firewall) |
| BudgetGate | `budget.exhausted` (with `TerminationReason`) |

---

## 5. Migration Priority

| Priority | Mutation Cluster | Files to Modify | Effort |
|----------|------------------|-----------------|--------|
| **P0** | Perception mutations (20 locations) | `nar-io.ts`, `nar.ts`, `nar-execution.ts`, `task/manager.ts`, `lm/enrichment.ts`, `lm/feedback.ts`, `tools/*`, `memory/state/serialization.ts` | High |
| **P0** | Belief revision independence check | `memory/concept.ts:255`, `stream/reasoner.ts:66`, `terms/truth.ts:60` | Medium |
| **P1** | RewardGate epistemic firewall | `gates/RewardGate.ts`, `rlfp/*` | Medium |
| **P1** | BudgetGate implementation | NEW file + integration in all hot paths | High |
| **P2** | ActionGate NAL veto | `gates/ActionGate.ts`, `reflex/Negotiator.ts` | Medium |
| **P2** | Priority/attention decay through BudgetGate | `memory/concept.ts`, `memory/memory.ts`, `memory/focus.ts`, `strategies/attention/*` | Medium |

---

## 6. Verification Strategy

1. **Static Analysis:** Grep for direct `.addTask()`, `.addConcept()`, `.revision()`, `.boost()`, `.decay()` calls outside gate files
2. **Runtime Assertion:** Add `assertGateAdmitted()` checks in `Concept.addBeliefWithRevision()`, `Memory.addTask()`
3. **Event Log Audit:** Verify every state mutation has corresponding `CognitiveEvent` in log
4. **Epistemic Firewall Test:** Attempt to mutate `Truth` via reward signal → expect exception
5. **Budget Exhaustion Test:** Shrink budgets → verify `TerminationReason` enums (not generic timeouts)

---

## 7. Files to Create/Modify

### New Files
- `nar/src/kernel/KernelPerceptionGate.ts`
- `nar/src/kernel/KernelActionGate.ts`
- `nar/src/kernel/KernelRewardGate.ts`
- `nar/src/kernel/KernelBudgetGate.ts`
- `nar/src/kernel/GateRegistry.ts` — Central gate accessor

### Modified Files (P0)
- `nar/src/nar-io.ts` → Route through KernelPerceptionGate
- `nar/src/nar.ts` → Route through KernelPerceptionGate
- `nar/src/nar-execution.ts` → Route through KernelPerceptionGate + KernelBudgetGate
- `nar/src/task/manager.ts` → Route through KernelPerceptionGate
- `nar/src/lm/enrichment.ts` → Route through KernelPerceptionGate
- `nar/src/lm/feedback.ts` → Route through KernelPerceptionGate
- `nar/src/tools/guided.ts` → Route through KernelPerceptionGate
- `nar/src/tools/adapters/external-tools.ts` → Route through KernelPerceptionGate
- `nar/src/memory/state/serialization.ts` → Route through KernelPerceptionGate (source: 'replay')
- `nar/src/memory/concept.ts` → Add independence check in `addBeliefWithRevision()`
- `nar/src/stream/reasoner.ts` → Add independence check in belief update
- `nar/src/gates/RewardGate.ts` → Add epistemic firewall throw
- `nar/src/rlfp/*` → Verify no Truth mutations

### Modified Files (P1)
- `nar/src/focus/Focus.ts` → Use KernelBudgetGate for decay/budget tracking
- `nar/src/memory/memory.ts` → Use KernelBudgetGate for decay
- `nar/src/memory/focus.ts` → Use KernelBudgetGate for decay
- `nar/src/strategies/attention/*` → Use KernelBudgetGate for decay

---

## 8. Acceptance Criteria

- [ ] Zero direct calls to `memory.addTask()`, `memory.addConcept()`, `concept.addBeliefWithRevision()` outside gate files
- [ ] All belief revisions check `independence` — reject conservatively when `unknown`
- [ ] RewardGate throws `EpistemicFirewallViolation` on `Truth` mutation attempts
- [ ] BudgetGate returns explicit `TerminationReason` enums
- [ ] Every state mutation produces a `CognitiveEvent` in the event log
- [ ] System can replay from event log to identical state

---

*This audit maps the current "mutate anywhere" architecture to the required "gate-admitted-only" kernel. Each P0 item must be addressed before the kernel can claim event-sourced, provenance-preserving guarantees.*