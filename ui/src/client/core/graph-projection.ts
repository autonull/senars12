/**
 * Project the WorkspaceGraph into renderer-agnostic graph elements (§2.1, Phase
 * 2). The Graph mode renders the *same* blocks/links the Notebook does — one
 * substrate, many eyes — so the conversation is navigable as a graph with no
 * reasoning backend attached. Pure and deterministic: the viewport owns the
 * Cytoscape lifecycle, this module only decides nodes, compound parents and
 * edges. Section/heading blocks with `children` become compound parents so
 * containment reads as spatial clustering.
 */

import { BLOCK_KIND_LABEL } from './block-labels.js';
import type { SemanticBlock, WorkspaceGraph } from './workspace-graph.js';

export interface WorkspaceNodeData {
  id: string;
  label: string;
  term: string;
  nodeType: 'workspace';
  kind: string;
  role: string;
  status?: string;
  /** Compound parent for contained children (Cytoscape `parent`). */
  parent?: string;
}

export interface WorkspaceEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

export interface WorkspaceProjection {
  nodes: Map<string, WorkspaceNodeData>;
  edges: Map<string, WorkspaceEdgeData>;
}

const MAX_LABEL = 80;

const firstLine = (text: string | undefined): string | undefined => {
  const line = text?.split('\n')[0]?.trim();
  return line ? line.slice(0, MAX_LABEL) : undefined;
};

const labelFor = (block: SemanticBlock): string =>
  block.title ?? firstLine(block.text) ?? BLOCK_KIND_LABEL[block.kind] ?? block.kind;

const isContainer = (block: SemanticBlock): boolean =>
  ((block.kind === 'section' || block.kind === 'heading' || block.kind === 'turn') &&
    (block.children?.length ?? 0) > 0);

export function projectWorkspaceGraph(graph: WorkspaceGraph): WorkspaceProjection {
  const nodes = new Map<string, WorkspaceNodeData>();
  for (const block of graph.blocks.values()) {
    const label = labelFor(block);
    nodes.set(block.id, {
      id: block.id,
      label,
      term: label,
      nodeType: 'workspace',
      kind: block.kind,
      role: block.role,
      status: block.status,
    });
  }

  for (const block of graph.blocks.values()) {
    if (!isContainer(block)) continue;
    for (const child of block.children ?? []) {
      const node = nodes.get(child);
      if (node && node.id !== block.id) node.parent = block.id;
    }
  }

  const edges = new Map<string, WorkspaceEdgeData>();
  for (const link of graph.links.values()) {
    if (!nodes.has(link.source) || !nodes.has(link.target)) continue;
    edges.set(link.id, {
      id: link.id,
      source: link.source,
      target: link.target,
      type: link.kind,
      label: link.label ?? link.kind,
    });
  }

  return { nodes, edges };
}
