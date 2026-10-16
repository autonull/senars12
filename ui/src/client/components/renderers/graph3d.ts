// @ts-nocheck
/**
 * The Graph3D workspace renderer — full parity implementation (§3.2, Phase 3).
 * Implements the WorkspaceRenderer contract over SpaceGraphJS with fractal LOD,
 * semantic edge navigation, and 2D↔3D snapshot/restore round-trips.
 */

import type {
  Ref,
  SemanticBlock,
  SemanticLink,
  WorkspaceGraph,
  WorkspaceOp,
} from '../../core/workspace-graph.js';
import { graphRenderableKinds } from '../../core/block-descriptors.js';
import {
  registerRenderer,
  type RendererSnapshot,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
  type RendererContext,
  type IntentRef,
  type FocusRef,
  type Patch,
  type ItemPatch,
  type Cell,
} from '../../core/workspace-renderer.js';
import { focusRefId } from '../../framework/coordinates.js';
import type { Channel } from '../../modulation/types.js';
import { diffWorkspaceGraph } from '../../core/workspace-diff.js';
import { applyWorkspaceOps } from '../../core/workspace-graph.js';
import { getSpaceGraphViewport } from '../../spacegraph/spacegraph-viewport.js';
import { theme } from '../../utils/theme.js';
import { $workspaceGraph, setWorkspaceFocus, setWorkspaceSelection, $focus, $depth, $aspect } from '../../core/store.js';

interface SpaceGraphNodeSpec {
  id: string;
  type: string;
  label?: string;
  position?: [number, number, number];
  data?: Record<string, unknown>;
}

interface SpaceGraphEdgeSpec {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
}

interface ViewportState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

class Graph3DRenderer implements WorkspaceRenderer {
  readonly id = 'graph-3d';
  readonly label = '3D Graph';

  private ctx?: RendererContext;
  private element?: HTMLElement;
  private focusRef?: FocusRef;
  private selection = new Set<string>();
  private viewportState?: ViewportState;

  capabilities(): WorkspaceRendererCaps {
    return {
      interactions: [
        'compose',
        'stream',
        'artifacts',
        'inspect',
        'explain',
        'select-context',
        'follow-up',
        'steer',
        'run-control',
        'palette',
        'structure-nav',
        'embed',
      ],
      blockKinds: 'all',
      parity: 'full',
      surface: 'spacegraph-viewport',
      requiredCapability: 'reasoning',
      channels: {
        node: new Set<Channel>([
          'color',
          'opacity',
          'size',
          'label',
          'stroke.dash',
          'stroke.width',
          'z',
        ]),
        edge: new Set<Channel>([
          'color',
          'edge-color',
          'width',
          'line-style',
          'opacity',
        ]),
      },
    };
  }

  mount(host: HTMLElement, ctx: RendererContext): void {
    this.ctx = ctx;
    this.element = document.createElement('spacegraph-viewport');
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    host.appendChild(this.element);

    // Subscribe to projection changes for fractal zoom integration
    this.#focusSub = $focus.subscribe(() => this.onFocusChange());
    this.#depthSub = $depth.subscribe(() => this.onDepthChange());
    this.#aspectSub = $aspect.subscribe(() => this.onAspectChange());
  }

  #focusSub?: () => void;
  #depthSub?: () => void;
  #aspectSub?: () => void;

  private async onFocusChange(): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    const focusId = $focus.get();
    if (focusId) {
      // Set focused node in FractalZoomPlugin for semantic zoom
      const fractalZoom = sg.pluginManager.getPlugin('fractal-zoom') as any;
      if (fractalZoom) {
        fractalZoom.focusedNodeId = focusId;
      }
      // Fly camera to focus
      this.focusAsync(focusId);
    }
  }

  private async onDepthChange(): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    const depth = $depth.get();
    // Map depth (0-3) to fractal zoom level (0-4)
    const fractalZoom = sg.pluginManager.getPlugin('fractal-zoom') as any;
    const lodPlugin = sg.pluginManager.getPlugin('lod') as any;

    if (fractalZoom) {
      const targetLevel = Math.min(depth, fractalZoom.config.levels.length - 1);
      // Direct level setting
      if (typeof fractalZoom.updateLevel === 'function') {
        fractalZoom.updateLevel(targetLevel);
      }
    }

    if (lodPlugin) {
      // Adjust LOD threshold based on depth
      // Depth 0 = overview (high threshold), Depth 3 = detail (low threshold)
      const thresholds = [2000, 1000, 500, 200];
      const threshold = thresholds[Math.min(depth, thresholds.length - 1)];
      lodPlugin.setZoomLevel(depth, threshold);
    }
  }

  private async onAspectChange(): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    const aspect = $aspect.get();
    // Different aspects might need different visualizations
    // For now, just re-apply lens which will update visuals
    await this.applyLens(sg);
    sg.render();
  }

  private getViewport() {
    return getSpaceGraphViewport();
  }

  private async ensureViewport(): Promise<any> {
    const viewport = this.getViewport();
    if (!viewport?.sg) {
      // Wait for SpaceGraph to initialize
      await new Promise<void>((resolve) => {
        const check = () => {
          if (this.getViewport()?.sg) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }
    return this.getViewport()?.sg;
  }

  private blockToNodeSpec(block: SemanticBlock): SpaceGraphNodeSpec {
    // Determine node type based on block properties
    // 'turn' blocks with text content are message-like
    const isMessageLike = block.kind === 'turn' && typeof block.text === 'string' && block.text.length > 0;
    const nodeType = isMessageLike ? 'HtmlNode' : 'ShapeNode';

    // Use layout position if available, otherwise default
    let position: [number, number, number] = [0, 0, 0];
    if (block.data && typeof block.data === 'object' && 'layout' in block.data) {
      const layout = block.data.layout as { x?: number; y?: number; z?: number } | undefined;
      if (layout) {
        position = [layout.x ?? 0, layout.y ?? 0, layout.z ?? 0];
      }
    }

    // Check for contradiction via data flag
    const isContradiction = (block.data as any)?.isContradiction === true || block.kind === 'error';

    const nodeData: Record<string, unknown> = {
      color: theme.colors.accentCyan,
      priority: (block.data as any)?.priority ?? 0.5,
      confidence: (block.data as any)?.confidence ?? 1,
      isContradiction,
      label: block.title ?? block.id,
      shape: 'sphere',
      size: 40,
      blockKind: block.kind,
      blockRole: block.role,
      blockId: block.id,
    };

    if (isMessageLike && block.text) {
      nodeData.html = block.text;
    }

    if (block.data) {
      // Include block data for richer rendering
      nodeData.blockData = block.data;
    }

    return {
      id: block.id,
      type: nodeType,
      label: block.title ?? block.id,
      position,
      data: nodeData,
    };
  }

  private linkToEdgeSpec(link: SemanticLink): SpaceGraphEdgeSpec {
    // Map semantic link kinds to edge types
    const edgeTypeMap: Record<string, string> = {
      contains: 'CurvedEdge',
      'next': 'FlowEdge',
      'responds-to': 'CurvedEdge',
      answers: 'CurvedEdge',
      asks: 'CurvedEdge',
      references: 'DottedEdge',
      supports: 'CurvedEdge',
      contradicts: 'DynamicThicknessEdge',
      revises: 'CurvedEdge',
      elaborates: 'CurvedEdge',
      summarizes: 'CurvedEdge',
      achieves: 'FlowEdge',
      'uses-tool': 'CurvedEdge',
      'produced-by-tool': 'CurvedEdge',
      'derived-from': 'CurvedEdge',
      'admitted-by-gate': 'CurvedEdge',
      'rejected-by-gate': 'DottedEdge',
      formalizes: 'CurvedEdge',
      cites: 'DottedEdge',
      focuses: 'CurvedEdge',
      'same-topic': 'DottedEdge',
    };

    return {
      id: link.id,
      source: link.source,
      target: link.target,
      type: edgeTypeMap[link.kind] ?? 'CurvedEdge',
      data: {
        linkKind: link.kind,
        label: link.label,
        confidence: link.confidence,
      },
    };
  }

  present(blocks: readonly SemanticBlock[], links: readonly SemanticLink[]): void {
    this.presentAsync(blocks, links);
  }

  private async presentAsync(blocks: readonly SemanticBlock[], links: readonly SemanticLink[]): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    // Build SpaceGraph spec from blocks and links
    const nodeSpecs = blocks.map((b) => this.blockToNodeSpec(b));
    const edgeSpecs = links.map((l) => this.linkToEdgeSpec(l));

    // Clear existing graph and load new spec
    sg.graph.clear();
    for (const nodeSpec of nodeSpecs) {
      sg.addNode(nodeSpec);
    }
    for (const edgeSpec of edgeSpecs) {
      sg.addEdge(edgeSpec);
    }

    // Apply modulation/lens
    await this.applyLens(sg);

    // Restore viewport if we have saved state
    if (this.viewportState) {
      const { Vector3 } = await import('three');
      sg.cameraControls.setTargetSmooth(
        new Vector3(...this.viewportState.target),
        this.viewportState.zoom * 500,
        0.5
      );
    } else {
      sg.fitView(undefined, 0.3);
    }

    sg.render();

    // Restore selection
    for (const id of this.selection) {
      sg.select(id);
    }
  }

  private async applyLens(sg: any): Promise<void> {
    // Apply modulation pipeline — similar to spacegraph-viewport.syncGraph
    const { clearNodeStyles, checkUnsupportedChannels, applyDelta } = await import(
      '../../spacegraph/adapter-3d.js'
    );
    const { evaluateLens } = await import('../../core/index.js');
    const { $graphEdges } = await import('../../core/store.js');

    clearNodeStyles(sg);
    const delta = evaluateLens();
    const isEdge = (id: string) => $graphEdges.get().has(id);
    const unsupported = checkUnsupportedChannels(delta, isEdge);
    applyDelta({ forNodes: sg.forNodes.bind(sg), getNode: sg.getNode.bind(sg), getEdge: sg.getEdge.bind(sg), updatePosition: sg.updatePosition?.bind(sg), sg }, delta);
  }

  apply(ops: readonly WorkspaceOp[]): void {
    this.applyAsync(ops);
  }

  private async applyAsync(ops: readonly WorkspaceOp[]): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    const graph = $workspaceGraph.get();
    const newGraph = applyWorkspaceOps(graph, ops);
    $workspaceGraph.set(newGraph);

    for (const op of ops) {
      switch (op.op) {
        case 'block.add':
          sg.addNode(this.blockToNodeSpec(op.block));
          break;
        case 'block.patch':
          sg.update({ nodes: [{ id: op.id, data: op.patch }] });
          break;
        case 'block.remove':
          sg.removeNode(op.id);
          break;
        case 'link.add':
          sg.addEdge(this.linkToEdgeSpec(op.link));
          break;
        case 'link.remove':
          sg.removeEdge(op.id);
          break;
        case 'roots.set':
          // Roots are notebook-specific, no-op for graph
          break;
      }
    }

    await this.applyLens(sg);
    sg.render();
  }

  applyPatch(patch: Patch): void {
    this.applyPatchAsync(patch);
  }

  private async applyPatchAsync(patch: Patch): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    // Apply structural changes
    if (patch.upsert) {
      for (const item of patch.upsert) {
        if (item.data) {
          // Check if it's a block or link by looking at required fields
          const data = item.data as Record<string, unknown>;
          if ('source' in data && 'target' in data && 'kind' in data) {
            // It's a link
            sg.addEdge(this.linkToEdgeSpec(data as unknown as SemanticLink));
          } else if ('kind' in data && 'id' in data) {
            // It's a block
            sg.addNode(this.blockToNodeSpec(data as unknown as SemanticBlock));
          }
        }
      }
    }

    if (patch.remove) {
      for (const id of patch.remove) {
        if (sg.getNode(id)) {
          sg.removeNode(id);
        } else if (sg.getEdge(id)) {
          sg.removeEdge(id);
        }
      }
    }

    // Apply channel/modulation changes
    if (patch.upsert) {
      const { applyDelta, checkUnsupportedChannels, clearNodeStyles } = await import(
        '../../spacegraph/adapter-3d.js'
      );
      const { evaluateLens } = await import('../../core/index.js');
      const { $graphEdges } = await import('../../core/store.js');

      const delta = new Map<string, Partial<Record<Channel, any>>>();
      for (const item of patch.upsert) {
        if (item.channels) {
          delta.set(item.id, item.channels);
        }
      }

      if (delta.size > 0) {
        clearNodeStyles(sg);
        const lensDelta = evaluateLens();
        // Merge patch channels with lens delta
        for (const [id, channels] of delta) {
          const existing = lensDelta.get(id) ?? {};
          lensDelta.set(id, { ...existing, ...channels });
        }
        const isEdge = (id: string) => $graphEdges.get().has(id);
        const unsupported = checkUnsupportedChannels(lensDelta, isEdge);
        applyDelta({ forNodes: sg.forNodes.bind(sg), getNode: sg.getNode.bind(sg), getEdge: sg.getEdge.bind(sg), updatePosition: sg.updatePosition?.bind(sg), sg }, lensDelta);
      }
    }

    sg.render();
  }

  focus(address: string | FocusRef): void {
    // Synchronous update for workspace graph
    let targetId: string;
    if (typeof address === 'string') {
      targetId = address;
      this.focusRef = { kind: 'concept', term: address } as FocusRef;
    } else {
      this.focusRef = address;
      const refId = focusRefId(address);
      if (!refId) return;
      targetId = refId;
    }
    setWorkspaceFocus(targetId);

    // Async camera fly-to
    this.focusAsync(targetId);
  }

  private async focusAsync(targetId: string): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    // Fly camera to the node
    const node = sg.getNode(targetId);
    if (node) {
      const distance = 150;
      const { Vector3 } = await import('three');
      sg.cameraControls.flyTo(
        new Vector3(node.position.x, node.position.y, node.position.z),
        distance,
        1.0
      );
    }
  }

  select(ids: readonly string[]): void {
    // Synchronous update for workspace graph
    this.selection = new Set(ids);
    setWorkspaceSelection(ids);

    // Async visual selection
    this.selectAsync(ids);
  }

  private async selectAsync(ids: readonly string[]): Promise<void> {
    const sg = await this.ensureViewport();
    if (!sg) return;

    sg.deselectAll();
    for (const id of ids) {
      sg.select(id);
    }
  }

  affordances(anchor?: string): readonly IntentRef[] {
    return [];
  }

  invoke(intentId: string, _args?: unknown): boolean {
    return false;
  }

  openComposer(anchor?: FocusRef): void {
    this.ctx?.openOverlay('composer', anchor ?? this.focusRef);
  }

  openExplain(ref: FocusRef): void {
    this.ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    const vp = this.getViewport();
    let viewport: RendererSnapshot['viewport'];

    if (vp?.sg?.cameraControls) {
      const camera = vp.sg.renderer.camera;
      const target = vp.sg.cameraControls.target;
      const distance = camera.position.distanceTo(target);
      viewport = {
        x: target.x,
        y: target.z, // 2D viewport uses x,z plane
        zoom: distance / 500,
      };
      this.viewportState = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
        zoom: distance / 500,
      };
    }

    return {
      renderer: this.id,
      viewport: viewport ?? (this.viewportState ? { x: this.viewportState.target[0], y: this.viewportState.target[2], zoom: this.viewportState.zoom } : undefined),
      focus: this.focusRef ? focusRefId(this.focusRef) : undefined,
      selection: [...this.selection],
    };
  }

  restore(snap: RendererSnapshot): void {
    if (snap.focus) {
      this.focusRef = { kind: 'concept', term: snap.focus } as FocusRef;
      setWorkspaceFocus(snap.focus);
    } else {
      this.focusRef = undefined;
      setWorkspaceFocus(undefined);
    }
    this.selection = new Set(snap.selection);
    setWorkspaceSelection(snap.selection);
    if (snap.viewport) {
      this.viewportState = {
        position: [snap.viewport.x, 500 * snap.viewport.zoom, snap.viewport.y],
        target: [snap.viewport.x, 0, snap.viewport.y],
        zoom: snap.viewport.zoom,
      };
    }
  }

  async embed(cell: Cell, host: HTMLElement): Promise<void> {
    // For fractal embedding, create a nested SpaceGraph viewport showing the cell's focus
    if (!cell.focus) return;

    const sg = await this.ensureViewport();
    if (!sg) return;

    const refId = focusRefId(cell.focus);
    if (!refId) return;

    // Create nested viewport element
    const nestedViewport = document.createElement('spacegraph-viewport');
    nestedViewport.style.width = '100%';
    nestedViewport.style.height = '100%';
    nestedViewport.style.minHeight = '300px';
    nestedViewport.setAttribute('data-embedded', 'true');
    host.appendChild(nestedViewport);

    // Initialize nested SpaceGraph
    const { SpaceGraph } = await import('spacegraphjs/SpaceGraph');
    const nestedSg = await SpaceGraph.create(nestedViewport, { nodes: [], edges: [] });

    // Add the focus node as a GroupNode that contains its neighborhood
    const focusNode = sg.getNode(refId);
    if (!focusNode) return;

    const groupNodeSpec = {
      id: `group_${refId}`,
      type: 'GroupNode',
      label: focusNode.label,
      position: [focusNode.position.x, focusNode.position.y, focusNode.position.z],
      data: {
        width: 400,
        height: 300,
        depth: 200,
        color: 0x4488ff,
        lodThreshold: 1000,
        parentFocus: refId,
      },
    };

    nestedSg.addNode(groupNodeSpec);

    // Add neighborhood nodes as children of the group
    const neighborhood = this.getNeighborhood(sg, refId, 2);
    for (const [nodeId, node] of neighborhood) {
      if (nodeId === refId) continue;
      const childSpec = {
        id: nodeId,
        type: 'ShapeNode',
        label: node.label,
        position: [node.position.x, node.position.y, node.position.z],
        data: {
          ...node.data,
          parent: `group_${refId}`,
          size: 20,
        },
      };
      nestedSg.addNode(childSpec);

      // Add edge from group to child
      nestedSg.addEdge({
        id: `edge_group_${nodeId}`,
        source: `group_${refId}`,
        target: nodeId,
        type: 'CurvedEdge',
        data: { isFractalEdge: true },
      });
    }

    // Set up LOD for fractal reveal
    const lodPlugin = nestedSg.pluginManager.get('lod');
    if (lodPlugin) {
      lodPlugin.setZoomLevel(0, 800); // Reveal children when zoomed close
    }

    nestedSg.fitView(undefined, 0.5);
    nestedSg.render();

    // Store reference for cleanup
    (nestedViewport as any).spacegraph = nestedSg;
  }

  private getNeighborhood(sg: any, focusId: string, depth: number): Map<string, any> {
    const result = new Map<string, any>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; d: number }> = [{ id: focusId, d: 0 }];

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (visited.has(id) || d > depth) continue;
      visited.add(id);

      const node = sg.getNode(id);
      if (node) {
        result.set(id, node);
        // Add neighbors
        for (const [, edge] of sg.graph.edges) {
          if (edge.source.id === id && !visited.has(edge.target.id)) {
            queue.push({ id: edge.target.id, d: d + 1 });
          } else if (edge.target.id === id && !visited.has(edge.source.id)) {
            queue.push({ id: edge.source.id, d: d + 1 });
          }
        }
      }
    }

    return result;
  }

  dispose(): void {
    this.#focusSub?.();
    this.#depthSub?.();
    this.#aspectSub?.();
    this.#focusSub = this.#depthSub = this.#aspectSub = undefined;
    this.element?.remove();
    this.element = undefined;
    this.ctx = undefined;
    this.viewportState = undefined;
  }
}

export const graph3dRenderer = new Graph3DRenderer();

registerRenderer(graph3dRenderer);