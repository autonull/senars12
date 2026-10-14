/**
 * LM Provider catalog — providers as contributions.
 *
 * Replaces hardcoded `LM_PROVIDER_NAMES` + `KNOWN_LABELS` + `providerOf` logic.
 * With one provider catalog, the settings UI, the status display, the docs
 * and the gallery derive from one source, and a new provider is one entry.
 */

import type { Contribution } from '../framework/contribution.js';

/** LM Provider descriptor — extends Contribution with provider-specific fields. */
export interface LMProviderDescriptor extends Contribution<Record<string, unknown>> {
  /** Where the provider runs: 'engine' | 'browser'. */
  readonly kind: 'engine' | 'browser';
  /** Default model for this provider. */
  readonly defaultModel?: string;
  /** Whether this provider supports streaming. */
  readonly streaming?: boolean;
  /** Whether this provider supports structured output. */
  readonly structuredOutput?: boolean;
  /** Required environment variables (for engine providers). */
  readonly requiredEnv?: readonly string[];
  /** Whether this provider is available in the current environment. */
  readonly available?: boolean;
}

/** Registry of LM providers. */
const lmProviderRegistry = new Map<string, LMProviderDescriptor>();

/** Register an LM provider. */
export function registerLMProvider(descriptor: LMProviderDescriptor): void {
  if (lmProviderRegistry.has(descriptor.id)) {
    throw new Error(`LM Provider with id "${descriptor.id}" already registered`);
  }
  lmProviderRegistry.set(descriptor.id, descriptor);
}

/** Get an LM provider by id. */
export function lmProviderFor(id: string): LMProviderDescriptor | undefined {
  return lmProviderRegistry.get(id);
}

/** All registered LM providers. */
export function getLMProviders(): readonly LMProviderDescriptor[] {
  return [...lmProviderRegistry.values()];
}

/** All LM provider ids. */
export function lmProviderIds(): readonly string[] {
  return [...lmProviderRegistry.keys()];
}

/** LM providers by kind. */
export function lmProvidersByKind(kind: 'engine' | 'browser'): readonly LMProviderDescriptor[] {
  return getLMProviders().filter((p) => p.kind === kind);
}

/** Reset LM provider registry (for testing). */
export function resetLMProviders(): void {
  lmProviderRegistry.clear();
}

/** Get a label for any provider id (falls back to formatted id). */
export function lmProviderLabel(id: string): string {
  const provider = lmProviderRegistry.get(id);
  return provider?.label ?? id.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Check if a provider is usable in the current environment. */
export function lmProviderUsable(id: string, browserAvailable: boolean, engineProviders: ReadonlySet<string>): boolean {
  const provider = lmProviderRegistry.get(id);
  if (!provider) return false;
  if (provider.kind === 'browser') return browserAvailable;
  return engineProviders.has(id) || provider.available !== false;
}

// Register built-in LM providers
const BUILTIN_LM_PROVIDERS: LMProviderDescriptor[] = [
  {
    id: 'transformers',
    label: 'Transformers.js',
    kind: 'browser',
    defaultModel: 'Xenova/llama-2-7b-chat-q4',
    streaming: true,
    structuredOutput: false,
    facets: {},
  },
  {
    id: 'webllm',
    label: 'WebLLM (in browser)',
    kind: 'browser',
    defaultModel: 'Llama-3-8B-Instruct-q4f16_1-MLC',
    streaming: true,
    structuredOutput: true,
    requiredEnv: [],
    facets: {},
  },
  {
    id: 'llamacpp',
    label: 'llama.cpp server',
    kind: 'engine',
    defaultModel: 'llama-2-7b-chat.Q4_K_M.gguf',
    streaming: true,
    structuredOutput: false,
    requiredEnv: ['LLAMACPP_HOST'],
    facets: {},
  },
  {
    id: 'llamacpp-embedded',
    label: 'llama.cpp embedded',
    kind: 'engine',
    defaultModel: 'llama-2-7b-chat.Q4_K_M.gguf',
    streaming: true,
    structuredOutput: false,
    requiredEnv: ['LLAMACPP_MODEL_PATH'],
    facets: {},
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'engine',
    defaultModel: 'claude-3-haiku-20240307',
    streaming: true,
    structuredOutput: true,
    requiredEnv: ['ANTHROPIC_API_KEY'],
    facets: {},
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'engine',
    defaultModel: 'gpt-4o-mini',
    streaming: true,
    structuredOutput: true,
    requiredEnv: ['OPENAI_API_KEY'],
    facets: {},
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    kind: 'engine',
    defaultModel: 'auto',
    streaming: true,
    structuredOutput: false,
    requiredEnv: ['OPENAI_COMPATIBLE_BASE_URL'],
    facets: {},
  },
  {
    id: 'mock',
    label: 'Mock (no model)',
    kind: 'engine',
    streaming: false,
    structuredOutput: false,
    facets: {},
  },
];

// Register built-in providers
for (const provider of BUILTIN_LM_PROVIDERS) {
  registerLMProvider(provider);
}