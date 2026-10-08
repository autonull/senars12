import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/app-layout.js';
import { dispatchCommand } from '../../src/client/core/commands.js';
import { $selectedEdgeId, $selectedNodeId } from '../../src/client/core/store.js';

afterEach(() => {
  document.body.innerHTML = '';
  $selectedNodeId.set(null);
  $selectedEdgeId.set(null);
});

const overlays = () =>
  (
    window as unknown as {
      __testApi?: {
        overlays?: { isOpen(id: string): boolean; pinned(): string[] };
      };
    }
  ).__testApi?.overlays;

const mount = async () => {
  const el = document.createElement('app-layout');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

describe('app-layout inspector wiring (0.4)', () => {
  it('opens the inspector while a node is selected and closes it when cleared', async () => {
    await mount();
    expect(overlays()?.isOpen('inspector')).toBe(false);

    $selectedNodeId.set('n1');
    expect(overlays()?.isOpen('inspector')).toBe(true);

    $selectedNodeId.set(null);
    expect(overlays()?.isOpen('inspector')).toBe(false);
  });

  it('follows an edge selection too', async () => {
    await mount();
    $selectedEdgeId.set('a->b');
    expect(overlays()?.isOpen('inspector')).toBe(true);
  });

  it('pins and unpins the top overlay through the pin command (§4.5)', async () => {
    await mount();
    expect(dispatchCommand('overlay.palette')).toBe(true);
    expect(overlays()?.isOpen('palette')).toBe(true);

    expect(dispatchCommand('overlay.pin')).toBe(true);
    expect(overlays()?.pinned()).toEqual(['palette']);

    expect(dispatchCommand('overlay.pin')).toBe(true);
    expect(overlays()?.pinned()).toEqual([]);
  });
});
