import {
  configureLM,
  createSeNARSRegistry,
  getLmProvider,
  getModelChain,
  getModelForTask,
  resolveActiveProvider,
  resolveLMConfig,
  resolveLMSettings,
  setRouting,
} from '@senars/nar/lm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ENV_KEYS = [
  'LM_PROVIDER',
  'SENARS_LM_PROVIDER',
  'LM_MODEL',
  'SENARS_LM_MODEL',
  'LM_FAST_MODEL',
  'LM_STRUCTURED_MODEL',
  'LM_COMPACT_MODEL',
  'LM_BASE_URL',
  'OLLAMA_HOST',
  'LM_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
];

const clearLMEnv = () => {
  for (const k of ENV_KEYS) delete process.env[k];
};

describe('LM settings resolution', () => {
  beforeEach(() => {
    clearLMEnv();
    configureLM({ provider: 'transformers' });
  });

  afterEach(() => {
    clearLMEnv();
    configureLM({ provider: 'transformers' });
  });

  it('defaults to transformers', () => {
    expect(resolveLMSettings()).toEqual({ provider: 'transformers' });
    expect(resolveLMConfig()).toMatchObject({
      provider: 'transformers',
      model: 'onnx-community/Qwen2.5-1.5B-Instruct',
    });
  });

  it('env overrides file config', () => {
    process.env.LM_PROVIDER = 'ollama';
    process.env.LM_MODEL = 'llama3.1:8b';
    process.env.OLLAMA_HOST = 'http://localhost:1234';
    const s = resolveLMSettings({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(s).toMatchObject({
      provider: 'ollama',
      model: 'llama3.1:8b',
      ollamaHost: 'http://localhost:1234',
    });
  });

  it('file config fills gaps left by env', () => {
    process.env.LM_PROVIDER = 'openai-compatible';
    process.env.LM_MODEL = 'my-model';
    const s = resolveLMSettings({
      provider: 'openai',
      model: 'ignored',
      baseUrl: 'https://gateway.example/v1',
      compactModel: 'compact-1',
      quantized: true,
    });
    expect(s).toMatchObject({
      provider: 'openai-compatible',
      model: 'my-model',
      baseUrl: 'https://gateway.example/v1',
      compactModel: 'compact-1',
      quantized: true,
    });
  });

  it('rejects unknown providers with a specific error', () => {
    expect(() => resolveLMSettings({ provider: 'nope' })).toThrow(/Invalid LM provider/);
  });

  it('configureLM installs settings used by getLmProvider', () => {
    configureLM({ provider: 'mock' });
    expect(getLmProvider()).toBe('mock');
  });

  it('derives per-provider default models', () => {
    process.env.LM_PROVIDER = 'anthropic';
    expect(resolveLMConfig().model).toBe('claude-3-5-sonnet-latest');
    process.env.LM_PROVIDER = 'openai';
    expect(resolveLMConfig().model).toBe('gpt-4o-mini');
  });

  it('LM_PROFILE presets resolve providers', () => {
    process.env.LM_PROFILE = 'local-private';
    expect(resolveLMSettings().provider).toBe('transformers');
    process.env.LM_PROFILE = 'ollama';
    expect(resolveLMSettings().provider).toBe('ollama');
  });

  it('cloud-quality profile picks the first provider with credentials', () => {
    process.env.LM_PROFILE = 'cloud-quality';
    expect(resolveLMSettings().provider).toBe('transformers'); // no credentials
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const s = resolveLMSettings();
    expect(s.provider).toBe('anthropic');
    expect(s.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(resolveLMSettings().provider).toBe('openai');
  });

  it('auto-detection picks cloud when credentials exist, else local', () => {
    configureLM({});
    expect(resolveLMSettings().provider).toBe('transformers');
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(resolveLMSettings()).toMatchObject({
      provider: 'openai',
      apiKeyEnv: 'OPENAI_API_KEY',
    });
  });

  it('explicit LM_PROVIDER wins over profile and auto-detection', () => {
    process.env.LM_PROFILE = 'ollama';
    process.env.LM_PROVIDER = 'mock';
    expect(resolveLMSettings().provider).toBe('mock');
  });

  it('routing override composes candidates with the offline failsafe ladder', () => {
    setRouting({ candidates: ['cloud:quality', 'cloud:fast'] });
    expect(getModelChain('openai', 'quality')).toEqual([
      'cloud:quality',
      'cloud:fast',
      'builtin:compact',
      'builtin:mock',
    ]);
    setRouting(null);
    expect(getModelChain('openai', 'quality')).toContain('cloud:quality');
  });

  it('offlineOnly restricts the chain to builtin models', () => {
    setRouting({ candidates: ['cloud:quality', 'builtin:quality'], offlineOnly: true });
    expect(getModelChain('openai', 'structured')).toEqual([
      'builtin:quality',
      'builtin:compact',
      'builtin:mock',
    ]);
    setRouting(null);
  });

  it('maxLatencyMs filters slow candidates', () => {
    setRouting({ candidates: ['builtin:quality', 'builtin:fast'], maxLatencyMs: 2000 });
    expect(getModelChain('openai', 'fast')).toEqual([
      'builtin:fast',
      'builtin:compact',
      'builtin:mock',
    ]);
    setRouting(null);
  });
});

describe('provider registry and task chains', () => {
  const providerOf = (model: unknown): string | undefined =>
    (model as { provider?: string }).provider;

  it('mock provider resolves every task to builtin:mock', () => {
    const registry = createSeNARSRegistry({ provider: 'mock' });
    for (const task of ['quality', 'fast', 'structured'] as const) {
      expect(providerOf(getModelForTask(registry, task, { provider: 'mock' }))).toBe('mock');
    }
  });

  it('getModelForTask honors env provider over installed file settings', () => {
    const registry = createSeNARSRegistry({ provider: 'mock' });
    process.env.LM_PROVIDER = 'mock';
    expect(providerOf(getModelForTask(registry, 'quality'))).toBe('mock');
  });

  it('chains always end in a local/builtin fallback', () => {
    const chain = getModelChain('anthropic', 'structured');
    expect(chain[0]).toBe('cloud:structured');
    expect(chain.at(-1)).toBe('builtin:mock');
  });

  it('transformers chain uses builtin models only', () => {
    for (const task of ['quality', 'fast', 'structured'] as const) {
      expect(getModelChain('transformers', task)).toEqual([`builtin:${task}`]);
    }
  });

  it('resolveActiveProvider honors explicit mock', async () => {
    process.env.LM_PROVIDER = 'mock';
    await expect(resolveActiveProvider()).resolves.toBe('mock');
  });
});
