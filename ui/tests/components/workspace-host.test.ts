import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/workspace-host.js';
import { $activeRenderer, $workspaceGraph, setWorkspaceFocus } from '../../src/client/core/store.js';
import {
  registerRenderer,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../src/client/core/workspace-renderer.js';
import { eventBus } from '../../src/client/core/events.js';

class FakeRenderer implements WorkspaceRenderer {
  readonly id = 'test-fake';
  readonly label = 'Fake';
  mountCount = 0;
  disposeCount = 0;
  restoreCount = 0;
  host?: HTMLElement;
  ctx?: WorkspaceContext;

  capabilities(): WorkspaceRendererCaps {
    return { interactions: [], blockKinds: 'all', parity: 'full' };
  }
  mount(host: HTMLElement, ctx: WorkspaceContext): void {
    this.mountCount++;
    this.host = host;
    this.ctx = ctx;
  }
  present(): void {}
  apply(): void {}
  focus(): void {}
  select(): void {}
  openComposer(): void {}
  openExplain(): void {}
  snapshot(): RendererSnapshot {
    return { renderer: this.id, focus: $workspaceGraph.get().focus, selection: [] };
  }
  restore(): void {
    this.restoreCount++;
  }
  dispose(): void {
    this.disposeCount++;
    this.host = undefined;
  }
}

const fake = new FakeRenderer();
registerRenderer(fake);

const mountHost = async () => {
  $activeRenderer.set(fake.id);
  const host = document.createElement('workspace-host');
  document.body.appendChild(host);
  await host.updateComplete;
  return host;
};

const stage = (host: Element) => host.shadowRoot?.querySelector('.stage') ?? undefined;

afterEach(() => {
  document.body.innerHTML = '';
  $activeRenderer.set('graph');
  setWorkspaceFocus(undefined);
  fake.mountCount = 0;
  fake.disposeCount = 0;
  fake.restoreCount = 0;
});

describe('workspace host (0.4 / 2.5)', () => {
  it('mounts the active renderer from the registry', async () => {
    const host = await mountHost();
    expect(fake.mountCount).toBe(1);
    expect(fake.host).toBe(stage(host));
  });

  it('snapshots, disposes and remounts on a mode switch', async () => {
    const host = await mountHost();
    setWorkspaceFocus('blk-a');

    $activeRenderer.set('notebook');
    await host.updateComplete;
    expect(fake.disposeCount).toBe(1);
    expect(stage(host)?.querySelector('s-notebook')).toBeTruthy();

    $activeRenderer.set(fake.id);
    await host.updateComplete;
    expect(fake.mountCount).toBe(2);
    expect(fake.restoreCount).toBe(1);
    expect($workspaceGraph.get().focus).toBe('blk-a');
  });

  it('gives renderers the shell context', async () => {
    await mountHost();
    const opened: Array<{ id: string; ref?: string }> = [];
    const unsubscribe = eventBus.on('overlay:open', ({ id, ref }) => opened.push({ id, ref }));
    fake.ctx?.openOverlay('explain', 'blk-a');
    fake.ctx?.openPalette();
    unsubscribe();
    expect(opened).toEqual([
      { id: 'explain', ref: 'blk-a' },
      { id: 'palette', ref: undefined },
    ]);
  });

  it('disposes the renderer when the host unmounts', async () => {
    const host = await mountHost();
    host.remove();
    expect(fake.disposeCount).toBe(1);
  });
});
