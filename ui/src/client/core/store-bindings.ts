import type { Core } from 'cytoscape';
import type {
  ChatMessage,
  GraphNodeData,
  GraphOp,
  IncomingFromServer,
} from '@senars/core';
import { edgeKey, extractTerm, generateId } from '../../shared/utils.js';
import type { CognitiveMetricsData, RevisionEntry } from './store.js';
import {
  $activeLens,
  $chatMessages,
  $cognitiveMetrics,
  $config,
  $graphEdges,
  $graphMeta,
  $graphNodes,
  $lastSeqId,
  $lensFields,
  $lensRegistry,
  $nodeHistory,
  $streamingDelta,
  $telemetry,
  $workingMemory,
  registerLens,
} from './store.js';

const TELEMETRY_WINDOW = 300;

function renderMessageHtml(msg: ChatMessage): string {
  const roleClass = `msg-${msg.role}`;
  const content = msg.html ?? msg.content;
  return `<div class="graph-message ${roleClass}" data-id="${msg.id}">${content}</div>`;
}

/** Adds a user chat message to the store and triggers graph update. */
export function addUserMessage(content: string): void {
  const chat: ChatMessage = {
    id: generateId('user'),
    role: 'user',
    content,
    html: renderMessageHtml({
      id: '',
      role: 'user',
      content,
      timestamp: Date.now(),
      parentId: null,
      threadRootId: '',
      supports: [],
      contradicts: [],
      derivesFrom: [],
    }),
    timestamp: Date.now(),
    term: extractTerm(content),
    parentId: null,
    threadRootId: generateId('thread'),
    supports: [],
    contradicts: [],
    derivesFrom: [],
  };
  $chatMessages.set([...$chatMessages.get(), chat]);
}

/** Applies an incoming server message to the client state and optionally updates the graph. */
export function applyServerMessage(msg: IncomingFromServer, cy?: Core): void {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;

    case 'chat.agent.complete': {
      const id = msg.messageId ?? generateId('agent');
      const html =
        msg.html ??
        renderMessageHtml({
          id,
          role: 'agent',
          content: msg.content,
          timestamp: Date.now(),
          parentId: null,
          threadRootId: id,
          supports: [],
          contradicts: [],
          derivesFrom: [],
        });
      const chatMsg: ChatMessage = {
        id,
        role: 'agent',
        content: msg.content,
        html,
        timestamp: Date.now(),
        term: extractTerm(msg.content),
        parentId: null,
        threadRootId: id,
        supports: [],
        contradicts: [],
        derivesFrom: [],
      };
      $chatMessages.set([...$chatMessages.get(), chatMsg]);

      if (cy) {
        cy.add({
          group: 'nodes',
          data: {
            id,
            label: msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : ''),
            html: chatMsg.html,
            term: extractTerm(msg.content),
            priority: 0.8,
            confidence: 1.0,
            nodeType: 'message',
            layout: { threadIndex: $chatMessages.get().length },
          },
          classes: 'chat-message-node',
        });
      }
      $streamingDelta.set('');
      break;
    }

    case 'cognitive.delta':
      applyGraphOps(msg.ops, cy);
      $lastSeqId.set(msg.seqId);
      if (msg.lens) $activeLens.set(msg.lens);
      if (msg.meta)
        $graphMeta.set({
          truncated: msg.meta.truncated ?? false,
          totalHidden: msg.meta.totalHidden ?? 0,
        });
      break;

    case 'config.schema':
      $config.set(msg.data);
      if (cy) addConfigMetaNode(cy, msg.data);
      break;

    case 'state.snapshot':
      $lastSeqId.set(msg.seqId);
      applyFullSnapshot(msg.data, cy);
      break;

    case 'telemetry':
      appendTelemetry(msg);
      break;

    case 'lens.list':
      for (const spec of msg.lenses) {
        registerLens(spec);
      }
      break;

    case 'lens.defined':
      registerLens(msg.lens);
      break;

    case 'lens.fields':
      $lensFields.set(msg.fields);
      break;

    case 'node.history':
      $nodeHistory.set(msg.history);
      break;
  }
}

function applyFullSnapshot(
  data: {
    graph: { nodes: GraphNodeData[]; edges: Record<string, any>[] };
    workingMemory: (string | { id: string })[];
    config: Record<string, any>;
  },
  cy?: Core
): void {
  const nodes = new Map<string, GraphNodeData>(
    data.graph.nodes.map((n) => [n.id ?? crypto.randomUUID(), n] as [string, GraphNodeData])
  );
  const edges = new Map<string, Record<string, any>>(
    data.graph.edges.map((e) => [edgeKey(e.source, e.target), e])
  );
  $graphNodes.set(nodes);
  $graphEdges.set(edges);
  $config.set(data.config);
  $workingMemory.set(
    data.workingMemory?.map((item) => (typeof item === 'object' ? item.id : String(item))) ?? []
  );
}

function applyGraphOps(ops: GraphOp[], cy?: Core): void {
  const nodes = new Map($graphNodes.get());
  const edges = new Map($graphEdges.get());
  for (const op of ops) {
    switch (op.action) {
      case 'add_node':
        nodes.set(op.id, op.data);
        if (cy) cy.add({ group: 'nodes', data: op.data });
        break;
      case 'update_node': {
        const existing = nodes.get(op.id);
        if (existing) {
          const updated = { ...existing, ...op.data } as GraphNodeData;
          nodes.set(op.id, updated);
        }
        if (cy) {
          const node = cy.getElementById(op.id);
          if (node.length) node.data({ ...node.data(), ...op.data });
        }
        break;
      }
      case 'remove_node':
        nodes.delete(op.id);
        if (cy) cy.getElementById(op.id).remove();
        break;
      case 'add_edge': {
        const edgeData = { ...op.data, source: op.source, target: op.target };
        edges.set(edgeKey(op.source, op.target), edgeData);
        if (cy) cy.add({ group: 'edges', data: edgeData });
        break;
      }
      case 'remove_edge':
        edges.delete(edgeKey(op.source, op.target));
        if (cy) cy.edges(`[source="${op.source}"][target="${op.target}"]`).remove();
        break;
    }
  }
  $graphNodes.set(nodes);
  $graphEdges.set(edges);
}

function pushWindow(arr: number[], v: number): number[] {
  if (arr.length >= TELEMETRY_WINDOW) {
    arr.shift();
  }
  arr.push(v);
  return arr;
}

function appendTelemetry(msg: {
  metrics: {
    reasoning_hz: number;
    tokens_per_sec: number;
    memory_mb: number;
    ws_latency_ms: number;
  };
  cognitive?: CognitiveMetricsData;
}): void {
  const t = $telemetry.get();
  $telemetry.set({
    reasoning_hz: pushWindow(t.reasoning_hz, msg.metrics.reasoning_hz),
    tokens_per_sec: pushWindow(t.tokens_per_sec, msg.metrics.tokens_per_sec),
    memory_mb: pushWindow(t.memory_mb, msg.metrics.memory_mb),
    ws_latency_ms: pushWindow(t.ws_latency_ms, msg.metrics.ws_latency_ms),
  });
  if (msg.cognitive) $cognitiveMetrics.set(msg.cognitive);
}

function addConfigMetaNode(cy: Core, config: Record<string, any>): void {
  const nodeData: GraphNodeData = {
    id: 'meta:config',
    label: '⚙ Config',
    html: '<div class="graph-message msg-system">Configuration</div>',
    nodeType: 'nar:concept',
    priority: 1.0,
    confidence: 1.0,
    layout: { x: 500, y: -500 },
  };
  const nodes = new Map($graphNodes.get());
  nodes.set('meta:config', nodeData);
  $graphNodes.set(nodes);
  cy.add({ group: 'nodes', data: nodeData, classes: 'chat-message-node' });
}
