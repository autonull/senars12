import { describe, expect, it } from 'vitest';
import { derivationsFor } from '../../src/client/core/workspace-projection.js';
import type {
  SemanticBlock,
  SemanticLink,
  WorkspaceGraph,
} from '../../src/client/core/workspace-graph.js';

const block = (id: string, kind: SemanticBlock['kind']): SemanticBlock => ({
  id,
  kind,
  role: 'reasoner',
  createdAt: 0,
  createdBy: 'reasoner',
});

const link = (source: string, target: string, kind: SemanticLink['kind']): SemanticLink => ({
  id: `${source}->${target}:${kind}`,
  source,
  target,
  kind,
  createdBy: 'reasoner',
});

const graph = (blocks: SemanticBlock[], links: SemanticLink[]): WorkspaceGraph => ({
  blocks: new Map(blocks.map((b) => [b.id, b])),
  links: new Map(links.map((l) => [l.id, l])),
  roots: [],
  selection: new Set(),
});

describe('one-click "why" lookup', () => {
  it('finds the derivation-record a claim is derived from', () => {
    const g = graph(
      [block('claim:bird', 'claim'), block('derivation-record:d1', 'derivation-record')],
      [link('claim:bird', 'derivation-record:d1', 'derived-from')]
    );
    expect(derivationsFor(g, 'claim:bird')).toEqual(['derivation-record:d1']);
  });

  it('returns nothing when the engine recorded no derivation (affordance hides)', () => {
    expect(derivationsFor(graph([block('claim:ghost', 'claim')], []), 'claim:ghost')).toEqual([]);
  });

  it('ignores a derived-from link to a block that is not a record', () => {
    const g = graph(
      [block('claim:a', 'claim'), block('claim:b', 'claim')],
      [link('claim:a', 'claim:b', 'derived-from')]
    );
    expect(derivationsFor(g, 'claim:a')).toEqual([]);
  });

  it('ignores a non-derivation link to a record', () => {
    const g = graph(
      [block('claim:a', 'claim'), block('derivation-record:d1', 'derivation-record')],
      [link('claim:a', 'derivation-record:d1', 'supports')]
    );
    expect(derivationsFor(g, 'claim:a')).toEqual([]);
  });
});
