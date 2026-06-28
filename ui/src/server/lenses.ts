import type { NarAdapter } from './gateway.js';
import type { GraphOp, Lens, GraphNodeData } from '../shared/protocol.js';
import { edgeKey, LENS_COLORS_HEX } from '../shared/index.js';
import { computeActiveSubgraph } from './projection.js';
import { DEFAULT_PROJECTION } from './config.js';

function createNodeOp(id: string, data: GraphNodeData): GraphOp {
  return { action: 'add_node' as const, id, data };
}

function createEdgeOp(source: string, target: string, weight: number, type = 'semantic'): GraphOp {
  return { action: 'add_edge' as const, source, target, data: { weight, type, directed: true } };
}

type LensScorer = (concept: { term: string; priority: number; confidence: number; getLinks: () => Array<{ target: string; strength: number }> }, allConcepts: unknown[]) => number;

function termOverlap(a: string, b: string): number {
  if (a === b) return 1;
  const aw = new Set(a.toLowerCase().split(/[\s_()\[\]<>\-\/=>]+/).filter(Boolean));
  const bw = new Set(b.toLowerCase().split(/[\s_()\[\]<>\-\/=>]+/).filter(Boolean));
  if (!aw.size || !bw.size) return 0;
  let n = 0;
  for (const w of aw) if (bw.has(w)) n++;
  return n / Math.max(aw.size, bw.size);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function getLensColor(lens: string, intensity: number): string {
  const hex = LENS_COLORS_HEX[lens as Lens] ?? '#646964';
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${0.3 + 0.7 * intensity})`;
}

const lensScorers: Record<string, LensScorer> = {
  belief: (c) => c.confidence * c.priority,

  goal: (c, all) => {
    const goals = all.filter((t: any) => t.term && t.priority > 0.5);
    if (goals.length === 0) return 0;
    return Math.max(0, ...goals.map((g: any) => {
      const sim = termOverlap(c.term, g.term?.toString() ?? '');
      return sim * g.priority * (1 - g.confidence);
    }));
  },

  contradiction: (c, _all) => {
    const links = c.getLinks();
    const contradictory = links.filter(l => l.strength > 0.8);
    return contradictory.length * 0.2;
  },
};

export function buildLensGraphOps(adapter: NarAdapter, lens: Lens): { ops: GraphOp[]; meta?: { truncated: boolean; totalHidden: number } } {
  const scorer = lensScorers[lens];
  const concepts = adapter.listConcepts();
  if (!scorer) {
    const proj = computeActiveSubgraph(concepts, null, DEFAULT_PROJECTION);
    return {
      ops: [
        ...proj.nodes.map((n) => createNodeOp(n.id, { id: n.id, label: n.id, priority: n.priority, confidence: n.confidence, nodeType: 'concept' })),
        ...proj.edges.map((e) => createEdgeOp(e.source, e.target, e.weight)),
      ],
      meta: proj.truncated ? { truncated: true, totalHidden: proj.total_hidden } : undefined,
    };
  }

  const scored = concepts
    .map((c) => ({ concept: c, score: scorer(c, concepts) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, DEFAULT_PROJECTION.maxNodes);

  const maxScore = Math.max(...scored.map((s) => s.score), 0.01);
  const nodeIds = new Set(scored.map((s) => s.concept.term));

  const ops: GraphOp[] = scored.map(({ concept, score }) =>
    createNodeOp(concept.term, {
      id: concept.term, label: concept.term, priority: concept.priority, confidence: concept.confidence,
      nodeType: 'concept',
      lensData: {
        score: score / maxScore,
        color: getLensColor(lens, score / maxScore),
        size: 10 + 40 * (score / maxScore),
      },
    })
  );

  const edgeSet = new Set<string>();
  for (const { concept } of scored) {
    for (const link of concept.getLinks()) {
      if (nodeIds.has(link.target) && !edgeSet.has(edgeKey(concept.term, link.target))) {
        edgeSet.add(edgeKey(concept.term, link.target));
        ops.push(createEdgeOp(concept.term, link.target, link.strength));
      }
    }
  }

  return {
    ops,
    meta: concepts.length > DEFAULT_PROJECTION.maxNodes
      ? { truncated: true, totalHidden: concepts.length - scored.length }
      : undefined,
  };
}