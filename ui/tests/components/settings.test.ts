import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/settings.js';
import { eventBus } from '../../src/client/core/events.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('settings overlay', () => {
  it('registers a modal, palette-visible settings overlay', () => {
    const descriptor = overlayDescriptor('settings');
    expect(descriptor).toMatchObject({ id: 'settings', title: 'Settings', modal: true });
    expect(descriptor?.hiddenInPalette).toBeUndefined();
    expect(descriptor?.tag).toBe('s-settings');
  });

  it('hosts the config form and closes through the overlay host', async () => {
    const el = document.createElement('s-settings');
    document.body.appendChild(el);
    await el.updateComplete;

    const config = el.shadowRoot?.querySelector('config-hud');
    expect(config).toBeTruthy();

    const closed: string[] = [];
    const unsubscribe = eventBus.on('overlay:close', ({ id }) => id && closed.push(id));
    config?.dispatchEvent(new CustomEvent('s-close', { bubbles: true, composed: true }));
    unsubscribe();
    expect(closed).toEqual(['settings']);
  });
});
