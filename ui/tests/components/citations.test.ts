import { describe, expect, it } from 'vitest';
import { collectSources, resolveSource, type Source } from '../../src/client/core/citations.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';

const citation = (id: string, data: Record<string, string>): SemanticBlock => ({
  id,
  kind: 'citation',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  text: data.key ?? data.label ?? '',
  data,
});

const graph = applyWorkspaceOps(emptyWorkspaceGraph(), [
  { op: 'block.add', block: citation('c1', { key: '1', href: 'https://a' }) },
  { op: 'block.add', block: citation('c2', { label: 'docs', href: 'https://b' }) },
  { op: 'block.add', block: citation('c3', { key: '2', href: 'https://c' }) },
  { op: 'block.add', block: citation('c4', { key: '1', href: 'https://dup' }) },
  { op: 'roots.set', roots: ['c1', 'c2', 'c3', 'c4'] },
] satisfies WorkspaceOp[]);

describe('citations model', () => {
  it('collects reference-style citations into a numbered bibliography', () => {
    expect(collectSources(graph)).toEqual([
      { key: '1', href: 'https://a', index: 1, label: undefined },
      { key: '2', href: 'https://c', index: 2, label: undefined },
    ] satisfies Source[]);
  });

  it('resolves bare and bracketed keys, and rejects unknowns', () => {
    const sources = collectSources(graph);
    expect(resolveSource('2', sources)?.href).toBe('https://c');
    expect(resolveSource('[1]', sources)?.href).toBe('https://a');
    expect(resolveSource('missing', sources)).toBeUndefined();
  });

  it('treats a plain link (no key) as a non-source', () => {
    expect(collectSources(graph).some((source) => source.href === 'https://b')).toBe(false);
  });
});
