/**
 * The Graph3D renderer stub (§0.4/Phase 6). It implements the same
 * `WorkspaceRenderer` contract over the same WorkspaceGraph and declares
 * `parity: 'partial'` honestly, but performs no bespoke product work until
 * Notebook and Graph are excellent. Registering it proves the registry admits a
 * third renderer without touching the shell, and gives the mode switcher a real
 * (if minimal) target.
 */

import type {
  Ref,
  SemanticBlock,
  SemanticLink,
  WorkspaceOp,
} from '../../core/workspace-graph.js';
import {
  registerRenderer,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceInteraction,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../core/workspace-renderer.js';

const INTERACTIONS: readonly WorkspaceInteraction[] = [
  'compose',
  'stream',
  'inspect',
  'explain',
  'select-context',
  'follow-up',
  'palette',
  'embed',
];

class Graph3DRenderer implements WorkspaceRenderer {
  readonly id = 'graph3d';
  readonly label = 'Graph 3D';

  private ctx?: WorkspaceContext;
  private focusRef?: Ref;
  private selection = new Set<Ref>();

  capabilities(): WorkspaceRendererCaps {
    return { interactions: INTERACTIONS, blockKinds: 'all', parity: 'partial' };
  }

  mount(_host: HTMLElement, ctx: WorkspaceContext): void {
    this.ctx = ctx;
  }

  present(_blocks: readonly SemanticBlock[], _links: readonly SemanticLink[]): void {}

  apply(_ops: readonly WorkspaceOp[]): void {}

  focus(ref: Ref): void {
    this.focusRef = ref;
  }

  select(refs: readonly Ref[]): void {
    this.selection = new Set(refs);
  }

  openComposer(anchor?: Ref): void {
    this.ctx?.openOverlay('composer', anchor ?? this.focusRef);
  }

  openExplain(ref: Ref): void {
    this.ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    return {
      renderer: this.id,
      focus: this.focusRef,
      selection: [...this.selection],
    };
  }

  restore(snap: RendererSnapshot): void {
    this.focusRef = snap.focus;
    this.selection = new Set(snap.selection);
  }

  dispose(): void {
    this.ctx = undefined;
  }
}

export const graph3dRenderer = new Graph3DRenderer();

registerRenderer(graph3dRenderer);
