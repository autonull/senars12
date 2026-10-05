# LM Ladder — Model Choice from Compact to Frontier

One dial (`LM_PROVIDER` + env) selects across a capability ladder. Every rung is optional; the chain always ends in a local failsafe.

## Rungs (compact → frontier)

| Tier | Provider | Model (default) | Notes |
|------|----------|-----------------|-------|
| 0 | `mock` | `mock` | Deterministic; never probes (also under `LM_OFFLINE=1`) |
| 1 | `webllm` | `llama-3.2-3b-instruct` / `phi-3.5-mini-instruct` | Browser WebGPU only |
| 2 | `transformers` | `onnx-community/Qwen2.5-1.5B-Instruct` (quality) · `HuggingFaceTB/SmolLM2-360M-Instruct` (compact) | Local CPU/WASM; first run downloads via `cacheDir` |
| 3 | `llamacpp-embedded` | GGUF at `LM_LLAMACPP_MODEL` | GPU backends: `LM_LLAMACPP_GPU` (auto/cuda/metal/vulkan), layers, ctx, batch, seqs, flash-attn; verified 188.9 tok/s on GPU |
| 4 | `llamacpp` | `LM_LLAMACPP_HOST` server | |
| 5 | `openai-compatible` (local daemon, e.g. ollama) | `llama3.2` (`OLLAMA_MODEL`) | |
| 6 | `anthropic` / `openai` / `openai-compatible` | `claude-3-5-sonnet-latest` / `gpt-4o-mini` | Credentials via `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` |

## Environment matrix

| Env | Effect |
|-----|--------|
| `LM_PROVIDER` | Hard provider selection; `mock` never probes |
| `LM_OFFLINE=1` | Skip all probes; local/mock resolve immediately, cloud falls back to `transformers` |
| `LM_DTYPE` | Global dtype override: `q4` \| `q8` \| `fp16` \| `fp32` (transformers models) |
| `LM_QUALITY_DTYPE` / `LM_FAST_DTYPE` | Per-slot dtype (overrides `LM_DTYPE`) |
| `LM_MAX_SPEND_USD` | Circuit-breaker spend cap (H3); trips ⇒ `LMUnavailableError` with remediation hint |
| `LM_MODEL`, `LM_FAST_MODEL`, `LM_STRUCTURED_MODEL`, `LM_COMPACT_MODEL` | Per-slot model ids |
| `LM_PROFILE` | `auto` \| `cloud-quality` \| `local-private` \| `ollama` (deprecated alias) presets |

## Failure UX (H6)

Every `LMUnavailableError` appends a provider-specific remediation hint (`ollama serve`, `scripts/fetch-model.ts`, cache-dir hints, credential hints).

## Routing honesty

- Explicit per-call model ids (`generateText(prompt, { model: 'cloud:quality' })`) bypass the chain; unknown ids throw — no silent failover (Bench 27).
- Per-domain bindings: `systemOne.cortex.model` (Cortex candidates), `LM_FAST_MODEL`/`LM_QUALITY_DTYPE` slots.
- Spend is observable: `getSpend()`, `lm_spend_tokens{provider}`, `lm_spend_cost_milli{provider}`.
