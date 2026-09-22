# Gate Deadlock (all kernel gates denying)

## Symptom

- Agent admits no tasks and executes no actions; appears hung but alive.
- `senars_gate_decisions_total{granted="false"}` dominating; denials across
  `perception`, `action`, `budget` gates simultaneously.
- `senars_gate_vetoes_total{reason=...}` climbing with a single veto reason.
- Kernel event log full of fail-closed `policy.violation` events — emitted by
  `KernelActionGate.ts:193,218,241`, `KernelPerceptionGate.ts:163`,
  `KernelRewardGate.ts:54` — never throw across the gate boundary.

## Diagnosis

```sh
# Per-gate/per-reason denial breakdown (recordGateDecision → nar/src/telemetry/index.ts:25)
curl -s localhost:<metrics-port>/metrics | grep -E 'gate_(decisions|vetoes)_total'

# Kernel event log: which violation type dominates
grep -c 'policy.violation' <event-log-file>

# Which gates are wired (NARBuilder)
grep -n "withGates\|createGateRegistry" nar/src/agent/builder.ts
```

- Inspect `GateRegistry` init config passed via `NARBuilder.withGates(spec)`
  (`nar/src/agent/builder.ts:137`) — a policy spec that denies everything
  (e.g. all operations blocked, zero budget) deadlocks by construction.
- `KernelBudgetGate` denials (`recordGateDecision('budget', ...)`,
  `KernelBudgetGate.ts:82`) with `terminationReason` set → see
  [budget-exhaustion.md](budget-exhaustion.md), not a policy issue.
- A single veto reason repeating (e.g. `nal-<trap>`) → see [veto-storm.md](veto-storm.md).

## Remediation

1. Identify the blocking gate from the decision metric labels (`gate`, `operation`, `reason`).
2. If gate init config is wrong: fix the `GateInitConfig` and restart — gates are
   constructed per-instance via `NARBuilder.withGates()`.
3. If `KernelActionGate` vetoes on policy: check the offending operation against the
   policy config; the typed veto reason is in the gate result and `policy.violation` event.
4. Perception gate rejecting everything: check input task quality/budget thresholds in
   `KernelPerceptionGate.ts` (`admitTask`, `rejectionReason` label values).

## Escalation / Rollback

- Gates are fail-closed by design — never widen policy to "fix" a deadlock; instead
  correct the misconfigured policy value.
- Rollback: revert the last change to the gate init config; gates hold no persisted
  state, so a restart with corrected config fully restores admission.
- If deadlock persists with default `createGateRegistry()`, escalate with the
  `policy.violation` event stream and gate metric snapshot.