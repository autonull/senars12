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
import { awaitControl } from './control-channel.js';
import { $graphEdges, $graphNodes } from './store.js';
import { send } from './ws-client.js';
import { VERIFIER_TRUTH_TABLE } from '@senars/core/verify-derivation';
import type { Ref, SemanticLinkKind } from './workspace-graph.js';

/** The uncertainty vocabulary NAL truth values are labelled with. */
export const NAL_VOCABULARY = 'nal';

/** NAR rule names → semantic link kinds, derived from the single-source-of-truth verifier table. */
function makeNarEdgeVocab(): Readonly<Record<string, SemanticLinkKind>> {
  const binary = Object.keys(VERIFIER_TRUTH_TABLE.BINARY_TRUTH);
  const unary = Object.keys(VERIFIER_TRUTH_TABLE.UNARY_TRUTH);
  // Structural rules that appear in the engine but have no truth function
  const structural = ['inheritance', 'similarity', 'implication', 'equivalence', 'derivation', 'semantic', 'relation'];
  // Explicit provenance edges
  const provenance = ['support', 'contradiction', 'reference'];

  const edgeMap: Record<string, SemanticLinkKind> = {};

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
  // Not yet routed to the engine (the server replies `ok:false`); advertised false
  // so no affordance lies until the engine facade supports them.
  canRetract: false,
  canRevise: false,
  canAddGoal: true,
  canAdjustBudget: false,
  canAdjustProvider: false,
  canAbort: true,
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
  // Send the request with a correlation id and settle on the engine's reply, so
  // the caller learns the real outcome rather than an assumed one.
  const request = (msg: Record<string, unknown>): Promise<ControlResult> => {
    const { seqId, result } = awaitControl();
    send({ ...msg, seqId });
    return result;
  };

  return {
    // A `question` is an ask: the engine admits it, reasons, and returns the
    // answer with its verified derivation in one round-trip (Flow B).
    submit: (input: SubmitInput) =>
      input.mode === 'question'
        ? request({ type: 'reasoning.ask', term: input.term })
        : request({ type: 'reasoning.submit', term: input.term, mode: input.mode }),
    step: () => request({ type: 'reasoning.step' }),
    run: () => request({ type: 'reasoning.run' }),
    abort: () => request({ type: 'reasoning.abort' }),
    retract: (nodeId: Ref) => request({ type: 'reasoning.retract', nodeId }),
    revise: (nodeId: Ref, frequency: number, confidence: number) =>
      request({ type: 'reasoning.revise', nodeId, frequency, confidence }),
    addGoal: (term: string) => request({ type: 'reasoning.add-goal', term }),
    adjustBudget: (budget: number) => request({ type: 'reasoning.adjust-budget', budget }),
    adjustProvider: (providerId: string) =>
      request({ type: 'reasoning.adjust-provider', provider: providerId }),
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
