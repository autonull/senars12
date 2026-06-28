export interface ProjectionOptions {
  maxNodes: number;
  maxEdges: number;
  maxHops: number;
}

export interface ProjectionResult {
  nodes: Array<{ id: string; priority: number; confidence: number; depth: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
  truncated: boolean;
  total_hidden: number;
}

export function computeActiveSubgraph(
  concepts: Array<{ term: string; priority: number; confidence: number; getLinks: () => Array<{ target: string; strength: number }> }>,
  focusTerm: string | null,
  opts: ProjectionOptions,
): ProjectionResult {
  const conceptMap = new Map(concepts.map(c => [c.term, c]));

  const seeds = focusTerm
    ? conceptMap.has(focusTerm) ? [{ term: focusTerm }] : []
    : [...concepts].sort((a, b) => b.priority - a.priority).slice(0, 50);

  const visited = new Set<string>();
  const queue: Array<{ term: string; depth: number }> = seeds.map(c => ({ term: c.term, depth: 0 }));
  const candidates: Array<{ term: string; priority: number; confidence: number; depth: number }> = [];

  while (queue.length > 0 && candidates.length < opts.maxNodes) {
    const { term, depth } = queue.shift()!;
    if (visited.has(term)) continue;
    visited.add(term);
    const concept = conceptMap.get(term);
    if (!concept) continue;
    candidates.push({ term, priority: concept.priority, confidence: concept.confidence, depth });
    if (depth < opts.maxHops) {
      for (const link of concept.getLinks()) {
        if (!visited.has(link.target)) queue.push({ term: link.target, depth: depth + 1 });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const selected = candidates.slice(0, opts.maxNodes);
  const nodes = selected.map(n => ({ id: n.term, priority: n.priority, confidence: n.confidence, depth: n.depth }));
  const nodeSet = new Set(nodes.map(n => n.id));

  const edges: Array<{ source: string; target: string; weight: number }> = [];
  for (const node of selected) {
    const concept = conceptMap.get(node.term);
    if (!concept) continue;
    for (const link of concept.getLinks()) {
      if (nodeSet.has(link.target) && edges.length < opts.maxEdges) {
        edges.push({ source: node.term, target: link.target, weight: link.strength });
      }
    }
  }

  const truncated = candidates.length > opts.maxNodes;
  const total_hidden = concepts.length - nodes.length;

  return { nodes, edges, truncated, total_hidden };
}
