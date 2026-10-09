import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/explain.js';
import { explain, explainEventModel, explainModel } from '../../src/client/core/explain.js';
import { $nodeHistory, $workspaceGraph, type RevisionEntry } from '../../src/client/core/store.js';
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
    { op: 'link.add', link: { id: 'l1', source: 'c', target: 'p', kind: 'derived-from', createdBy: 'reasoner', eventRefs: ['e1'] } },
    { op: 'roots.set', roots: ['p', 'c'] },
  ] satisfies WorkspaceOp[]);

const entry: RevisionEntry = {
  truth: { frequency: 0.4, confidence: 0.8 },
  stampId: 'e1',
  timestamp: 0,
  source: 'derivation',
};

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
  $nodeHistory.set([]);
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

  it('reports nothing to explain for a ref that names nothing', async () => {
    $workspaceGraph.set(linked());
    const el = await mount('missing');
    expect(el.shadowRoot?.textContent).toContain('Nothing to explain');
  });
});

describe('explain subjects', () => {
  it('resolves whichever of the three a ref names', () => {
    const graph = linked();
    expect(explain(graph, 'c')?.kind).toBe('block');
    expect(explain(graph, 'l1')?.kind).toBe('link');
    expect(explain(graph, 'e1', [entry])?.kind).toBe('event');
    expect(explain(graph, 'missing')).toBeUndefined();
  });

  it('joins an event to the links that cite it', () => {
    const event = explainEventModel(linked(), [entry], 'e1');
    expect(event?.entry.source).toBe('derivation');
    expect(event?.citing).toMatchObject([{ id: 'l1', label: 'derived from', sourceLabel: 'conclusion', targetLabel: 'premise' }]);
    expect(explainEventModel(linked(), [], 'e1')).toBeUndefined();
  });

  it('explains a link by its relationship, endpoints and the block it lands on', async () => {
    $workspaceGraph.set(linked());
    const el = await mount('l1');
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('Relationship');
    expect(text).toContain('derived from');
    expect(text).toContain('premise');
  });

  it('explains an event by its truth and what cites it', async () => {
    $workspaceGraph.set(linked());
    $nodeHistory.set([entry]);
    const el = await mount('e1');
    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('Stamp');
    expect(text).toContain('f0.40 c0.80');
    expect(text).toContain('conclusion → premise');
  });

  it('renders the block body as the notebook would, not a JSON dump', async () => {
    $workspaceGraph.set(
      applyWorkspaceOps(emptyWorkspaceGraph(), [
        { op: 'block.add', block: block('a', 'plan', { kind: 'list', data: { items: ['fly south', 'sing'] } }) },
      ] satisfies WorkspaceOp[])
    );
    const el = await mount('a');
    const list = el.shadowRoot?.querySelector('ul.list');
    expect(list?.children).toHaveLength(2);
    expect(el.shadowRoot?.querySelector('pre')).toBeFalsy();
  });
});
