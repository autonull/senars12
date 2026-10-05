## Configuration Reference

This section is the lookup reference for tuning and deployment; the system description above does not depend on it.

### LM Profiles & Routing

`LM_PROFILE` selects a preset: `auto` (default — cloud when credentials exist, else local),
`cloud-quality`, `local-private` (transformers.js), `openai-compatible`. Per-tier env overrides
(`LM_FAST_MODEL` etc.) and an optional `routing` config block enable objective-driven
multi-provider model selection with a self-upgrading offline failsafe ladder.

LM profiles are the system's interface to external **System 1 proposers**: each profile selects which untrusted models translate, enrich, and formalize on the kernel's behalf.

### NARConfig

```typescript
// Full NARConfig interface
interface NARConfig extends CoreConfig {
  // LLM Integration
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;

  // Optional Subsystems
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: { optimizeInterval?: number };

  // Cognitive Architecture
  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: CognitiveRegistry;
  adaptationInterval?: number;

  // Control budgets (the control budgets spec §5.7): per-scope ceiling overrides.
  // `BUDGET_SCOPES` in nar/src/kernel/budget-scopes.ts owns the vocabulary,
  // the owner and the overflow reason of every declared scope.
  controlBudgets?: Partial<Record<BudgetScopeId, number>>;

  // Persistence
  persistState?: boolean;
  statePath?: string;
}
```

### SystemOneConfig

The Judgment Manifold's full config is zod-validated in a single schema (`src/config/schema.ts`), organized into `cortex`, `ingress`, `manifold` (encoder model + provider), `rl`, and `distillation` sections, all gated by `systemOne.enabled`. See `docs/system-one-guide.md` for per-section semantics and `pnpm status` to inspect the effective values. The Dialogue Flywheel has its own top-level `dialogue` section (`enabled`, `captureAll`, `maxTurnsPerSession`, `autoRetrospect` — default off; see `util/src/config/dialogue.ts`).

### Environment Variables (`.env`)

```bash
# LM Provider
LM_PROVIDER=openai|anthropic|openai-compatible|local
LM_MODEL=gpt-4o|claude-3|...
LM_API_KEY=...
LM_OFFLINE=1          # skip all provider probes (offline hard-switch)

# Transports
ENABLE_IRC=true
ENABLE_WS=true
ENABLE_HTTP=true
ENABLE_MCP=true
ENABLE_WEB_UI=true

# IRC
IRC_SERVER=irc.libera.chat
IRC_CHANNEL=#senars
IRC_NICK=senars-bot

# Persistence
STATE_PATH=.cache/nar-state
```
