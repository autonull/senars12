## Safety, Observability & Governance

### Observability (OpenTelemetry)

Kernel stage regions are recorded by `CycleTrace` (`@senars/nar/proposal/cycle-trace`) and can be
exported to OpenTelemetry by wrapping them:

```typescript
import { initOtel, getTracer } from '@senars/nar/otel';

initOtel({
  serviceName: 'senars-cognitive-kernel',
  otlpEndpoint: 'http://localhost:4318/v1/traces',  // optional
  batch: true,  // use BatchSpanProcessor (recommended for production)
  enabled: true,
});

getTracer().addEvent('cycle.stage', { stage: 'reason', cycle: 12 });
```

**Exports:** `initOtel`, `shutdownOtel`, `emitEvent`, `getTracer`, type `OtelConfig` from `@senars/nar/otel`.

### WASI Sandbox — Secure Capability Execution

`CapabilitySpace` supports **WebAssembly sandboxing via WASI** for safe execution of self-modification tools and untrusted code:

```typescript
import { CapabilitySpace, createWasiSandbox, createWasmModuleSandbox, createNodeVMSandbox } from '@senars/nar/capability';

// 1. WASI sandbox with preopened directories (deny-by-default)
const wasiSandbox = await createWasiSandbox({
  allowedPaths: ['/workspace', '/tmp'],  // explicit allowlist
  env: { MY_VAR: 'value' },              // explicit env only (deny-by-default)
  args: ['--flag'],
  timeoutMs: 30000,                      // enforced wall-clock timeout
  // deny-by-default: no network, no clock, no env vars unless explicitly provided
});

// 2. WASM module sandbox (loads .wasm file with WASI imports)
const wasmSandbox = await createWasmModuleSandbox({
  wasmPath: '/path/to/module.wasm',
  imports: { custom: { func: () => {} } },
  timeoutMs: 30000,
});

// 3. Node.js VM sandbox (JS isolation fallback — NOT for untrusted code)
const vmSandbox = createNodeVMSandbox(); // relegated to "trusted-but-faulty code isolation"; deprecated for secure use

// Use with CapabilitySpace
const space = new CapabilitySpace({ sandbox: wasiSandbox });
space.register({ name: 'run_wasm', execute: () => 'result' });
await space.execute('run_wasm');
```

**Hardening Features:**
- **Env leak closed** — both sandboxes receive explicit `env` only (default `{}`); no `process.env` spread
- **Path containment** — `sanitizePreopens()` normalizes paths, drops `..` escapes; `assertWasmPathContained()` enforces `wasmPath` stays within `allowedPaths` (guards sibling-prefix confusion)
- **Timeouts** — `timeoutMs` option (default 30s) enforced via `withTimeout()` → `SandboxTimeoutError`; all wrappers race execution against it
- **`createNodeVMSandbox` deprecated** — JSDoc `@deprecated` + one-time `console.warn`; retained only for backward compat. Never use for untrusted code.

**Sandbox Options:**

| Option | Type | Description |
|--------|------|-------------|
| `allowedPaths` | `string[]` | Directories preopened for WASI file access (deny-by-default) |
| `env` | `Record<string,string>` | Environment variables for WASI process (deny-by-default) |
| `args` | `string[]` | Command-line arguments for WASI process |
| `timeoutMs` | `number` | Wall-clock timeout in ms (default 30000) |

**Exports:** `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox`, `SandboxTimeoutError`, `DEFAULT_SANDBOX_TIMEOUT_MS`, `sanitizePreopens`, `containsPath`, `assertWasmPathContained`, `withTimeout` from `@senars/nar/capability`.

### Production Readiness

SeNARS is designed for **continuous, unattended operation** within defined autonomy bounds. The cognitive kernel includes:

- **OpenTelemetry distributed tracing** — per-middleware spans with OTLP HTTP export for observability
- **WASI sandbox** — secure capability execution via `CapabilitySpace` with `createWasiSandbox`/`createWasmModuleSandbox` (deny-by-default)
- **Health monitoring** — cognitive state emission every 10 cycles (drives, meta-goals, AIKR pressure, RLFP rewards)
- **Persistent state verification** — JSON serialization/deserialization with integrity checks across restarts
- **Auto-approval modes** — configurable `ApprovalManager` for unattended operation within autonomy bounds
- **Event-sourced replay** — system can be paused, event log serialized, and perfectly replayed in a separate process

**Target:** 1-hour+ unattended autonomous runs (`nar run --auto --duration 3600`) at `sandbox-execute` autonomy level.
