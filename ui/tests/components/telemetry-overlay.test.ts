import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/telemetry.js';
import { eventBus } from '../../src/client/core/events.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const query = <T extends Element>(root: ParentNode | null | undefined, selector: string): T => {
  const found = root?.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found as T;
};

describe('telemetry overlay (0.4)', () => {
  it('registers a palette-reachable overlay', () => {
    expect(overlayDescriptor('telemetry')).toMatchObject({
      id: 'telemetry',
      title: 'Telemetry',
      tag: 's-telemetry',
    });
    expect(overlayDescriptor('telemetry')?.hiddenInPalette).toBeUndefined();
  });

  it('hosts the full telemetry panel', async () => {
    const el = document.createElement('s-telemetry');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('telemetry-panel')).toBeTruthy();
  });

  it('closes through the overlay host', async () => {
    const el = document.createElement('s-telemetry');
    document.body.appendChild(el);
    await el.updateComplete;

    const closed: string[] = [];
    const unsubscribe = eventBus.on('overlay:close', ({ id }) => id && closed.push(id));
    query<HTMLButtonElement>(el.shadowRoot, '.close').click();
    unsubscribe();

    expect(closed).toEqual(['telemetry']);
  });
});
