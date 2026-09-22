/** Per-model capability metadata used by routing decisions. */
export interface ModelCapability {
  contextTokens: number;
  supportsTools: boolean;
  supportsJson: boolean;
  costPerMTok: number;
  latencyClass: 'fast' | 'medium' | 'slow';
  local: boolean;
}

const cloudFrontierCap = {
  contextTokens: 200_000,
  supportsTools: true,
  supportsJson: true,
  costPerMTok: 3,
  latencyClass: 'medium',
  local: false,
} as const;
const localCap = {
  contextTokens: 32_768,
  supportsTools: false,
  supportsJson: true,
  costPerMTok: 0,
  latencyClass: 'fast',
  local: true,
} as const;

const embeddedCap = {
  ...localCap,
  latencyClass: 'medium' as const,
};

const webllmCap = {
  contextTokens: 8192,
  supportsTools: false,
  supportsJson: true,
  costPerMTok: 0,
  latencyClass: 'fast' as const,
  local: true,
} as const;

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'cloud:quality': { ...cloudFrontierCap, latencyClass: 'medium' },
  'cloud:fast': { ...cloudFrontierCap, costPerMTok: 0.15, latencyClass: 'fast' },
  'cloud:structured': { ...cloudFrontierCap, latencyClass: 'medium' },
  'cloud:compact': { ...cloudFrontierCap, costPerMTok: 0.15, latencyClass: 'fast' },
  'local:quality': { ...localCap, latencyClass: 'medium' },
  'llamacpp:quality': { ...localCap, latencyClass: 'medium' },
  'llamacpp:fast': localCap,
  'llamacpp:structured': { ...localCap, latencyClass: 'medium' },
  'llamacpp:compact': localCap,
  'llamacpp-embedded:quality': { ...embeddedCap, latencyClass: 'medium' },
  'llamacpp-embedded:fast': embeddedCap,
  'llamacpp-embedded:structured': { ...embeddedCap, latencyClass: 'medium' },
  'llamacpp-embedded:compact': embeddedCap,
  'local:fast': { ...localCap, latencyClass: 'fast' },
  'local:compact': { ...localCap, latencyClass: 'fast' },
  'builtin:quality': { ...localCap, latencyClass: 'slow' },
  'builtin:fast': { ...localCap, latencyClass: 'fast' },
  'builtin:compact': { ...localCap, latencyClass: 'fast', contextTokens: 8_192 },
  'builtin:mock': { ...localCap, latencyClass: 'fast', contextTokens: 1_024 },
  'webllm:quality': { ...webllmCap, latencyClass: 'medium' },
  'webllm:fast': { ...webllmCap, latencyClass: 'fast' },
};

export const getModelCapability = (id: string): ModelCapability | undefined =>
  MODEL_CAPABILITIES[id];

/**
 * Objective-driven routing override lives on `ProviderRuntime`
 * (see provider-runtime.ts); the module functions below delegate to the
 * process-wide default instance. Pass an explicit runtime for scoped state.
 */

export const latencyClassOf = (id: string): 'fast' | 'medium' | 'slow' => {
  const cap = MODEL_CAPABILITIES[id];
  return cap?.latencyClass ?? (id.startsWith('builtin:') ? 'slow' : 'medium');
};
