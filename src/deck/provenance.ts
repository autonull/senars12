/**
 * Deck Provenance — artifact provenance tracking and visualization.
 */

import type { Artifact } from '@senars/admit/repertoire.js';
import type { Stamp } from '@senars/kernel/types.js';

/** Provenance node. */
export interface ProvenanceNode {
  /** Artifact ID. */
  id: string;
  /** Artifact kind. */
  kind: string;
  /** Truth value. */
  truth: { f: number; c: number };
  /** Status. */
  status: string;
  /** Stamp. */
  stamp?: Stamp;
  /** Parent IDs. */
  parents: string[];
  /** Children IDs. */
  children: string[];
  /** Depth in graph. */
  depth: number;
}

/** Provenance graph. */
export interface ProvenanceGraph {
  /** Nodes by ID. */
  nodes: Map<string, ProvenanceNode>;
  /** Root nodes (no parents). */
  roots: string[];
  /** Leaf nodes (no children). */
  leaves: string[];
}

/** Provenance tracker. */
export class ProvenanceTracker {
  private graph: ProvenanceGraph = { nodes: new Map(), roots: [], leaves: [] };

  /** Add artifact to provenance graph. */
  addArtifact(artifact: Artifact): void {
    const node: ProvenanceNode = {
      id: artifact.id,
      kind: artifact.kind,
      truth: artifact.truth,
      status: artifact.status,
      stamp: artifact.stamp,
      parents: [...artifact.dependencies],
      children: [],
      depth: 0,
    };

    this.graph.nodes.set(artifact.id, node);

    // Update parent references
    for (const parentId of artifact.dependencies) {
      const parent = this.graph.nodes.get(parentId);
      if (parent && !parent.children.includes(artifact.id)) {
        parent.children.push(artifact.id);
      }
    }
  }

  /** Get provenance graph for artifact. */
  getGraph(artifactId: string): ProvenanceGraph | null {
    const node = this.graph.nodes.get(artifactId);
    if (!node) return null;

    // Build subgraph
    const visited = new Set<string>();
    const nodes = new Map<string, ProvenanceNode>();

    this.collectAncestors(artifactId, visited, nodes);
    this.collectDescendants(artifactId, visited, nodes);

    // Calculate depths
    this.calculateDepths(nodes, artifactId);

    const roots = Array.from(nodes.values()).filter(n => n.parents.length === 0).map(n => n.id);
    const leaves = Array.from(nodes.values()).filter(n => n.children.length === 0).map(n => n.id);

    return { nodes, roots, leaves };
  }

  /** Collect ancestors recursively. */
  private collectAncestors(id: string, visited: Set<string>, nodes: Map<string, ProvenanceNode>): void {
    if (visited.has(id)) return;
    visited.add(id);

    const node = this.graph.nodes.get(id);
    if (!node) return;

    nodes.set(id, { ...node });

    for (const parentId of node.parents) {
      this.collectAncestors(parentId, visited, nodes);
    }
  }

  /** Collect descendants recursively. */
  private collectDescendants(id: string, visited: Set<string>, nodes: Map<string, ProvenanceNode>): void {
    if (visited.has(id)) return;
    visited.add(id);

    const node = this.graph.nodes.get(id);
    if (!node) return;

    if (!nodes.has(id)) {
      nodes.set(id, { ...node });
    }

    for (const childId of node.children) {
      this.collectDescendants(childId, visited, nodes);
    }
  }

  /** Calculate depths from root. */
  private calculateDepths(nodes: Map<string, ProvenanceNode>, rootId: string): void {
    const queue: [string, number][] = [[rootId, 0]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [id, depth] = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodes.get(id);
      if (node) {
        node.depth = depth;
        for (const childId of node.children) {
          if (!visited.has(childId)) {
            queue.push([childId, depth + 1]);
          }
        }
      }
    }
  }

  /** Get full graph. */
  getFullGraph(): ProvenanceGraph {
    const nodes = new Map(this.graph.nodes);
    const roots = Array.from(nodes.values()).filter(n => n.parents.length === 0).map(n => n.id);
    const leaves = Array.from(nodes.values()).filter(n => n.children.length === 0).map(n => n.id);
    return { nodes, roots, leaves };
  }

  /** Clear graph. */
  clear(): void {
    this.graph = { nodes: new Map(), roots: [], leaves: [] };
  }
}

/** Provenance renderer. */
export class ProvenanceRenderer {
  /** Render provenance as tree. */
  renderTree(graph: ProvenanceGraph, rootId?: string): string {
    const roots = rootId ? [rootId] : graph.roots;
    let output = '';

    output += '╔══════════════════════════════════════════════════════════════╗\n';
    output += '║ PROVENANCE                                                  ║\n';
    output += '╠══════════════════════════════════════════════════════════════╣\n';

    for (const root of roots) {
      output += this.renderNode(graph, root, '', true);
    }

    output += '╚══════════════════════════════════════════════════════════════╝';
    return output;
  }

  /** Render provenance as JSON. */
  renderJSON(graph: ProvenanceGraph): string {
    const obj: Record<string, unknown> = {};
    for (const [id, node] of graph.nodes) {
      obj[id] = {
        kind: node.kind,
        truth: node.truth,
        status: node.status,
        stamp: node.stamp,
        parents: node.parents,
        children: node.children,
        depth: node.depth,
      };
    }
    return JSON.stringify(obj, null, 2);
  }

  /** Render single node recursively. */
  private renderNode(graph: ProvenanceGraph, id: string, prefix: string, isLast: boolean): string {
    const node = graph.nodes.get(id);
    if (!node) return '';

    const connector = isLast ? '└── ' : '├── ';
    const stampStr = node.stamp ? ` @${node.stamp.id.slice(0, 8)}` : '';
    const truthStr = `%${node.truth.f.toFixed(2)};${node.truth.c.toFixed(2)}%`;
    const line = `${prefix}${connector}${id} (${node.kind}) ${truthStr} [${node.status}]${stampStr}\n`;

    let output = line;
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    for (let i = 0; i < node.children.length; i++) {
      const childId = node.children[i]!;
      const isLastChild = i === node.children.length - 1;
      output += this.renderNode(graph, childId, childPrefix, isLastChild);
    }

    return output;
  }
}

/** Create provenance tracker. */
export function createProvenanceTracker(): ProvenanceTracker {
  return new ProvenanceTracker();
}

/** Create provenance renderer. */
export function createProvenanceRenderer(): ProvenanceRenderer {
  return new ProvenanceRenderer();
}