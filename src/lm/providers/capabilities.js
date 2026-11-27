const cloudFrontierCap = {
    contextTokens: 200_000,
    supportsTools: true,
    supportsJson: true,
    costPerMTok: 3,
    latencyClass: 'medium',
    local: false,
};
const localCap = {
    contextTokens: 32_768,
    supportsTools: false,
    supportsJson: true,
    costPerMTok: 0,
    latencyClass: 'fast',
    local: true,
};
const embeddedCap = {
    ...localCap,
    latencyClass: 'medium',
};
const webllmCap = {
    contextTokens: 8192,
    supportsTools: false,
    supportsJson: true,
    costPerMTok: 0,
    latencyClass: 'fast',
    local: true,
};
export const MODEL_CAPABILITIES = {
    'cloud:quality': { ...cloudFrontierCap, latencyClass: 'medium' },
    'cloud:fast': { ...cloudFrontierCap, costPerMTok: 0.15, latencyClass: 'fast' },
    'cloud:structured': { ...cloudFrontierCap, latencyClass: 'medium' },
    'cloud:compact': { ...cloudFrontierCap, costPerMTok: 0.15, latencyClass: 'fast' },
    'llamacpp:quality': { ...localCap, latencyClass: 'medium' },
    'llamacpp:fast': localCap,
    'llamacpp:structured': { ...localCap, latencyClass: 'medium' },
    'llamacpp:compact': localCap,
    'llamacpp-embedded:quality': { ...embeddedCap, latencyClass: 'medium' },
    'llamacpp-embedded:fast': embeddedCap,
    'llamacpp-embedded:structured': { ...embeddedCap, latencyClass: 'medium' },
    'llamacpp-embedded:compact': embeddedCap,
    'builtin:quality': { ...localCap, latencyClass: 'slow' },
    'builtin:fast': { ...localCap, latencyClass: 'fast' },
    'builtin:compact': { ...localCap, latencyClass: 'fast', contextTokens: 8_192 },
    'builtin:mock': { ...localCap, latencyClass: 'fast', contextTokens: 1_024 },
    'webllm:quality': { ...webllmCap, latencyClass: 'medium' },
    'webllm:fast': { ...webllmCap, latencyClass: 'fast' },
};
export const getModelCapability = (id) => MODEL_CAPABILITIES[id];
/**
 * Objective-driven routing override lives on `ProviderRuntime`
 * (see provider-runtime.ts); the module functions below delegate to the
 * process-wide default instance. Pass an explicit runtime for scoped state.
 */
export const latencyClassOf = (id) => {
    const cap = MODEL_CAPABILITIES[id];
    return cap?.latencyClass ?? (id.startsWith('builtin:') ? 'slow' : 'medium');
};
