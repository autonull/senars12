# Veto Storm (Negotiator mass-vetoing)

## Symptom

- `senars_gate_vetoes_total{reason="below-threshold"}` (and `nal-<source>` reasons)
  spiking (`nar/src/telemetry/index.ts:25` counters `gateVetoesTotal`,
  `nar/src/metrics/prometheus.ts:200`).
- Agent proposes actions but nothing executes; `actionExecuted` null while
  `action` non-null in Negotiator results.
- OTel attributes on decisions: `negotiator.vetoed: true`,
  `negotiator.veto_reason: ...` (`Negotiator.ts:54-55`).
- Reflex learning events all carry `overriddenBy: "below-threshold"` or
  `"nal-<trap-source>"` (`Negotiator.ts:149`, `nar/src/reflex/Reflex.ts:18`) —
  L1 adapters then demote those actions (`nar/src/reflex/adapters.ts:51,72`),
  compounding the shutdown.

## Diagnosis

- Root logic (`nar/src/reflex/Negotiator.ts:116-123`): a proposed action is vetoed
  when its supporting derivation has `truth.f < 0.3` while `truth.c >=
  nalVetoThreshold` (default 0.8) — confident-but-low-frequency truth = trap veto.
- `below-threshold` vetoes (`Negotiator.ts:78`) mean no proposal clears
  `reflexThreshold` (default 0.3) at all.

```sh
# Veto reason distribution
curl -s localhost:<metrics-port>/metrics | grep gate_vetoes_total

# Confidence/frequency of top proposed beliefs — are truth.f values genuinely low,
# or is the belief base degraded?
grep -n 'veto_reason\|overriddenBy' <log>
```

- Distinguish: mass `below-threshold` → weak action proposals (evidence starvation,
  bad focus); mass `nal-<source>` vetoes → the trap detector firing on legitimate
  actions (threshold too strict, or a repetitive loop genuinely detected).
- `vetoMemo` cache (`Negotiator.ts:35,122`, cap-limited) — memoized vetoes persist
  within a session even after conditions change.

## Remediation

1. If truths are genuinely low: feed more evidence — check perception admission
   ([gate-deadlock.md](gate-deadlock.md)) and schema induction; the belief base
   needs supporting derivations.
2. If the trap veto is over-firing: inspect `nalVetoThreshold` (default 0.8) and the
   truth-frequency floor (0.3) passed as `Negotiator` options (`Negotiator.ts:23,39`);
   loosen only with evidence the vetoed actions are legitimate.
3. Clear the veto memo: `vetoMemo` is cleared when it hits `VETO_MEMO_CAP`; a
   process restart clears it immediately.
4. Reflex learning contaminated by vetoes: since `overriddenBy` demotions persist in
   the reflex tables (TabularQ/UCB/EpsilonGreedy), re-balance after the storm ends —
   demoted actions recover only through new non-vetoed trials.

## Escalation / Rollback

- Do not disable the Negotiator — vetoes are the safety layer; escalate with the
  `negotiator.veto_reason` histogram and sample vetoed derivations instead.
- Rollback: revert the `Negotiator` options change (thresholds are constructor
  config, no persisted state); learning tables may need a reset if they learned
  around the vetoed set during the storm.