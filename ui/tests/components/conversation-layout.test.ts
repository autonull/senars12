import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_LAYOUT_IDS,
  type ConversationLayoutId,
  type ConversationPositions,
  conversationPositions,
} from '../../src/client/core/conversation-layout.js';
import {
  applyWorkspaceOps,
  emptyWorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
  type WorkspaceOp,
} from '../../src/client/core/workspace-graph.js';
import { layoutRegistry } from '../../src/client/utils/layout-registry.js';

const block = (id: string, over: Partial<SemanticBlock> = {}): SemanticBlock => ({
  id,
  kind: 'claim',
  role: 'assistant',
  createdAt: 0,
  createdBy: 'lm',
  ...over,
});

const link = (
  id: string,
  source: string,
  target: string,
  kind: SemanticLink['kind']
): SemanticLink => ({
  id,
  source,
  target,
  kind,
  createdBy: 'lm',
});

const build = () =>
  applyWorkspaceOps(emptyWorkspaceGraph(), [
    {
      op: 'block.add',
      block: block('u1', { kind: 'turn', role: 'user', createdBy: 'user', children: ['c1', 'c2'] }),
    },
    { op: 'block.add', block: block('c1', { text: 'alpha' }) },
    { op: 'block.add', block: block('c2', { text: 'beta' }) },
    { op: 'block.add', block: block('t1', { kind: 'table' }) },
    { op: 'block.add', block: block('g1', { text: 'gamma' }) },
    { op: 'link.add', link: link('s1', 'c1', 'g1', 'same-topic') },
    { op: 'roots.set', roots: ['u1', 't1', 'g1'] },
  ] satisfies WorkspaceOp[]);

const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const at = (positions: ConversationPositions, id: string): { x: number; y: number } => {
  const point = positions.get(id);
  if (!point) throw new Error(`no position for ${id}`);
  return point;
};

describe('conversation layouts', () => {
  const graph = build();

  it('positions every block under every layout, deterministically', () => {
    for (const id of CONVERSATION_LAYOUT_IDS) {
      const positions = conversationPositions(graph, id);
      expect(positions.size).toBe(graph.blocks.size);
      expect(positions).toEqual(conversationPositions(graph, id));
    }
  });

  it('chronological-flow follows document order', () => {
    const positions = conversationPositions(graph, 'chronological-flow');
    const order = ['u1', 'c1', 'c2', 't1', 'g1'];
    const ys = order.map((id) => at(positions, id).y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('semantic-map keeps same-topic claims closer than unrelated blocks', () => {
    const positions = conversationPositions(graph, 'semantic-map');
    const c1 = at(positions, 'c1');
    const g1 = at(positions, 'g1');
    const c2 = at(positions, 'c2');
    expect(manhattan(c1, g1)).toBeLessThan(manhattan(g1, c2));
  });

  it('artifact-map centres typed outputs', () => {
    const positions = conversationPositions(graph, 'artifact-map');
    expect(at(positions, 't1')).toEqual({ x: 0, y: 0 });
    expect(manhattan(at(positions, 'c1'), { x: 0, y: 0 })).toBeGreaterThan(0);
  });

  it('source-view separates blocks into one lane per source', () => {
    const positions = conversationPositions(graph, 'source-view');
    const { x: userX } = at(positions, 'u1');
    const { x: lmX } = at(positions, 'c1');
    expect(at(positions, 'c2').x).toBe(lmX);
    expect(at(positions, 't1').x).toBe(lmX);
    expect(manhattan({ x: userX, y: 0 }, { x: lmX, y: 0 })).toBeGreaterThan(0);
  });
});

describe('conversation layout registry rows', () => {
  it('registers every conversation layout under the conversation scope', () => {
    for (const id of CONVERSATION_LAYOUT_IDS) {
      expect(layoutRegistry.get(id)?.scope).toBe('conversation');
    }
    expect(layoutRegistry.layoutsFor('conversation').map((layout) => layout.id)).toEqual([
      ...CONVERSATION_LAYOUT_IDS,
    ]);
  });

  it('keeps concept and conversation scopes disjoint', () => {
    const conversation = new Set<ConversationLayoutId>(CONVERSATION_LAYOUT_IDS);
    for (const layout of layoutRegistry.layoutsFor('concept')) {
      expect(conversation.has(layout.id as ConversationLayoutId)).toBe(false);
    }
  });
});
