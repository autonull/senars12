/**
 * The Graph workspace renderer adapter (§3.1). The Cytoscape viewport already
 * exists; this only wires it into the `WorkspaceRenderer` contract so the
 * registry, mode switcher and shell treat Notebook and Graph uniformly. It reads
 * the same store the viewport does, so `present`/`apply` are no-ops by design —
 * the op stream is already applied to `$graphNodes`/`$graphEdges` before it
 * reaches the workspace substrate. Focus/selection round-trip through the shared
 * session state for a renderer switch.
 */

import type { BlockKind, Ref, SemanticBlock, SemanticLink, WorkspaceOp } from '../../core/workspace-graph.js';
import {
  $activeRenderer,
  $selectedNodeIds,
  $workspaceGraph,
  CONVERSATION_LAYOUT_CATALOG,
  CONVERSATION_LAYOUT_IDS,
  registerCommand,
  setGraphLayer,
} from '../../core/index.js';
import { eventBus } from '../../core/events.js';
import {
  registerRenderer,
  WORKSPACE_INTERACTIONS,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../core/workspace-renderer.js';
import '../graph-viewport.js';

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
  #focus?: Ref;
  #selection = new Set<Ref>();

  capabilities(): WorkspaceRendererCaps {
    return { interactions: WORKSPACE_INTERACTIONS, blockKinds: GRAPH_BLOCK_KINDS, parity: 'full' };
  }

  mount(host: HTMLElement, ctx: WorkspaceContext): void {
    this.#ctx = ctx;
    this.#element = document.createElement('graph-viewport');
    host.appendChild(this.#element);
  }

  present(_blocks: readonly SemanticBlock[], _links: readonly SemanticLink[]): void {}

  apply(_ops: readonly WorkspaceOp[]): void {}

  focus(ref: Ref): void {
    this.#focus = ref;
  }

  select(refs: readonly Ref[]): void {
    this.#selection = new Set(refs);
  }

  openComposer(anchor?: Ref): void {
    const refs = anchor ? [anchor] : workspaceRefs($selectedNodeIds.get());
    eventBus.emit('composer:focus', { refs: refs.length ? refs : undefined });
  }

  openExplain(ref: Ref): void {
    this.#ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    return { renderer: this.id, focus: this.#focus, selection: [...this.#selection] };
  }

  restore(snap: RendererSnapshot): void {
    this.#focus = snap.focus;
    this.#selection = new Set(snap.selection);
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
