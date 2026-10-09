import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/related.js';
import { $neighborhoodDepth, $workspaceGraph } from '../../src/client/core/store.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  title: id.toUpperCase(),
  createdAt: 0,
  createdBy: 'lm',
});

const link = (id: string, source: string, target: string): SemanticLink => ({
  id,
  source,
  target,
  kind: 'supports',
  createdBy: 'lm',
});

/** a → b → c: two hops reach `c`, one does not. */
const graph = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    ...['a', 'b', 'c'].map((id) => ({ op: 'block.add' as const, block: block(id) })),
    { op: 'link.add', link: link('ab', 'a', 'b') },
    { op: 'link.add', link: link('bc', 'b', 'c') },
    { op: 'roots.set', roots: ['a'] },
  ]);

const mount = async (ref: string) => {
  const el = document.createElement('s-related') as HTMLElement & { ref: string };
  el.ref = ref;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
  $neighborhoodDepth.set(2);
});

describe('related surface', () => {
  it('walks as far as the remembered depth says', async () => {
    $workspaceGraph.set(graph());
    const el = await mount('a');
    expect(el.shadowRoot?.querySelectorAll('.row')).toHaveLength(2);

    el.shadowRoot?.querySelector<HTMLButtonElement>('.depth button[data-depth="1"]')?.click();
    await el.updateComplete;
    expect($neighborhoodDepth.get()).toBe(1);
    expect(el.shadowRoot?.querySelectorAll('.row')).toHaveLength(1);
    expect(el.shadowRoot?.querySelector('.row .label')?.textContent).toBe('B');

    el.shadowRoot?.querySelector<HTMLButtonElement>('.depth button[data-depth="2"]')?.click();
    await el.updateComplete;
    expect(
      [...(el.shadowRoot?.querySelectorAll('.row .label') ?? [])].map((n) => n.textContent)
    ).toEqual(['B', 'C']);
  });

  it('marks the current depth and clamps an out-of-range one', async () => {
    $workspaceGraph.set(graph());
    const el = await mount('a');
    expect(
      [...(el.shadowRoot?.querySelectorAll('.depth button') ?? [])].map((b) =>
        b.getAttribute('aria-pressed')
      )
    ).toEqual(['false', 'true', 'false']);
  });

  it('reports a block that is not in the workspace', async () => {
    $workspaceGraph.set(graph());
    const el = await mount('ghost');
    expect(el.shadowRoot?.querySelector('.empty')?.textContent).toBe('Block not found');
  });
});
