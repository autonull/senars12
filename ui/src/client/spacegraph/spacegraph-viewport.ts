// @ts-nocheck
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { edgeKey } from '../../shared/utils.js';
import { BaseComponent } from '../core/base-component.js';
import {
  $activeLens,
  $chatMessages,
  $focusTerm,
  $graphEdges,
  $graphFilter,
  $graphMeta,
  $graphNodes,
  $lensViewport,
  $selectedNodeId,
  $selectedNodeIds,
  $view,
  $viewport,
  evaluateLens,
  eventBus,
  mountTestApi,
  send,
} from '../core/index.js';
import { TOKEN_COLORS } from '../utils/token-colors.js';
import { applyDelta, checkUnsupportedChannels, clearNodeStyles } from './adapter-3d.js';

// Dynamic import SpaceGraphJS (source-level via Vite alias)
import { Edge, ForceLayout, HtmlNode, ShapeNode, SpaceGraph, Wire } from 'spacegraphjs';

interface NodeSpec3D {
  id: string;
  type: string;
  label?: string;
  position?: [number, number, number];
  data?: Record<string, unknown>;
}

interface EdgeSpec3D {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
}

const CHAT_NODE_STYLE = {
  shape: 'round-rectangle',
  'border-color': TOKEN_COLORS.accentCyan,
  'border-width': 1.5,
};

@customElement('spacegraph-viewport')
export class SpaceGraphViewport extends BaseComponent {
  static override styles = css`
    :host { display: block; position: relative; flex: 1; background: var(--colors-semantic-bg-base); min-height: 0; }
    #sg-container { width: 100%; height: 100%; position: relative; }
    .warning { position: absolute; bottom: 8px; left: 8px; background: rgba(255, 176, 0, 0.1); border-left: 2px solid var(--colors-primitive-warning); padding: 4px 8px; font-family: var(--typography-fontFamilies-data); font-size: 0.65rem; color: var(--colors-primitive-warning); pointer-events: none; }
    .tooltip { position: absolute; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-default); border-radius: var(--borderRadius-component-panel); padding: var(--spacing-scale-2) var(--spacing-scale-3); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-primary); pointer-events: none; z-index: var(--zIndex-layers-popover); box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: nowrap; transform: translate(-50%, -100%); margin-top: -8px; }
    .tooltip-row { display: flex; justify-content: space-between; gap: var(--spacing-scale-4); }
    .tooltip-label { color: var(--colors-semantic-text-muted); }
    .tooltip-value { color: var(--colors-semantic-text-primary); font-variant-numeric: tabular-nums; }
    .tooltip-divider { height: 1px; background: var(--colors-semantic-border-subtle); margin: var(--spacing-scale-1) 0; }
  `;

  private sg: SpaceGraph | null = null;
  private mounted = false;
  @state() private tooltip: { x: number; y: number; content: string } | null = null;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private prevNodeCount = 0;
  @state() private unsupportedChannelsWarning: string | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => this.syncGraph());
    this.watchWith($graphEdges, () => this.syncGraph());
    this.watchWith($activeLens, () => {
      clearNodeStyles(this.sg!);
      const delta = evaluateLens();
      const isEdge = (id: string) => $graphEdges.get().has(id);
      const unsupported = checkUnsupportedChannels(delta, isEdge);
      this.showUnsupportedWarning(unsupported);
      applyDelta(
        { sg: this.sg!, updatePosition: (id, pos) => this.updatePosition(id, pos) },
        delta
      );
      this.restoreLensViewport();
    });
    this.watchWith($view, () => {
      if (!this.sg) return;
      const delta = evaluateLens();
      const isEdge = (id: string) => $graphEdges.get().has(id);
      const unsupported = checkUnsupportedChannels(delta, isEdge);
      this.showUnsupportedWarning(unsupported);
      applyDelta({ sg: this.sg, updatePosition: (id, pos) => this.updatePosition(id, pos) }, delta);
    });
    this.watchWith($selectedNodeId, (id) => this.centerOnNode(id));
    this.watchWith($viewport, (vp) => this.restoreViewport(vp));
    this.watchWith($graphFilter, () => this.applyGraphFilter());
    eventBus.on('graph:layout', this.layoutHandler);
    mountTestApi('spacegraph', {
      getNodeCount: () => this.sg?.nodeCount ?? 0,
      getEdgeCount: () => this.sg?.edgeCount ?? 0,
      getNodeData: (id: string) => this.sg?.getNode(id)?.data ?? null,
      getAllNodeIds: () => this.sg?.nodes.map((n) => n.id) ?? [],
      clickNode: (id: string) => this.sg?.getNode(id)?.object?.dispatchEvent?.(new Event('click')),
    });
  }

  private showUnsupportedWarning(channels: string[]): void {
    this.unsupportedChannelsWarning =
      channels.length > 0 ? `Unsupported channels: ${channels.join(', ')}` : null;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    eventBus.off('graph:layout', this.layoutHandler);
    this.sg?.dispose();
  }

  override async firstUpdated() {
    const container = this.shadowRoot?.getElementById('sg-container');
    if (!container) return;

    this.sg = await SpaceGraph.create(container, {
      nodes: [],
      edges: [],
    });
    this.sg.render();

    // Register interaction callbacks on nodes
    this.sg.events.on('node:added', (data: { node: any }) => {
      this.setupNodeInteractions(data.node);
    });

    this.sg.events.on('node:updated', (data: { node: any; changes: any }) => {
      this.handleNodeUpdate(data.node, data.changes);
    });

    this.sg.events.on('node:removed', (data: { id: string }) => {
      this.handleNodeRemove(data.id);
    });

    // Viewport sync from SpaceGraph camera
    this.sg.cameraControls.addEventListener('change', () => this.onCameraChange());
    this.sg.events.on('preRender', () => this.onPreRender());
  }

  private onPreRender(): void {
    // No-op — Lit reactive updates handle HTML label rendering differently
  }

  private onCameraChange(): void {
    if (!this.sg) return;
    const vp = {
      x: this.sg.cameraPosition[0],
      y: this.sg.cameraPosition[1],
      zoom: this.sg.renderer.camera.position.length() / 500, // rough zoom proxy
    };
    $viewport.set(vp);
    const lens = $activeLens.get();
    const all = { ...$lensViewport.get(), [lens]: vp };
    $lensViewport.set(all);
  }

  private layoutHandler = (layoutName: string) => {
    if (!this.sg) return;
    this.sg.layout(layoutName as any, { animate: true, duration: 1.0 });
  };

  private setupNodeInteractions(node: any): void {
    const object = node.object;
    if (!object) return;

    // Raycast on click
    object.userData = { ...object.userData, nodeId: node.id };

    // Three.js raycast handles clicks — we'll wire in render()
  }

  private handleNodeUpdate(node: any, changes: any): void {
    // Visual updates handled by modulation pipeline — no-op
  }

  private handleNodeRemove(nodeId: string): void {
    // Clean up
  }

  private applyGraphFilter(): void {
    if (!this.sg) return;
    const filter = $graphFilter.get();
    this.sg.forNodes((node: any) => {
      if (filter === 'contradiction') {
        node.object.visible = !!node.data?.isContradiction;
      } else {
        node.object.visible = true;
      }
    });
  }

  private restoreViewport(vp: { x: number; y: number; zoom: number }) {
    if (!this.sg || this.mounted) return;
    this.mounted = true;
    // SpaceGraph uses 3D camera — convert 2D pan to camera position
    this.sg.setCamera([vp.x, 500 * vp.zoom, vp.y], [vp.x, 0, vp.y]);
  }

  private restoreLensViewport(): void {
    if (!this.sg) return;
    const lens = $activeLens.get();
    const vp = $lensViewport.get()[lens];
    if (vp && this.mounted) {
      this.sg.setCamera([vp.x, 500 * vp.zoom, vp.y], [vp.x, 0, vp.y]);
    }
  }

  private centerOnNode(id: string | null): void {
    if (!id || !this.sg) return;
    this.sg.focusNode(id, 100, 1);
  }

  private syncGraph(): void {
    if (!this.sg) return;
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    const graphFilter = $graphFilter.get();

    // Diff and apply
    const currentNodeIds = new Set(this.sg.nodes.map((n) => n.id));
    const targetNodeIds = new Set(nodes.keys());

    // Remove nodes no longer present
    for (const id of currentNodeIds) {
      if (!targetNodeIds.has(id)) {
        this.sg.removeNode(id);
      }
    }

    // Add or update nodes
    for (const [nodeId, nd] of nodes) {
      if (this.sg.getNode(nodeId)) {
        // Update existing
        this.sg.update({
          nodes: [{ id: nodeId, data: nd }],
        });
      } else {
        // Add new
        const nodeType = nd.nodeType === 'message' ? 'HtmlNode' : 'ShapeNode';
        const position: [number, number, number] = nd.layout
          ? [nd.layout.x ?? 0, nd.layout.y ?? 0, 0]
          : [0, 0, 0];

        const nodeData: Record<string, unknown> = {
          color: TOKEN_COLORS.accentCyan,
          priority: nd.priority,
          confidence: nd.confidence,
          isContradiction: nd.isContradiction,
          label: nd.label,
          html: nd.html,
          shape: 'sphere',
          size: 40,
        };

        if (nodeType === 'HtmlNode' && nd.html) {
          nodeData.html = nd.html;
        }

        this.sg.addNode({
          id: nodeId,
          type: nodeType,
          label: nd.label ?? nodeId,
          position,
          data: nodeData,
        });
      }
    }

    // Sync edges
    const currentEdgeKeys = new Set(Array.from(this.sg.graph.edges.keys()));
    const targetEdgeKeys = new Set(edges.keys());

    for (const key of currentEdgeKeys) {
      if (!targetEdgeKeys.has(key)) {
        // Need to find edge by source/target
        const [source, target] = key.split('->');
        this.sg.removeEdge(key);
      }
    }

    for (const [key, ed] of edges) {
      if (!currentEdgeKeys.has(key)) {
        const [source, target] = key.split('->');
        this.sg.addEdge({
          id: key,
          source,
          target,
          type: ed.type ?? 'Edge',
          data: ed.data,
        });
      }
    }

    // Apply modulation pipeline after sync
    clearNodeStyles(this.sg);
    const delta = evaluateLens();
    const isEdgeCheck = (id: string) => $graphEdges.get().has(id);
    const unsupported = checkUnsupportedChannels(delta, isEdgeCheck);
    this.showUnsupportedWarning(unsupported);
    applyDelta({ sg: this.sg, updatePosition: (id, pos) => this.updatePosition(id, pos) }, delta);
    this.applyGraphFilter();

    // Run layout if needed
    const currentNodeCount = this.sg.nodeCount;
    const isFirstLayout = currentNodeCount <= 1;
    if (isFirstLayout || this.shouldRelayout(this.prevNodeCount, currentNodeCount)) {
      this.sg.layout('ForceLayout', { animate: isFirstLayout, duration: isFirstLayout ? 0 : 1.0 });
    }
    this.prevNodeCount = currentNodeCount;

    // Update multi-select styles
    const selectedIds = $selectedNodeIds.get();
    this.sg.deselectAll();
    for (const id of selectedIds) {
      this.sg.select(id);
    }
  }

  private shouldRelayout(oldCount: number, newCount: number): boolean {
    // Simple heuristic: relayout if node count changed significantly
    return Math.abs(newCount - oldCount) > Math.max(5, oldCount * 0.2);
  }

  private updatePosition(id: string, position: [number, number, number]): void {
    const node = this.sg?.getNode(id);
    if (node?.object) {
      this.sg?.update({ nodes: [{ id, position }] });
    }
  }

  override render() {
    const meta = $graphMeta.get();
    return html`
      <div id="sg-container" @click=${() => {
        this.sg?.deselectAll();
        $selectedNodeId.set(null);
      }}></div>
      ${meta?.truncated ? html`<div class="warning">▼ ${meta.totalHidden} lower-priority concepts hidden</div>` : ''}
      ${this.unsupportedChannelsWarning ? html`<div class="warning">${this.unsupportedChannelsWarning}</div>` : ''}
      ${
        this.tooltip
          ? html`
        <div class="tooltip" style="left:${this.tooltip.x}px;top:${this.tooltip.y}px" .innerHTML=${this.tooltip.content}></div>
      `
          : ''
      }
    `;
  }
}
