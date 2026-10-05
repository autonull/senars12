### The Core and the Induction Layer

The reasoning cycle — `cognitive/`, `kernel/`, `learning/`, `memory/`, `reason/`, `rules/`, `stream/`, `strategies/`, `terms/`, `nar-execution.ts` — **does not import `nar/src/lm/`**. Not as a convention and not as a lint rule: `pnpm core:no-lm` fails on a relative, workspace-subpath, static, dynamic, value or type import, and the prefix list it reads is the same `CYCLE_PATH_PREFIXES` the induction census prints.

What the core names instead, is a capability it declares and the composition root satisfies:

| the core declares | where | what it replaces |
|---|---|---|
| `ModelRule` | `nar/src/rules/types.ts` | `LMRule` — the layer's class satisfies it structurally, and `registerModelRule` is where that is checked |
| `TextGenerator` | `nar/src/ports/` | `LMService` — one method, so a caller cannot demand an argument the core has no vocabulary for |
| `EmbeddingRuntime` | `nar/src/memory/embedding.ts` | `getLMSettings()` — a source function the core injects; `lm/embedding-runtime.ts` is the only module that answers it |
| `ModelRuleSelector` | `nar/src/strategies/types.ts` | `LMRuleSelector` — selection is a proposal-time concern, so it runs in the off-cycle pass |

A NAR with no `lmService` has no model rules; there is no flag to read and no third state to misread. `facade/`, `nl/`, `agent/` and `system-one-wiring.ts` are assembly and may name the layer — they are what a provider is handed, and what hands it over.

| Technique | Purpose |
|-----------|---------|
| **Branded Types** | Separate timestamps/units, prevent unit mixups |
| **Discriminated Unions** | Exhaustive pattern matching on term structures |
| **Structural Sharing** | Memoization factory for canonical terms |
| **Stable Hashes** | Canonical normalization for deduplication |
