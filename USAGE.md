# SeNARS — usage

Command-first, non-UI first. The browser UI is one consumer; the organism is
usable without it. The demo/release narrative is UI.19 W6 — not duplicated here.

Everything below works with **no LLM configured** (D10): a missing key degrades
to the deterministic path.

## CLI

One-shot — positional Narsese, punctuation *is* the task type (`.` belief, `!`
goal, `?` question), and one argument may hold several sentences:

```sh
pnpm bot -- "(cat-->animal). (animal-->living). (cat-->living)?" --steps 10
pnpm bot -- "(cat-->living)?" --json
```

A question prints its answer with its verified derivation. `--steps` defaults to
10; `--json` emits the structured result.

Reporting modes:

```sh
pnpm bot -- --status      # System One + persisted boundary
pnpm bot -- --doctor      # credentials, provider probes, persisted boundary
pnpm bot -- --doctor --benchmarks   # declared placeholder (not yet implemented)
```

`--status` and `--doctor` read the persisted consistency boundary off disk
(`cycle N, P pending`) or report `Persisted state: none`.

Run the agent:

```sh
pnpm senars                # agent; starts a UI only when ENABLE_WEB_UI=true
```

## MCP

```sh
pnpm mcp
```

Resources report real state on a seeded agent:

| URI | Contents |
|---|---|
| `nar://state` | beliefs/goals/questions/attention/drives **+ the persisted boundary** |
| `nar://beliefs`, `nar://concepts`, `nar://attention` | live memory |
| `nar://episodes` | recent episodic entries |
| `sessions://list` | live sessions |
| `self-reasoning://quality` | `getSelfAnalyzer().assessQuality()` |
| `nar://memory-status`, `nar://benchmarks`, `nar://lm-status`, `rlfp://state` | subsystem state |

## HTTP

`/metrics` and `/metrics.json` are served by any HTTP connection (the bot wires
them ahead of auth).

Production reasoning — **off unless `ENABLE_REASONING_HTTP=true`**:

```sh
ENABLE_REASONING_HTTP=true pnpm bot -- ...
curl -X POST localhost:8080/reasoning/believe -d '{"term":"(cat-->animal)."}'
curl -X POST localhost:8080/reasoning/ask     -d '{"term":"(cat-->living)?","runs":10}'
```

`ask` reuses the kernel (`question` → `run` → `askWithDerivation`) and returns the
answer with its derivation. When the flag is off the route answers `404 DISABLED`
rather than routing the request as chat.

## SDK

```ts
import { createNAR } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
```

- `NAR` — the kernel. `believe` / `goal` / `question`, `run` / `step`, `ask` /
  **`askWithDerivation(question)`** (verified derivation attached), `perceive`,
  `explainDerivation`, `getRuleFires*`.
- `Agent` — chat + memory: `chat`, `recall`, `know*`, **`getRecentDerivations()`**
  (typed `Derivation[]`), `getNAR()`.
- `createAgent(config)` / `createNAR(config)` — composition roots. `capabilities()`
  reflects wired subsystems honestly (D15).

Experimental / not-yet-stable: `Agent.delegate` (remote delegation), `--tune`
(simulated metrics), `--benchmarks` (placeholder).

## Verification

```sh
pnpm gates            # every gate (the local source of truth)
pnpm gates --tier slow
```
