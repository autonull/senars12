import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/overlays/block-menu.js';
import { eventBus } from '../../src/client/core/events.js';
import { $activeRenderer, $workspaceGraph } from '../../src/client/core/store.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  text: id,
  createdAt: 0,
  createdBy: 'lm',
  ...over,
});

const build = (withProvenance: boolean) =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    { op: 'block.add', block: block('p') },
    { op: 'block.add', block: block('c') },
    ...(withProvenance
      ? ([
          {
            op: 'link.add',
            link: { id: 'l1', source: 'c', target: 'p', kind: 'derived-from', createdBy: 'reasoner' },
          },
        ] satisfies WorkspaceOp[])
      : []),
    { op: 'roots.set', roots: ['p', 'c'] },
  ] satisfies WorkspaceOp[]);

const mount = async (ref: string) => {
  const el = document.createElement('s-block-menu');
  document.body.appendChild(el);
  el.ref = ref;
  await el.updateComplete;
  return el;
};

const action = (el: HTMLElement, name: string) =>
  el.shadowRoot?.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`);

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
  $activeRenderer.set('graph');
});

describe('block menu surface', () => {
  it('offers the honest affordances and hides the rest', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    expect(action(el, 'explain')).toBeTruthy();
    expect(action(el, 'open-graph')).toBeTruthy();
    expect(action(el, 'copy')).toBeTruthy();
    expect(action(el, 'provenance')).toBeFalsy();
  });

  it('shows provenance only when the block has provenance links', async () => {
    $workspaceGraph.set(build(true));
    const el = await mount('c');
    expect(action(el, 'provenance')).toBeTruthy();
  });

  it('opens the explanation overlay', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    const opened = vi.fn();
    const off = eventBus.on('overlay:open', opened);
    action(el, 'explain')?.click();
    expect(opened).toHaveBeenCalledWith({ id: 'explain', ref: 'c' });
    off();
  });

  it('switches to graph and focuses the block on open-in-graph', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    action(el, 'open-graph')?.click();
    expect($activeRenderer.get()).toBe('graph');
    expect($workspaceGraph.get().focus).toBe('c');
  });
});
