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
});
