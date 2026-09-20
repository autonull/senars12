# System One User Guide

System One is SeNARS's trained judgment layer: a set of calibrated heads over a shared
embedding space that handles natural-language ingress, candidate ranking, semantic
reflexes, and reinforcement learning — without NAL logic in the loop.

## Enable it

Add a `systemOne` section to `senars.config.json`:

```jsonc
{
  "systemOne": {
    "enabled": true,
    "manifold": {
      "provider": "off",              // 'off' = deterministic stub; 'wasi' | 'http' | 'peer' for real backends
      "encoder": { "modelId": "Xenova/all-MiniLM-L6-v2", "dimension": 384 }
    },
    "cortex": { "provider": "off" }   // Tier-2 synthesis ('off' = stub candidates)
  }
}
```

Verify the flag reached a live NAR: `pnpm status` shows `System One: enabled` and its
provenance (config file vs default).

## What it does when enabled

- **Ingress** — `nar.input("the robin is a bird")` sends the raw utterance through the
  `KernelPerceptionGate` before parsing. Six heads judge it: `task_type`, `illocution`,
  `injection`, `ambiguity`, `tense`, `source_quality`. Admission truth is seeded from
  `source_quality` (LLM_PRIOR ceiling), ambiguity injects a clarification question.
- **Synthesis** — when `cortex.provider` is a real LM, `proposeAndJudge` generates
  candidates through GBNF-constrained decoding and ranks them on the manifold.
- **Reflexes** — `GameFocus` prefetches manifold scores at the attend stage; the
  semantic reflex proposes instead of the incumbent Q-table when warm.
- **RL without NAL** — `ManifoldRLAgent` drives any `Game` using only the embedding
  cache, manifold, and dataset (see `examples/rl-gridworld.ts`).

## The heads

All 17 heads are declared in one table (`nar/src/lm/system-one/head-specs.ts`):

| Group | Heads |
|---|---|
| Ingress (epistemic) | `task_type`, `illocution`, `injection`, `ambiguity`, `tense`, `source_quality` |
| Action (teleological) | `tool_dispatch`, `risk`, `feasibility`, `strategy`, `reflex_value` |
| Synthesis | `candidate_select`, `conflict`, `novelty`, `groundedness` |
| Memory / others | `relevance`, `episodic_match` |

Each head reports a calibrated `ece` and an `abstain` threshold. Registering your own
head takes one object — see `examples/custom-head.ts`.

## Observability

- `pnpm status` — live manifold health, per-head ECE/abstain thresholds, LM spend
  counters, dataset and calibration-lock artifact sizes. `--json` for scripts.
- REPL (`pnpm repl`): `:judge <text>` prints the full 6-head distribution for any text;
  `:health` and `:spend` are shortcuts to the same data.
- Prometheus: `systemone_*`, `lm_spend_tokens{provider}`, `lm_spend_cost_milli{provider}`.

## Distillation flywheel

1. Labels accumulate in the dataset (`systemOne.distillation.datasetPath`, default
   `./data/systemone-distillation.jsonl`) — corrections, approvals, RL outcomes,
   clarifications. Rows are hash-only; the 384-d embeddings live in a vector sidecar.
2. `pnpm tsx scripts/system-one-train.ts` fits linear/logistic heads (Brier loss) and
   emits digest-pinned artifacts (`config.json` + `weights.bin` + `MODEL_DIGEST`).
3. `pnpm tsx scripts/system-one-fit-thresholds.ts` fits isotonic calibrators + abstain
   thresholds and writes `calibration-lock.json`; the manifold fails closed on digest
   mismatch.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No judgment events on `nar.input` | provider is `'off'` (deterministic stub) | configure a real manifold provider, or inspect heads directly via `:judge` |
| Config changes have no effect | `systemOne` not flowing from file | `pnpm status` → provenance should read `config-file` |
| `DigestMismatchError` on head load | encoder or weights changed without re-pinning | retrain/re-fit, or delete `calibration-lock.json` to revert to unfitted |
| LM hangs on startup | provider probing with unreachable endpoints | `LM_PROVIDER=mock` or `LM_OFFLINE=1`; `pnpm doctor` to probe |
| Heads behave like hash scorers | `calibration.fitted === false` | run the trainer; untrained heads never gate (mask/floor pass through) |
