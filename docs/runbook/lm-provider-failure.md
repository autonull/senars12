# LM Provider Failure / Circuit Breaker Trip

## Symptom

- `LMUnavailableError` (code `LM_UNAVAILABLE`) in logs with appended `hint:` from
  `LADDER_HINTS` (`nar/src/lm/service/errors.ts:5`).
- OTel span `lm.generate_text` (`nar/src/lm/service/LMService.ts:139`) ends with error.
- Metrics (`nar/src/metrics/prometheus.ts`):
  - `senars_lm_circuit_state{provider=...}` stuck at `open`
  - `senars_lm_probe_total` showing consecutive probe failures
  - `senars_lm_calls_total{status="error"}` rising
- Agent falls back to `transformers`/`mock` — degraded output quality, `LM_PROVIDER` in
  effect not the one configured.

## Diagnosis

```sh
# Which provider is configured and what settings say
echo $LM_PROVIDER $LM_OFFLINE $LM_BASE_URL

# Circuit breaker state per provider (defaults in nar/src/lm/provider-runtime.ts:72-79)
# openai-compatible: trip at 5 consecutive failures, 30s reset; anthropic/openai: 3 fails, 60s reset

# Probe the endpoint directly (same check as probeOpenAICompatible, nar/src/lm/providers/health.ts:16)
curl -m 3 -H "Authorization: Bearer $OPENAI_API_KEY" "$LM_BASE_URL/models"

# Session-level model demotions (routing.ts demoteModel → ProviderRuntime.demotions)
grep -rn "demoted" /path/to/log
```

- Check whether the breaker is `open` vs provider actually down: breaker auto-transitions
  to `half-open` after `resetTimeoutMs` and passes when `successThreshold` probes succeed
  (`provider-runtime.ts:258-261`).
- Health probes run every 60s (`startHealthProbes`, `health.ts:144`); check `lastProbe`/`probeResult`.
- `LM_OFFLINE=1` short-circuits all probing to offline-safe providers (`health.ts:43-56`).

## Remediation

1. If the endpoint is down: restart it (`ollama serve`, `llama-server`) or fix
   `LM_BASE_URL`. For `llamacpp-embedded`, fetch the GGUF first:
   `pnpm exec tsx scripts/fetch-model.ts`.
2. If auth: set `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (hint text in `LADDER_HINTS`).
3. Breaker will self-heal after `resetTimeoutMs`; to reset immediately, restart the
   process or call `resetCircuitBreakers()` (`nar/src/lm/providers/health.ts:91`).
4. Clear session demotions: `resetDemotions()` (`nar/src/lm/providers/routing.ts:34`)
   once the underlying model is healthy.
5. Need to keep running regardless: `LM_PROVIDER=mock` or `LM_OFFLINE=1`.

## Escalation / Rollback

- Transport errors retry twice with exponential backoff (250ms base,
  `withRetry` in `errors.ts:46`) before failing — recurring failures beyond that
  indicate provider-side outage; escalate to provider owner.
- Rollback: revert `LM_PROVIDER` to the last known-good provider; breakers/demotions
  are session-scoped state (no on-disk rollback needed).