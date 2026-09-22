# Budget Exhaustion (bag / focus / tool / LM spend)

## Symptom

- `KernelBudgetGate` denies operations: `senars_gate_decisions_total{gate="budget",granted="false"}`
  rising with `terminationReason` labels (`KernelBudgetGate.ts:82`).
- Tasks starve in the bag: AIKR priorities decay to below `forgetRate` and drop
  (`nar/src/bag/Bag.ts` — priority decay `priority *= 1 - applied`, removal below `forgetRate`).
- Tool executions cut short: `Execution budget exceeded` /
  `Duration budget exceeded` results (`nar/src/tools/manager.ts:202,230`).
- LM calls fail fast with `LMUnavailableError` and message
  `Spend cap reached for provider '...': $X >= LM_MAX_SPEND_USD=$Y` — this is a
  *budget* error raised via spend tracking (`nar/src/lm/service/spend.ts:31,53`),
  not a transport outage.
- Metrics: `lm_spend_cost_milli` / `lm_spend_tokens` climbing toward cap;
  focus step durations collapsing (`focus-scheduler.ts:83` —
  `bag.allocateBudget(focus.focus, 100)`).

## Diagnosis

```sh
# Spend ledger per provider
curl -s localhost:<metrics-port>/metrics | grep -E 'lm_spend_(cost_milli|tokens)'

# Env caps
echo $LM_MAX_SPEND_USD

# Bag health: total priority vs item count (AIKR budget pressure)
grep -rn 'forgetRate\|overflow' <run-log>
```

- Compare `lm_spend_cost_milli{provider=...}` across providers: one hot provider
  burning the cap vs uniformly high spend.
- If budget gate denials precede LM spend issues, the root cause is upstream task
  inflation (too many high-priority tasks competing for the same AIKR budget).

## Remediation

1. Spend cap hit: raise `LM_MAX_SPEND_USD`, switch to a local provider
   (`LM_PROVIDER=mock|transformers`), or set `LM_OFFLINE=1` — the error message
   itself lists these three options (`spend.ts:54`).
2. Tool budgets: raise `budget.maxExecutions` / `budget.maxTotalDuration` in the
   calling context (`tools/manager.ts:199-229`).
3. Bag starvation: reduce task inflow or raise forget tolerance; check
   `shouldOverflow` evictions for priority inversion (low-priority items displacing
   high ones, `Bag.ts:82-85`).
4. Focus allocation: verify the focus scheduler budget split
   (`focus-scheduler.ts` `allocateBudget`) matches expected cognitive-resource mix.

## Escalation / Rollback

- Spend ledger is in-memory per-process (`spend.ts` `Map`); restarting resets the
  ledger — only do this deliberately, it re-opens the spend budget.
- Rollback: revert `LM_MAX_SPEND_USD` / tool budget values to prior env; no
  persisted state involved.
- Recurring exhaustion with a local provider (no cost) → escalate: something is
  looping tasks; pull the bag dump and top-priority task IDs.