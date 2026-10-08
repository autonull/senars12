import { afterEach, describe, expect, it } from 'vitest';
import {
  $lmProvider,
  applyLmStatus,
  providerLabel,
  providerUsable,
} from '../../src/client/core/lm-provider.js';
import { switchLmProvider } from '../../src/client/core/lm-transport.js';
import { applyServerMessage } from '../../src/client/core/store-bindings.js';
import { $webllmAvailable } from '../../src/client/core/store.js';

const CATALOG = [
  { id: 'mock', kind: 'engine' },
  { id: 'webllm', kind: 'browser' },
];

const status = (over: Record<string, unknown> = {}) => ({
  provider: 'mock',
  model: 'mock-model',
  available: true,
  providers: CATALOG,
  ...over,
});

afterEach(() => {
  $lmProvider.set({ id: 'unknown', available: false, providers: [] });
  $webllmAvailable.set(false);
});

describe('LmProvider façade (§0.6)', () => {
  it('normalizes a status frame into the one provider state', () => {
    applyLmStatus(status());
    expect($lmProvider.get()).toMatchObject({
      id: 'mock',
      model: 'mock-model',
      available: true,
      providers: [
        { id: 'mock', label: 'Mock (no model)', kind: 'engine' },
        { id: 'webllm', label: 'WebLLM (in browser)', kind: 'browser' },
      ],
    });
  });

  it('keeps an uncatalogued provider in the list so it stays selectable', () => {
    applyLmStatus(status({ provider: 'custom-llm', providers: [] }));
    expect($lmProvider.get().providers.map((provider) => provider.id)).toEqual(['custom-llm']);
  });

  it('drops a malformed frame instead of clearing the state', () => {
    applyLmStatus(status());
    applyLmStatus('nonsense');
    expect($lmProvider.get().id).toBe('mock');
  });

  it('settles a requested switch once the engine reports that provider', () => {
    switchLmProvider('webllm');
    expect($lmProvider.get().pending).toBe('webllm');
    applyLmStatus(status({ provider: 'webllm' }));
    expect($lmProvider.get()).toMatchObject({ id: 'webllm', pending: undefined, stale: undefined });
  });

  it('reports a switch the engine ignored as stale rather than as a silent success', () => {
    switchLmProvider('webllm');
    applyLmStatus(status({ provider: 'mock' }));
    expect($lmProvider.get()).toMatchObject({ id: 'mock', pending: 'webllm', stale: true });
  });

  it('routes the wire message into the façade', () => {
    applyServerMessage({ type: 'lm.status', data: status() });
    expect($lmProvider.get().id).toBe('mock');
  });

  it('labels a provider it has never seen and gates browser providers on WebGPU', () => {
    expect(providerLabel('llamacpp-embedded')).toBe('llama.cpp embedded');
    expect(providerLabel('brand-new')).toBe('Brand new');
    const browser = { id: 'webllm', label: 'WebLLM', kind: 'browser' } as const;
    expect(providerUsable(browser)).toBe(false);
    $webllmAvailable.set(true);
    expect(providerUsable(browser)).toBe(true);
    expect(providerUsable({ id: 'mock', label: 'Mock', kind: 'engine' })).toBe(true);
  });
});
