import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/overlay-header.js';
import { getOverlayManager, resetOverlayManager } from '../../src/client/core/overlay-manager.js';
import { registerOverlay } from '../../src/client/core/overlay-registry.js';

type Header = HTMLElement & { overlayId: string; title: string; updateComplete: Promise<unknown> };

const open = (id: string): void => {
  getOverlayManager().open({ id, element: document.createElement('div') });
};

const mount = async (overlayId: string, title = ''): Promise<Header> => {
  const el = document.createElement('overlay-header') as Header;
  el.overlayId = overlayId;
  el.title = title;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const crumbs = (el: Header): (string | null)[] =>
  [...(el.shadowRoot?.querySelectorAll('.crumb') ?? [])].map((n) => n.textContent?.trim() ?? null);

beforeEach(() => {
  resetOverlayManager();
  registerOverlay({ id: 'toc', title: 'Table of Contents', tag: 'div' });
  registerOverlay({ id: 'settings', title: 'Settings', tag: 'div' });
});

afterEach(() => {
  resetOverlayManager();
  document.body.innerHTML = '';
});

describe('overlay header breadcrumbs', () => {
  it('shows the drill-down trail only for a nested overlay', async () => {
    open('toc');
    open('settings');

    const nested = await mount('settings');
    expect(crumbs(nested)).toEqual(['Table of Contents', 'Settings']);

    const root = await mount('toc', 'Table of Contents');
    expect(crumbs(root)).toEqual([]);
    expect(root.shadowRoot?.querySelector('.title')?.textContent).toBe('Table of Contents');
  });

  it('closes every overlay above a clicked crumb', async () => {
    open('toc');
    open('settings');
    const nested = await mount('settings');

    nested.shadowRoot?.querySelector<HTMLButtonElement>('.crumb')?.click();
    await nested.updateComplete;

    const manager = getOverlayManager();
    expect(manager.stack()).toEqual(['toc']);
    expect(manager.isOpen('settings')).toBe(false);
  });
});
