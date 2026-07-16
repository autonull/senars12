import type { GraphNodeData, IncomingFromServer } from '@senars/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  $graphEdges,
  $graphNodes,
  $nodeHistory,
} from '../../ui/src/client/core/store.js';
import { applyServerMessage } from '../../ui/src/client/core/store-bindings.js';

function node(id: string, term: string): { action: 'add_node'; id: string; data: GraphNodeData } {
  return {
    action: 'add_node',
    id,
    data: { id, nodeType: 'nar:concept', term, priority: 0.7, confidence: 0.9 },
  };
}

function edge(source: string, target: string) {
  return { action: 'add_edge' as const, source, target, data: { weight: 0.6, type: 'inheritance', directed: true } };
}

const TRANSCRIPT: IncomingFromServer[] = [
  { type: 'config.schema', data: {} },
  {
    type: 'cognitive.delta',
    seqId: 1,
    lens: 'belief',
    ops: [
      node('sky', 'sky'),
      node('blue', 'blue'),
      node('bird', 'bird'),
      node('animal', 'animal'),
      node('robin', 'robin'),
      edge('bird', 'animal'),
      edge('sky', 'blue'),
      edge('robin', 'bird'),
    ],
  },
  { type: 'lens.fields', fields: [] },
  {
    type: 'node.history',
    term: '<bird --> animal>',
    history: [
      { truth: { frequency: 1, confidence: 0.9 }, stampId: 's1', timestamp: 100, source: 'input' },
      {
        truth: { frequency: 0.6, confidence: 0.85 },
        stampId: 's2',
        timestamp: 200,
        source: 'revision',
      },
    ],
  },
];

describe('Pillar 3 (client): shared store consumes the live transcript', () => {
  beforeEach(() => {
    for (const msg of TRANSCRIPT) applyServerMessage(msg);
  });

  it('populates the graph node model from cognitive.delta', () => {
    const nodes = $graphNodes.get();
    for (const term of ['sky', 'blue', 'bird', 'animal', 'robin']) {
      expect(nodes.has(term), `expected node ${term}`).toBe(true);
    }
  });

  it('populates the graph edge model from cognitive.delta', () => {
    const edges = $graphEdges.get();
    const keys = new Set(edges.keys());
    expect(keys.has('bird->animal')).toBe(true);
    expect(keys.has('sky->blue')).toBe(true);
    expect(keys.has('robin->bird')).toBe(true);
  });

  it('populates the node history from node.history (drawer scrubber source)', () => {
    const history = $nodeHistory.get();
    expect(history.length).toBe(2);
    expect(history[1]?.source).toBe('revision');
    expect(history[1]?.truth.frequency).toBeCloseTo(0.6, 5);
  });

  it('delta ops are cumulative across messages (live growth)', () => {
    applyServerMessage({
      type: 'cognitive.delta',
      seqId: 2,
      lens: 'belief',
      ops: [node('cat', 'cat'), node('mammal', 'mammal'), edge('cat', 'mammal')],
    });
    expect($graphNodes.get().has('cat')).toBe(true);
    expect($graphNodes.get().has('mammal')).toBe(true);
    expect($graphEdges.get().has('cat->mammal')).toBe(true);
  });
});
