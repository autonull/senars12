import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../src/client/core/neighborhood.js';
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

const graph = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    ...['a', 'b', 'c'].map((id) => ({ op: 'block.add' as const, block: block(id, { title: id.toUpperCase() }) })),
    { op: 'link.add', link: link('ab', 'a', 'b', 'supports') },
    { op: 'link.add', link: link('cb', 'c', 'b', 'references') },
  ]);

describe('semantic neighborhood', () => {
  it('returns undefined for an unknown block', () => {
    expect(neighborhood(graph(), 'ghost')).toBeUndefined();
  });

  it('finds direct neighbors with direction', () => {
    const fromB = neighborhood(graph(), 'b', 1)!;
    expect(fromB.neighbors.map((n) => n.block.id)).toEqual(['a', 'c']);
    expect(fromB.neighbors.every((n) => n.direction === 'in')).toBe(true);
    const fromA = neighborhood(graph(), 'a', 1)!;
    expect(fromA.neighbors.find((n) => n.block.id === 'b')).toMatchObject({ direction: 'out', depth: 1 });
  });

  it('walks to a bounded depth breadth-first without revisiting', () => {
    const { neighbors } = neighborhood(graph(), 'a', 2)!;
    expect(neighbors.map((n) => n.block.id)).toEqual(['b', 'c']);
    expect(neighbors.find((n) => n.block.id === 'c')?.depth).toBe(2);
    expect(neighborhood(graph(), 'a', 1)!.neighbors.map((n) => n.block.id)).toEqual(['b']);
  });
});
