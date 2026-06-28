import cytoscape, { type Core } from 'cytoscape';
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $graphNodes, $graphEdges, $graphMeta, $activeLens, $selectedMessageId, $focusTerm, mountTestApi } from '../core/store.js';
import type { GraphNodeData } from '../../shared/protocol.js';

const LENS_COLORS: Record<string, string> = {
  belief: '#00f3ff', goal: '#ff0055', contradiction: '#ff00ff',
};

const CHAT_NODE_STYLE = { 'shape': 'round-rectangle', 'border-color': '#00f3ff', 'border-width': 1.5 };

@customElement('belief-graph')
export class BeliefGraph extends LitElement {
  private cy: Core | null = null;
  private unsubs: Array<() => void> = [];

  static override styles = css`
    :host { display: block; position: relative; flex: 1; background: var(--bg-void); min-height: 0; }
    #graph { width: 100%; height: 100%; }
    .warning { position: absolute; bottom: 8px; left: 8px; background: rgba(255, 176, 0, 0.1); border-left: 2px solid var(--accent-amber); padding: 4px 8px; font-family: var(--font-data); font-size: 0.65rem; color: var(--accent-amber); pointer-events: none; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubs = [
      $graphNodes.subscribe(() => this.syncGraph()),
      $graphEdges.subscribe(() => this.syncGraph()),
      $activeLens.subscribe(() => this.applyLens()),
      $selectedMessageId.subscribe((id) => this.centerOnNode(id)),
    ];
    mountTestApi('graph', {
      getNodeCount: () => this.cy?.nodes().length ?? 0,
      getEdgeCount: () => this.cy?.edges().length ?? 0,
      getNodeData: (id: string) => this.cy?.getElementById(id).data() ?? null,
      getAllNodeIds: () => this.cy?.nodes().map((n) => n.id()) ?? [],
      clickNode: (id: string) => this.cy?.getElementById(id).emit('tap'),
    });
  }

  override disconnectedCallback() {
    this.unsubs.forEach((u) => u());
    this.cy?.destroy();
    super.disconnectedCallback();
  }

  override firstUpdated() {
    const container = this.shadowRoot?.getElementById('graph');
    if (!container) return;

    this.cy = cytoscape({
      container,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(id)',
            color: '#e2e8f0',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '9px',
            width: 'mapData(priority, 0, 1, 16, 50)',
            height: 'mapData(priority, 0, 1, 16, 50)',
            'border-width': 2,
            'border-color': '#00f3ff',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'border-opacity': 'mapData(confidence, 0, 1, 0.3, 1)' as any,
          },
        },
        { selector: 'node:active', style: { 'border-color': '#ffb000', 'border-width': 3 as any } },
        {
          selector: 'edge',
          style: {
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 'mapData(weight, 0, 1, 1, 3)',
            'line-opacity': 0.6,
          },
        },
      ],
      layout: { name: 'cose', animate: false },
      wheelSensitivity: 0.3,
    });

    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const id = node.id();
      const term = node.data('term') || id;
      $selectedMessageId.set(id);
      $focusTerm.set(term);
    });

    this.applyLens();
  }

  private centerOnNode(id: string | null) {
    if (!id || !this.cy) return;
    const node = this.cy.getElementById(id);
    if (!node.length) return;
    this.cy.animate({
      center: { eles: node },
      zoom: 2,
      duration: 300,
    });
    node.style({ 'border-color': '#00f3ff', 'border-width': 4 });
    setTimeout(() => node.style({ 'border-width': 2, 'border-color': '#00f3ff' }), 1000);
  }

  private applyLens() {
    const cy = this.cy;
    if (!cy) return;
    const lens = $activeLens.get();

    const positions = new Map<string, { x: number; y: number }>();
    cy.nodes().forEach((n) => { positions.set(n.id(), n.position()); });

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const ld = node.data('lensData');
        if (ld) {
          node.style({
            'background-color': ld.color,
            width: ld.size,
            height: ld.size,
            opacity: 0.5 + 0.5 * Math.min(1, ld.score),
            'transition-property': 'background-color, width, height, opacity',
            'transition-duration': '0.25s',
          });
        } else {
          const baseColor = LENS_COLORS[lens] ?? '#00f3ff';
          node.style({
            'background-color': baseColor,
            opacity: 0.15,
            'transition-property': 'background-color, opacity',
            'transition-duration': '0.25s',
          });
        }
      });

      cy.edges().forEach((edge) => {
        const srcData = edge.source().data('lensData');
        edge.style('opacity', srcData ? 0.1 + 0.9 * srcData.score : 0.02);
      });
    });

    cy.nodes().forEach((n) => {
      const pos = positions.get(n.id());
      if (pos) n.position(pos);
    });
  }

  private syncGraph() {
    if (!this.cy) return;
    const cy = this.cy;
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    const oldPositions = new Map<string, { x: number; y: number }>();

    cy.batch(() => {
      const currentIds = new Set(cy.nodes().map((n) => n.id()));

      for (const [nodeId, nd] of nodes) {
        if (currentIds.has(nodeId)) {
          oldPositions.set(nodeId, cy.getElementById(nodeId).position());
          cy.getElementById(nodeId).data(nd);
        } else {
          const nodeType = nd.nodeType === 'message' ? 'message' : 'concept';
          const data = { id: nodeId, color: '#00f3ff', term: nd.term, nodeType, priority: nd.priority, confidence: nd.confidence, lensData: nd.lensData };
          cy.add({ group: 'nodes', data, classes: nodeType === 'message' ? 'chat-message-node' : '' });
          if (nodeType === 'message') cy.getElementById(nodeId).style(CHAT_NODE_STYLE);
        }
      }

      for (const nid of currentIds) {
        if (!nodes.has(nid)) cy.getElementById(nid).remove();
      }

      const currentEdgeKeys = new Set(cy.edges().map((e) => `${e.data('source')}->${e.data('target')}`));
      for (const [key, ed] of edges) {
        if (!currentEdgeKeys.has(key)) cy.add({ group: 'edges', data: { ...ed } });
      }
      for (const e of cy.edges()) {
        const key = `${e.data('source')}->${e.data('target')}`;
        if (!edges.has(key)) e.remove();
      }
    });

    for (const [nid, pos] of oldPositions) {
      const el = cy.getElementById(nid);
      if (el.length) el.position(pos);
    }

    const firstLayout = cy.nodes().length <= 1;
    cy.layout({ name: 'cose', animate: true, animationDuration: 300, fit: firstLayout, padding: 20 }).run();
    this.applyLens();
  }

  override render() {
    const meta = $graphMeta.get();
    return html`
      <div id="graph"></div>
      ${meta?.truncated ? html`<div class="warning">▼ ${meta.total_hidden} lower-priority concepts hidden</div>` : ''}
    `;
  }
}
