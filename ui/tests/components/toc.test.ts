import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/overlays/toc.js';
import { eventBus } from '../../src/client/core/events.js';
import { $collapsedBlocks, $workspaceGraph } from '../../src/client/core/store.js';
import { tocEntries } from '../../src/client/core/toc.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'turn',
  role: 'user',
  text: id,
  createdAt: 0,
  createdBy: 'user',
  ...over,
});

const build = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    {
      op: 'block.add',
      block: block('t1', { children: ['h1', 's1', 'tb1', 'p1'], text: undefined }),
    },
    { op: 'block.add', block: block('h1', { kind: 'heading', level: 2, text: 'Findings' }) },
    {
      op: 'block.add',
      block: block('s1', {
        kind: 'section',
        children: ['c1', 'c2'],
        text: 'Evidence',
        role: 'assistant',
      }),
    },
    {
      op: 'block.add',
      block: block('c1', { kind: 'claim', role: 'assistant', createdBy: 'lm', text: 'Robins fly' }),
    },
    {
      op: 'block.add',
      block: block('c2', { kind: 'claim', role: 'assistant', createdBy: 'lm', text: 'Swifts fly' }),
    },
    {
      op: 'block.add',
      block: block('tb1', { kind: 'table', data: { headers: ['a'], rows: [['1']] } }),
    },
    { op: 'block.add', block: block('p1', { kind: 'paragraph', text: 'prose' }) },
    { op: 'roots.set', roots: ['t1'] },
  ] satisfies WorkspaceOp[]);

const mount = async () => {
  const el = document.createElement('s-toc');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
  $collapsedBlocks.set(new Set());
});

describe('tocEntries', () => {
  it('walks nested sections in document order, keeping navigable kinds', () => {
    const entries = tocEntries(build());
    expect(entries.map((entry) => entry.ref)).toEqual(['h1', 'c1', 'c2', 'tb1']);
    expect(entries[0]).toMatchObject({
      ref: 'h1',
      label: 'Findings',
      level: 2,
      pageRef: 't1',
      depth: 1,
    });
    expect(entries[1]).toMatchObject({ ref: 'c1', label: 'Robins fly', pageRef: 't1', depth: 2 });
  });

  it('drops the entries a folded section hides', () => {
    expect(tocEntries(build(), new Set(['s1'])).map((entry) => entry.ref)).toEqual(['h1', 'tb1']);
  });
});

describe('toc surface', () => {
  it('renders one indented row per navigable block', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const rows = el.shadowRoot?.querySelectorAll('.entry') ?? [];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.querySelector('.kind')?.textContent).toContain('Heading');
    expect(rows[0]?.querySelector('.label')?.textContent).toContain('Findings');
    expect([...rows].map((row) => row.getAttribute('data-depth'))).toEqual(['1', '2', '2', '1']);
  });

  it('shows the folded count and folds/unfolds every section from the badge', async () => {
    $workspaceGraph.set(build());
    $collapsedBlocks.set(new Set(['s1']));
    const el = await mount();
    expect(el.shadowRoot?.querySelectorAll('.entry')).toHaveLength(2);
    const badge = el.shadowRoot?.querySelector<HTMLButtonElement>('.folds');
    expect(badge?.textContent).toContain('1 folded');
    badge?.click();
    expect([...$collapsedBlocks.get()].sort()).toEqual(['s1', 't1']);
    await el.updateComplete;
    badge?.click();
    expect($collapsedBlocks.get().size).toBe(0);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelectorAll('.entry')).toHaveLength(4);
  });

  it('filters rows by kind', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const chip = el.shadowRoot?.querySelector<HTMLButtonElement>('button[data-filter="claim"]');
    chip?.click();
    await el.updateComplete;
    const rows = el.shadowRoot?.querySelectorAll('.entry') ?? [];
    expect(rows).toHaveLength(2);
    expect([...rows].every((row) => row.getAttribute('data-kind') === 'claim')).toBe(true);
  });

  it('navigates focus and closes on entry selection', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const closed = vi.fn();
    const off = eventBus.on('overlay:close', closed);
    el.shadowRoot?.querySelector<HTMLButtonElement>('.entry')?.click();
    expect($workspaceGraph.get().focus).toBe('h1');
    expect(closed).toHaveBeenCalledWith({ id: 'toc' });
    off();
  });

  it('marks the focused entry as current', async () => {
    $workspaceGraph.set({ ...build(), focus: 'c1' });
    const el = await mount();
    const current = el.shadowRoot?.querySelector('.entry[aria-current="true"]');
    expect(current?.getAttribute('data-ref')).toBe('c1');
  });

  it('offers an artifact affordance only for blocks that have one', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const buttons = [...(el.shadowRoot?.querySelectorAll('.artifact') ?? [])];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute('data-artifact')).toBe('tb1');
  });

  it('opens the artifact overlay for a row', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const opened = vi.fn();
    const off = eventBus.on('overlay:open', opened);
    el.shadowRoot?.querySelector<HTMLButtonElement>('.artifact')?.click();
    expect(opened).toHaveBeenCalledWith({ id: 'artifact', ref: 'tb1' });
    off();
  });
});
