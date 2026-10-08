import { describe, expect, it } from 'vitest';
import { BLOCK_KIND_LABEL } from '../../src/client/core/block-labels.js';
import { projectWorkspaceGraph } from '../../src/client/core/graph-projection.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, patch: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  ...patch,
});

const link = (id: string, source: string, target: string, kind: SemanticLink['kind']): SemanticLink => ({
  id,
  source,
  target,
  kind,
  createdBy: 'lm',
});

const graphOf = (blocks: SemanticBlock[], links: SemanticLink[] = []) =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    ...blocks.map((b) => ({ op: 'block.add' as const, block: b })),
    ...links.map((l) => ({ op: 'link.add' as const, link: l })),
  ]);

describe('workspace graph projection', () => {
  it('projects blocks to labelled nodes and links to typed edges', () => {
    const { nodes, edges } = projectWorkspaceGraph(
      graphOf(
        [block('a', { text: 'Robins are birds.' }), block('b', { title: 'Bird' })],
        [link('l1', 'a', 'b', 'supports')]
      )
    );
    expect(nodes.get('a')).toMatchObject({ label: 'Robins are birds.', nodeType: 'workspace', kind: 'claim' });
    expect(nodes.get('b')).toMatchObject({ label: 'Bird' });
    expect(edges.get('l1')).toMatchObject({ source: 'a', target: 'b', type: 'supports', label: 'supports' });
  });

  it('falls back to the first line then the kind label', () => {
    const { nodes } = projectWorkspaceGraph(
      graphOf([block('a', { text: 'First line\nsecond' }), block('b', { kind: 'answer' })])
    );
    expect(nodes.get('a')?.label).toBe('First line');
    expect(nodes.get('b')?.label).toBe(BLOCK_KIND_LABEL.answer);
  });

  it('makes a section with children a compound parent', () => {
    const { nodes } = projectWorkspaceGraph(
      graphOf([
        block('s', { kind: 'section', title: 'Intro', children: ['c1', 'c2'] }),
        block('c1'),
        block('c2'),
      ])
    );
    expect(nodes.get('c1')?.parent).toBe('s');
    expect(nodes.get('c2')?.parent).toBe('s');
    expect(nodes.get('s')?.parent).toBeUndefined();
  });

  it('drops links whose endpoints are not blocks', () => {
    const { edges } = projectWorkspaceGraph(graphOf([block('a')], [link('l1', 'a', 'ghost', 'references')]));
    expect(edges.size).toBe(0);
  });
});
