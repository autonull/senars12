import { decayAttentionField } from '../framework/attention-runtime.js';
import type { ChatMessage, CognitiveEvent, GraphNodeData, GraphOp, IncomingFromServer } from '@senars/core';
import { generateId, makeId, truncate } from '@senars/util';
import type { Core } from 'cytoscape';
import { edgeKey, extractTerm } from '../../shared/index.js';
import { dispatchCommand } from './commands.js';
import { settleControl } from './control-channel.js';
import { applyLmStatus } from './lm-provider.js';
import type { CognitiveMetricsData } from './store.js';
import {
  $activeLens,
  $chatMessages,
  $cognitiveEvents,
  $cognitiveMetrics,
  $config,
  $cycleCount,
  $cycleState,
  $graphEdges,
  $graphMeta,
  $graphNodes,
  $lastSeqId,
  $lensFields,
  $nodeHistory,
  $reasoningRunning,
  $streamingDelta,
  $telemetry,
  $workingMemory,
  pushCognitiveEvents,
  pushServerError,
  registerLens,
  type UiConfig,
} from './store.js';
import { UiConfigSchema, DEFAULT_UI_CONFIG } from './config-schema.js';

const TELEMETRY_WINDOW = 300;

/** Convert legacy server config format (Record<string, ConfigFieldType>) to UiConfig. */
function convertLegacyConfig(legacyConfig: Record<string, any>): UiConfig {
  const result: Partial<UiConfig> = {};
  for (const [key, field] of Object.entries(legacyConfig)) {
    if (field && typeof field === 'object' && 'value' in field) {
      const value = field.value;
      if (key.startsWith('nars.')) {
        const narsKey = key.replace('nars.', '');
        if (!result.nars) result.nars = {} as UiConfig['nars'];
        (result.nars as Record<string, unknown>)[narsKey] = value;
      } else if (key.startsWith('llm.')) {
        // Legacy LLM config - map to provider
        const providerKey = key.replace('llm.', '');
        if (!result.provider) result.provider = {} as UiConfig['provider'];
        (result.provider as Record<string, unknown>)[providerKey] = value;
      }
    }
  }
  // Fill in defaults for missing fields
  return UiConfigSchema.parse({ ...DEFAULT_UI_CONFIG, ...result });
}

/** Adds a user chat message to the store and triggers graph update. */
export function addUserMessage(content: string, mode?: string, contexts?: string[]): void {
  const chat: ChatMessage = {
    id: generateId('user'),
    role: 'user',
    content,
    mode,
    contexts,
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

/** Adds an agent chat message to the store — the visible half of a control answer. */
export function addAgentMessage(content: string, mode?: string): void {
  const id = generateId('agent');
  const chat: ChatMessage = {
    id,
    role: 'agent',
    content,
    mode,
    timestamp: Date.now(),
    term: extractTerm(content),
    parentId: null,
    threadRootId: id,
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
      const chatMsg: ChatMessage = {
        id,
        role: 'agent',
        content: msg.content,
        timestamp: Date.now(),
        term: extractTerm(msg.content),
        parentId: null,
        threadRootId: id,
        supports: [],
        contradicts: [],
        derivesFrom: [],
      };
      $chatMessages.set([...$chatMessages.get(), chatMsg]);
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
      // Drive UI attention decay on each kernel cycle (§18.2)
      // Use cycleIntervalMs if provided by server, otherwise default ~1s
      decayAttentionField((msg as any).cycleIntervalMs);
      break;

    case 'config.schema':
      $config.set(convertLegacyConfig(msg.data));
      break;

    case 'state.snapshot':
      $lastSeqId.set(msg.seqId);
      applyFullSnapshot({
        ...msg.data,
        config: convertLegacyConfig(msg.data.config),
      }, cy);
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

    case 'lm.status':
      applyLmStatus(msg.data);
      break;

    case 'reasoning.control.response':
      settleControl(msg.seqId, {
        ok: msg.ok,
        message: msg.message,
        seqId: msg.seqId,
        answer: msg.answer,
        termination: msg.termination,
      });
      break;

    case 'ui.command':
      if (!dispatchCommand(msg.command, msg.args ?? {})) {
        console.warn('[UI] Unknown ui.command:', msg.command);
      }
      break;

    case 'cognitive.events':
      pushCognitiveEvents(msg.events);
      break;

    case 'cycle.state':
      $cycleState.set(msg.state);
      $cycleCount.set(msg.cycleCount ?? 0);
      $reasoningRunning.set(msg.state === 'running');
      break;

    case 'server.error':
      pushServerError(msg.code, msg.message);
      console.error('[Server]', msg.code, msg.message, msg.context ?? '');
      break;
  }
}

function applyFullSnapshot(
  data: {
    graph: { nodes: GraphNodeData[]; edges: Record<string, any>[] };
    workingMemory: (string | { id: string })[];
    config: UiConfig;
  },
  cy?: Core
): void {
  const nodes = new Map<string, GraphNodeData>(
    data.graph.nodes.map((n) => [n.id ?? makeId(), n] as [string, GraphNodeData])
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
        if (!nodes.has(op.source) || !nodes.has(op.target)) break;
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
