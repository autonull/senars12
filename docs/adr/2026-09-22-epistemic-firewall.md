# ADR: Epistemic Firewall Between Kernel and System One

## Status

Accepted

## Date

2026-09-22

## Context

The kernel (slow, deliberative NARS reasoning) and System One (fast,
LM-proposed judgments) must not share an import graph. If the kernel imports
System One internals, LM behavior can alter kernel semantics, System One
faults propagate into admission, and the dependency direction is untestable.
TODO20 X2 / §5k require the kernel to be LM-agnostic.

## Decision

The kernel defines an `IngressJudge` interface in `kernel/ingress.ts`. It
evaluates proposed task content (task type, source quality) and returns a
verdict. The concrete implementation, `SystemOneIngressJudge`
(`lm/system-one/ingress-judge.ts`), is injected into `KernelPerceptionGate`
at build time; the kernel holds the interface, never the implementation.

`KernelPerceptionGate` imports no `lm/*` or System One modules — verified by
its import set (`@senars/kernel/schemas`, `nl/normalize`, `terms`,
`telemetry`, `kernel/ingress`). If the judge faults, the gate rejects the
task with `rejectionReason: 'System One ingress fault: admission rejected
(fail-closed)'` — judge failure degrades to conservative admission, never
pass-through.

## Consequences

- Kernel remains testable and compilable without any LM dependency.
- Alternative judges (stub, replay, human-approval) can be injected without
  kernel changes.
- Cost: every LM-derived proposal passes one indirection; judge quality is
  the admission ceiling, so the judge must be calibrated and fault-tested.
- Firewall compliance is an invariant to check in gate audits
  (`docs/GATE_AUDIT.md`).

## References

- `nar/src/kernel/ingress.ts`
- `nar/src/kernel/KernelPerceptionGate.ts`
- `nar/src/lm/system-one/ingress-judge.ts`
- `nar/src/lm/system-one/index.ts`
