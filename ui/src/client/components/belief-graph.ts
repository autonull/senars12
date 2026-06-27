import cytoscape, { type Core } from 'cytoscape';
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $graphNodes, $graphEdges, $graphMeta } from '../core/store.js';

@customElement('belief-graph')
export class BeliefGraph extends LitElement {
  private cy: Core | null = null;

  static override styles = css`
    :host { display: block; position: relative; flex: 1; background: var(--bg-void); min-height: 0; }
    #graph { width: 100%; height: 100%; }
    .warning { position: absolute; bottom: 8px; left: 8px; background: rgba(255, 176, 0, 0.1); border-left: 2px solid var(--accent-amber); padding: 4px 8px; font-family: var(--font-data); font-size: 0.65rem; color: var(--accent-amber); pointer-events: none; }
  `;

  private unsubNodes = $graphNodes.subscribe(() => this.syncGraph());
  private unsubEdges = $graphEdges.subscribe(() => this.syncGraph());

  override connectedCallback() {
    super.connectedCallback();
    const w = window as any;
    w.__testApi = w.__testApi || {};
    w.__testApi.graph = {
      getNodeCount: () => this.cy?.nodes().length ?? 0,
      getEdgeCount: () => this.cy?.edges().length ?? 0,
      getNodeData: (id: string) => this.cy?.getElementById(id).data() ?? null,
      getAllNodeIds: () => this.cy?.nodes().map(n => n.id()) ?? [],
      clickNode: (id: string) => this.cy?.getElementById(id).emit('tap'),
    };
  }

  override disconnectedCallback() {
    this.unsubNodes();
    this.unsubEdges();
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
            'border-opacity': 'mapData(confidence, 0, 1, 0.3, 1)',
          },
        },
        {
          selector: 'node:active',
          style: { 'border-color': '#ffb000', 'border-width': 3 } as any,
        },
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
  }

  private syncGraph() {
    if (!this.cy) return;
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();

    this.cy.batch(() => {
      const cyNodes = this.cy!.nodes();
      const cyEdges = this.cy!.edges();

      const currentNodeIds = new Set(cyNodes.map(n => n.id()));
      for (const [id, data] of nodes) {
        if (currentNodeIds.has(id)) {
          this.cy!.getElementById(id).data(data);
        } else {
          this.cy!.add({ group: 'nodes', data: { id, color: '#00f3ff', ...data } });
        }
      }
      for (const id of currentNodeIds) {
        if (!nodes.has(id)) this.cy!.getElementById(id).remove();
      }

      const currentEdgeKeys = new Set(cyEdges.map(e => `${e.data('source')}->${e.data('target')}`));
      for (const [key, data] of edges) {
        if (!currentEdgeKeys.has(key)) {
          this.cy!.add({ group: 'edges', data: { ...data } });
        }
      }
      for (const e of cyEdges) {
        const key = `${e.data('source')}->${e.data('target')}`;
        if (!edges.has(key)) e.remove();
      }
    });

    this.cy.layout({ name: 'cose', animate: true, animationDuration: 300, fit: true, padding: 20 }).run();
  }

  override render() {
    const meta = $graphMeta.get();
    return html`
      <div id="graph"></div>
      ${meta.truncated ? html`<div class="warning">▼ ${meta.total_hidden} lower-priority concepts hidden</div>` : ''}
    `;
  }
}
