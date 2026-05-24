# Continuation: Demonstrate AI3.md in Action with Real Transformers.js LM

## What's Been Done

- Verified **AI3.md Phase 5** implementation is complete: AutonomousScheduler, priority-gated LM rules, checkGoalSatisfaction(), status bar goals, config activation
- Built missing `src/cli/repl.ts` (#m0058) — pipe-mode REPL with `.stats`, `.goals`, `.priorities`, `.lm`, `.run`, `.help`, `.quit`
- Fixed reasoner (`src/nar/reason/reasoner.ts`) to use `for await...of` + async `deriveFromSecondary` so LM rules fire during `nar.run()` — previously only sync `processSync()` was called, skipping all async LM rules
- Exposed `processLMRulesExternal()` on `RuleProcessor` for the reasoner to invoke
- Verified LM rules fire: pipe demo (#m0094) shows **640 LM calls**, with LM-derived beliefs `(knowledge --> derived)`, `(causal --> relation)`, `(concept --> property)`, `(lm --> insight)` appearing alongside NARS-derived `(robin --> animal)`

## Current State

The REPL at `src/cli/repl.ts` defaults to `SeNARSFactory.createDefault()` which calls `setupDefaultLMClient()`. Currently the demo overrides with a mock LM client.

**User directive: NO MOCKS** (#m0096) — must use real Transformers.js LM provider.

## What Remains

1. **Remove mock LM from REPL** — let `SeNARSFactory.createDefault()` use real provider chain (transformers → ollama → mock). The mock is already the last fallback; if transformers or ollama fail, mock is OK as last resort but caller wants real Transformers.js.

2. **Test Transformers.js works** — `@browser-ai/transformers-js` is in package.json. Need to verify `HuggingFaceTB/SmolLM2-360M-Instruct` can load. Model ~360M params, ~700MB download on first use, needs ~512MB+ RAM.

3. **Demonstrate real NARS+LM cognitive synergy**:
   - Pipe Narsese inheritance chain through REPL: `(bird --> animal).` + `(robin --> bird).` → NARS deduces `(robin --> animal)`
   - Show **LM rules firing with real Transformers.js** — not boilerplate but real generated Narsese
   - Show **LM does what NARS alone cannot**: concept elaboration (LM has world knowledge about birds), NL→Narsese translation, hypothesis generation from low-confidence beliefs
   - Show **priority gating**: low-priority concepts get skipped, high-priority trigger LM enhancement
   - Show **goal satisfaction**: `checkGoalSatisfaction()` detecting beliefs with `f > 0.8`

4. **Test file**: `cat tests/lm-synergy-demo.txt | pnpm exec tsx src/cli/repl.ts` contains the pipe input sequence. The text file may need updating after removing mock.

## Key Files

| File | Purpose |
|------|---------|
| `src/cli/repl.ts` | Pipe-mode REPL (just built) |
| `src/nar/reason/reasoner.ts` | Modified: `deriveFromSecondary` now async, calls `processLMRulesExternal` |
| `src/nar/rules/processor.ts` | Modified: added public `processLMRulesExternal` method |
| `src/nar/lm/rules.ts` | 13 built-in LM rules with activation conditions |
| `src/nar/lm/defaults.ts` | TransformersLMClient at line 58, fallback chain `transformers → ollama → mock` |
| `src/agent/AutonomousScheduler.ts` | Phase 5 scheduler (idle detection, effort scaling) |
| `src/agent/CognitiveContext.ts` | `checkGoalSatisfaction()` method |
| `src/nar/rules/processor.ts` L124-131 | Priority-gated `processLMRules` |
| `tests/lm-synergy-demo.txt` | Pipe input (Narsese lines) |

## Quick Start

```bash
# Test Transformers.js (write a .mjs file since -e can't top-level-await):
pnpm exec tsx -e "
import {SeNARSFactory} from './src/nar/index.ts';
import {createSeNARSRegistry} from './src/nar/lm/providers.ts';
const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({providerRegistry: registry});
await nar.initialize();
console.log('LM client:', nar.getConfig()?.lmClient?.provider, nar.getConfig()?.lmClient?.available);
" 2>&1

# Pipe demo through REPL:
cat tests/lm-synergy-demo.txt | pnpm exec tsx src/cli/repl.ts 2>&1 | grep -v '^2026\|node:'
```
