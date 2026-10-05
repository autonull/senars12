### Kernel Gates — Trusted Boundary

Four gates mediate every state mutation. Every subsystem — inference, RL, self-improvement, tools — operates through them; none can bypass them. **Scope, honestly:** the PerceptionGate is an *ingress* filter — it refuses external stimuli (unparseable observations, an injection veto, a fault), not the system's own derivations, which it stamps and admits. `admitTask` always admits; the branch that would refuse a derived task is unreachable.

| Gate | Responsibility | Key Guarantees |
|------|----------------|----------------|
| **PerceptionGate** | Admit external stimuli → belief/goal/question tasks | Source-quality → confidence mapping; lossless `admitTask(term, type, truth, source)`; provisional multi-candidate admission from LLM (`admitFormalization`) |
| **ActionGate** | Authorize tool executions | Autonomy-mode state machine (`observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`); NAL veto registry; operation allow-list |
| **RewardGate** | Accept reward signals → mutate attention/policy only | **Epistemic firewall** rejects any attempt to mutate `Truth.frequency`/`confidence`; domain split (`external-reflex` direct, `self-*` → proposal) |
| **BudgetGate** | Account CPU/derivation/LM/memory budgets | Per-focus `scopeId` budgets; explicit `TerminationReason` enums (`cycle-budget`, `depth-budget`, `llm-budget`, `deadline`, `backpressure`) |

All gates emit typed `CognitiveEvent`s to an append-only JSONL log; pure reducers (`replayCognitiveState`) reconstruct gate-level state for pause/serialize/replay.

**One budget, four dimensions, one arithmetic.** The AIKR budget has exactly four spendable
dimensions, and `core/budget`'s `BUDGET_RESOURCES` is the only table that says what each one is
called, which ceiling key limits it, and which `TerminationReason` it raises. Everything that
spends reads that table rather than re-deriving `limit − consumed`: the budget gate, the focus
slice (`BudgetSlice`), and the control-scope table, where a row now declares *which dimension* it
spends and nothing else — `scopeLimitKey` and `scopeTerminationReason` derive the rest. So a
scope cannot spend `memoryOps` under a `cycle-budget` reason, and the spend summary, the gate's
`budget.exhausted` event and the scope table cannot disagree about what `memoryOps` is called
(`BUDGET_TYPES` maps each dimension to its event-level name).

```typescript
import { budgetAffords, budgetRefusal, chargeBudget } from '@senars/core/budget';

// The grant test, the refusal reason and the accumulation, once each.
if (budgetAffords(budget, 'llmCalls', cost)) chargeBudget(budget, 'llmCalls', cost);
else budget.terminationReason = budgetRefusal(budget, 'llmCalls'); // 'llm-budget' | 'backpressure'
```

A refusal names the dimension only once that dimension *is* spent; a charge that merely does not
fit in what was left is `backpressure`. An operation the gate does not declare — only reachable
from a cast, since `BudgetOperation` is a closed enum — is granted and charged nothing, rather
than guessed onto one.
