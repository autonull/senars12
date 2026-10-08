import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/renderers/graph.js';
import '../../src/client/components/renderers/graph3d.js';
import '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/workspace-hud.js';
import { $activeRenderer, $lmStatus } from '../../src/client/core/store.js';

afterEach(() => {
  document.body.innerHTML = '';
  $activeRenderer.set('graph');
  $lmStatus.set({});
});

const mountHud = async () => {
  const el = document.createElement('workspace-hud');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const query = <T extends Element>(root: ParentNode | null | undefined, selector: string): T => {
  const found = root?.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found as T;
};

describe('workspace hud', () => {
  it('lists every registered renderer and marks the active one', async () => {
    const el = await mountHud();
    const ids = [...(el.shadowRoot?.querySelectorAll('button[data-renderer]') ?? [])].map(
      (button) => button.getAttribute('data-renderer')
    );
    expect(ids).toEqual(expect.arrayContaining(['notebook', 'graph', 'graph3d']));
    const active = el.shadowRoot?.querySelector('button[aria-pressed="true"]');
    expect(active?.getAttribute('data-renderer')).toBe('graph');
  });

  it('switches the active renderer on click', async () => {
    const el = await mountHud();
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-renderer="notebook"]').click();
    expect($activeRenderer.get()).toBe('notebook');
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('button[aria-pressed="true"]')?.getAttribute('data-renderer')
    ).toBe('notebook');
  });

  it('shows the provider chip from lm status', async () => {
    $lmStatus.set({ provider: 'mock' });
    const el = await mountHud();
    expect(el.shadowRoot?.querySelector('.chip')?.textContent).toContain('mock');
  });
});
