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
  registerRenderer,
  WORKSPACE_INTERACTIONS,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../core/workspace-renderer.js';
import '../graph-viewport.js';

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
    this.#ctx?.openOverlay('composer', anchor ?? this.#focus);
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
