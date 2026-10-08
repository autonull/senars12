import { describe, expect, it } from 'vitest';
import {
  applyWorkspaceOp,
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  linksTouching,
  type SemanticBlock,
  type SemanticLink,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'paragraph',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  ...over,
});

const link = (
  source: string,
  target: string,
  kind: SemanticLink['kind'] = 'references'
): SemanticLink => ({ id: `${source}->${target}`, source, target, kind, createdBy: 'lm' });

const fold = (...ops: WorkspaceOp[]) => applyWorkspaceOps(emptyWorkspaceGraph(), ops);

describe('workspace graph ops', () => {
  it('adds root blocks in order', () => {
    const graph = fold(
      { op: 'block.add', block: block('a') },
      { op: 'block.add', block: block('b') }
    );
    expect(graph.roots).toEqual(['a', 'b']);
  });

  it('inserts a block after an anchor and appends when the anchor is absent', () => {
    const graph = fold(
      { op: 'block.add', block: block('a') },
      { op: 'block.add', block: block('c') },
      { op: 'block.add', block: block('b'), after: 'a' },
      { op: 'block.add', block: block('d'), after: 'missing' }
    );
    expect(graph.roots).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the root position when re-adding an existing block', () => {
    const graph = fold(
      { op: 'block.add', block: block('a') },
      { op: 'block.add', block: block('b') },
      { op: 'block.add', block: block('a', { text: 'updated' }) }
    );
    expect(graph.roots).toEqual(['a', 'b']);
    expect(graph.blocks.get('a')?.text).toBe('updated');
  });

  it('patches an existing block and ignores an unknown id', () => {
    const graph = fold(
      { op: 'block.add', block: block('a') },
      { op: 'block.patch', id: 'a', patch: { status: 'streaming' } },
      { op: 'block.patch', id: 'zzz', patch: { status: 'error' } }
    );
    expect(graph.blocks.get('a')?.status).toBe('streaming');
    expect(graph.blocks.has('zzz')).toBe(false);
  });

  it('removes a block together with its links and root entry', () => {
    const graph = fold(
      { op: 'block.add', block: block('a') },
      { op: 'block.add', block: block('b') },
      { op: 'link.add', link: link('a', 'b') },
      { op: 'block.remove', id: 'b' }
    );
    expect(graph.blocks.has('b')).toBe(false);
    expect(graph.links.size).toBe(0);
    expect(graph.roots).toEqual(['a']);
  });

  it('adds and removes links, and replaces roots', () => {
    const withLink = fold(
      { op: 'block.add', block: block('a') },
      { op: 'block.add', block: block('b') },
      { op: 'link.add', link: link('a', 'b', 'derived-from') }
    );
    expect(linksTouching(withLink, 'a')).toHaveLength(1);
    const removed = applyWorkspaceOp(withLink, { op: 'link.remove', id: 'a->b' });
    expect(removed.links.size).toBe(0);
    const rerooted = applyWorkspaceOp(removed, { op: 'roots.set', roots: ['b', 'a'] });
    expect(rerooted.roots).toEqual(['b', 'a']);
  });

  it('carries session state through event-sourced ops', () => {
    const graph = emptyWorkspaceGraph();
    graph.focus = 'a';
    graph.selection = new Set(['a']);
    const next = applyWorkspaceOp(graph, { op: 'block.add', block: block('a') });
    expect(next.focus).toBe('a');
    expect([...next.selection]).toEqual(['a']);
  });
});
