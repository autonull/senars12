import cytoscape, { type Core } from 'cytoscape';
import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $chatMessages, $graphNodes, $graphEdges, $graphMeta, $activeLens, $selectedNodeId, $viewport, mountTestApi } from '../core/store.js';
import { send } from '../core/ws-client.js';
import { BaseComponent } from '../core/base-component.js';
import { edgeKey } from '../../shared/utils.js';
import type { GraphNodeData, ChatMessage } from '../../shared/protocol.js';
import { layoutConversationThread } from '../utils/graph-layout.js';
import { computeHtmlLabels, type HtmlLabelData } from '../utils/html-labels.js';
import { applyLensStyles } from '../utils/lens-styles.js';

const CHAT_NODE_STYLE = { shape: 'round-rectangle', 'border-color': '#00f3ff', 'border-width': 1.5 };

@customElement('graph-viewport')
export class GraphViewport extends BaseComponent {
  private cy: Core | null = null;
  private mounted = false;
  @state() private htmlLabels = new Map<string, HtmlLabelData>();

  static override styles = css`
    :host { display: block; position: relative; flex: 1; background: var(--bg-void); min-height: 0; }
    #cy-container { width: 100%; height: 100%; }
    .warning { position: absolute; bottom: 8px; left: 8px; background: rgba(255, 176, 0, 0.1); border-left: 2px solid var(--accent-amber); padding: 4px 8px; font-family: var(--font-data); font-size: 0.65rem; color: var(--accent-amber); pointer-events: none; }
    .html-label { position: absolute; pointer-events: auto; overflow: hidden; background: transparent; z-index: 100; }
    .html-label .graph-message { transform-origin: top left; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => this.syncGraph());
    this.watchWith($graphEdges, () => this.syncGraph());
    this.watchWith($activeLens, () => this.applyLensStyles());
    this.watchWith($selectedNodeId, (id) => this.centerOnNode(id));
    this.watchWith($viewport, (vp) => this.restoreViewport(vp));
    mountTestApi('graph', {
      getNodeCount: () => this.cy?.nodes().length ?? 0,
      getEdgeCount: () => this.cy?.edges().length ?? 0,
      getNodeData: (id: string) => this.cy?.getElementById(id).data() ?? null,
      getAllNodeIds: () => this.cy?.nodes().map((n) => n.id()) ?? [],
      clickNode: (id: string) => this.cy?.getElementById(id).emit('tap'),
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.cy?.destroy();
  }

  override firstUpdated() {
    const container = this.shadowRoot?.getElementById('cy-container');
    if (!container) return;

    this.cy = cytoscape({
      container,
      style: this.getBaseStyle(),
      layout: { name: 'preset', fit: false },
      minZoom: 0.1, maxZoom: 10,
      wheelSensitivity: 0.15,
      boxSelectionEnabled: false,
    });

    this.cy.on('render', () => this.renderHtmlLabels());
    this.cy.on('viewport', this.throttle(() => {
      $viewport.set({ x: this.cy!.pan().x, y: this.cy!.pan().y, zoom: this.cy!.zoom() });
    }, 100));

    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const id = node.id();
      const term = node.data('term') || id;
      $selectedNodeId.set(id);
      send({ type: 'focus.set', term });
    });

    this.applyLensStyles();
  }

  private throttle(fn: () => void, ms: number) {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn(); }
    };
  }

  private getBaseStyle(): any[] {
    return [
      { selector: 'node', style: {
        'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center',
        'color': '#fff', 'text-outline-width': 2, 'text-outline-color': '#000',
        'font-size': '11px', 'font-family': 'JetBrains Mono, monospace',
      }},
      { selector: 'node.html-enabled', style: { 'label': '' }},
      { selector: 'edge', style: {
        'width': 1.5, 'line-color': '#444', 'target-arrow-color': '#444',
        'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'opacity': 0.3,
      }},
      { selector: 'edge.thread-edge', style: {
        'line-color': '#00f3ff', 'width': 2, 'line-style': 'dotted',
        'target-arrow-shape': 'none', 'opacity': 0.6,
      }},
      { selector: 'edge[type="derivation"]', style: {
        'line-color': '#FFaa00', 'line-style': 'dashed', 'width': 2,
        'target-arrow-shape': 'vee', 'curve-style': 'unbundled-bezier',
      }},
      { selector: '.focused', style: {
        'border-width': 3, 'border-color': '#00f3ff', 'z-index': 999,
      }},
    ];
  }

  private renderHtmlLabels() {
    if (!this.cy) return;
    this.htmlLabels = computeHtmlLabels(this.cy);
    this.requestUpdate();
  }

  private centerOnNode(id: string | null) {
    if (!id || !this.cy) return;
    const node = this.cy.getElementById(id);
    if (!node.length) return;
    this.cy.animate({ center: { eles: node }, zoom: 1.8, duration: 300 });
    node.style({ 'border-color': '#00f3ff', 'border-width': 4 });
    setTimeout(() => node.style({ 'border-width': 2, 'border-color': '#00f3ff' }), 1000);
  }

  private savePositions() {
    const positions = new Map<string, { x: number; y: number }>();
    if (this.cy) this.cy.nodes().forEach((n) => { positions.set(n.id(), n.position()); });
    return positions;
  }

  private restorePositions(positions: Map<string, { x: number; y: number }>) {
    if (!this.cy) return;
    this.cy.nodes().forEach((n) => {
      const pos = positions.get(n.id());
      if (pos) n.position(pos);
    });
  }

  private applyLensStyles() {
    if (!this.cy) return;
    applyLensStyles(this.cy, $activeLens.get());
  }

  private restoreViewport(vp: { x: number; y: number; zoom: number }) {
    if (!this.cy || this.mounted) return;
    this.mounted = true;
    this.cy.pan({ x: vp.x, y: vp.y });
    this.cy.zoom(vp.zoom);
  }

  private syncGraph() {
    if (!this.cy) return;
    const cy = this.cy;
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    const oldPositions = this.savePositions();

    cy.batch(() => {
      const currentIds = new Set(cy.nodes().map((n) => n.id()));

      for (const [nodeId, nd] of nodes) {
        if (currentIds.has(nodeId)) {
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

      const currentEdgeKeys = new Set(cy.edges().map((e) => edgeKey(e.data('source'), e.data('target'))));
      for (const [key, ed] of edges) {
        if (!currentEdgeKeys.has(key)) cy.add({ group: 'edges', data: { ...ed } });
      }
      for (const e of cy.edges()) {
        const key = edgeKey(e.data('source'), e.data('target'));
        if (!edges.has(key)) e.remove();
      }
    });

    this.restorePositions(oldPositions);
    layoutConversationThread(cy, $chatMessages.get());
    this.applyLensStyles();

    const firstLayout = cy.nodes().length <= 1;
    cy.layout({ name: 'cose', animate: true, animationDuration: 300, fit: firstLayout, padding: 20 }).run();
  }

  override render() {
    const meta = $graphMeta.get();
    return html`
      <div id="cy-container"></div>
      ${meta?.truncated ? html`<div class="warning">▼ ${meta.totalHidden} lower-priority concepts hidden</div>` : ''}
      ${Array.from(this.htmlLabels.values()).map(d => html`
        <div class="html-label" style="left:${d.x}px;top:${d.y}px;width:${d.width}px;height:${d.height}px" .innerHTML=${d.html}></div>
      `)}
    `;
  }
}