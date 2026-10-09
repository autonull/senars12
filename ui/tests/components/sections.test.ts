import { describe, expect, it } from 'vitest';
import {
  admittedRoots,
  foldableSections,
  isAdmitted,
  pageOf,
  sectionTree,
} from '../../src/client/core/sections.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, children: string[] = []): SemanticBlock => ({
  id,
  kind: 'section',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'user',
  ...(children.length > 0 ? { children } : {}),
});

/** page → section → (leaf, nested section → leaf), plus a second page. */
const build = (): ReturnType<typeof applyWorkspaceOps> =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    { op: 'block.add', block: block('p1', ['s1']) },
    { op: 'block.add', block: block('s1', ['leaf', 's2']) },
    { op: 'block.add', block: block('leaf') },
    { op: 'block.add', block: block('s2', ['deep']) },
    { op: 'block.add', block: block('deep') },
    { op: 'block.add', block: block('p2', ['other']) },
    { op: 'block.add', block: block('other') },
    { op: 'roots.set', roots: ['p1', 'p2'] },
  ] satisfies WorkspaceOp[]);

describe('present-anchored admission', () => {
  const at = (ref: string, createdAt: number, children: string[] = []): SemanticBlock => ({
    ...block(ref, children),
    createdAt,
  });

  const timed = () =>
    applyWorkspaceOps(emptyWorkspaceGraph(), [
      { op: 'block.add', block: at('t1', 100, ['old', 'new']) },
      { op: 'block.add', block: at('old', 150) },
      { op: 'block.add', block: at('new', 900) },
      { op: 'block.add', block: at('undated', 0) },
      { op: 'roots.set', roots: ['t1', 'undated'] },
    ] satisfies WorkspaceOp[]);

  it('judges a block by its event time against the cursor', () => {
    expect(isAdmitted(at('x', 150), undefined)).toBe(true);
    expect(isAdmitted(at('x', 150), 200)).toBe(true);
    expect(isAdmitted(at('x', 900), 200)).toBe(false);
  });

  it('admits everything at the live cursor', () => {
    const tree = sectionTree(timed());
    expect(admittedRoots(tree, undefined)).toHaveLength(2);
    expect(admittedRoots(tree, Number.POSITIVE_INFINITY)).toHaveLength(2);
  });

  it('drops a root admitted only after the cursor, but not an undated one', () => {
    const tree = sectionTree(timed());
    expect(admittedRoots(tree, 200).map((node) => node.ref)).toEqual(['t1', 'undated']);
  });
});

describe('sectionTree', () => {
  it('recurses containment to any depth', () => {
    const tree = sectionTree(build());
    expect(tree.order.map((node) => node.ref)).toEqual([
      'p1',
      's1',
      'leaf',
      's2',
      'deep',
      'p2',
      'other',
    ]);
    expect(tree.byRef.get('deep')?.depth).toBe(3);
    expect(tree.byRef.get('p1')?.depth).toBe(0);
  });

  it('records each node’s ancestors and its page', () => {
    const tree = sectionTree(build());
    expect(tree.byRef.get('deep')?.ancestors).toEqual(['p1', 's1', 's2']);
    expect(pageOf(tree, 'deep')).toBe('p1');
    expect(pageOf(tree, 'p1')).toBe('p1');
    expect(pageOf(tree, 'other')).toBe('p2');
    expect(pageOf(tree, 'missing')).toBeUndefined();
    expect(pageOf(tree, undefined)).toBeUndefined();
  });

  it('hides only the descendants of a folded section', () => {
    const tree = sectionTree(build(), new Set(['s1']));
    expect(tree.byRef.get('s1')?.folded).toBe(true);
    expect(tree.byRef.get('s1')?.hidden).toBe(false);
    expect(tree.order.map((node) => node.ref)).toHaveLength(7);
    expect(tree.visible.map((node) => node.ref)).toEqual(['p1', 's1', 'p2', 'other']);
  });

  it("hides a whole page's children when the page is folded", () => {
    const tree = sectionTree(build(), new Set(['p2']));
    expect(tree.visible.map((node) => node.ref)).toEqual(['p1', 's1', 'leaf', 's2', 'deep', 'p2']);
  });

  it('lists the sections a fold-all can collapse', () => {
    expect(foldableSections(sectionTree(build()))).toEqual(['p1', 's1', 's2', 'p2']);
  });

  it('keeps the first placement of a ref claimed twice instead of recursing forever', () => {
    const graph = applyWorkspaceOps(emptyWorkspaceGraph(), [
      { op: 'block.add', block: block('a', ['b']) },
      { op: 'block.add', block: block('b', ['a']) },
      { op: 'roots.set', roots: ['a'] },
    ] satisfies WorkspaceOp[]);
    expect(sectionTree(graph).order.map((node) => node.ref)).toEqual(['a', 'b']);
  });
});
