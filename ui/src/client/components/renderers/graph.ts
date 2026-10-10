/**
 * The Graph workspace renderer adapter (§3.1). The Cytoscape viewport already
 * exists; this wires it into the `WorkspaceRenderer` contract so the
 * registry, mode switcher and shell treat Notebook and Graph uniformly.
 * Implements incremental `present`/`apply` with animation (§P2.1).
 */

import type { BlockKind, Ref, SemanticBlock, SemanticLink, WorkspaceGraph, WorkspaceOp } from '../../core/workspace-graph.js';
import type { ConversationLayoutId } from '../../core/conversation-layout.js';
import { $activeRenderer, $conversationLayout, $selectedNodeId, $selectedNodeIds, $workspaceGraph, CONVERSATION_LAYOUT_CATALOG, CONVERSATION_LAYOUT_IDS, registerCommand, setConversationLayout, setGraphLayer, setWorkspaceFocus, setWorkspaceSelection } from '../../core/index.js';
import { eventBus } from '../../core/events.js';
import { getViewportInstance } from '../graph-viewport.js';
import {
  registerRenderer,
  WORKSPACE_INTERACTIONS,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../core/workspace-renderer.js';
import { diffWorkspaceGraph } from '../../core/workspace-diff.js';
import { applyWorkspaceOps } from '../../core/workspace-graph.js';
import './graph-surface.js';

const workspaceRefs = (ids: Iterable<Ref>): Ref[] => {
  const blocks = $workspaceGraph.get().blocks;
  return [...ids].filter((id) => blocks.has(id));
};

const GRAPH_BLOCK_KINDS: readonly BlockKind[] = [
  'turn',
  'section',
  'heading',
  'paragraph',
  'claim',
  'question',
  'answer',
  'list',
  'table',
  'code',
  'math',
  'image',
  'diagram',
  'chart',
  'citation',
  'tool-call',
  'tool-result',
  'derivation',
  'gate-decision',
  'budget',
  'config-change',
  'error',
  'embedded-view',
  'raw',
];

class GraphRenderer implements WorkspaceRenderer {
  readonly id = 'graph';
  readonly label = 'Graph';

  #element?: HTMLElement;
  #ctx?: WorkspaceContext;

  capabilities(): WorkspaceRendererCaps {
    return {
      interactions: WORKSPACE_INTERACTIONS,
      blockKinds: GRAPH_BLOCK_KINDS,
      parity: 'full',
      controls: ['layers'],
      surface: 'graph-surface',
      requiredCapability: 'reasoning',
    };
  }

  mount(host: HTMLElement, ctx: WorkspaceContext): void {
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

  focus(ref: Ref): void {
    setWorkspaceFocus(ref);
  }

  select(refs: readonly Ref[]): void {
    setWorkspaceSelection(refs);
    $selectedNodeId.set(refs.length === 1 ? (refs[0] ?? null) : null);
  }

  openComposer(anchor?: Ref): void {
    const refs = anchor ? [anchor] : workspaceRefs($selectedNodeIds.get());
    eventBus.emit('composer:focus', { refs: refs.length ? refs : undefined });
  }

  openExplain(ref: Ref): void {
    this.#ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    const { focus, selection } = $workspaceGraph.get();
    return { renderer: this.id, focus, selection: [...selection] };
  }

  restore(snap: RendererSnapshot): void {
    setWorkspaceFocus(snap.focus);
    setWorkspaceSelection(snap.selection);
  }

  dispose(): void {
    this.#element?.remove();
    this.#element = undefined;
    this.#ctx = undefined;
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
    available: () => $activeRenderer.get() === 'graph',
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
  available: () => $activeRenderer.get() === 'graph',
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
