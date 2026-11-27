import { existsSync } from 'node:fs';
import { envFirst, envNumOr, envSet, envStr, isTruthy } from '@senars/config';
import { endpointPath } from './providers/probe';
import { gpuSettingFrom } from './runtime/llama-runtime';
import { SenarsError } from '../errors/senars-error';
export const LM_PROVIDER_NAMES = [
    'transformers',
    'llamacpp',
    'llamacpp-embedded',
    'anthropic',
    'openai',
    'openai-compatible',
    'webllm',
    'mock',
];
const TRANSFORMERS_DEFAULT_MODEL = 'onnx-community/Qwen2.5-1.5B-Instruct';
const TRANSFORMERS_DEFAULT_COMPACT = 'HuggingFaceTB/SmolLM2-360M-Instruct';
/** Registry-only providers: valid ids that this (server-side) runtime never resolves. */
const BROWSER_ONLY_PROVIDERS = ['webllm'];
const PROVIDERS = LM_PROVIDER_NAMES.filter((name) => !BROWSER_ONLY_PROVIDERS.includes(name));
const isResolvedProvider = (v) => PROVIDERS.includes(v);
/**
 * The cloud credential: the env var named by `apiKeyEnv` (if any), then the
 * generic key, then the provider-specific cloud keys.
 */
export const cloudApiKey = (apiKeyEnv) => envStr(apiKeyEnv, 'LM_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY');
/**
 * Cloud provider presets with their credential env vars, in preference order.
 */
const CLOUD_CREDENTIALS = [
    ['anthropic', 'ANTHROPIC_API_KEY'],
    ['openai', 'OPENAI_API_KEY'],
];
/** First cloud provider with a credential present in the environment. */
export const detectCloudProvider = () => CLOUD_CREDENTIALS.find(([, key]) => envSet(key))?.[0];
/** Sync cheap check: an embedded-llama GGUF model is configured and present on disk. */
export const embeddedLlamaConfigured = () => {
    const p = envStr('LM_LLAMACPP_MODEL');
    return Boolean(p && existsSync(p));
};
/** Speed-first local default: embedded llama.cpp when a GGUF is present, else the
 *  external llama-server when configured, else mock (symbolic fallbacks cover cognition).
 *  transformers.js is explicit opt-in only (LM_PROVIDER=transformers) — never the default. */
export const defaultLocalProvider = () => {
    if (embeddedLlamaConfigured())
        return 'llamacpp-embedded';
    if (envStr('LM_LLAMACPP_HOST'))
        return 'llamacpp';
    return 'mock';
};
/** The env var a cloud provider's key lives in, or `undefined` for a local provider. */
const credentialEnvFor = (provider) => CLOUD_CREDENTIALS.find(([p]) => p === provider)?.[1];
/**
 * LM_PROFILE presets. `production` is reserved (handled by lifecycle config merge).
 */
export const LM_PROFILES = ['auto', 'cloud-quality', 'local-private', 'ollama'];
const resolveProfileProvider = (profile) => {
    switch (profile) {
        case 'cloud-quality':
            return detectCloudProvider() ?? defaultLocalProvider();
        case 'local-private':
            return defaultLocalProvider();
        case 'ollama':
            return 'openai-compatible';
        default:
            return undefined;
    }
};
/**
 * Resolve LM settings from env + optional file config. Throws on invalid provider.
 * Precedence: LM_PROVIDER > file provider > LM_PROFILE preset > auto-detect
 * (cloud when credentials exist, else local transformers).
 */
export const resolveLMSettings = (file) => {
    const explicit = envFirst('LM_PROVIDER', 'SENARS_LM_PROVIDER') ?? file?.provider;
    const profile = envFirst('LM_PROFILE') ?? file?.profile;
    const profileProvider = profile && profile !== 'production' ? resolveProfileProvider(profile) : undefined;
    const rawProvider = (explicit ??
        profileProvider ??
        detectCloudProvider() ??
        defaultLocalProvider())
        .toString()
        .toLowerCase();
    // A4 deprecation: 'ollama' is an alias for openai-compatible pointed at the
    // local daemon. Resolved at the settings boundary; nothing downstream sees it.
    const aliasedOllama = rawProvider === 'ollama' || profile === 'ollama';
    const normalized = aliasedOllama && rawProvider === 'ollama' ? 'openai-compatible' : rawProvider;
    if (!isResolvedProvider(normalized)) {
        throw new SenarsError(`Invalid LM provider "${rawProvider}". Must be one of: ${PROVIDERS.join(', ')}.` +
            (rawProvider === 'ollama' ? " ('ollama' is now LM_PROVIDER=openai-compatible)" : ''), 'VALIDATION_ERROR');
    }
    const provider = normalized;
    const cloudCredentialEnv = credentialEnvFor(provider);
    const flashAttentionEnv = envFirst('LM_LLAMACPP_FLASH_ATTN');
    return {
        provider,
        profile: profile && profile !== 'production' ? profile : undefined,
        fastModel: envFirst('LM_FAST_MODEL') ?? file?.fastModel,
        structuredModel: envFirst('LM_STRUCTURED_MODEL') ?? file?.structuredModel,
        compactModel: envFirst('LM_COMPACT_MODEL') ?? file?.compactModel,
        baseUrl: envFirst('LM_BASE_URL') ??
            file?.baseUrl ??
            (aliasedOllama
                ? endpointPath(envFirst('OLLAMA_HOST') ?? file?.ollamaHost ?? 'http://localhost:11434', 'v1')
                : undefined),
        ollamaHost: envFirst('OLLAMA_HOST') ?? file?.ollamaHost,
        model: envFirst('LM_MODEL', 'SENARS_LM_MODEL') ??
            file?.model ??
            (aliasedOllama ? (envFirst('OLLAMA_MODEL') ?? 'llama3.2') : undefined),
        llamacppHost: envFirst('LM_LLAMACPP_HOST') ?? file?.llamacppHost,
        llamacppModelPath: envFirst('LM_LLAMACPP_MODEL') ?? file?.llamacppModelPath,
        llamacppGpu: gpuSettingFrom(envFirst('LM_LLAMACPP_GPU')) ?? file?.llamacppGpu,
        llamacppGpuLayers: envNumOr('LM_LLAMACPP_GPU_LAYERS') ?? file?.llamacppGpuLayers,
        llamacppContextSize: envNumOr('LM_LLAMACPP_CTX') ?? file?.llamacppContextSize,
        llamacppBatchSize: envNumOr('LM_LLAMACPP_BATCH') ?? file?.llamacppBatchSize,
        llamacppSequences: envNumOr('LM_LLAMACPP_SEQS') ?? file?.llamacppSequences,
        // D7-adjacent: FA default true (KV-cache padding path without it is
        // segv-prone on hybrid-attention models); an explicit env value wins.
        llamacppFlashAttention: flashAttentionEnv !== undefined
            ? isTruthy(flashAttentionEnv)
            : (file?.llamacppFlashAttention ?? true),
        apiKeyEnv: file?.apiKeyEnv ?? cloudCredentialEnv,
        quantized: file?.quantized,
        cacheDir: file?.cacheDir,
        offline: isTruthy(envFirst('LM_OFFLINE')) || file?.offline === true,
        dtype: envFirst('LM_DTYPE') ?? file?.dtype,
        qualityDtype: envFirst('LM_QUALITY_DTYPE') ??
            file?.qualityDtype,
        fastDtype: envFirst('LM_FAST_DTYPE') ?? file?.fastDtype,
        disableThinking: isTruthy(envFirst('LM_DISABLE_THINKING')) || file?.disableThinking === true,
        circuitBreaker: file?.circuitBreaker,
    };
};
/** Default per-provider model when none is configured. */
export const defaultModelFor = (provider) => {
    switch (provider) {
        case 'llamacpp':
            return envFirst('LM_MODEL') ?? 'local-model';
        case 'llamacpp-embedded':
            return envFirst('LM_LLAMACPP_MODEL') ?? 'local-model';
        case 'transformers':
            return TRANSFORMERS_DEFAULT_MODEL;
        case 'anthropic':
            return 'claude-3-5-sonnet-latest';
        case 'openai':
            return 'gpt-4o-mini';
        case 'openai-compatible':
            return 'default';
        case 'webllm':
            return 'llama-3.2-3b-instruct';
        case 'mock':
            return 'mock';
    }
};
export const resolveLMConfig = (file) => {
    const s = resolveLMSettings(file);
    const model = s.model ?? defaultModelFor(s.provider);
    const host = s.provider === 'openai-compatible' ? (s.baseUrl ?? '') : undefined;
    return { provider: s.provider, model, host };
};
export const formatLMConfig = (cfg) => {
    const lines = [`provider: ${cfg.provider}`, `model:    ${cfg.model}`];
    if (cfg.host)
        lines.push(`host:     ${cfg.host}`);
    return lines.join('\n');
};
export const builtinModels = {
    quality: TRANSFORMERS_DEFAULT_MODEL,
    compact: TRANSFORMERS_DEFAULT_COMPACT,
};
