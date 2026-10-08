import { afterEach, describe, expect, it, vi } from 'vitest';
import { notebookRenderer } from '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/views/table-mini-view.js';
import '../../src/client/components/views/table-view.js';
import { eventBus } from '../../src/client/core/events.js';
import { $workspaceGraph } from '../../src/client/core/store.js';
import '../../src/client/core/view-host.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';
import { workspaceRenderer } from '../../src/client/core/workspace-renderer.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'turn',
  role: 'user',
  text: id,
  createdAt: 0,
  createdBy: 'user',
  ...over,
});

const graph = (...blocks: SemanticBlock[]) =>
  applyWorkspaceOps(
    emptyWorkspaceGraph(),
    blocks.map((b): WorkspaceOp => ({ op: 'block.add', block: b }))
  );

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
});

describe('notebook surface', () => {
  it('renders top-level blocks as pages', async () => {
    $workspaceGraph.set(
      graph(
        block('user-1', { text: 'Robins are birds' }),
        block('agent-1', { kind: 'claim', role: 'assistant', createdBy: 'lm', text: 'Robins fly' })
      )
    );
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('Robins are birds');
    expect(text).toContain('Robins fly');
    expect(el.shadowRoot?.querySelectorAll('.page')).toHaveLength(2);
  });

  it('shows an empty state when there are no blocks', async () => {
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('s-empty-state')).toBeTruthy();
  });

  it('renders engine uncertainty as a chip', async () => {
    $workspaceGraph.set(
      graph(
        block('c1', {
          kind: 'claim',
          role: 'reasoner',
          createdBy: 'reasoner',
          text: 'bird',
          uncertainty: { frequency: 0.9, confidence: 0.8, vocabulary: 'nal' },
        })
      )
    );
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.chip')?.textContent).toContain('f0.90');
  });

  it('renders segmented children of a turn page (heading, list, table, code)', async () => {
    $workspaceGraph.set(
      applyWorkspaceOps(emptyWorkspaceGraph(), [
        { op: 'block.add', block: block('t1', { children: ['t1-h', 't1-l', 't1-tb', 't1-c'], text: undefined }) },
        { op: 'block.add', block: block('t1-h', { kind: 'heading', level: 2, text: 'Findings' }) },
        { op: 'block.add', block: block('t1-l', { kind: 'list', data: { items: ['a', 'b'] } }) },
        { op: 'block.add', block: block('t1-tb', { kind: 'table', data: { headers: ['x'], rows: [['1']] } }) },
        { op: 'block.add', block: block('t1-c', { kind: 'code', text: 'const x = 1;' }) },
        { op: 'roots.set', roots: ['t1'] },
      ])
    );
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    const root = el.shadowRoot;
    expect(root?.querySelector('h2')?.textContent).toBe('Findings');
    expect(root?.querySelector('ul.list')?.children).toHaveLength(2);
    expect(root?.querySelector('s-view')).toBeTruthy();
    expect(root?.querySelector('pre.code')?.textContent).toContain('const x = 1;');
  });

  it('renders image and citation blocks', async () => {
    $workspaceGraph.set(
      applyWorkspaceOps(emptyWorkspaceGraph(), [
        { op: 'block.add', block: block('t1', { children: ['img', 'cite'], text: undefined }) },
        { op: 'block.add', block: block('img', { kind: 'image', data: { alt: 'robin', src: 'https://x/y.png' } }) },
        { op: 'block.add', block: block('cite', { kind: 'citation', data: { label: 'docs', href: 'https://x' } }) },
        { op: 'roots.set', roots: ['t1'] },
      ])
    );
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('img.image')?.getAttribute('src')).toBe('https://x/y.png');
    expect(el.shadowRoot?.querySelector('img.image')?.getAttribute('alt')).toBe('robin');
    expect(el.shadowRoot?.querySelector('a.citation')?.getAttribute('href')).toBe('https://x');
    expect(el.shadowRoot?.querySelector('a.citation')?.textContent).toContain('docs');
  });

  it('offers each block a context menu affordance', async () => {
    $workspaceGraph.set(graph(block('user-1', { text: 'Robins are birds' })));
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    const opened = vi.fn();
    const off = eventBus.on('overlay:open', opened);
    el.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    expect(opened).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'block-menu', ref: 'user-1' })
    );
    off();
  });

  it('marks the focused block', async () => {
    $workspaceGraph.set({ ...graph(block('user-1', { text: 'hi' })), focus: 'user-1' });
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.block[data-focused="true"]')).toBeTruthy();
  });

  it('shows a breadcrumb for the focused block and navigates on click', async () => {
    $workspaceGraph.set(
      applyWorkspaceOps(emptyWorkspaceGraph(), [
        { op: 'block.add', block: block('t1', { children: ['h1'], text: undefined }) },
        { op: 'block.add', block: block('h1', { kind: 'heading', text: 'Findings' }) },
        { op: 'roots.set', roots: ['t1'] },
      ])
    );
    $workspaceGraph.set({ ...$workspaceGraph.get(), focus: 'h1' });
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    const crumbs = el.shadowRoot?.querySelectorAll('.breadcrumb .crumb') ?? [];
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1]?.getAttribute('aria-current')).toBe('true');
    crumbs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect($workspaceGraph.get().focus).toBe('t1');
  });

  it('tags every block with its ref for navigation', async () => {
    $workspaceGraph.set(graph(block('user-1', { text: 'hi' })));
    const el = document.createElement('s-notebook');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[data-id="user-1"]')).toBeTruthy();
  });
});

describe('notebook workspace renderer', () => {
  it('registers with the renderer registry as a full renderer', () => {
    expect(workspaceRenderer('notebook')).toBe(notebookRenderer);
    expect(notebookRenderer.capabilities().parity).toBe('full');
    expect(notebookRenderer.capabilities().blockKinds).toBe('all');
  });

  it('mounts a notebook element and disposes it', () => {
    const host = document.createElement('div');
    notebookRenderer.mount(host, { openOverlay: () => {}, openPalette: () => {} });
    expect(host.querySelector('s-notebook')).toBeTruthy();
    notebookRenderer.dispose();
    expect(host.querySelector('s-notebook')).toBeFalsy();
  });

  it('round-trips focus/selection and routes overlays through the context', () => {
    const openOverlay = vi.fn();
    notebookRenderer.mount(document.createElement('div'), { openOverlay, openPalette: () => {} });
    notebookRenderer.focus('r1');
    notebookRenderer.select(['r1', 'r2']);
    expect(notebookRenderer.snapshot()).toMatchObject({ renderer: 'notebook', focus: 'r1' });
    expect(notebookRenderer.snapshot().selection).toEqual(['r1', 'r2']);
    notebookRenderer.openExplain('r1');
    expect(openOverlay).toHaveBeenCalledWith('explain', 'r1');
    notebookRenderer.dispose();
  });
});
