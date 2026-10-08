import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/overlays/toc.js';
import { eventBus } from '../../src/client/core/events.js';
import { $workspaceGraph } from '../../src/client/core/store.js';
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
    { op: 'block.add', block: block('t1', { children: ['h1', 'c1', 'tb1', 'p1'], text: undefined }) },
    { op: 'block.add', block: block('h1', { kind: 'heading', level: 2, text: 'Findings' }) },
    { op: 'block.add', block: block('c1', { kind: 'claim', role: 'assistant', createdBy: 'lm', text: 'Robins fly' }) },
    { op: 'block.add', block: block('tb1', { kind: 'table', data: { headers: ['a'], rows: [['1']] } }) },
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
});

describe('tocEntries', () => {
  it('walks page order and children in document order, keeping navigable kinds', () => {
    const entries = tocEntries(build());
    expect(entries.map((entry) => entry.kind)).toEqual(['heading', 'claim', 'table']);
    expect(entries[0]).toMatchObject({ ref: 'h1', label: 'Findings', level: 2, pageRef: 't1' });
    expect(entries[1]?.label).toBe('Robins fly');
  });
});

describe('toc surface', () => {
  it('renders one row per navigable block', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const rows = el.shadowRoot?.querySelectorAll('.entry') ?? [];
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector('.kind')?.textContent).toContain('Heading');
    expect(rows[0]?.querySelector('.label')?.textContent).toContain('Findings');
  });

  it('filters rows by kind', async () => {
    $workspaceGraph.set(build());
    const el = await mount();
    const chip = el.shadowRoot?.querySelector<HTMLButtonElement>('button[data-filter="claim"]');
    chip?.click();
    await el.updateComplete;
    const rows = el.shadowRoot?.querySelectorAll('.entry') ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute('data-kind')).toBe('claim');
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
});
