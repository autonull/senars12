/**
 * Adapter #1 for the `ReasoningBackend` contract (§0.6, §3.2, §3.6): the NARS engine
 * behind `cognitive.delta`, plus the MeTTa atoms/skills that arrive on the same
 * channel. It is behaviour-preserving — the same node and edge kinds become the
 * same blocks and links the projection's inline maps produced — and it is where
 * the engine's vocabulary now lives: `nodeType`, the `nal` truth label and the
 * label/text fallbacks are the adapter's business, not the projection's.
 *
 * The snapshot is memoised on the identity of the two engine maps. The workspace
 * re-projects on every chat delta too, and the maps are replaced (never mutated)
 * on every graph delta, so identity is a sound content key.
 *
 * The control surface (§3.6) sends reasoning control messages to the engine
 * via the WebSocket. The engine responds with `reasoning.control.response`
 * and subsequent `cognitive.delta` frames update the graph.
 */

import type { GraphNodeData } from '@senars/core';
import type {
  BackendCaps,
  BackendEdge,
  BackendNode,
  BackendSnapshot,
  BackendVocabulary,
  ControlResult,
  ReasoningBackend,
  ReasoningControl,
  SubmitInput,
} from './reasoning-backend.js';
import { $graphEdges, $graphNodes } from './store.js';
import { send } from './ws-client.js';
import { VERIFIER_TRUTH_TABLE } from '@senars/core';
import type { Ref } from './workspace-graph.js';

/** The uncertainty vocabulary NAL truth values are labelled with. */
export const NAL_VOCABULARY = 'nal';

/** NAR rule names → semantic link kinds, derived from the single-source-of-truth verifier table. */
function makeNarEdgeVocab(): Readonly<Record<string, string>> {
  const binary = Object.keys(VERIFIER_TRUTH_TABLE.BINARY_TRUTH);
  const unary = Object.keys(VERIFIER_TRUTH_TABLE.UNARY_TRUTH);
  // Structural rules that appear in the engine but have no truth function
  const structural = ['inheritance', 'similarity', 'implication', 'equivalence', 'derivation', 'semantic', 'relation'];
  // Explicit provenance edges
  const provenance = ['support', 'contradiction', 'reference'];

  const edgeMap: Record<string, string> = {};

  // Logical inference rules → derived-from
  for (const rule of binary) edgeMap[rule] = 'derived-from';
  for (const rule of unary) edgeMap[rule] = 'derived-from';

  // Structural/relational
  for (const rule of structural) {
    if (rule === 'similarity' || rule === 'equivalence') edgeMap[rule] = 'supports';
    else if (rule === 'semantic' || rule === 'relation') edgeMap[rule] = 'references';
    else edgeMap[rule] = 'derived-from';
  }

  // Provenance
  for (const rule of provenance) {
    if (rule === 'support') edgeMap[rule] = 'supports';
    else if (rule === 'contradiction') edgeMap[rule] = 'contradicts';
    else edgeMap[rule] = 'references';
  }

  return edgeMap;
}

/** Unmapped kinds still surface: a node becomes a `claim`, an edge a `references`. */
const VOCAB: BackendVocabulary = {
  nodes: { 'nar:concept': 'claim', 'metta:atom': 'claim', 'metta:skill': 'tool-call' },
  edges: makeNarEdgeVocab(),
};

/** NARS can steer/author — the engine exposes the full control surface. */
const CAPS: BackendCaps = {
  canSubmit: true,
  canStep: true,
  canRun: true,
  canRetract: true,
  canRevise: true,
  canAddGoal: true,
  canAdjustBudget: true,
  canAdjustProvider: true,
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

function makeControl(): ReasoningControl {
  return {
    async submit(input: SubmitInput): Promise<ControlResult> {
      send({ type: 'reasoning.submit', term: input.term, mode: input.mode });
      return { ok: true };
    },
    async step(): Promise<ControlResult> {
      send({ type: 'reasoning.step' });
      return { ok: true };
    },
    async run(): Promise<ControlResult> {
      send({ type: 'reasoning.run' });
      return { ok: true };
    },
    async retract(nodeId: Ref): Promise<ControlResult> {
      send({ type: 'reasoning.retract', nodeId });
      return { ok: true };
    },
    async revise(nodeId: Ref, frequency: number, confidence: number): Promise<ControlResult> {
      send({ type: 'reasoning.revise', nodeId, frequency, confidence });
      return { ok: true };
    },
    async addGoal(term: string): Promise<ControlResult> {
      send({ type: 'reasoning.add-goal', term });
      return { ok: true };
    },
    async adjustBudget(budget: number): Promise<ControlResult> {
      send({ type: 'reasoning.adjust-budget', budget });
      return { ok: true };
    },
    async adjustProvider(providerId: string): Promise<ControlResult> {
      send({ type: 'reasoning.adjust-provider', provider: providerId });
      return { ok: true };
    },
  };
}

/** The engine's adapter — NARS concepts and MeTTa atoms/skills over the live graph. */
export const narsBackend: ReasoningBackend = {
  id: 'nars',
  kind: NAL_VOCABULARY,
  vocab: VOCAB,
  caps: CAPS,
  snapshot,
  control: makeControl(),
};
