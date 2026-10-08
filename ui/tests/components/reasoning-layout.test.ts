import { describe, expect, it } from 'vitest';
import {
  REASONING_LAYOUT_IDS,
  type ReasoningPositions,
  reasoningPositions,
} from '../../src/client/core/reasoning-layout.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';
import { layoutRegistry } from '../../src/client/utils/layout-registry.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  ...over,
});

const link = (
  id: string,
  source: string,
  target: string,
  kind: SemanticLink['kind']
): SemanticLink => ({ id, source, target, kind, createdBy: 'lm' });

const build = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    { op: 'block.add', block: block('a', { createdBy: 'user' }) },
    { op: 'block.add', block: block('b') },
    { op: 'block.add', block: block('c') },
    { op: 'block.add', block: block('d') },
    { op: 'block.add', block: block('e') },
    { op: 'block.add', block: block('f') },
    { op: 'block.add', block: block('g') },
    { op: 'link.add', link: link('l1', 'c', 'b', 'derived-from') },
    { op: 'link.add', link: link('l2', 'd', 'c', 'derived-from') },
    { op: 'link.add', link: link('l3', 'd', 'c', 'formalizes') },
    { op: 'link.add', link: link('l4', 'e', 'd', 'admitted-by-gate') },
    { op: 'link.add', link: link('l5', 'f', 'd', 'rejected-by-gate') },
    { op: 'link.add', link: link('l6', 'c', 'g', 'contradicts') },
    { op: 'roots.set', roots: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
  ] satisfies WorkspaceOp[]);

const at = (positions: ReasoningPositions, id: string): { x: number; y: number } => {
  const point = positions.get(id);
  if (!point) throw new Error(`no position for ${id}`);
  return point;
};

describe('reasoning layouts', () => {
  const graph = build();

  it('positions every block under every layout, deterministically', () => {
    for (const id of REASONING_LAYOUT_IDS) {
      const positions = reasoningPositions(graph, id);
      expect(positions.size).toBe(graph.blocks.size);
      expect(positions).toEqual(reasoningPositions(graph, id));
    }
  });

  it('reasoning-provenance layers by derived-from depth', () => {
    const positions = reasoningPositions(graph, 'reasoning-provenance');
    expect(at(positions, 'b').x).toBe(0);
    expect(at(positions, 'c').x).toBeGreaterThan(at(positions, 'b').x);
    expect(at(positions, 'd').x).toBeGreaterThan(at(positions, 'c').x);
  });

  it('gate-pipeline orders formalized → admitted → rejected left to right', () => {
    const positions = reasoningPositions(graph, 'gate-pipeline');
    expect(at(positions, 'a').x).toBe(0);
    expect(at(positions, 'd').x).toBeGreaterThan(0);
    expect(at(positions, 'e').x).toBeGreaterThan(at(positions, 'd').x);
    expect(at(positions, 'f').x).toBeGreaterThan(at(positions, 'e').x);
  });

  it('contradiction-neighborhood centres contested claims', () => {
    const positions = reasoningPositions(graph, 'contradiction-neighborhood');
    expect(at(positions, 'c').x).toBe(0);
    expect(at(positions, 'g').x).toBe(0);
    expect(at(positions, 'a').x).toBeGreaterThan(0);
  });

  it('budget-resource separates the originating parties into lanes', () => {
    const positions = reasoningPositions(graph, 'budget-resource');
    expect(at(positions, 'a').x).toBe(0);
    expect(at(positions, 'b').x).toBeGreaterThan(0);
  });
});

describe('reasoning layout registry rows', () => {
  it('registers every reasoning layout under the concept scope', () => {
    const concept = new Set(layoutRegistry.layoutsFor('concept').map((layout) => layout.id));
    for (const id of REASONING_LAYOUT_IDS) {
      expect(layoutRegistry.get(id)?.scope ?? 'concept').toBe('concept');
      expect(concept.has(id)).toBe(true);
    }
  });
});
