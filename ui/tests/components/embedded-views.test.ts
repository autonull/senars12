import { afterEach, describe, expect, it } from 'vitest';
import {
  $embeddedViews,
  derivationTree,
  embeddedDataset,
  embeddedViewsFor,
  embeddedViewsShown,
  embeddedViewSpec,
  hasEmbeddedView,
  toggleEmbeddedView,
} from '../../src/client/core/embedded-views.js';
import { $workspaceGraph } from '../../src/client/core/store.js';
import type { TableDataset, TreeDataset } from '../../src/client/core/view-spec.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  title: id,
  createdAt: 0,
  createdBy: 'reasoner',
  ...over,
});

const link = (
  id: string,
  source: string,
  target: string,
  kind: SemanticLink['kind'] = 'derived-from'
): SemanticLink => ({ id, source, target, kind, createdBy: 'reasoner' });

const graphOf = (...ops: WorkspaceOp[]) => applyWorkspaceOps(emptyWorkspaceGraph(), ops);

/** A claim derived from a record, in tension with a rival claim, beside a citation. */
const workspace = () =>
  graphOf(
    { op: 'block.add', block: block('claim') },
    { op: 'block.add', block: block('record') },
    { op: 'block.add', block: block('rival', { uncertainty: { frequency: 0.2, confidence: 0.9 } }) },
    { op: 'block.add', block: block('note') },
    { op: 'link.add', link: link('l1', 'record', 'claim') },
    { op: 'link.add', link: link('l2', 'rival', 'claim', 'contradicts') },
    { op: 'link.add', link: link('l3', 'note', 'claim', 'cites') },
    { op: 'roots.set', roots: ['claim', 'record', 'rival', 'note'] }
  );

afterEach(() => {
  $workspaceGraph.set(emptyWorkspaceGraph());
  $embeddedViews.set(new Map());
});

describe('derivation view', () => {
  it('nests the provenance chain behind a block', () => {
    const graph = graphOf(
      { op: 'block.add', block: block('claim') },
      { op: 'block.add', block: block('record') },
      { op: 'block.add', block: block('source') },
      { op: 'link.add', link: link('l1', 'record', 'claim') },
      { op: 'link.add', link: link('l2', 'source', 'record') }
    );
    const { roots } = derivationTree(graph, 'claim');
    expect(roots[0]?.label).toBe('claim');
    expect(roots[0]?.children?.[0]?.label).toBe('derived from · record');
    expect(roots[0]?.children?.[0]?.children?.[0]?.label).toBe('derived from · source');
  });

  it('terminates on a cyclic chain', () => {
    const graph = graphOf(
      { op: 'block.add', block: block('a') },
      { op: 'block.add', block: block('b') },
      { op: 'link.add', link: link('l1', 'b', 'a') },
      { op: 'link.add', link: link('l2', 'a', 'b') }
    );
    const { roots } = derivationTree(graph, 'a');
    expect(roots[0]?.children?.[0]?.children?.[0]?.children).toBeUndefined();
  });

  it('reads only the provenance links, not every link', () => {
    expect(derivationTree(workspace(), 'claim').roots[0]?.children).toHaveLength(1);
  });
});

describe('contradiction view', () => {
  it('keeps the blocks the catalog puts in tension and their truth', () => {
    const dataset = embeddedDataset(workspace(), 'claim', 'contradiction') as TableDataset;
    expect(dataset.columns.map((column) => column.label)).toEqual(['Block', 'Link', 'Truth', 'Hop']);
    expect(dataset.rows).toHaveLength(1);
    expect(dataset.rows[0]).toMatchObject({ c0: 'rival', c1: 'contradicts', c2: 'f0.20 c0.90' });
  });
});

describe('topic view', () => {
  it('lists the topical links around the block, provenance aside', () => {
    const dataset = embeddedDataset(workspace(), 'claim', 'topic') as TableDataset;
    expect(dataset.rows.map((row) => row.c0)).toEqual(['rival', 'note']);
    expect(dataset.rows.map((row) => row.c2)).toEqual(['←', '←']);
  });
});

describe('embedded view availability', () => {
  it('offers only what the block has to show', () => {
    expect(embeddedViewsFor(workspace(), 'claim')).toEqual(['derivation', 'contradiction', 'topic']);
    expect(embeddedViewsFor(graphOf({ op: 'block.add', block: block('lonely') }), 'lonely')).toEqual(
      []
    );
    expect(hasEmbeddedView(workspace(), 'record', 'derivation')).toBe(false);
  });

  it('remembers what a block shows, in catalog order, and toggles it off', () => {
    toggleEmbeddedView('claim', 'topic');
    toggleEmbeddedView('claim', 'derivation');
    expect(embeddedViewsShown('claim')).toEqual(['derivation', 'topic']);
    toggleEmbeddedView('claim', 'derivation');
    expect(embeddedViewsShown('claim')).toEqual(['topic']);
    expect(embeddedViewsShown('other')).toEqual([]);
  });
});

describe('embedded view spec', () => {
  it('projects the dataset live off the workspace graph', () => {
    $workspaceGraph.set(workspace());
    const spec = embeddedViewSpec($workspaceGraph.get().blocks.get('claim')!, 'topic');
    expect((spec.source.get() as TableDataset).rows).toHaveLength(2);
    $workspaceGraph.set(graphOf({ op: 'block.add', block: block('claim') }));
    expect((spec.source.get() as TableDataset).rows).toHaveLength(0);
  });

  it('reuses one spec per block so a re-render does not churn the host', () => {
    const claim = $workspaceGraph.get().blocks.get('lonely') ?? block('lonely');
    expect(embeddedViewSpec(claim, 'topic')).toBe(embeddedViewSpec(claim, 'topic'));
    expect(embeddedViewSpec(claim, 'topic')).not.toBe(embeddedViewSpec(claim, 'derivation'));
  });
});