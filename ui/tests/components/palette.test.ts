import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/overlays/index.js';
import '../../src/client/components/renderers/graph.js';
import '../../src/client/components/renderers/graph3d.js';
import '../../src/client/components/renderers/notebook.js';
import { eventBus } from '../../src/client/core/events.js';
import { $activeRenderer } from '../../src/client/core/store.js';

const mount = async () => {
  const el = document.createElement('s-palette');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const ids = (el: HTMLElement) =>
  [...(el.shadowRoot?.querySelectorAll('.command') ?? [])].map((row) => row.getAttribute('data-id'));

const type = async (el: HTMLElement, value: string) => {
  const input = el.shadowRoot?.querySelector<HTMLInputElement>('input');
  if (!input) throw new Error('missing input');
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  return input;
};

afterEach(() => {
  document.body.innerHTML = '';
  $activeRenderer.set('graph');
});

describe('command palette', () => {
  it('lists commands derived from the renderer and overlay registries', async () => {
    const el = await mount();
    expect(ids(el)).toEqual(expect.arrayContaining(['renderer.notebook', 'overlay.toc']));
    expect(ids(el)).not.toContain('overlay.palette');
  });

  it('filters as the query changes', async () => {
    const el = await mount();
    await type(el, 'notebook');
    expect(ids(el)).toEqual(['renderer.notebook']);
  });

  it('runs the active command on Enter and closes the overlay', async () => {
    const el = await mount();
    const closed = vi.fn();
    const off = eventBus.on('overlay:close', closed);
    const input = await type(el, 'notebook');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect($activeRenderer.get()).toBe('notebook');
    expect(closed).toHaveBeenCalledWith({ id: 'palette' });
    off();
  });

  it('moves the active row with the arrow keys', async () => {
    const el = await mount();
    const input = el.shadowRoot?.querySelector<HTMLInputElement>('input');
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[data-index="1"][aria-selected="true"]')).toBeTruthy();
  });

  it('resets the query when re-opened', async () => {
    const el = await mount();
    await type(el, 'minimap');
    el.dispatchEvent(new CustomEvent('overlay-open'));
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector<HTMLInputElement>('input')?.value).toBe('');
  });
});
