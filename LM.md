# LM Provider Unification Plan

## Executive Summary

Consolidate three overlapping LM provider layers (`LMClient`, `AISDKAdapter`, `SeNARSRegistry`) into a single architecture backed by **AI SDK v7** + **@browser-ai/transformers-js** only. Remove all Anthropic references and delete ~25 files of duplicate code.

## Goals

1. Single source of truth: `LMService` wraps AI SDK v7 exclusively
2. Providers via AI SDK: Ollama (OpenAI-compatible), Transformers.js (community provider)
3. Remove all Anthropic support (`@ai-sdk/anthropic`, `ANTHROPIC_API_KEY`)
4. No backwards compatibility: full cutover in one pass
5. Reduce `src/nar/lm/` LOC from ~3833 to ~1500

## Target Architecture

```
┌─────────────────────────────────────────────────┐
│                  LMService                       │
│  (thin AI SDK v7 wrapper with task-based model  │
│   selection and env-driven provider configuration) │
└─────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│       SeNARSRegistry (ProviderRegistry)          │
│  ┌─────────┴─────────┬───────────────────────┐   │
│  │ local (Ollama)  │ builtin (Transformers) │   │
│  │ via             │ via                   │   │
│  │ @ai-sdk/openai-compatible │ @browser-ai/transformers-js │   │
│  └─────────────────┴─────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

No `LMClient` interface. No adapter layer. No separate `ModelRegistry` or `LMRouter`.

## AI SDK v7 Migration Impact

Breaking changes requiring code updates:

| Change | Old | New |
|--------|-----|-----|
| System messages | `system` prompt option | `instructions` |
| Step count check | `stepCountIs(n)` | `isStepCount(n)` |
| Lifecycle events | `onFinish` | `onEnd` |
| Stream result | `result.fullStream` | `result.stream` |
| Include option | `includeRawChunks` | `include.rawChunks` |
| Provider registry | `experimental_customProvider` | `customProvider` |
| Active tools | `experimental_activeTools` | `activeTools` |

Node.js requirement: **v22+** (already satisfied via `@types/node@22.x`).

## Dependencies

### Remove
- `@ai-sdk/anthropic` — no Anthropic support
- `ollama-ai-provider-v2` — replaced by `@ai-sdk/openai-compatible`
- `ollama` — unused
- `@huggingface/transformers` — transitive only (keep if transformers-js needs it)

### Add
- `ai` ^7.x (upgrade from v5)
- `@ai-sdk/openai-compatible` ^1.x (for Ollama + any other OpenAI-compatible providers)

### Keep
- `@browser-ai/transformers-js` ^1.0.0 — verify v7 compatibility during Phase 0

## File-by-File Changes

### Delete Entirely
| File | LOC | Reason | Status |
|------|-----|--------|--------|
| `src/nar/lm/defaults.ts` | 222 | `OllamaLMClient`, `setupDefaultLMClient`, capability constants | NOT FOUND |
| `src/nar/lm/transformers-client.ts` | 184 | Legacy `TransformersLMClient` | NOT FOUND |
| `src/nar/lm/mock-client.ts` | 140 | Replaced by `MockLanguageModel` | NOT FOUND |
| `src/nar/lm/model-registry.ts` | 155 | Merged into registry | NOT FOUND |
| `src/nar/lm/router.ts` | 232 | Merged into `getModelForTask` | NOT FOUND |
| `src/nar/lm/model-discovery.ts` | 170 | Unused after consolidation | NOT FOUND |
| `src/nar/lm/adapters/AISDKAdapter.ts` | 343 | Bridge no longer needed | NOT FOUND |
| `src/nar/lm/adapters/prompt-utils.ts` | 111 | Bridge helpers | NOT FOUND |
| `src/nar/lm/adapters/index.ts` | 9 | Bridge barrel | NOT FOUND |
| `src/nar/lm/__mocks__/` | 44 | Dead code | NOT FOUND |
| `src/nar/lm/response-repair.ts` | 105 | Folded into `LMService` | ⏳ PENDING |
| `src/nar/lm/types.ts` | 87 | Drops `LMClient`, `LMConfig` | ✅ DONE |
| `src/nar/lm/env-config.ts` | 69 | Simplified (no Anthropic) | ✅ DONE |

### Rewrite
| File | To | Notes | Status |
|------|----|-------|--------|
| `src/nar/lm/providers.ts` | ~100 loc | Use `createOpenAICompatible` for Ollama; `transformersJS` for builtin | ✅ DONE |
| `src/nar/lm/LMRule.ts` | ~200 loc | Hold `LMService`; drop `structuredModel` field | ✅ DONE |
| `src/nar/lm/lm-rule-factory.ts` | ~450 loc | Constructor: `(id, lmService, config)` | ✅ DONE |
| `src/nar/lm/feedback.ts` | ~250 loc | Constructor: `(memory, lmService)` | ✅ DONE |
| `src/nar/lm/enrichment.ts` | ~140 loc | Same | ✅ DONE |
| `src/nar/lm/parser.ts` | ~80 loc | Drop JSON parsing (now via `generateObject`) | ✅ DONE |
| `src/nar/lm/index.ts` | ~15 loc | Barrel: `createSeNARSRegistry`, `LMService`, `createLMService` | ✅ DONE |

### New Files
| File | LOC | Purpose | Status |
|------|-----|---------|--------|
| `src/nar/lm/lm-service.ts` | ~180 | Unified LM facade | ✅ DONE |
| `src/nar/lm/mock-provider.ts` | ~70 | `MockLanguageModel` for tests | ✅ DONE |

### Consumer Updates
All consumers swap `LMClient`/`AISDKAdapter` → `LMService`:

| File | Status |
|-----|--------|
| `src/nar/nar.ts` | ✅ DONE |
| `src/nar/nar-lm.ts` | ✅ DONE |
| `src/nar/factory.ts` | ✅ DONE |
| `src/nar/cognitive/ObserverService.ts` | ✅ DONE |
| `src/nar/memory/memory.ts` | ✅ DONE |
| `src/nar/learning/schema-induction.ts` | ✅ DONE |
| `src/nar/nl/understanding.ts` | ✅ DONE |
| `src/nar/nl/generation.ts` | ✅ DONE |
| `src/nar/nl/clarification.ts` | ✅ DONE |
| `src/agent/core/AgentImpl.ts` | ✅ DONE |
| `src/agent/types.ts` | ✅ DONE |
| `src/agent/presets.ts` | ✅ DONE |
| `src/agent/model/ModelRunner.ts` | ✅ DONE |
| `src/agent/services/LMChatService.ts` | ✅ DONE |
| `src/bin/repl.ts` | ✅ DONE |
| `src/bin/bot-ai.ts` | ✅ DONE |
| `src/io/commands/lm.ts` | ✅ DONE |
| `src/utils/env-validate.ts` | ✅ DONE |
| `src/config/schema.ts` | ✅ DONE |
| `tests/conversational/providers.ts` | ✅ DONE |

**Total files deleted**: 0 (already removed previously)
**Net LOC change**: 1264 LOC removed (from 3833 to 2239)

## API Design

### LMService (`src/nar/lm/lm-service.ts`)

```ts
import { generateText, generateObject, streamText, type LanguageModelV2 } from 'ai';
import type { z } from 'zod';
import type { SeNARSRegistry } from './providers.js';

export type LMTask = 'quality' | 'fast' | 'structured';

export class LMService {
  constructor(private registry: SeNARSRegistry) {}

  getModel(task: LMTask): LanguageModelV2 {
    return getModelForTask(this.registry, task);
  }

  async generateText(prompt: string, opts?: {
    task?: LMTask;
    instructions?: string;
    signal?: AbortSignal;
    temperature?: number;
    maxOutputTokens?: number;
    tools?: Record<string, unknown>;
  }): Promise<string> {
    const { text } = await generateText({
      model: this.getModel(opts?.task ?? 'fast'),
      prompt: opts?.instructions
        ? [{ role: 'user', content: prompt }]
        : prompt,
      abortSignal: opts?.signal,
      temperature: opts?.temperature,
      maxOutputTokens: opts?.maxOutputTokens,
      ...(opts?.tools ? { tools: toAISDKTools(opts.tools) } : {}),
    });
    return text;
  }

  async generateObject<T>(prompt: string, schema: z.ZodSchema<T>, opts?: {
    task?: LMTask;
    instructions?: string;
    signal?: AbortSignal;
  }): Promise<T> {
    const { object } = await generateObject({
      model: this.getModel(opts?.task ?? 'structured'),
      prompt: opts?.instructions
        ? [{ role: 'user', content: prompt }]
        : prompt,
      schema,
      abortSignal: opts?.signal,
    });
    return object;
  }

  async *stream(prompt: string, opts?: {
    task?: LMTask;
    instructions?: string;
    signal?: AbortSignal;
  }): AsyncIterable<string> {
    const result = streamText({
      model: this.getModel(opts?.task ?? 'fast'),
      prompt: opts?.instructions
        ? [{ role: 'user', content: prompt }]
        : prompt,
      abortSignal: opts?.signal,
    });
    for await (const chunk of result.stream) {
      if (chunk.type === 'text-delta') yield chunk.text;
    }
  }
}
```

### SeNARSRegistry (`src/nar/lm/providers.ts`)

```ts
import { createProviderRegistry, customProvider, wrapLanguageModel, defaultSettingsMiddleware } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { transformersJS } from '@browser-ai/transformers-js';

const OLLAMA_DEFAULT_HOST = 'http://localhost:11434/v1';
const OLLAMA_DEFAULT_MODEL = 'llama3.1:8b';

const ollama = createOpenAICompatible({
  name: 'ollama',
  apiKey: 'ollama',
  baseURL: process.env.OLLAMA_HOST ?? OLLAMA_DEFAULT_HOST,
});

export function createSeNARSRegistry() {
  return createProviderRegistry({
    local: customProvider({
      languageModels: {
        quality: ollama(process.env.LM_MODEL ?? OLLAMA_DEFAULT_MODEL),
        fast: ollama('llama3.2:3b'),
        compact: ollama('phi3:3.8b'),
      },
      fallbackProvider: ollama,
    }),
    builtin: customProvider({
      languageModels: {
        quality: transformersJS('HuggingFaceTB/SmolLM2-135M-Instruct', { device: 'cpu' }),
        compact: transformersJS('Xenova/gpt-2', { device: 'cpu' }),
        mock: createMockLanguageModel(),
      },
    }),
  });
}

export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;

export function getModelForTask(registry: SeNARSRegistry, task: LMTask): LanguageModelV2 {
  const chain: Record<LMTask, string[]> = {
    quality: ['local:quality', 'builtin:quality', 'builtin:compact', 'builtin:mock'],
    fast: ['local:fast', 'builtin:compact', 'builtin:mock'],
    structured: ['local:quality', 'builtin:compact', 'builtin:mock'],
  };
  for (const id of chain[task]) {
    try {
      return registry.languageModel(id);
    } catch {
      continue;
    }
  }
  throw new Error(`No model available for task: ${task}`);
}
```

### MockLanguageModel (`src/nar/lm/mock-provider.ts`)

Implements AI SDK v7 `LanguageModelV2` interface with canned responses for testing. Used as `builtin:mock` in registry.

## Migration Phases

### Phase 0: Foundation
1. ✅ Install AI SDK v7 + `@ai-sdk/openai-compatible`
2. ✅ Verify `@browser-ai/transformers-js` compatibility with v7
3. ✅ Add `LMService` + `MockLanguageModel` skeletons
4. ✅ Update `providers.ts` to use `createOpenAICompatible`
5. ✅ Update `env-config.ts` (drop Anthropic; verify env vars)

### Phase 1: NAR Core
1. ✅ Migrate `src/nar/learning/schema-induction.ts` → `LMService.generateObject`
2. ✅ Migrate `src/nar/cognitive/ObserverService.ts` → `LMService`
3. ✅ Migrate `src/nar/lm/{LMRule,feedback,enrichment}.ts`

### Phase 2: Agent Side
1. ✅ Update `src/agent/model/ModelRunner.ts`
2. ✅ Update `src/agent/services/LMChatService.ts`
3. ✅ Update `src/agent/core/AgentImpl.ts`
4. ✅ Update `src/agent/types.ts`, `presets.ts`

### Phase 3: Entry Points & Config
1. ✅ Update `src/bin/repl.ts`
2. ✅ Update `src/io/commands/lm.ts`
3. ✅ Update `src/utils/env-validate.ts` (drop `ANTHROPIC_API_KEY`)
4. ✅ Update `src/config/schema.ts`

### Phase 4: Delete Legacy
- Files already removed previously. Pending: `response-repair.ts`, `enrichment-utils.ts`

### Phase 5: Verify
1. ✅ `pnpm typecheck` — zero errors
2. ⏳ `pnpm lint` — zero warnings (has pre-existing warnings unrelated to LM)
3. ⏳ `pnpm test:unit` — 32 failed, 660 passed
4. ⏳ `LM_PROVIDER=mock pnpm test:cognitive`
5. ⏳ Manual: `LM_PROVIDER=ollama pnpm repl`

## Acceptance Criteria

- [ ] `src/nar/lm/` LOC < 1500 (currently 2239)
- [ ] `src/nar/lm/` files ≤ 8 (currently 11)
- [x] `pnpm typecheck` passes
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:cognitive` (mock) passes
- [ ] `grep -r "LMClient"` returns 0 matches in `src/` (only in method names like `getLMClient()`, acceptable)
- [x] `grep -r "anthropic\|Anthropic"` returns 0 matches in `src/`
- [x] `grep -r "ollama-ai-provider"` returns 0 matches in `src/`
- [ ] `pnpm repl` starts and processes input with `LM_PROVIDER=mock`

## Progress Summary

### Completed (Phase 0-1)
- Removed `ANTHROPIC_API_KEY` from `src/utils/env-validate.ts`
- Removed `LMClient` type from `src/nar/lm/types.ts`
- Updated `src/nar/cognitive/ObserverService.ts` to use `LMService`
- Updated `src/nar/learning/schema-induction.ts` to use `LMService`
- Updated `src/bin/repl.ts` to use `createLMService`
- Updated `src/nar/factory.ts` to use `createLMService`
- Cleaned up `src/nar/lm/index.ts` exports (removed LMClient, setupDefaultLMClient)
- Simplified `src/nar/lm/env-config.ts`
- `pnpm typecheck` and `pnpm build` pass

### Remaining Work
- Delete `src/nar/lm/response-repair.ts` (now unused)
- Delete `src/nar/lm/enrichment-utils.ts` (can be merged into enrichment.ts)
- Fix test failures (32 tests failing)
- Run `pnpm test:cognitive` to verify mock provider works

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `@browser-ai/transformers-js` incompatible with v7 | Check during Phase 0; use ai-sdk `customProvider` wrapper if needed |
| Ollama via OpenAI-compatible has subtle differences | Compare responses before/after via unit tests |
| Mock provider must implement full `LanguageModelV2` spec | Use ai-sdk `customProvider` to reduce boilerplate |
| Tool-call loop semantics change (Vercel SDK handles internally) | Keep existing `ModelRunner` event surface; map SDK events |

## Timeline Estimate

- Phase 0: 1 hour ✅
- Phase 1: 2-3 hours ✅
- Phase 2: 2 hours ✅
- Phase 3: 1 hour ✅
- Phase 4: 30 min ⏳
- Phase 5: 1 hour ⏳

**Total estimated effort**: 7-8 hours (completed ~5 hours of work)