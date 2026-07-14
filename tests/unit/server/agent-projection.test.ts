import { Agent } from '@senars/core';
import type { GraphDelta } from '@senars/core';
import { NarBackend, SeNARSFactory } from '@senars/nar';
import { createAgent } from '@senars/nar/agent';
import { DEFAULT_NAR_CONFIG } from '@senars/nar';
import { UnifiedGraphProjection } from '@senars/ui/server/UnifiedGraphProjection';
import type { IncomingFromServer } from '@senars/ui/shared/protocol';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Agent + NarBackend + UnifiedGraphProjection pipeline', () => {
  let agent: Agent;
  let projection: UnifiedGraphProjection;
  const sent: IncomingFromServer[] = [];

  beforeAll(async () => {
    const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
    const oldAgent = createAgent({ nar });
    const narBackend = new NarBackend(oldAgent);

    agent = new Agent({ name: 'projection-test' });
    await agent.registerBackend(narBackend, {});

    projection = new UnifiedGraphProjection();
    projection.mount((msg) => sent.push(msg));

    // Wire graph delta from Agent → projection
    agent.setGraphDeltaHandler((delta: GraphDelta) => {
      projection.applyDelta(delta);
    });

    agent.start();
  });

  it('submitting a belief produces graph nodes for parsed concepts', async () => {
    const before = sent.length;
    agent.submit('<bird --> animal>.', 'test-1');
    // Give the event loop time to process
    await new Promise((r) => setTimeout(r, 50));

    const deltas = sent.slice(before).filter((m) => m.type === 'cognitive.delta');
    expect(deltas.length).toBeGreaterThan(0);

    const nodeIds = new Set<string>();
    for (const d of deltas) {
      if (d.type === 'cognitive.delta') {
        for (const op of d.ops) {
          if (op.action === 'add_node') nodeIds.add(op.id);
        }
      }
    }

    expect(nodeIds.has('bird')).toBe(true);
    expect(nodeIds.has('animal')).toBe(true);
  });

  it('submitting a second belief grows the graph', async () => {
    const before = sent.length;
    agent.submit('<robin --> bird>.', 'test-2');
    await new Promise((r) => setTimeout(r, 50));

    const deltas = sent.slice(before).filter((m) => m.type === 'cognitive.delta');
    expect(deltas.length).toBeGreaterThan(0);

    const nodeIds = new Set<string>();
    for (const d of deltas) {
      if (d.type === 'cognitive.delta') {
        for (const op of d.ops) {
          if (op.action === 'add_node') nodeIds.add(op.id);
        }
      }
    }

    expect(nodeIds.has('robin')).toBe(true);
  });

  it('submitting a belief creates inheritance edges in the graph', async () => {
    const before = sent.length;
    agent.submit('<cat --> mammal>.', 'test-3');
    await new Promise((r) => setTimeout(r, 50));

    const deltas = sent.slice(before).filter((m) => m.type === 'cognitive.delta');
    const edges: Array<{ source: string; target: string; type: string }> = [];
    for (const d of deltas) {
      if (d.type === 'cognitive.delta') {
        for (const op of d.ops) {
          if (op.action === 'add_edge') {
            edges.push({ source: op.source, target: op.target, type: op.data.type });
          }
        }
      }
    }

    expect(edges.some((e) => e.source === 'cat' && e.target === 'mammal' && e.type === 'inheritance')).toBe(true);
  });

  it('projection sendInitialState emits lens.fields, lens.list, cognitive.delta', () => {
    const before = sent.length;
    projection.sendInitialState();

    const newMessages = sent.slice(before);
    const types = new Set(newMessages.map((m) => m.type));
    expect(types.has('lens.fields')).toBe(true);
    expect(types.has('lens.list')).toBe(true);
    expect(types.has('cognitive.delta')).toBe(true);
  });

  it('projection setLens re-emits delta with chosen lens', () => {
    const before = sent.length;
    projection.setLens('contradiction');

    const newMessages = sent.slice(before);
    const delta = newMessages.find((m) => m.type === 'cognitive.delta');
    expect(delta).toBeDefined();
    if (delta && delta.type === 'cognitive.delta') {
      expect(delta.lens).toBe('contradiction');
    }
  });

  it('projection setFocus restricts graph to focused term', () => {
    const before = sent.length;
    projection.setFocus('bird');

    const delta = sent.slice(before).find((m) => m.type === 'cognitive.delta');
    expect(delta).toBeDefined();
    if (delta && delta.type === 'cognitive.delta') {
      const ids = delta.ops.filter((op) => op.action === 'add_node').map((op) => op.id);
      expect(ids.includes('bird')).toBe(true);
    }
  });
});
