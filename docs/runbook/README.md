# SeNARS Runbook Index

Operational incident runbooks. Each covers Symptom → Diagnosis → Remediation → Escalation/Rollback.

| Incident | File | Key signals |
|---|---|---|
| LM provider failure / circuit breaker | [lm-provider-failure.md](lm-provider-failure.md) | `LMUnavailableError`, `senars_lm_circuit_state`, `senars_lm_probe_total` |
| Kernel gate deadlock | [gate-deadlock.md](gate-deadlock.md) | `senars_gate_decisions_total` all-denied, `policy.violation` events |
| Schema store corruption | [schema-store-corruption.md](schema-store-corruption.md) | `schema_store.promote` span failures, kind/version mismatch |
| Budget exhaustion | [budget-exhaustion.md](budget-exhaustion.md) | spend-cap `LMUnavailableError`, budget gate termination |
| Veto storm | [veto-storm.md](veto-storm.md) | `senars_gate_vetoes_total` spike, `negotiator.veto_reason` |
| Config migration failure | [config-migration-failure.md](config-migration-failure.md) | `configVersion` newer than supported, `pnpm config:check` failure |

Related: `nar/src/lm/service/errors.ts` (`LADDER_HINTS` — per-provider remediation hints appear
in error messages), `nar/src/metrics/prometheus.ts` (metric registry), `package.json` (`config:check`).