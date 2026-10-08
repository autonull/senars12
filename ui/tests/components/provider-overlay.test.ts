import { afterEach, describe, expect, it } from 'vitest';
import { $lmProvider } from '../../src/client/core/lm-provider.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';
import { $webllmAvailable } from '../../src/client/core/store.js';
import '../../src/client/components/overlays/provider.js';

const providers = [
  { id: 'mock', label: 'Mock (no model)', kind: 'engine' },
  { id: 'webllm', label: 'WebLLM (in browser)', kind: 'browser' },
] as const;

const mount = async () => {
  $lmProvider.set({ id: 'mock', model: 'mock-model', available: true, providers: [...providers] });
  const el = document.createElement('s-provider');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  $lmProvider.set({ id: 'unknown', available: false, providers: [] });
  $webllmAvailable.set(false);
});

describe('provider overlay', () => {
  it('registers a palette-visible overlay', () => {
    expect(overlayDescriptor('provider')).toMatchObject({ id: 'provider', title: 'Provider' });
  });

  it('lists the reported providers and marks the active one', async () => {
    const el = await mount();
    const rows = [...(el.shadowRoot?.querySelectorAll('.provider') ?? [])];
    expect(rows.map((row) => row.getAttribute('data-provider'))).toEqual(['mock', 'webllm']);
    expect(
      el.shadowRoot?.querySelector('[data-provider="mock"]')?.getAttribute('aria-current')
    ).toBe('true');
    expect(el.shadowRoot?.textContent).toContain('mock-model');
  });

  it('offers a browser provider only where it can run', async () => {
    const el = await mount();
    const browser = el.shadowRoot?.querySelector<HTMLButtonElement>('[data-provider="webllm"]');
    expect(browser?.disabled).toBe(true);
    $webllmAvailable.set(true);
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector<HTMLButtonElement>('[data-provider="webllm"]')?.disabled
    ).toBe(false);
  });

  it('requests a switch and says so while it is pending', async () => {
    $webllmAvailable.set(true);
    const el = await mount();
    el.shadowRoot?.querySelector<HTMLButtonElement>('[data-provider="webllm"]')?.click();
    await el.updateComplete;
    expect($lmProvider.get().pending).toBe('webllm');
    expect(el.shadowRoot?.querySelector('[data-provider="webllm"]')?.textContent).toContain(
      'pending'
    );
  });

  it('explains a switch the engine refused instead of claiming success', async () => {
    $lmProvider.set({
      id: 'mock',
      available: true,
      providers: [...providers],
      pending: 'webllm',
      stale: true,
    });
    const el = document.createElement('s-provider');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.notice')?.textContent).toContain('restart');
  });
});
