import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/timeline.js';
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

describe('timeline overlay', () => {
  it('registers a palette-visible, non-modal timeline overlay', () => {
    const descriptor = overlayDescriptor('timeline');
    expect(descriptor).toMatchObject({ id: 'timeline', title: 'Timeline', tag: 's-timeline' });
    expect(descriptor?.modal).toBeUndefined();
    expect(descriptor?.hiddenInPalette).toBeUndefined();
  });

  it('hosts the scrubber and closes through the overlay host', async () => {
    const el = document.createElement('s-timeline');
    document.body.appendChild(el);
    await el.updateComplete;

    expect(query(el.shadowRoot, 'timeline-scrubber')).toBeTruthy();

    const closed: string[] = [];
    const unsubscribe = eventBus.on('overlay:close', ({ id }) => id && closed.push(id));
    const header = query(el.shadowRoot, 'overlay-header');
    query<HTMLButtonElement>(header.shadowRoot, '.close').click();
    unsubscribe();
    expect(closed).toEqual(['timeline']);
  });
});
