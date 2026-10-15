/**
 * The Graph workspace renderer adapter (§3.1). The Cytoscape viewport already
 * exists; this wires it into the `WorkspaceRenderer` contract so the
 * registry, mode switcher and shell treat Notebook and Graph uniformly.
 * Implements incremental `present`/`apply` with animation (§P2.1).
 */

import type { Ref, SemanticBlock, SemanticLink, WorkspaceGraph, WorkspaceOp } from '../../core/workspace-graph.js';
import type { ConversationLayoutId } from '../../core/conversation-layout.js';
import { kindsWhere } from '../../core/block-descriptors.js';
import { $activeRenderer, $conversationLayout, $selectedNodeId, $selectedNodeIds, $workspaceGraph, CONVERSATION_LAYOUT_CATALOG, CONVERSATION_LAYOUT_IDS, registerCommand, setConversationLayout, setGraphLayer, setWorkspaceFocus, setWorkspaceSelection } from '../../core/index.js';
import { eventBus } from '../../core/events.js';
import { getViewportInstance } from '../graph-viewport.js';
import {
  registerRenderer,
  WORKSPACE_INTERACTIONS,
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
import type { Channel, ChannelValue } from '../../modulation/types.js';
import { diffWorkspaceGraph } from '../../core/workspace-diff.js';
import { applyWorkspaceOps } from '../../core/workspace-graph.js';
import { applyDelta } from '../../utils/adapter-2d.js';
import './graph-surface.js';

const workspaceRefs = (ids: Iterable<Ref>): Ref[] => {
  const blocks = $workspaceGraph.get().blocks;
  return [...ids].filter((id) => blocks.has(id));
};

const GRAPH_BLOCK_KINDS = kindsWhere((descriptor) => descriptor.graphRenderable);

class GraphRenderer implements WorkspaceRenderer {
  readonly id = 'graph-2d';
  readonly label = '2D Graph';

  #element?: HTMLElement;
  #ctx?: RendererContext;

  capabilities(): WorkspaceRendererCaps {
    return {
      interactions: WORKSPACE_INTERACTIONS,
      blockKinds: GRAPH_BLOCK_KINDS,
      parity: 'full',
      controls: ['layers'],
      surface: 'graph-surface',
      requiredCapability: 'reasoning',
      channels: {
        node: new Set<Channel>(['color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z']),
        edge: new Set<Channel>(['color', 'edge-color', 'width', 'line-style', 'opacity']),
      },
    };
  }

  mount(host: HTMLElement, ctx: RendererContext): void {
    this.#ctx = ctx;
    this.#element = document.createElement('graph-surface');
    host.appendChild(this.#element);
  }

  present(blocks: readonly SemanticBlock[], links: readonly SemanticLink[]): void {
    const viewport = getViewportInstance();
    if (!viewport) return;

    // Build new graph from incoming blocks/links
    const newGraph: WorkspaceGraph = {
      blocks: new Map(blocks.map((b) => [b.id, b])),
      links: new Map(links.map((l) => [l.id, l])),
      roots: blocks.map((b) => b.id),
      selection: new Set(),
    };

    // Diff against current graph
    const currentGraph = $workspaceGraph.get();
    const ops = diffWorkspaceGraph(currentGraph, newGraph);

    // Apply ops with animation
    if (ops.length > 0) {
      viewport.applyWorkspaceOps(ops);
    }

    // Update store to new graph state
    $workspaceGraph.set(newGraph);
  }

  apply(ops: readonly WorkspaceOp[]): void {
    const viewport = getViewportInstance();
    if (viewport) {
      viewport.applyWorkspaceOps(ops);
    }
  }

  applyPatch(patch: Patch): void {
    const viewport = getViewportInstance();
    if (!viewport) return;

    // Apply structural changes first
    if (patch.upsert) {
      // Convert ItemPatch to WorkspaceOp for structural updates
      const ops = patch.upsert
        .filter((item) => item.data)
        .map((item) => ({
          op: 'upsert' as const,
          block: item.data!,
        }));
      if (ops.length > 0) {
        viewport.applyWorkspaceOps(ops as any);
      }
    }
    if (patch.remove) {
      const ops = patch.remove.map((id) => ({ op: 'remove' as const, id }));
      if (ops.length > 0) {
        viewport.applyWorkspaceOps(ops as any);
      }
    }

    // Apply channel/modulation changes
    if (patch.upsert) {
      const delta = new Map<string, Partial<Record<Channel, ChannelValue>>>();
      for (const item of patch.upsert) {
        if (item.channels) {
          delta.set(item.id, item.channels);
        }
      }
      if (delta.size > 0) {
        const cy = (viewport as any).cy;
        if (cy) {
          applyDelta(cy, delta);
        }
      }
    }
  }

  focus(address: string | FocusRef): void {
    if (typeof address === 'string') {
      setWorkspaceFocus(address);
    } else {
      const ref = focusRefId(address);
      if (ref) setWorkspaceFocus(ref);
    }
  }

  select(ids: readonly string[]): void {
    setWorkspaceSelection(ids);
    $selectedNodeId.set(ids.length === 1 ? (ids[0] ?? null) : null);
  }

  affordances(anchor?: string): readonly IntentRef[] {
    return [];
  }

  invoke(intentId: string, args?: unknown): boolean {
    return false;
  }

  openComposer(anchor?: FocusRef): void {
    const refs = anchor ? [focusRefId(anchor)!] : workspaceRefs($selectedNodeIds.get());
    eventBus.emit('composer:focus', { refs: refs.length ? refs : undefined });
  }

  openExplain(ref: FocusRef): void {
    this.#ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    const { focus, selection } = $workspaceGraph.get();
    return { renderer: this.id, focus, selection: [...selection] };
  }

  restore(snap: RendererSnapshot): void {
    if (snap.focus) setWorkspaceFocus(snap.focus);
    setWorkspaceSelection(snap.selection);
  }

  dispose(): void {
    this.#element?.remove();
    this.#element = undefined;
    this.#ctx = undefined;
  }

  embed(cell: Cell, host: HTMLElement): void {
    // Embed a cell as a nested view within this renderer
    // For graph-2d, we create a nested graph-surface showing the cell's focus
    if (!cell.focus) return;

    const viewport = getViewportInstance();
    if (!viewport) return;

    const nestedSurface = document.createElement('graph-surface');
    nestedSurface.style.width = '100%';
    nestedSurface.style.height = '100%';
    nestedSurface.style.minHeight = '200px';
    nestedSurface.setAttribute('data-embedded', 'true');

    host.appendChild(nestedSurface);

    // Focus the nested surface on the cell's focus
    const ref = focusRefId(cell.focus);
    if (ref) {
      setWorkspaceFocus(ref);
    }
  }
}

export const graphRenderer = new GraphRenderer();

registerRenderer(graphRenderer);

registerCommand({
  id: 'graph.ask-selection',
  title: 'Ask about selection',
  group: 'Graph',
  keywords: 'context prompt selection composer',
  run: () => {
    const refs = workspaceRefs($selectedNodeIds.get());
    if (refs.length) eventBus.emit('composer:focus', { refs });
  },
});

for (const [layer, title] of [
  ['both', 'Show concepts and conversation'],
  ['conversation', 'Show conversation only'],
  ['concepts', 'Show concepts only'],
] as const) {
  registerCommand({
    id: `graph.layer.${layer}`,
    title,
    group: 'Graph',
    keywords: 'layer filter conversation concepts isolate',
    run: () => setGraphLayer(layer),
  });
}

for (const layout of CONVERSATION_LAYOUT_IDS) {
  registerCommand({
    id: `graph.layout.${layout}`,
    title: `Arrange: ${CONVERSATION_LAYOUT_CATALOG[layout].label}`,
    group: 'Graph',
    keywords: `layout arrange conversation ${layout}`,
    run: () => eventBus.emit('graph:layout', layout),
    available: () => $activeRenderer.get() === 'graph-2d',
  });
}

registerCommand({
  id: 'graph.layout.cycle',
  title: 'Cycle layout',
  group: 'Graph',
  keywords: 'layout cycle next arrange',
  run: () => {
    const current = $conversationLayout.get();
    const idx = CONVERSATION_LAYOUT_IDS.indexOf(current as ConversationLayoutId);
    const next = CONVERSATION_LAYOUT_IDS[(idx + 1) % CONVERSATION_LAYOUT_IDS.length];
    if (next) setConversationLayout(next);
  },
  available: () => $activeRenderer.get() === 'graph-2d',
});

registerCommand({
  id: 'graph.ask-selection',
  title: 'Ask about selection',
  group: 'Graph',
  keywords: 'context prompt selection composer',
  run: () => {
    const refs = workspaceRefs($selectedNodeIds.get());
    if (refs.length) eventBus.emit('composer:focus', { refs });
  },
});
