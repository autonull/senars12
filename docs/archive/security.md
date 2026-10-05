# Security Pen-Test Checklist (TODO20 Phase 7)

Status: delivered 2026-09-22. Bench 68 (`tests/nar/todo20-security.test.ts`) is the executable gate —
re-run it after any change to the tool or LM boundaries.

## S1 — Tool input validation

- [x] Every AI-SDK tool `inputSchema` is a strict zod object (`z.strictObject`); unknown keys rejected
      at the boundary. Grep-guard: `inputSchema: z.object(` → zero hits in `nar/src/tools/`.
- [x] JSON-Schema tools (`nar/src/tools/registry.ts` `Registry.validateArgs`) reject unknown
      parameters with `Unknown parameter: <key>` (`ToolError`).
- [x] `ToolSpecSchema` / `ConnectionConfigSchema` are `.strict()` (Phase 3 E3).

Pen-test cases (all covered by Bench 68):
- Send extra/unknown keys to any tool → rejected, not silently dropped.
- Send wrong types / out-of-range values → rejected by schema or `validateType`.

## S2 — Shell tool hardening (`code_exec`)

- [x] **Disabled by default** — `createCodeExecTools()` returns `{}`; opt-in via
      `createCodeExecTools({ enabled: true })` (per DQ6: allow-list default empty, explicit opt-in).
- [x] Allow-list via `SHELL_ALLOWLIST` env (comma-separated command names) or `allowlist` option;
      empty allow-list denies every command. Match is exact name or basename (no path trickery).
- [x] No `shell:true` — argv-array `spawn` only; injection via shell metacharacters impossible.
- [x] Timeout enforced via `AbortSignal.timeout(timeout)` passed to `spawn` (kernel kills the child).
- [x] Cwd containment uses `containsPath` (segment-aware; `/ws-secret` is not inside `/ws` — the old
      `startsWith` bug is closed).

Pen-test cases:
- `command: "curl"` with `SHELL_ALLOWLIST=ls` → denied with grant hint.
- `cwd: "../sibling"` → denied (outside workspace root).
- Long-running child with `timeout: 1000` → resolved promptly, non-zero exit.

## S3 — WASI sandbox (`code_exec_wasi`)

- [x] Untrusted code runs through `@wasmer/wasi` + `wasmfs` (`nar/src/capability/wasi-sandbox.ts`);
      `node:vm` sandbox is deprecated (not a security boundary) and warns on use.
- [x] No host FS or network access unless explicitly granted via capability tokens
      (`wasiAllowedPaths` → `sanitizePreopens` MemFS preopens; traversal entries dropped).
- [x] Wall-clock limit via `withTimeout` (`SandboxTimeoutError`); wasm module path must be inside
      granted roots (`assertWasmPathContained`).
- [x] Unknown/missing module fails closed (error result, no partial execution).
- Deviation from plan text (§5p): wasmtime fuel metering is not available through the `@wasmer`
  runtime — limits are wall-clock + MemFS isolation + preopen grants. Revisit fuel/memory metering
  when the wasmtime Node binding stabilizes.

Pen-test cases:
- `wasmPath` outside granted roots → rejected before instantiation.
- Nonexistent module → fails closed.

## S4 — LM response sanitization

- [x] `toolChoice` stripped from local-model (transformers.js) params via middleware
      (`nar/src/lm/providers/model-factory.ts`); the transformers.js provider never emits legacy
      `function_call` wire format, so no additional strip point exists (documented in source).
- [x] Narsese from LM output is grammar-validated before admission (`LMResponseParser` →
      `parsed.valid` gate in `lm/rule/LMRule.ts`; ingress tasks pass `KernelPerceptionGate`).
- [x] Size limits on all LM outputs: `enforceLMOutputSize` (`nar/src/lm/service/sanitize.ts`),
      cap `LM_MAX_OUTPUT_CHARS` (default 65,536 chars), enforced on `generateText` (incl. cache
      hits) and streaming (`LMOutputTooLargeError`, code `LM_OUTPUT_TOO_LARGE`).

Pen-test cases:
- Model output containing spoofed tool-call payloads → stripped before it can influence agents.
- Oversized output (> cap) → `LMOutputTooLargeError`, spend/call metrics recorded as failure.

## Related controls (pre-existing)

- Strict config schemas + provider enum (Phase 5 C1); `.env` gitignored; secrets checked by
  `config:check` (C4).
- Kernel fail-closed perception gate (D1) with structural IngressJudge boundary (X2, §5k).
- Tool budgets/permissions in `ToolManager`; abort-signal checked per execution.
