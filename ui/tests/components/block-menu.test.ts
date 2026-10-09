import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/overlays/block-menu.js';
import { $capabilities, defaultCapabilities, setCapability } from '../../src/client/core/capabilities.js';
import { $embeddedViews, embeddedViewsShown } from '../../src/client/core/embedded-views.js';
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

const embedAction = (el: HTMLElement, view: string) =>
  el.shadowRoot?.querySelector<HTMLButtonElement>(`button[data-embed="${view}"]`);

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
  $embeddedViews.set(new Map());
  $activeRenderer.set('graph');
  $capabilities.set(defaultCapabilities());
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

  it('opens the semantic neighborhood only when related blocks exist', async () => {
    $workspaceGraph.set(build(false));
    expect(action(await mount('c'), 'related')).toBeFalsy();

    $workspaceGraph.set(build(true));
    const el = await mount('c');
    const related = action(el, 'related');
    expect(related).toBeTruthy();
    const open = vi.fn();
    const off = eventBus.on('overlay:open', open);
    related?.click();
    expect(open).toHaveBeenCalledWith({ id: 'related', ref: 'c' });
    off();
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

  it('offers an artifact action only for artifact blocks', async () => {
    $workspaceGraph.set(
      applyWorkspaceOps(emptyWorkspaceGraph(), [
        { op: 'block.add', block: block('c') },
        {
          op: 'block.add',
          block: block('tb', { kind: 'table', data: { headers: ['x'], rows: [['1']] } }),
        },
        { op: 'roots.set', roots: ['c', 'tb'] },
      ] satisfies WorkspaceOp[])
    );
    const claim = await mount('c');
    expect(action(claim, 'artifact')).toBeFalsy();
    const table = await mount('tb');
    expect(action(table, 'artifact')).toBeTruthy();
  });

  it('switches to graph and focuses the block on open-in-graph', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    action(el, 'open-graph')?.click();
    expect($activeRenderer.get()).toBe('graph');
    expect($workspaceGraph.get().focus).toBe('c');
  });

  it('asks a follow-up by focusing the composer on the block', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    const focus = vi.fn();
    const off = eventBus.on('composer:focus', focus);
    action(el, 'follow-up')?.click();
    expect(focus).toHaveBeenCalledWith({ refs: ['c'] });
    off();
  });

  it('offers an embed toggle per view the block has, and reflects the shown state', async () => {
    $workspaceGraph.set(build(true));
    const el = await mount('p');
    expect(embedAction(el, 'derivation')).toBeTruthy();
    expect(embedAction(el, 'contradiction')).toBeFalsy();

    const toggle = embedAction(el, 'derivation')!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    expect(embeddedViewsShown('p')).toEqual(['derivation']);
    await el.updateComplete;
    expect(embedAction(el, 'derivation')?.getAttribute('aria-checked')).toBe('true');
    expect($embeddedViews.get().get('p')).toEqual(new Set(['derivation']));
  });

  it('offers no embed toggle for a block with nothing to embed', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    expect(action(el, 'embed')).toBeFalsy();
  });

  it('offers formalize only when reasoning is on', async () => {
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    expect(action(el, 'belief')).toBeFalsy();
    expect(action(el, 'goal')).toBeFalsy();
    setCapability('reasoning', true);
    await el.updateComplete;
    expect(action(el, 'belief')).toBeTruthy();
    expect(action(el, 'goal')).toBeTruthy();
  });

  it('formalizes as belief in the believe mode', async () => {
    setCapability('reasoning', true);
    $workspaceGraph.set(build(false));
    const el = await mount('c');
    const focus = vi.fn();
    const off = eventBus.on('composer:focus', focus);
    action(el, 'belief')?.click();
    expect(focus).toHaveBeenCalledWith({ refs: ['c'], mode: 'believe' });
    off();
  });
});
