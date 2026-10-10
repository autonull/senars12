/**
 * Adapter #2 for the `ReasoningBackend` contract (§0.6, §3.2, §3.7): the MeTTa engine
 * atoms and skills that arrive on the same `cognitive.delta` channel. It exposes
 * the MeTTa vocabulary and provides a snapshot of the current MeTTa substrate.
 * Control surface is limited — MeTTa is primarily a query/rewrite engine.
 */

import type { GraphNodeData } from '@senars/core';
import type {
  BackendCaps,
  BackendEdge,
  BackendNode,
  BackendSnapshot,
  BackendVocabulary,
  ReasoningBackend,
  ReasoningControl,
  SubmitInput,
  ControlResult,
} from './reasoning-backend.js';
import { $graphNodes, $graphEdges } from './store.js';
import type { Ref, SemanticLinkKind } from './workspace-graph.js';

/** The uncertainty vocabulary MeTTa uses (probabilistic/confidence-based). */
export const METTA_VOCABULARY = 'metta';

/** MeTTa edge kinds → semantic link kinds. */
const METTA_EDGE_VOCAB: Readonly<Record<string, SemanticLinkKind>> = {
  'metta:rewrite': 'derived-from',
  'metta:query': 'references',
  'metta:pattern-match': 'references',
  'metta:skill-execution': 'uses-tool',
  'metta:space': 'contains',
};

const VOCAB: BackendVocabulary = {
  nodes: {
    'metta:atom': 'claim',
    'metta:skill': 'tool-call',
  },
  edges: METTA_EDGE_VOCAB,
};

/** MeTTa can query/rewrite but has limited steer/author surface. */
const CAPS: BackendCaps = {
  canSubmit: false,
  canStep: false,
  canRun: false,
  canRetract: false,
  canRevise: false,
  canAddGoal: false,
  canAdjustBudget: false,
  canAdjustProvider: false,
  canAbort: false,
};

const nodeOf = (id: Ref, node: GraphNodeData): BackendNode => ({
  id,
  kind: node.nodeType,
  label: node.label ?? node.term ?? node.atom ?? node.skill ?? id,
  text: node.term ?? node.atom ?? node.skill,
  attrs: node,
  occurredAt: node.occurrenceTime ?? node.durationMs,
  uncertainty: node.confidence
    ? {
        frequency: node.confidence,
        confidence: node.confidence,
        vocabulary: METTA_VOCABULARY,
      }
    : undefined,
});

const edgeOf = (id: Ref, edge: Record<string, unknown>): BackendEdge => ({
  id,
  source: String(edge.source),
  target: String(edge.target),
  kind: String(edge.type),
  confidence: typeof edge.confidence === 'number' ? edge.confidence : undefined,
});

type EngineMaps = readonly [
  ReadonlyMap<string, GraphNodeData>,
  ReadonlyMap<string, Record<string, unknown>>,
];

let cache: { source: EngineMaps; snapshot: BackendSnapshot } | undefined;

function snapshot(): BackendSnapshot {
  const nodes = $graphNodes.get();
  const edges = $graphEdges.get();
  if (cache && cache.source[0] === nodes && cache.source[1] === edges) return cache.snapshot;
  const next: BackendSnapshot = {
    nodes: new Map(
      [...nodes]
        .filter(([, node]) => node.nodeType?.startsWith('metta:'))
        .map(([id, node]) => [id, nodeOf(id, node)])
    ),
    edges: new Map(
      [...edges]
        .filter(([, edge]) => String(edge.type).startsWith('metta:'))
        .map(([id, edge]) => [id, edgeOf(id, edge)])
    ),
  };
  cache = { source: [nodes, edges], snapshot: next };
  return next;
}

/**
 * Minimal control surface for MeTTa — query execution via the engine.
 * Actual control is through the NARS backend; MeTTa is query-oriented.
 */
function makeControl(): ReasoningControl {
  return {
    async submit(_input: SubmitInput): Promise<ControlResult> {
      // MeTTa doesn't accept NAL-style submissions; use query() instead
      return { ok: false, message: 'MeTTa backend does not support submit; use query pattern' };
    },
    async step(): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support step' };
    },
    async run(): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support run' };
    },
    async abort(): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support abort' };
    },
    async retract(_nodeId: Ref): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support retract' };
    },
    async revise(_nodeId: Ref, _frequency: number, _confidence: number): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support revise' };
    },
    async addGoal(_term: string): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support addGoal' };
    },
    async adjustBudget(_budget: number): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support adjustBudget' };
    },
    async adjustProvider(_providerId: string): Promise<ControlResult> {
      return { ok: false, message: 'MeTTa backend does not support adjustProvider' };
    },
  };
}

/** The MeTTa engine's adapter — MeTTa atoms and skills over the live graph. */
export const mettaBackend: ReasoningBackend = {
  id: 'metta',
  kind: METTA_VOCABULARY,
  vocab: VOCAB,
  caps: CAPS,
  snapshot,
  control: makeControl(),
};