# ADR: GPU Offload Scoped to WebGPU/WebLLM Device Selection

## Status

Accepted (scoped to WebGPU/WebLLM device selection)

## Date

2026-09-22

## Context

In-browser and embedded local LM inference must run fast enough for System
One to keep up with the reasoning loop. Full GPU orchestration (CUDA-style
offload, multi-device scheduling) is out of scope for a browser-first
runtime; what is achievable today is automatic device selection for
WebGPU-capable runtimes and dtype tuning for local models.

## Decision

GPU offload is limited to what the local providers actually support:

- `lm/providers/webllm.ts` exposes `detectDevice()`, returning `'webgpu'`
  when `navigator.gpu` exists, else `'cpu'`. This is the single
  auto-detection point — no other module probes devices.
- `lm/providers/model-factory.ts` passes `device: detectDevice()` into every
  local model slot (`quality`, `fast`, `structured`, `compact` via
  `localModel`).
- Dtype is chosen per slot (H7 note): quality slots use
  `qualityDtype ?? dtype`, fast slots use `fastDtype ?? dtype`, falling back
  to `quantized ? 'q4' : 'fp32'` — device/dtype are independently tunable
  per slot.
- Transformers.js paths use the same device/dtype selection semantics
  through the shared factory.

Out of scope, deliberately: server-side GPU offload (`llamacpp.ts` /
`embedded-llamacpp.ts` delegate device placement to their runtimes),
multi-GPU scheduling, and embedding offload beyond what the chosen device
gives for free.

## Consequences

- WebGPU is a free win where present; CPU fallback is automatic and silent.
- Honest scope: there is no general GPU-offload layer; performance work
  beyond device/dtype selection is future scope with its own ADR.
- Dtype settings (`LM_QUALITY_DTYPE`, `LM_FAST_DTYPE`, `LM_DTYPE`) are the
  tuning surface — per-slot, not global-only.
- Providers without WebGPU support (llamacpp family) are unaffected and
  keep runtime-controlled placement.

## References

- `nar/src/lm/providers/webllm.ts`
- `nar/src/lm/providers/model-factory.ts`
- `nar/src/lm/providers/settings.ts`
- `nar/src/lm/providers/llamacpp.ts`
- `nar/src/lm/providers/embedded-llamacpp.ts`
