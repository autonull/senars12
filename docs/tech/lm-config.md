# Unified LM Configuration

One place configures every LM (chat, reasoning rules, structured output). Two layers, env wins:

## 1. Config file (`senars.config.json`)

```jsonc
{
  "lm": {
    "provider": "transformers",        // transformers | ollama | anthropic | openai | openai-compatible | mock
    "model": "onnx-community/Qwen2.5-1.5B-Instruct",  // quality model
    "fastModel": "HuggingFaceTB/SmolLM2-360M-Instruct",
    "structuredModel": "...",          // structured-output tier
    "compactModel": "...",
    "baseUrl": "https://api.example.com/v1",  // openai-compatible endpoints
    "ollamaHost": "http://localhost:11434",
    "apiKeyEnv": "MY_API_KEY",         // env var name holding the cloud key
    "quantized": true,                 // q4 for local models
    "cacheDir": ".cache/models"
  },
  "production": {                       // alternate settings, activated with LM_PROFILE=production
    "provider": "openai-compatible",
    "model": "anthropic/claude-3.5-sonnet",
    "apiKeyEnv": "ANTHROPIC_API_KEY"
  }
}
```

## 2. Environment (highest precedence)

| Env var | Purpose | Applies to |
|---|---|---|
| `LM_PROVIDER` / `SENARS_LM_PROVIDER` | provider selection | all tiers |
| `LM_MODEL` / `SENARS_LM_MODEL` | quality model override | quality tier |
| `LM_FAST_MODEL` | fast tier model | fast tier |
| `LM_STRUCTURED_MODEL` | structured-output model | structured tier |
| `LM_COMPACT_MODEL` | compact tier override | local compact |
| `LM_BASE_URL` | openai-compatible endpoint | cloud |
| `OLLAMA_HOST`, `OLLAMA_MODEL` | local ollama | local |
| `LM_API_KEY` / provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | cloud credentials | cloud |
| `LM_PROFILE` | `production` activates the config-file `production` block | all |

Precedence: env → config file (`lm`) → provider defaults. Local models run with WebGPU when available (auto-detected), otherwise CPU; `quantized` selects `q4` weights.

## Fallback chains

Each provider has a model chain per task (see `nar/src/lm/providers.ts`). On transport failure `LMService` retries with exponential backoff, then throws `LMUnavailableError` and re-probes the active provider once (`resolveActiveProvider()`).

## Offline / local support

- `transformers` provider: fully offline; models cached under `cacheDir`.
- `ollama`: auto-probed; when unreachable, chain falls back to built-in transformers models.
- `mock` provider: deterministic responses for tests (`LM_PROVIDER=mock`).

## LM rules from config

`bot.lmRules.rules` accepts entries `{id, name?, description?, priority?, prompt?, taskType?, budget?, multiline?, singlePremise?, enabled?}`.
Known preset ids (e.g. `lm-narsese-translation`, `lm-belief-revision`, …) build the corresponding preset; unknown ids build a custom rule and are logged at bootstrap.
## Objective-driven routing

When `senars.config.json` defines a `routing` block, chains are composed from configured
candidates plus the guaranteed offline failsafe ladder (`builtin:compact` → `builtin:mock`):

```jsonc
"routing": {
  "objectives": {
    "chat":       {"quality": "balanced", "maxLatencyMs": 2000},
    "rules":      {"quality": "high",     "offlineOnly": false},
    "structured": {"quality": "max"}
  },
  "candidates": ["cloud:quality", "local:quality"],
  "offlineLadder": ["HuggingFaceTB/SmolLM2-360M-Instruct", "onnx-community/Qwen2.5-1.5B-Instruct"]
}
```

| Field | Meaning |
|-------|---------|
| `objectives.<task>.quality` | `balanced` / `high` / `max` — weights the (quality, cost, latency) score |
| `objectives.<task>.maxLatencyMs` | Hard filter: latency-class floor (fast ≤2s, medium ≤5s, slow ≤30s) must fit the budget |
| `objectives.<task>.offlineOnly` | Hard filter: builtin (offline) candidates only; overrides global `routing.offlineOnly` per task |
| `candidates` | Model ids (`cloud:quality`, `local:fast`, `builtin:compact`, …); per-task objectives override global constraints |
| `offlineLadder` | Local model ids smallest → most capable; `builtin:quality` resolves to the largest rung cached under `cacheDir` (or `LM_LOCAL_MODEL`) |

Resolution: `pickModel(candidates, objective, stats)` — hard filters first, then objective-weighted
score scaled by the candidate's success rate (`LMExecutionStats`). Models with repeated transport
failures are demoted to the back of the chain for the session (`demoteModel`); demotions and the
last routing decision are visible in the `nar://lm-status` resource (`routing.demoted`,
`routing.lastDecision`). Without a `routing` block, behavior is exactly the built-in per-provider
chains.
