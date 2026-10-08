import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/explain.js';
import { explainModel } from '../../src/client/core/explain.js';
import { $workspaceGraph } from '../../src/client/core/store.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, title: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'reasoner',
  title,
  text: title,
  createdAt: 0,
  createdBy: 'reasoner',
  ...over,
});

const linked = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    { op: 'block.add', block: block('p', 'premise') },
    { op: 'block.add', block: block('c', 'conclusion') },
    { op: 'link.add', link: { id: 'l1', source: 'c', target: 'p', kind: 'derived-from', createdBy: 'reasoner' } },
    { op: 'roots.set', roots: ['p', 'c'] },
  ] satisfies WorkspaceOp[]);

const mount = async (ref: string) => {
  const el = document.createElement('s-explain');
  document.body.appendChild(el);
  el.ref = ref;
  await el.updateComplete;
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  $workspaceGraph.set(emptyWorkspaceGraph());
});

describe('explain model', () => {
  it('resolves the block and every touching link with direction and label', () => {
    const model = explainModel(linked(), 'c');
    expect(model?.block.title).toBe('conclusion');
    expect(model?.links).toHaveLength(1);
    expect(model?.links[0]).toMatchObject({
      kind: 'derived-from',
      label: 'derived from',
      direction: 'out',
      other: 'p',
      otherLabel: 'premise',
    });
  });

  it('returns undefined for an unknown ref', () => {
    expect(explainModel(linked(), 'missing')).toBeUndefined();
  });
});

describe('explain surface', () => {
  it('shows summary facts and relationships', async () => {
    $workspaceGraph.set(linked());
    const el = await mount('c');
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('Claim');
    expect(text).toContain('conclusion');
    expect(el.shadowRoot?.querySelector('.link')?.textContent).toContain('derived from');
  });

  it('switches disclosure levels', async () => {
    $workspaceGraph.set(linked());
    const el = await mount('c');
    el.shadowRoot?.querySelector<HTMLButtonElement>('button[data-level="raw"]')?.click();
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('pre')?.textContent).toContain('"id": "c"');
  });

  it('reports a missing block', async () => {
    $workspaceGraph.set(linked());
    const el = await mount('missing');
    expect(el.shadowRoot?.textContent).toContain('Block not found');
  });
});
