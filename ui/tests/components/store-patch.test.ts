import type { GraphNodeData } from '@senars/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  $graphEdges,
  $graphNodes,
  updateEdgeData,
  updateNodeData,
} from '../../src/client/core/store.js';

const node = (partial: Partial<GraphNodeData>): GraphNodeData => partial as GraphNodeData;

afterEach(() => {
  $graphNodes.set(new Map());
  $graphEdges.set(new Map());
});

describe('graph store patches', () => {
  it('patches a node in place — same map identity, entry replaced, subscriber told', () => {
    $graphNodes.set(new Map([['n1', node({ id: 'n1', term: 'bird' })]]));
    const before = $graphNodes.get();
    const original = before.get('n1');
    let notified = 0;
    const unsubscribe = $graphNodes.subscribe(() => {
      notified += 1;
    });

    const updated = updateNodeData('n1', { term: 'eagle' });
    unsubscribe();

    expect($graphNodes.get()).toBe(before);
    expect(updated).not.toBe(original);
    expect(updated?.term).toBe('eagle');
    expect(original?.term).toBe('bird');
    expect(notified).toBe(1);
  });

  it('misses without cloning or notifying', () => {
    const before = $graphNodes.get();
    let notified = 0;
    const unsubscribe = $graphNodes.subscribe(() => {
      notified += 1;
    });

    expect(updateNodeData('missing', { term: 'x' })).toBeUndefined();
    unsubscribe();

    expect($graphNodes.get()).toBe(before);
    expect(notified).toBe(0);
  });

  it('patches an edge in place without cloning the whole map', () => {
    $graphEdges.set(new Map([['e1', { weight: 1 }]]));
    const before = $graphEdges.get();

    const updated = updateEdgeData('e1', { weight: 2 });

    expect($graphEdges.get()).toBe(before);
    expect($graphEdges.get().get('e1')).toBe(updated);
    expect(updated?.weight).toBe(2);
  });
});
