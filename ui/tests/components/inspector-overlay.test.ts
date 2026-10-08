import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/inspector.js';
import { eventBus } from '../../src/client/core/events.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';
import { $selectedEdgeId, $selectedNodeId } from '../../src/client/core/store.js';

afterEach(() => {
  document.body.innerHTML = '';
  $selectedNodeId.set(null);
  $selectedEdgeId.set(null);
});

const query = <T extends Element>(root: ParentNode | null | undefined, selector: string): T => {
  const found = root?.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found as T;
};

describe('inspector overlay', () => {
  it('registers a non-modal popover that does not steal focus', () => {
    const descriptor = overlayDescriptor('inspector');
    expect(descriptor).toMatchObject({
      id: 'inspector',
      title: 'Inspector',
      tag: 's-inspector',
      autoFocus: false,
    });
    expect(descriptor?.modal).toBeUndefined();
    expect(descriptor?.hiddenInPalette).toBeUndefined();
  });

  it('hosts the node detail drawer', async () => {
    const el = document.createElement('s-inspector');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(query(el.shadowRoot, 'node-detail-drawer')).toBeTruthy();
  });

  it('clears the selection and closes through the overlay host', async () => {
    $selectedNodeId.set('n1');
    const el = document.createElement('s-inspector');
    document.body.appendChild(el);
    await el.updateComplete;

    const closed: string[] = [];
    const unsubscribe = eventBus.on('overlay:close', ({ id }) => id && closed.push(id));
    query<HTMLButtonElement>(el.shadowRoot, '.close').click();
    unsubscribe();

    expect($selectedNodeId.get()).toBeNull();
    expect(closed).toEqual(['inspector']);
  });
});
