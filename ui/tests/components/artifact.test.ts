import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/overlays/artifact.js';
import '../../src/client/components/views/table-mini-view.js';
import '../../src/client/components/views/table-view.js';
import '../../src/client/components/views/text-view.js';
import { $activeRenderer, $workspaceGraph } from '../../src/client/core/store.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';
import '../../src/client/core/view-host.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'paragraph',
  role: 'assistant',
  text: id,
  createdAt: 0,
  createdBy: 'lm',
  ...over,
});

const build = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    { op: 'block.add', block: block('p', { text: 'prose' }) },
    {
      op: 'block.add',
      block: block('tb', { kind: 'table', data: { headers: ['x'], rows: [['1']] } }),
    },
    {
      op: 'block.add',
      block: block('img', { kind: 'image', data: { alt: 'robin', src: 'https://x/y.png' } }),
    },
    { op: 'roots.set', roots: ['p', 'tb', 'img'] },
  ] satisfies WorkspaceOp[]);

const mount = async (ref: string) => {
  const el = document.createElement('s-artifact');
  document.body.appendChild(el);
  el.ref = ref;
  await el.updateComplete;
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
});

describe('artifact overlay', () => {
  it('renders a table artifact through the full view host', async () => {
    $workspaceGraph.set(build());
    const el = await mount('tb');
    const view = el.shadowRoot?.querySelector('s-view');
    expect(view).toBeTruthy();
    await view?.updateComplete;
    expect(view?.shadowRoot?.querySelector('s-table')).toBeTruthy();
  });

  it('renders an image artifact', async () => {
    $workspaceGraph.set(build());
    const el = await mount('img');
    expect(el.shadowRoot?.querySelector('img.image')?.getAttribute('src')).toBe('https://x/y.png');
  });

  it('reports a block without an artifact', async () => {
    $workspaceGraph.set(build());
    const el = await mount('p');
    expect(el.shadowRoot?.textContent).toContain('No artifact');
  });

  it('reports a missing block', async () => {
    $workspaceGraph.set(build());
    const el = await mount('missing');
    expect(el.shadowRoot?.textContent).toContain('Block not found');
  });

  it('copies the artifact source', async () => {
    $workspaceGraph.set(build());
    const el = await mount('img');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    el.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy"]')?.click();
    expect(writeText).toHaveBeenCalledWith('https://x/y.png');
  });

  it('opens the block in the graph and closes', async () => {
    $workspaceGraph.set(build());
    const el = await mount('tb');
    $activeRenderer.set('notebook');
    el.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="graph"]')?.click();
    expect($activeRenderer.get()).toBe('graph');
    expect($workspaceGraph.get().focus).toBe('tb');
  });
});
