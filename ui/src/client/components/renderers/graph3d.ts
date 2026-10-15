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
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
  type RendererContext,
  type IntentRef,
  type FocusRef,
} from '../../core/workspace-renderer.js';
import { focusRefId } from '../../framework/coordinates.js';
import type { Channel } from '../../modulation/types.js';

class Graph3DRenderer implements WorkspaceRenderer {
  readonly id = 'graph-3d';
  readonly label = '3D Graph';

  private ctx?: RendererContext;
  private element?: HTMLElement;
  private focusRef?: FocusRef;
  private selection = new Set<string>();

  capabilities(): WorkspaceRendererCaps {
    return {
      interactions: ['compose', 'stream', 'inspect', 'explain', 'select-context', 'follow-up', 'palette', 'embed'],
      blockKinds: 'all',
      parity: 'partial',
      surface: 'spacegraph-viewport',
      requiredCapability: 'reasoning',
      channels: {
        node: new Set<Channel>(['color', 'opacity', 'size', 'label', 'z']),
        edge: new Set<Channel>(['color', 'edge-color', 'width', 'opacity']),
      },
    };
  }

  mount(host: HTMLElement, ctx: RendererContext): void {
    this.ctx = ctx;
    this.element = document.createElement('spacegraph-viewport');
    host.appendChild(this.element);
  }

  present(_blocks: readonly SemanticBlock[], _links: readonly SemanticLink[]): void {}

  apply(_ops: readonly WorkspaceOp[]): void {}

  focus(address: string | FocusRef): void {
    if (typeof address === 'string') {
      this.focusRef = { kind: 'concept', term: address } as FocusRef;
    } else {
      this.focusRef = address;
    }
  }

  select(ids: readonly string[]): void {
    this.selection = new Set(ids);
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
    return {
      renderer: this.id,
      focus: this.focusRef ? focusRefId(this.focusRef) : undefined,
      selection: [...this.selection],
    };
  }

  restore(snap: RendererSnapshot): void {
    if (snap.focus) {
      this.focusRef = { kind: 'concept', term: snap.focus } as FocusRef;
    } else {
      this.focusRef = undefined;
    }
    this.selection = new Set(snap.selection);
  }

  dispose(): void {
    this.element?.remove();
    this.element = undefined;
    this.ctx = undefined;
  }
}

export const graph3dRenderer = new Graph3DRenderer();

registerRenderer(graph3dRenderer);
