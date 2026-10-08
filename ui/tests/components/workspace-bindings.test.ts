import type { ChatMessage, GraphNodeData } from '@senars/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  $chatMessages,
  $graphEdges,
  $graphNodes,
  $workspaceGraph,
} from '../../src/client/core/store.js';
import { mountWorkspaceProjection } from '../../src/client/core/workspace-bindings.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';
import { claimId, turnId } from '../../src/client/core/workspace-projection.js';

const message = (
  over: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role'>
): ChatMessage => ({
  content: '',
  timestamp: 0,
  parentId: null,
  threadRootId: '',
  supports: [],
  contradicts: [],
  derivesFrom: [],
  ...over,
});

const node = (id: string): GraphNodeData => ({ id, label: id, term: id, nodeType: 'nar:concept' });

describe('workspace projection binding', () => {
  beforeEach(() => {
    $chatMessages.set([]);
    $graphNodes.set(new Map());
    $graphEdges.set(new Map());
    $workspaceGraph.set(emptyWorkspaceGraph());
  });

  afterEach(() => {
    $chatMessages.set([]);
    $graphNodes.set(new Map());
    $graphEdges.set(new Map());
    $workspaceGraph.set(emptyWorkspaceGraph());
  });

  it('projects current state on mount and on every change', () => {
    const unmount = mountWorkspaceProjection();
    $chatMessages.set([message({ id: 'u1', role: 'user', content: 'hi' })]);
    expect($workspaceGraph.get().roots).toContain(turnId('u1'));
    $graphNodes.set(new Map([['bird', node('bird')]]));
    expect($workspaceGraph.get().roots).toContain(claimId('bird'));
    unmount();
  });

  it('preserves session state across re-projections', () => {
    const unmount = mountWorkspaceProjection();
    const graph = $workspaceGraph.get();
    graph.focus = turnId('u9');
    graph.selection = new Set([claimId('x')]);
    graph.timeCursor = 42;
    $workspaceGraph.set(graph);

    $chatMessages.set([message({ id: 'u1', role: 'user' })]);

    const next = $workspaceGraph.get();
    expect(next.focus).toBe(turnId('u9'));
    expect([...next.selection]).toEqual([claimId('x')]);
    expect(next.timeCursor).toBe(42);
    unmount();
  });

  it('stops updating after unsubscribe', () => {
    const unmount = mountWorkspaceProjection();
    unmount();
    $chatMessages.set([message({ id: 'u1', role: 'user' })]);
    expect($workspaceGraph.get().roots).toEqual([]);
  });
});
