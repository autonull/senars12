import type { Core } from 'cytoscape';
import { edgeKey } from '../../shared/utils.js';
import type { GraphNodeData } from '../../shared/protocol.js';
import { layoutConversationThread } from './graph-layout.js';
import { applyLensStyles } from './lens-styles.js';

const CHAT_NODE_STYLE = { 'shape': 'round-rectangle', 'border-color': '#00f3ff', 'border-width': 1.5 };

interface NodeData {
  id: string;
  color: string;
  term?: string;
  nodeType: string;
  priority: number;
  confidence: number;
  lensData?: { score: number; color: string; size: number };
}

export function syncGraph(
  cy: Core,
  nodes: Map<string, GraphNodeData>,
  edges: Map<string, Record<string, any>>,
  activeLens: string,
  chatMessages: any[]
): void {
  const oldPositions = savePositions(cy);

  cy.batch(() => {
    const currentIds = new Set(cy.nodes().map((n) => n.id()));

    for (const [nodeId, nd] of nodes) {
      if (currentIds.has(nodeId)) {
        cy.getElementById(nodeId).data(nd);
      } else {
        const nodeType = nd.nodeType === 'message' ? 'message' : 'concept';
        const data: NodeData = { id: nodeId, color: '#00f3ff', term: nd.term, nodeType, priority: nd.priority, confidence: nd.confidence, lensData: nd.lensData };
        cy.add({ group: 'nodes', data, classes: nodeType === 'message' ? 'chat-message-node' : '' });
        if (nodeType === 'message') cy.getElementById(nodeId).style(CHAT_NODE_STYLE);
      }
    }

    for (const nid of currentIds) {
      if (!nodes.has(nid)) cy.getElementById(nid).remove();
    }

    const currentEdgeKeys = new Set(cy.edges().map((e) => edgeKey(e.data('source'), e.data('target'))));
    for (const [key, ed] of edges) {
      if (!currentEdgeKeys.has(key)) cy.add({ group: 'edges', data: { ...ed } });
    }
    for (const e of cy.edges()) {
      const key = edgeKey(e.data('source'), e.data('target'));
      if (!edges.has(key)) e.remove();
    }
  });

  restorePositions(cy, oldPositions);
  layoutConversationThread(cy, chatMessages);
  applyLensStyles(cy, activeLens);

  const firstLayout = cy.nodes().length <= 1;
  cy.layout({ name: 'cose', animate: true, animationDuration: 300, fit: firstLayout, padding: 20 }).run();
}

function savePositions(cy: Core): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  cy.nodes().forEach((n) => { positions.set(n.id(), n.position()); });
  return positions;
}

function restorePositions(cy: Core, positions: Map<string, { x: number; y: number }>): void {
  cy.nodes().forEach((n) => {
    const pos = positions.get(n.id());
    if (pos) n.position(pos);
  });
}