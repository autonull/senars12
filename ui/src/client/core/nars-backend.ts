/**
 * Adapter #1 for the `ReasoningBackend` contract (§0.6, §3.2): the NARS engine
 * behind `cognitive.delta`, plus the MeTTa atoms/skills that arrive on the same
 * channel. It is behaviour-preserving — the same node and edge kinds become the
 * same blocks and links the projection's inline maps produced — and it is where
 * the engine's vocabulary now lives: `nodeType`, the `nal` truth label and the
 * label/text fallbacks are the adapter's business, not the projection's.
 *
 * The snapshot is memoised on the identity of the two engine maps. The workspace
 * re-projects on every chat delta too, and the maps are replaced (never mutated)
 * on every graph delta, so identity is a sound content key.
 */

import type { GraphNodeData } from '@senars/core';
import type {
  BackendEdge,
  BackendNode,
  BackendSnapshot,
  BackendVocabulary,
  ReasoningBackend,
} from './reasoning-backend.js';
import { $graphEdges, $graphNodes } from './store.js';
import type { Ref } from './workspace-graph.js';

/** The uncertainty vocabulary NAL truth values are labelled with. */
export const NAL_VOCABULARY = 'nal';

/** Unmapped kinds still surface: a node becomes a `claim`, an edge a `references`. */
const VOCAB: BackendVocabulary = {
  nodes: { 'nar:concept': 'claim', 'metta:atom': 'claim', 'metta:skill': 'tool-call' },
  edges: {
    derivation: 'derived-from',
    support: 'supports',
    contradiction: 'contradicts',
    revision: 'revises',
    reference: 'references',
  },
};

const nodeOf = (id: Ref, node: GraphNodeData): BackendNode => ({
  id,
  kind: node.nodeType,
  label: node.label ?? node.term ?? node.atom ?? id,
  text: node.term ?? node.atom,
  attrs: node,
  occurredAt: node.occurrenceTime,
  uncertainty: node.truth
    ? {
        frequency: node.truth.frequency,
        confidence: node.truth.confidence,
        vocabulary: NAL_VOCABULARY,
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
    nodes: new Map([...nodes].map(([id, node]) => [id, nodeOf(id, node)])),
    edges: new Map([...edges].map(([id, edge]) => [id, edgeOf(id, edge)])),
  };
  cache = { source: [nodes, edges], snapshot: next };
  return next;
}

/** The engine's adapter — NARS concepts and MeTTa atoms/skills over the live graph. */
export const narsBackend: ReasoningBackend = {
  id: 'nars',
  kind: NAL_VOCABULARY,
  vocab: VOCAB,
  snapshot,
};
