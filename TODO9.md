# TODO9 — Agent / Bot / LM Rules / MCP: Unification & Completion Plan

Status of previous phase (done, verified): unified LM settings (`nar/src/lm/env-config.ts` +
`providers.ts`, `configureLM()`), config-file `lm` block plumbed through `createAgentFromEnv()`,
MCP→NAR tool bridge (`src/api/mcp-bridge.ts`), real LM-rule enable/disable, working SSE transport,
single shared NAR instance in `mcp-server.ts`, lens-schema dedupe, `tests/cognitive/lm-config.test.ts`.
Do not modify TODO1–TODO8.

This phase completes the unification and closes the remaining gaps. Ordered by impact.

---

## 1. Single Tool Registry (the big one)
**Problem:** three independent tool systems: `core/src/motor/ToolRegistry.ts` (+ `builtin-tools.ts`,
`buildAgentTools.ts`), `nar/src/tools/tool-registry.ts` (`ToolManager`), and 18 hand-registered MCP
tools in `src/api/mcp-tools.ts` (incl. its own `read_file`/`write_file` duplicating motor's fs tools).
**Work:**
- Define one `Tool` contract (shape already compatible: name/description/Schema/execute) exported
  from a shared location (`@senars/nar/tools`); make core's motor register INTO nar's `ToolManager`
  (or make `ToolManager` the single registry, motor delegating to it).
- `core/src/motor/builtin-tools.ts` fs/shell/approval tools register once; `src/api/mcp-tools.ts`
  drops its duplicated `read_file`/`write_file` and delegates everything non-agent-specific to the
  registry → MCP surface = registry tools (auto-bridged) + a thin agent-specific set.
- Kill `core/src/motor/builtin-tools.ts` `execSync` shell tool in favor of async exec with timeout
  (it currently blocks the event loop).

## 2. One LM execution path
**Problem:** `LMService` (nar) and `core/src/ModelRunner` (chat/tool loop) both wrap AI SDK
generateText/streamText independently; `ModelRunner.ts` imports `ai` directly.
**Work:** `ModelRunner` consumes `LMService` (or the shared provider registry) instead of importing
`ai`; keep one streaming-abort/cancellation implementation. Prompt-building already split via
`PromptBuilder` — route all callers through it.

## 3. Finish `senars.config.json` plumbing
**Problem:** only `lm` is consumed; `memory`, `inference`, `backends`, `production`, `irc` blocks
are silently stripped by `appConfigSchema`.
**Work:**
- Extend `src/config/schema.ts` with validated `memory`/`inference` sections mapped onto
  `NARConfig` (`maxConcepts`, `maxDerivationDepth`, `maxDerivationsPerStep`, `cpuThrottleMs`) and
  pass them from `createAgentFromEnv()` into `SeNARSFactory.createDefault`.
- Either wire `irc` block into `readIRCConfig()` (config-file fallback under env) or remove it.
- `production` block: make `apiKeyEnv`/model/baseUrl a first-class `LMSettings` variant (e.g.
  `LM_PROFILE=production`) or delete it — it is inert today.
- `backends.metta`/`backends.nar`: map to engine enable flags in factory options.

## 4. LM rules from config
**Problem:** `bot.lmRules.rules` accepts arbitrary JSON but nothing loads/validates it.
**Work:** validate with a zod schema (`LMRuleFactoryConfig`-shaped); at agent bootstrap, build rules
via `LMRuleFactory.from(lmService)` (presets by name: `lm-narsese-translation`, …) and register into
the processor. Log unknown preset ids.

## 5. Offline-model robustness (state-of-the-art local support)
- Typed `LMUnavailableError` raised by `LMService` on provider failure; chain fallback already
  exists at registry level — add retry/backoff + one-shot `resolveActiveProvider()` re-probe after
  transport errors.
- transformers.js: replace hardcoded `device: 'cpu'` with auto WebGPU detection (`navigator.gpu`
  availability probe → `device: 'webgpu', dtype: 'q4'` fallback to cpu); surface model download
  progress events (`progress_callback`) through `LMService` stats/logs.
- `LM_FAST_MODEL`/`LM_STRUCTURED_MODEL` per-tier env already supported; document the full env matrix
  in `docs/` (provider × tier × credential).

## 6. MCP completeness
- Replace `explain_belief`/`agent_explain` stubs ("Not yet implemented") with real delegation to
  `nar/src/tools/ExplainTool.ts` / derivation recorder.
- Add vitest MCP tests (`tests/mcp/mcp-bridge.test.ts`): schema→zod conversion, annotation mapping,
  `nar_` prefix collisions, list/enable/disable LM rules. Keep `tests/mcp/integration-test.ts` as
  the e2e smoke; optionally wrap it as a vitest e2e test.
- `io/src/connections/mcp.ts` (MCP client) has no tests — add in-process transport test.

## 7. Agent/Bot entry-point consolidation
- `repl.ts` readline loop → reuse io `CLIConnection`; keep `.cmd` handlers via `src/cli/commands.ts`.
- Merge `multi-agent-demo.ts` into `multi-agent.ts` (subcommand or flag).
- Delete `src/bin/lib/env-config.ts` `readLMEnvConfig` consumers once all bins read `LMSettings`
  directly (keep `readAllEnvConfig` for non-LM sections).

## 8. Config systems consolidation (3 → 1 direction)
- `core/src/config/{Config,ConfigSchema,ConfigView}` per-key registry and `ui/src/server/
  config-schema.ts`: export the canonical zod schemas from `src/config` (or a shared package) and
  make core/ui views derive from them. At minimum, share the `lm`/agent section schemas.

## 9. UI lens compile dedupe
- `ui/src/client/modulation/compile.ts` hardcodes built-in lenses mirroring
  `core/src/lens-schema.ts` `builtinLensSpecs()` — derive compile's built-ins from the shared specs
  (already re-exported via `ui/src/shared/lens-schema.ts`).

## 10. Remaining duplicates / hygiene
- `tests/conversational/providers.ts:4-8` re-implements provider resolution → use `resolveLMSettings()`.
- Add `ModelRunner` tool-loop + streaming tests (behavior-level, mock LM service, no mocks of internals).
- Consolidate root `TODO*.md` backlog into the tracker (files themselves stay untouched).
- CI: add `pnpm typecheck` (currently 112 pre-existing test-type errors — burn down to 0 or scope
  tsconfig to src) and `pnpm deps:check` to the gate.

---

## Final-review additions (verified gaps)

### 11. Embeddings on the same provider rails
`nar/src/memory/embedding.ts` imports `@browser-ai/transformers-js` directly — a second, independent
transformers.js integration point that ignores `quantized`/`cacheDir`/device settings. Route the
embedding model through the shared `LMSettings` (same device/dtype/cacheDir resolution as
`providers.ts` localModel) so offline model management is configured in one place.

### 12. MCP safety parity with motor tools
`core/src/motor/builtin-tools.ts` routes destructive actions through `ApprovalService`
(`request_approval`), but MCP's `write_file` (`src/api/mcp-tools.ts`) bypasses approval entirely and
has no path restriction. Add: (a) a workspace-root allowlist/sandbox for MCP fs tools, (b) optional
approval gating when an `ApprovalService` is present (config flag), so MCP clients get the same
guardrails as the internal agent.

### 13. Profile/identity config mapping
`senars.config.json` top-level `agent: {name, persona}` is stripped by `appConfigSchema` and does not
map to `profile` (botProfileSchema: name/personality/joinMessage). Map or rename so identity config
actually reaches the bot (joinMessage/personality are used by IRC/WS connections). Also honor or
remove `configVersion` (no loader reads it) — use it for config migration validation.

### 14. Observability & docs
- Expose LM stats (`createLMStats`/`recordLMCall` in `nar/src/lm/stats.ts`) and the LM-rule
  execution log as an MCP resource (resources already exist for lm-rules stats — add provider/tier
  resolution info: active provider, model per task, credentials present). Great for the offline↔online
  story: one resource answers "which model am I actually using?".
- Docs: `docs/` page for the unified LM config (env matrix × config-file keys × precedence),
  MCP tool surface (curated + auto-bridged `nar_*`), and bot entry points.
- Optional future: browser-side provider (e.g. WebLLM) for the UI package so the 3D UI can run the
  model fully in-browser; UI currently has zero LM usage.

---

## Suggested sequence
1 → 2 → 6 → 4 → 3 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14.
Each step lands with tests + `pnpm typecheck` + `pnpm mcptest` green.
