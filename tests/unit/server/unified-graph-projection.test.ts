import type { GraphNodeData } from '@senars/core';
import type { IncomingFromServer } from '@senars/core/protocol';
import { type GraphDelta, UnifiedGraphProjection } from '@senars/ui/server/UnifiedGraphProjection';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('UnifiedGraphProjection', () => {
  let projection: UnifiedGraphProjection;
  let sent: IncomingFromServer[];

  beforeEach(() => {
    sent = [];
    projection = new UnifiedGraphProjection();
    projection.mount((msg) => sent.push(msg));
  });

  afterEach(() => {
    projection.unmount();
  });

  function makeNode(id: string, caps?: string[]): GraphNodeData {
    return {
      id,
      nodeType: 'nar:concept',
      term: id,
      priority: 0.7,
      confidence: 0.9,
      capabilities: caps,
    } as GraphNodeData;
  }

  function makeDelta(nodes: GraphNodeData[]): GraphDelta {
    return {
      nodes,
      edges: [],
    };
  }

  it('applies node deltas from any backend', () => {
    projection.applyDelta(makeDelta([makeNode('bird'), makeNode('animal')]));
    expect(sent.length).toBeGreaterThan(0);
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    expect(delta).toBeDefined();
    if (delta?.type === 'cognitive.delta') {
      const ids = delta.ops.filter((o) => o.action === 'add_node').map((o) => o.id);
      expect(ids.includes('bird')).toBe(true);
      expect(ids.includes('animal')).toBe(true);
    }
  });

  it('sends lens.list on sendInitialState', () => {
    projection.sendInitialState();
    const types = new Set(sent.map((m) => m.type));
    expect(types.has('lens.fields')).toBe(true);
    expect(types.has('lens.list')).toBe(true);
    expect(types.has('cognitive.delta')).toBe(true);
  });

  it('setLens re-emits delta with lens tag', () => {
    projection.applyDelta(makeDelta([makeNode('bird')]));
    sent.length = 0;
    projection.setLens('contradiction');
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    expect(delta).toBeDefined();
    if (delta?.type === 'cognitive.delta') {
      expect(delta.lens).toBe('contradiction');
    }
  });

  it('setFocus filters nodes', () => {
    projection.applyDelta(makeDelta([makeNode('bird'), makeNode('cat')]));
    sent.length = 0;
    projection.setFocus('bird');
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    expect(delta).toBeDefined();
    if (delta?.type === 'cognitive.delta') {
      const ids = delta.ops.filter((o) => o.action === 'add_node').map((o) => o.id);
      expect(ids.includes('bird')).toBe(true);
    }
  });

  it('assigns a monotonic seqId, never a wall clock', () => {
    projection.applyDelta(makeDelta([makeNode('bird')]));
    projection.applyDelta(makeDelta([makeNode('cat')]));
    const seqs = sent
      .filter((m) => m.type === 'cognitive.delta')
      .map((m) => (m as { seqId: number }).seqId);
    expect(seqs).toEqual([1, 2]);
  });

  it('emits update_node when a known term is revised', () => {
    projection.applyDelta(makeDelta([makeNode('bird')]));
    sent.length = 0;
    projection.applyDelta(makeDelta([makeNode('bird')]));
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    if (delta?.type === 'cognitive.delta') {
      expect(delta.ops.some((o) => o.action === 'update_node')).toBe(true);
    }
  });

  it('applyObjectPatch updates a node in place', () => {
    projection.applyDelta(makeDelta([makeNode('bird')]));
    sent.length = 0;
    projection.applyObjectPatch('node', 'bird', { priority: 0.42 });
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    if (delta?.type === 'cognitive.delta') {
      const op = delta.ops.find((o) => o.action === 'update_node');
      expect(op?.action === 'update_node' && op.data.priority).toBe(0.42);
    }
  });

  it('removeNode drops the node and its incident edges', () => {
    projection.applyDelta({
      nodes: [makeNode('bird'), makeNode('animal')],
      edges: [{ source: 'bird', target: 'animal', type: 'inheritance' }],
    });
    sent.length = 0;
    projection.removeNode('bird');
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    if (delta?.type === 'cognitive.delta') {
      expect(delta.ops.some((o) => o.action === 'remove_node' && o.id === 'bird')).toBe(true);
      expect(delta.ops.some((o) => o.action === 'remove_edge')).toBe(true);
    }
    expect(projection.node('bird')).toBeUndefined();
  });

  it('markContradiction flags known terms', () => {
    projection.applyDelta(makeDelta([makeNode('bird')]));
    sent.length = 0;
    projection.markContradiction('bird');
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    if (delta?.type === 'cognitive.delta') {
      const op = delta.ops.find((o) => o.action === 'update_node');
      expect(op?.action === 'update_node' && op.data.isContradiction).toBe(true);
    }
  });

  it('drops edges whose endpoints are not known nodes', () => {
    projection.applyDelta({
      nodes: [makeNode('(robin-->bird)'), makeNode('(robin-->animal)')],
      edges: [
        { source: 'robin', target: 'animal', type: 'inheritance' },
        { source: '(robin-->bird)', target: '(robin-->animal)', type: 'derivation' },
      ],
    });
    const delta = sent.find((m) => m.type === 'cognitive.delta');
    if (delta?.type === 'cognitive.delta') {
      const edges = delta.ops.filter((o) => o.action === 'add_edge');
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({ source: '(robin-->bird)', target: '(robin-->animal)' });
    }
  });

  it('reset clears nodes/edges/lens and rewinds the seq counter', () => {
    projection.applyDelta(makeDelta([makeNode('bird'), makeNode('animal')]));
    projection.setLens('goal');
    projection.setFocus('bird');
    expect(projection.seq).toBeGreaterThan(0);

    projection.reset();

    expect(projection.seq).toBe(0);
    expect(projection.lens).toBe('belief');
    expect(projection.graphSnapshot()).toEqual({ nodes: [], edges: [] });

    projection.applyDelta(makeDelta([makeNode('robin')]));
    expect(projection.seq).toBe(1);
  });
});
