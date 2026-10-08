import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/renderers/graph.js';
import '../../src/client/components/renderers/graph3d.js';
import '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/workspace-hud.js';
import { eventBus } from '../../src/client/core/events.js';
import { $activeRenderer, $graphLayer, $lmStatus } from '../../src/client/core/store.js';

afterEach(() => {
  document.body.innerHTML = '';
  $activeRenderer.set('graph');
  $graphLayer.set('both');
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

  it('offers the graph layer control only in Graph mode', async () => {
    const el = await mountHud();
    const layers = () =>
      [...(el.shadowRoot?.querySelectorAll('button[data-layer]') ?? [])].map((button) =>
        button.getAttribute('data-layer')
      );
    expect(layers()).toEqual(['both', 'conversation', 'concepts']);

    query<HTMLButtonElement>(el.shadowRoot, 'button[data-layer="conversation"]').click();
    expect($graphLayer.get()).toBe('conversation');
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('button[data-layer="conversation"]')?.getAttribute('aria-pressed')
    ).toBe('true');

    $activeRenderer.set('notebook');
    await el.updateComplete;
    expect(layers()).toEqual([]);
  });

  it('summons the timeline overlay from the HUD', async () => {
    const el = await mountHud();
    const opened: string[] = [];
    const unsubscribe = eventBus.on('overlay:open', ({ id }) => opened.push(id));
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="timeline"]').click();
    unsubscribe();
    expect(opened).toEqual(['timeline']);
  });

  it('summons the settings overlay from the HUD', async () => {
    const el = await mountHud();
    const opened: string[] = [];
    const unsubscribe = eventBus.on('overlay:open', ({ id }) => opened.push(id));
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="settings"]').click();
    unsubscribe();
    expect(opened).toEqual(['settings']);
  });
});
