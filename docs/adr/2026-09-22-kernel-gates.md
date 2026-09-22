# ADR: Kernel Gates as the Sole Admission/Authorization Boundary

## Status

Accepted

## Date

2026-09-22

## Context

Tasks enter the system from many sources (perception, System One, RL adapters,
replay). Without a single choke point, each source decides its own admission
and action policy, making audit, replay, and safety enforcement impossible.
The kernel needs deterministic, inspectable control over what is admitted and
what may act.

## Decision

All admission and authorization flows through four kernel gates registered in
`GateRegistry`:

- `KernelPerceptionGate.admitTask` — task admission (source quality, task-type
  validation, ingress verdict).
- `KernelActionGate.authorize` — action authorization, including sandbox tiers
  and authority (`system | human | external-governance`); system authority
  cannot upgrade beyond sandbox.
- `KernelBudgetGate.check` — AIKR budget feasibility.
- `KernelRewardGate` — reward-channel admission.

Every gate decision is recorded via `recordGateDecision` and surfaced in
Prometheus as `senars_gate_decisions_total` and `senars_gate_vetoes_total`.
Rejections return structured verdicts (`admitted: false` + `rejectionReason`,
`authorized: false` + `vetoReason`) rather than throwing; `KernelActionGate`
may translate a veto into an exception only at a defined boundary
(`unauthorized-tool` violation).

## Consequences

- Single auditable path: every admission/veto is a recorded, replayable
  cognitive event.
- Fail-closed semantics (D1): gate faults default to rejection, never
  silent admission.
- Callers must handle structured veto outputs; they cannot bypass the
  registry. Gate implementations are injected at build time.
- Metrics make gate pressure visible operationally.

## References

- `nar/src/kernel/interfaces.ts`
- `nar/src/kernel/GateRegistry.ts`
- `nar/src/kernel/KernelPerceptionGate.ts`
- `nar/src/kernel/KernelActionGate.ts`
- `nar/src/kernel/KernelBudgetGate.ts`
- `nar/src/kernel/KernelRewardGate.ts`
- `nar/src/metrics/prometheus.ts`
