import cytoscape, { type Core } from 'cytoscape';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ChatMessage, GraphNodeData } from '../../shared/protocol.js';
import { edgeKey } from '../../shared/utils.js';
import {
  $activeLens,
  $chatMessages,
  $focusTerm,
  $graphEdges,
  $graphFilter,
  $graphMeta,
  $graphNodes,
  $lensLayout,
  $lensViewport,
  $selectedNodeId,
  $selectedNodeIds,
  $viewport,
  eventBus,
  mountTestApi,
  send,
} from '../core/index.js';
import { BaseComponent } from '../core/index.js';
import { layoutConversationThread } from '../utils/graph-layout.js';
import { type HtmlLabelData, computeHtmlLabels } from '../utils/html-labels.js';
import { layoutRegistry } from '../utils/layout-registry.js';
import { applyLensStyles } from '../utils/lens-styles.js';
import { TOKEN_COLORS } from '../utils/token-colors.js';
import './graph-minimap.js';

const CHAT_NODE_STYLE = {
  shape: 'round-rectangle',
  'border-color': TOKEN_COLORS.accentCyan,
  'border-width': 1.5,
};

@customElement('graph-viewport')
export class GraphViewport extends BaseComponent {
  private cy: Core | null = null;
  private mounted = false;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private contextTarget: string | null = null;
  private prevNodeCount = 0;
  private layoutHandler = (layoutName: string) => {
    if (!this.cy) return;
    const lens = $activeLens.get();
    const layouts = { ...$lensLayout.get(), [lens]: layoutName };
    $lensLayout.set(layouts);
    const def = layoutRegistry.get(layoutName);
    if (def) this.cy.layout(def.getLayout(this.cy, { fit: false })).run();
  };
  @state() private htmlLabels = new Map<string, HtmlLabelData>();
  @state() private tooltip: { x: number; y: number; content: string } | null = null;
  @state() private contextMenu: { x: number; y: number; nodeId: string } | null = null;
  // LOD (Level of Detail) thresholds for performance
  private readonly LOD_LABEL_ZOOM = 0.5;
  private readonly LOD_EDGE_THIN_ZOOM = 0.3;

  static override styles = css`
    :host { display: block; position: relative; flex: 1; background: var(--colors-semantic-bg-base); min-height: 0; }
    #cy-container { width: 100%; height: 100%; }
    .warning { position: absolute; bottom: 8px; left: 8px; background: rgba(255, 176, 0, 0.1); border-left: 2px solid var(--colors-primitive-warning); padding: 4px 8px; font-family: var(--typography-fontFamilies-data); font-size: 0.65rem; color: var(--colors-primitive-warning); pointer-events: none; }
    .html-label { position: absolute; pointer-events: auto; overflow: hidden; background: transparent; z-index: 100; }
    .html-label .graph-message { transform-origin: top left; }

    /* Tooltip */
    .tooltip {
      position: absolute; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel); padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-primary); pointer-events: none; z-index: var(--zIndex-layers-popover);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: nowrap; transform: translate(-50%, -100%); margin-top: -8px;
    }
    .tooltip-row { display: flex; justify-content: space-between; gap: var(--spacing-scale-4); }
    .tooltip-label { color: var(--colors-semantic-text-muted); }
    .tooltip-value { color: var(--colors-semantic-text-primary); font-variant-numeric: tabular-nums; }
    .tooltip-divider { height: 1px; background: var(--colors-semantic-border-subtle); margin: var(--spacing-scale-1) 0; }

    /* Context menu */
    .context-menu {
      position: absolute; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel); padding: var(--spacing-scale-1);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      z-index: var(--zIndex-layers-popover); box-shadow: 0 4px 12px rgba(0,0,0,0.3); min-width: 140px;
    }
    .context-item {
      display: flex; align-items: center; gap: var(--spacing-scale-2); width: 100%; padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border: none; background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; transition: var(--transitions-fast); text-align: left; border-radius: var(--borderRadius-component-input);
    }
    .context-item:hover { background: var(--colors-semantic-bg-panel-hover); color: var(--colors-semantic-accent-primary); }
    .context-divider { height: 1px; background: var(--colors-semantic-border-subtle); margin: var(--spacing-scale-1) 0; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => this.syncGraph());
    this.watchWith($graphEdges, () => this.syncGraph());
    this.watchWith($activeLens, () => {
      this.applyLensStyles();
      this.restoreLensViewport();
    });
    this.watchWith($selectedNodeId, (id) => this.centerOnNode(id));
    this.watchWith($viewport, (vp) => this.restoreViewport(vp));
    this.watchWith($graphFilter, () => this.applyGraphFilter());
    eventBus.on('graph:layout', this.layoutHandler);
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
    eventBus.off('graph:layout', this.layoutHandler);
    this.cy?.destroy();
  }
  override firstUpdated() {
    const container = this.shadowRoot?.getElementById('cy-container');
    if (!container) return;

    this.cy = cytoscape({
      container,
      style: this.getBaseStyle(),
      layout: { name: 'preset', fit: false },
      minZoom: 0.1,
      maxZoom: 10,
      wheelSensitivity: 0.15,
      boxSelectionEnabled: false,
    });

    this.cy.on('render', () => this.renderHtmlLabels());
    this.cy.on(
      'viewport',
      this.throttle(() => {
        const vp = { x: this.cy!.pan().x, y: this.cy!.pan().y, zoom: this.cy!.zoom() };
        $viewport.set(vp);
        // Persist per-lens viewport
        const lens = $activeLens.get();
        const all = { ...$lensViewport.get(), [lens]: vp };
        $lensViewport.set(all);
        // Apply LOD based on zoom level
        this.applyLOD(vp.zoom);
      }, 100)
    );

    // Click: select + center + open detail drawer
    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const id = node.id();
      if (evt.originalEvent?.shiftKey) {
        this.toggleMultiSelect(id);
      } else {
        $selectedNodeIds.set(new Set([id]));
        $selectedNodeId.set(id);
        const term = node.data('term') || id;
        send({ type: 'focus.set', term });
      }
    });

    // Click on background: deselect
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        $selectedNodeId.set(null);
        $selectedNodeIds.set(new Set());
        this.closeContextMenu();
      }
    });

    // Double-click: focus term
    this.cy.on('dblclick', 'node', (evt) => {
      const node = evt.target;
      const term = node.data('term') || node.id();
      $focusTerm.set(term);
      send({ type: 'focus.set', term });
    });

    // Right-click: context menu
    this.cy.on('cxttap', 'node', (evt) => {
      evt.originalEvent?.preventDefault();
      const node = evt.target;
      this.contextTarget = node.id();
      const pos = evt.renderedPosition || node.renderedPosition();
      this.contextMenu = { x: pos.x, y: pos.y, nodeId: node.id() };
      this.requestUpdate();
    });

    // Hover tooltip (500ms delay)
    this.cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      this.tooltipTimer = setTimeout(() => {
        const pos = node.renderedPosition();
        const data = node.data();
        this.tooltip = {
          x: pos.x,
          y: pos.y,
          content: this.buildTooltipContent(data),
        };
        this.requestUpdate();
      }, 500);
    });

    this.cy.on('mouseout', 'node', () => {
      if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
      this.tooltip = null;
      this.requestUpdate();
    });

    this.applyLensStyles();
  }

  private buildTooltipContent(data: Record<string, any>): string {
    const p = (data.priority ?? 0).toFixed(3);
    const c = (data.confidence ?? 0).toFixed(3);
    const score = data.lensData?.score?.toFixed(3) ?? '—';
    const term = data.term ?? data.label ?? data.id;
    const degree = this.cy?.getElementById(data.id).degree() ?? 0;
    return `<div class="tooltip-row"><span class="tooltip-label">${term}</span></div>
<div class="tooltip-divider"></div>
<div class="tooltip-row"><span class="tooltip-label">Priority</span><span class="tooltip-value">${p}</span></div>
<div class="tooltip-row"><span class="tooltip-label">Confidence</span><span class="tooltip-value">${c}</span></div>
<div class="tooltip-row"><span class="tooltip-label">Score</span><span class="tooltip-value">${score}</span></div>
<div class="tooltip-row"><span class="tooltip-label">Degree</span><span class="tooltip-value">${degree}</span></div>`;
  }

  private toggleMultiSelect(id: string) {
    const selected = new Set($selectedNodeIds.get());
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    $selectedNodeIds.set(selected);
    // Also keep single selection in sync
    if (selected.size === 1) {
      $selectedNodeId.set(selected.values().next().value ?? null);
    } else if (selected.size === 0) {
      $selectedNodeId.set(null);
    }
  }

  private closeContextMenu() {
    this.contextMenu = null;
    this.contextTarget = null;
  }

  private contextFocus() {
    if (this.contextTarget) {
      $selectedNodeId.set(this.contextTarget);
      send({ type: 'focus.set', term: this.contextTarget });
    }
    this.closeContextMenu();
  }
  private contextPin() {
    if (this.contextTarget) {
      const ids = new Set($selectedNodeIds.get());
      ids.add(this.contextTarget);
      $selectedNodeIds.set(ids);
    }
    this.closeContextMenu();
  }
  private contextHide() {
    if (this.contextTarget) {
      const nodes = new Map($graphNodes.get());
      nodes.delete(this.contextTarget);
      $graphNodes.set(nodes);
    }
    this.closeContextMenu();
  }
  private contextCopy() {
    if (this.contextTarget) {
      const nd = $graphNodes.get().get(this.contextTarget);
      if (nd?.term) navigator.clipboard.writeText(nd.term).catch(() => {});
    }
    this.closeContextMenu();
  }

  /** Apply Level-of-Detail based on zoom level to maintain performance. */
  private applyLOD(zoom: number) {
    if (!this.cy) return;
    const showLabels = zoom >= this.LOD_LABEL_ZOOM;
    const thinEdges = zoom < this.LOD_EDGE_THIN_ZOOM;

    this.cy.batch(() => {
      this.cy!.nodes().style('label', showLabels ? 'data(label)' : '');
      this.cy!.edges().style('width', thinEdges ? 0.5 : 1.5);
    });
  }

  private throttle(fn: () => void, ms: number) {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn();
      }
    };
  }

  private getBaseStyle(): any[] {
    return [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          color: TOKEN_COLORS.textPrimary,
          'text-outline-width': 2,
          'text-outline-color': TOKEN_COLORS.void,
          'font-size': '11px',
          'font-family': 'JetBrains Mono, monospace',
          'transition-property':
            'background-color, width, height, opacity, border-color, border-width',
          'transition-duration': '0.25s',
        },
      },
      { selector: 'node.html-enabled', style: { label: '' } },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': TOKEN_COLORS.borderDefault,
          'target-arrow-color': TOKEN_COLORS.borderDefault,
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          opacity: 0.3,
        },
      },
      {
        selector: 'edge.thread-edge',
        style: {
          'line-color': TOKEN_COLORS.accentCyan,
          width: 2,
          'line-style': 'dotted',
          'target-arrow-shape': 'none',
          opacity: 0.6,
        },
      },
      {
        selector: 'edge[type="derivation"]',
        style: {
          'line-color': TOKEN_COLORS.warning,
          'line-style': 'dashed',
          width: 2,
          'target-arrow-shape': 'vee',
          'curve-style': 'unbundled-bezier',
        },
      },
      {
        selector: '.focused',
        style: {
          'border-width': 3,
          'border-color': TOKEN_COLORS.accentCyan,
          'z-index': 999,
        },
      },
      {
        selector: '.selected',
        style: {
          'border-width': 3,
          'border-color': TOKEN_COLORS.accentCyan,
          'z-index': 998,
        },
      },
      {
        selector: '.multi-selected',
        style: {
          'border-width': 2,
          'border-color': TOKEN_COLORS.accentAmber,
          'z-index': 997,
        },
      },
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
    this.highlightNode(node);
  }

  private highlightNode(node: cytoscape.NodeSingular) {
    this.cy?.nodes().removeClass('selected');
    node.addClass('selected');
    setTimeout(() => {
      node.removeClass('selected');
    }, 1500);
  }

  private savePositions() {
    const positions = new Map<string, { x: number; y: number }>();
    if (this.cy)
      this.cy.nodes().forEach((n) => {
        positions.set(n.id(), n.position());
      });
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

  private applyGraphFilter() {
    if (!this.cy) return;
    const filter = $graphFilter.get();
    this.cy.nodes().forEach((n) => {
      if (filter === 'contradiction') {
        const ld = n.data('lensData');
        const isContradiction =
          ld && (ld.color?.includes('ffaa00') || ld.color?.includes('ffb000'));
        n.style('display', isContradiction ? 'element' : 'none');
      } else {
        n.style('display', 'element');
      }
    });
  }

  private restoreViewport(vp: { x: number; y: number; zoom: number }) {
    if (!this.cy || this.mounted) return;
    this.mounted = true;
    this.cy.pan({ x: vp.x, y: vp.y });
    this.cy.zoom(vp.zoom);
  }

  private restoreLensViewport() {
    if (!this.cy) return;
    const lens = $activeLens.get();
    const vp = $lensViewport.get()[lens];
    if (vp && this.mounted) {
      this.cy.pan({ x: vp.x, y: vp.y });
      this.cy.zoom(vp.zoom);
    }
  }

  private syncGraph() {
    if (!this.cy) return;
    const cy = this.cy;
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    const oldPositions = this.savePositions();
    const graphFilter = $graphFilter.get();

    cy.batch(() => {
      const currentIds = new Set(cy.nodes().map((n) => n.id()));

      for (const [nodeId, nd] of nodes) {
        if (currentIds.has(nodeId)) {
          cy.getElementById(nodeId).data(nd);
        } else {
          const nodeType = nd.nodeType === 'message' ? 'message' : 'concept';
          const data = {
            id: nodeId,
            color: TOKEN_COLORS.accentCyan,
            term: nd.term,
            nodeType,
            priority: nd.priority,
            confidence: nd.confidence,
            lensData: nd.lensData,
            label: nd.label,
          };
          cy.add({
            group: 'nodes',
            data,
            classes: nodeType === 'message' ? 'chat-message-node' : '',
          });
          if (nodeType === 'message') cy.getElementById(nodeId).style(CHAT_NODE_STYLE);
        }
      }

      for (const nid of currentIds) {
        if (!nodes.has(nid)) cy.getElementById(nid).remove();
      }

      const currentEdgeKeys = new Set(
        cy.edges().map((e) => edgeKey(e.data('source'), e.data('target')))
      );
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
    this.applyGraphFilter();

    // Update multi-select styles
    cy.nodes().removeClass('multi-selected');
    const selectedIds = $selectedNodeIds.get();
    for (const id of selectedIds) {
      const node = cy.getElementById(id);
      if (node.length) node.addClass('multi-selected');
    }

    const currentNodeCount = cy.nodes().length;
    const lens = $activeLens.get();
    const isFirstLayout = currentNodeCount <= 1;
    const topologyChanged = layoutRegistry.shouldRelayout(this.prevNodeCount, currentNodeCount);
    this.prevNodeCount = currentNodeCount;

    if (isFirstLayout || topologyChanged) {
      layoutRegistry.runLayout(cy, lens, { fit: isFirstLayout });
    }
  }

  override render() {
    const meta = $graphMeta.get();
    return html`
      <div id="cy-container" @click=${this.closeContextMenu}></div>
      ${meta?.truncated ? html`<div class="warning">▼ ${meta.totalHidden} lower-priority concepts hidden</div>` : ''}
      ${Array.from(this.htmlLabels.values()).map(
        (d) => html`
        <div class="html-label" style="left:${d.x}px;top:${d.y}px;width:${d.width}px;height:${d.height}px" .innerHTML=${d.html}></div>
      `
      )}
      ${
        this.tooltip
          ? html`
        <div class="tooltip" style="left:${this.tooltip.x}px;top:${this.tooltip.y}px" .innerHTML=${this.tooltip.content}></div>
      `
          : ''
      }
      ${
        this.contextMenu
          ? html`
        <div class="context-menu" style="left:${this.contextMenu.x}px;top:${this.contextMenu.y}px">
          <button class="context-item" @click=${this.contextFocus}>Focus Term</button>
          <button class="context-item" @click=${this.contextPin}>Pin to Selection</button>
          <button class="context-item" @click=${this.contextHide}>Hide</button>
          <div class="context-divider"></div>
          <button class="context-item" @click=${this.contextCopy}>Copy Term</button>
        </div>
      `
          : ''
      }
      <graph-minimap></graph-minimap>
    `;
  }
}
