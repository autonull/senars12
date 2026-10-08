import { describe, expect, it } from 'vitest';
import { blockLabel } from '../../src/client/core/block-labels.js';
import {
  blockOrder,
  breadcrumb,
  navigationForKey,
  rootOf,
  stepBlock,
  stepPage,
} from '../../src/client/core/navigation.js';
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
    { op: 'block.add', block: block('t1', { children: ['h1', 's1'], text: undefined }) },
    { op: 'block.add', block: block('h1', { kind: 'heading', text: 'Heading', level: 1 }) },
    { op: 'block.add', block: block('s1', { kind: 'section', children: ['p1'] }) },
    { op: 'block.add', block: block('p1', { kind: 'paragraph', text: 'prose' }) },
    { op: 'block.add', block: block('t2', { children: ['c1'], text: undefined }) },
    { op: 'block.add', block: block('c1', { kind: 'claim', text: 'claim text' }) },
    { op: 'roots.set', roots: ['t1', 't2'] },
  ] satisfies WorkspaceOp[]);

describe('navigation projections', () => {
  it('orders blocks depth-first in document order', () => {
    expect(blockOrder(build())).toEqual(['t1', 'h1', 's1', 'p1', 't2', 'c1']);
  });

  it('steps blocks and clamps at the ends', () => {
    const graph = build();
    expect(stepBlock(graph, 'h1', 1)).toBe('s1');
    expect(stepBlock(graph, 'h1', -1)).toBe('t1');
    expect(stepBlock(graph, undefined, 1)).toBe('t1');
    expect(stepBlock(graph, undefined, -1)).toBe('c1');
    expect(stepBlock(graph, 't1', -1)).toBe('t1');
    expect(stepBlock(graph, 'c1', 1)).toBe('c1');
  });

  it('never steps onto a block a folded section hides', () => {
    const graph = build();
    expect(stepBlock(graph, 's1', 1, new Set(['s1']))).toBe('t2');
    expect(navigationForKey(graph, 'j', 's1', new Set(['s1']))).toBe('t2');
    // A folded container stays walkable: it is still a block on screen.
    expect(stepBlock(graph, 't1', 1, new Set(['t1']))).toBe('t2');
    expect(stepBlock(graph, 't1', 1)).toBe('h1');
  });

  it('resolves the containing page and steps pages', () => {
    const graph = build();
    expect(rootOf(graph, 'p1')).toBe('t1');
    expect(rootOf(graph, 't2')).toBe('t2');
    expect(rootOf(graph, 'missing')).toBeUndefined();
    expect(stepPage(graph, 'h1', 1)).toBe('t2');
    expect(stepPage(graph, 'c1', -1)).toBe('t1');
    expect(stepPage(graph, undefined, 1)).toBe('t1');
  });

  it('builds the page-to-block breadcrumb through nested sections', () => {
    const crumbs = breadcrumb(build(), 'p1');
    expect(crumbs.map((crumb) => crumb.ref)).toEqual(['t1', 's1', 'p1']);
    expect(crumbs[2]?.label).toBe('prose');
    expect(breadcrumb(build(), undefined)).toEqual([]);
  });

  it('maps navigation keys and ignores others', () => {
    const graph = build();
    expect(navigationForKey(graph, 'j', 'h1')).toBe('s1');
    expect(navigationForKey(graph, 'k', 'h1')).toBe('t1');
    expect(navigationForKey(graph, ']', 'h1')).toBe('t2');
    expect(navigationForKey(graph, '[', 'c1')).toBe('t1');
    expect(navigationForKey(graph, 'x', 'h1')).toBeUndefined();
  });
});

describe('blockLabel', () => {
  it('prefers heading text, then title, then the first line, then the kind', () => {
    expect(blockLabel(block('h', { kind: 'heading', text: 'Title' }))).toBe('Title');
    expect(blockLabel(block('c', { kind: 'claim', title: 'T', text: 'body' }))).toBe('T');
    expect(blockLabel(block('c', { kind: 'claim', text: 'first\nsecond' }))).toBe('first');
    expect(blockLabel(block('c', { kind: 'claim', text: '' }))).toBe('Claim');
  });
});
