import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/index.js';
import '../../src/client/components/renderers/graph.js';
import '../../src/client/components/renderers/graph3d.js';
import '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/views/index.js';
import '../../src/client/components/workspace-hud.js';
import '../../src/client/core/view-host.js';
import { eventBus } from '../../src/client/core/events.js';
import { $lmProvider } from '../../src/client/core/lm-provider.js';
import { $activeRenderer, $graphLayer, $graphNodes, $telemetry } from '../../src/client/core/store.js';

const UNKNOWN_PROVIDER = { id: 'unknown', available: false, providers: [] } as const;

afterEach(() => {
  document.body.innerHTML = '';
  $activeRenderer.set('graph');
  $graphLayer.set('both');
  $graphNodes.set(new Map());
  $lmProvider.set(UNKNOWN_PROVIDER);
  $telemetry.set({ reasoning_hz: [1, 2], tokens_per_sec: [1, 2], memory_mb: [1, 2], ws_latency_ms: [1, 2] });
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

  it('shows the provider chip from the LmProvider facade and opens the switcher', async () => {
    $lmProvider.set({ id: 'mock', available: true, providers: [] });
    const el = await mountHud();
    const chip = el.shadowRoot?.querySelector('button[data-action="provider"]');
    expect(chip?.textContent).toContain('Mock (no model)');
    const opened: string[] = [];
    const unsubscribe = eventBus.on('overlay:open', ({ id }) => id && opened.push(id));
    chip?.click();
    unsubscribe();
    expect(opened).toEqual(['provider']);
  });

  it('derives the layer control from renderer capabilities', async () => {
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

    $activeRenderer.set('graph3d');
    await el.updateComplete;
    expect(layers()).toEqual([]);

    $activeRenderer.set('notebook');
    await el.updateComplete;
    expect(layers()).toEqual([]);
  });

  it('summons the timeline overlay from the HUD when nodes carry occurrence times', async () => {
    $graphNodes.set(new Map([['n1', { id: 'n1', nodeType: 'nar:concept', occurrenceTime: 1000 }]]));
    const el = await mountHud();
    const opened: string[] = [];
    const unsubscribe = eventBus.on('overlay:open', ({ id }) => opened.push(id));
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="timeline"]').click();
    unsubscribe();
    expect(opened).toEqual(['timeline']);
  });

  it('hides the timeline control when no node is temporal', async () => {
    $graphNodes.set(new Map([['n1', { id: 'n1', nodeType: 'nar:concept' }]]));
    const el = await mountHud();
    expect(el.shadowRoot?.querySelector('button[data-action="timeline"]')).toBeNull();
  });

  it('summons the settings overlay from the HUD', async () => {
    const el = await mountHud();
    const opened: string[] = [];
    const unsubscribe = eventBus.on('overlay:open', ({ id }) => opened.push(id));
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="settings"]').click();
    unsubscribe();
    expect(opened).toEqual(['settings']);
  });

  it('expands a telemetry sparkline and latest-values table above the pill', async () => {
    const el = await mountHud();
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="telemetry"]').click();
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.stats')).toBeTruthy();
    const hosts = [...(el.shadowRoot?.querySelectorAll('s-view') ?? [])] as unknown as (HTMLElement & {
      updateComplete: Promise<unknown>;
    })[];
    await Promise.all(hosts.map((host) => host.updateComplete));
    const tags = hosts.map((host) =>
      host.shadowRoot?.querySelector('s-sparkline, s-table-mini')?.tagName.toLowerCase()
    );
    expect(tags).toEqual(expect.arrayContaining(['s-sparkline', 's-table-mini']));
  });

  it('offers a Panels menu derived from the view.panel commands', async () => {
    const el = await mountHud();
    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="panels"]').click();
    await el.updateComplete;
    const items = [...(el.shadowRoot?.querySelectorAll('.panels button') ?? [])].map((button) =>
      button.getAttribute('data-panel')
    );
    expect(items).toEqual(
      expect.arrayContaining(['view.panel.chat', 'view.panel.search', 'view.panel.lens-designer'])
    );
  });
});
