/**
 * Catalog-keyed graph reducers — the server side of Phase 3.2. The bridge no
 * longer owns the "which events are graph-relevant" decision: `EVENT_CATALOG`
 * declares it (`shapes` includes `'graph'`), and this map must provide exactly
 * those reducers. The parity test in `tests/unit/server/event-catalog.test.ts`
 * fails if the two drift, so a newly graph-shaped event cannot be silently
 * dropped by the bridge.
 */

import type { CognitiveEvent, GraphNodeData } from '@senars/core';
import { isNarsese } from '@senars/core';
import type { CognitiveEventOf } from '@senars/core/schemas';
import { parseTermToEdges, termParser } from '@senars/nar';
import { asBeliefTruth } from '@senars/util';
import type { GraphEdge, UnifiedGraphProjection } from './UnifiedGraphProjection.js';

type Truth = { frequency: number; confidence: number };
type NarBelief = { term: { toString(): string }; truth: { f: number; c: number } };

export type ReducerContext = {
  projection: UnifiedGraphProjection;
  beliefs: () => NarBelief[];
};

type GraphReducerMap = {
  [K in CognitiveEvent['type']]?: (event: CognitiveEventOf<K>, ctx: ReducerContext) => void;
};

function makeNode(
  term: string,
  truth?: Truth,
  priority?: number,
  extra: Partial<GraphNodeData> = {}
): GraphNodeData {
  return {
    id: term,
    term,
    label: term,
    nodeType: 'nar:concept',
    ...(truth ? { truth } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...extra,
  };
}

function derivationEdges(premises: string[], conclusion: string): GraphEdge[] {
  return premises.map((premise) => ({
    source: premise,
    target: conclusion,
    type: 'derivation',
    weight: 1,
    directed: true,
  }));
}

const reducers = {
  'derivation.made': (event, { projection, beliefs }) => {
    const { conclusion, premises, rule, cpuMs, lmCalls, lmTokens } = event.payload;
    const belief = beliefs().find((b) => b.term.toString() === conclusion);
    // NAR belief truth is `{f, c}`; the wire contract is `{frequency, confidence}`.
    const truth = asBeliefTruth(belief?.truth);
    const edges = derivationEdges(premises, conclusion);
    if (isNarsese(conclusion)) {
      try {
        edges.push(
          ...parseTermToEdges(termParser.parse(conclusion)).map((edge) => ({
            source: edge.source,
            target: edge.target,
            type: edge.type,
            weight: edge.weight,
            directed: edge.directed ?? true,
          }))
        );
      } catch {
        /* structural parse is best-effort decoration */
      }
    }
    projection.applyDelta({
      nodes: [makeNode(conclusion, truth, undefined, { rule, cpuMs, lmCalls, lmTokens })],
      edges,
    });
  },

  'derivation.accepted': (event, { projection }) => {
    const { conclusion, premises, truth, ruleId } = event.payload;
    projection.applyDelta({
      nodes: [makeNode(conclusion, truth, undefined, { rule: ruleId })],
      edges: derivationEdges(premises, conclusion),
    });
  },

  'belief.added': (event, { projection }) => {
    const { term, truth } = event.payload;
    projection.applyDelta({
      nodes: [makeNode(term, truth, projection.node(term)?.priority)],
      edges: [],
    });
  },

  'belief.revised': (event, { projection }) => {
    const { term, newTruth } = event.payload;
    projection.applyDelta({
      nodes: [makeNode(term, newTruth, projection.node(term)?.priority)],
      edges: [],
    });
  },

  'concept.activated': (event, { projection }) => {
    const { term, priority } = event.payload;
    projection.applyDelta({
      nodes: [makeNode(term, projection.node(term)?.truth, priority)],
      edges: [],
    });
  },

  'belief.retracted': (event, { projection }) => projection.removeNode(event.payload.term),

  'atom.retracted': (event, { projection }) => projection.removeNode(event.payload.atom),

  'atom.derived': (event, { projection }) => {
    const { atom, space } = event.payload;
    projection.applyDelta({
      nodes: [{ id: atom, atom, label: atom, nodeType: 'metta:atom', space }],
      edges: [],
    });
  },

  'goal.achieved': (event, { projection }) => {
    const goal = event.payload.goal;
    projection.applyDelta({
      nodes: [makeNode(`goal:${goal}`, undefined, undefined, { type: 'goal', result: 'achieved' })],
      edges: [],
    });
  },

  'goal.failed': (event, { projection }) => {
    const { goal, reason } = event.payload;
    projection.applyDelta({
      nodes: [makeNode(`goal:${goal}`, undefined, undefined, { type: 'goal', result: reason })],
      edges: [],
    });
  },

  'skill.executed': (event, { projection }) => {
    const { skill, args, result, durationMs } = event.payload;
    projection.applyDelta({
      nodes: [
        {
          id: `skill:${skill}`,
          skill,
          label: skill,
          nodeType: 'metta:skill',
          args,
          result,
          durationMs,
        },
      ],
      edges: [],
    });
  },

  'proposal.admitted': (event, { projection }) => {
    const { proposalId, kind } = event.payload;
    projection.applyDelta({
      nodes: [
        makeNode(`proposal:${proposalId}`, undefined, undefined, {
          type: 'proposal',
          result: `admitted:${kind}`,
        }),
      ],
      edges: [],
    });
  },

  'proposal.rejected': (event, { projection }) => {
    const { proposalId, reason } = event.payload;
    projection.applyDelta({
      nodes: [
        makeNode(`proposal:${proposalId}`, undefined, undefined, {
          type: 'proposal',
          result: `rejected:${reason}`,
        }),
      ],
      edges: [],
    });
  },

  'task.admitted': (event, { projection }) => {
    const { taskId, term } = event.payload;
    projection.applyDelta({
      nodes: [makeNode(`task:${taskId}`, undefined, undefined, { type: 'task', term, label: term })],
      edges: [],
    });
  },

  'conflict:detected': (event, { projection }) =>
    projection.markContradiction(event.payload.term, event.payload.conflictWith),
} satisfies GraphReducerMap;

export const GRAPH_REDUCERS: GraphReducerMap = reducers;

export function dispatchGraphEvent(event: CognitiveEvent, ctx: ReducerContext): void {
  const reducer = GRAPH_REDUCERS[event.type] as
    | ((e: CognitiveEvent, c: ReducerContext) => void)
    | undefined;
  reducer?.(event, ctx);
}
