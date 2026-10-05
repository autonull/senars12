### Observability & UX

- `pnpm status` — live manifold health, per-head ECE/abstain thresholds, circuit breakers, LM spend, dataset/lock paths, and a governance section (attached self-meta-games + validation/approval queue depths) (`--json` for machines)
- REPL — natural-language input routes through the ingress; `:judge <text>` prints the full per-head judgment distribution, `:health`/`:spend` for status shortcuts
- `egress.gate.rejected` events — groundedness-gate rejections are user-visible, never silently swapped
- Prometheus: `systemone_*` judgment/ingress/reflex counters, `lm_spend_tokens{provider}` / `lm_spend_cost_milli{provider}` with optional `LM_MAX_SPEND_USD` cap — served at `GET /metrics` (Prometheus text) and `/metrics.json` by the Web UI server (`ENABLE_WEB_UI=true`); gate-decision spans carry `correlation.id`, so a counter joins to the events behind it
- Benchmarks 15–28 (`tests/nar/todo16c-*.test.ts`) falsify every claim above in the CI `systemone-benches` job

Three runnable starters live in `examples/`: `systemone-ingress.ts`, `rl-gridworld.ts`, `custom-head.ts`.
