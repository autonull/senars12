/**
 * The main workspace host (§0.1/§3.1, Phase 0.4/2.5). The shell renders one host
 * and the renderer registry owns the lifecycle: on a mode switch the host
 * snapshots the current renderer, disposes it, mounts the next, and restores the
 * snapshot — so switching is registry-driven instead of a hardcoded tag per
 * renderer, and the shared focus/selection ride across for free.
 *
 * The host also supplies the `WorkspaceContext` shell services, so a renderer
 * opens overlays/palette without importing shell chrome.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { dispatchCommand } from '../core/commands.js';
import { eventBus } from '../core/events.js';
import { overlayManager } from '../core/overlay-manager.js';
import { $activeRenderer, setActiveRenderer } from '../core/store.js';
import {
  type WorkspaceContext,
  type WorkspaceRenderer,
  workspaceRenderer,
  workspaceRenderers,
} from '../core/workspace-renderer.js';

const WORKSPACE_CONTEXT: WorkspaceContext = {
  openOverlay: (id, ref) => eventBus.emit('overlay:open', { id, ref }),
  // Funnel the palette through the command registry, so there is one open seam (§2.6).
  openPalette: () => void dispatchCommand('overlay.palette'),
  get renderer() {
    return $activeRenderer.get();
  },
  setRenderer: (id) => setActiveRenderer(id),
  overlays: () => overlayManager.stack(),
  hasOverlays: () => overlayManager.size() > 0,
};

@customElement('workspace-host')
export class WorkspaceHost extends BaseComponent {
  static override styles = css`
    :host { display: flex; flex: 1; min-height: 0; }
    .stage { display: flex; flex: 1; min-height: 0; }
    .stage > * { flex: 1; min-height: 0; }
  `;

  #current?: WorkspaceRenderer;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeRenderer);
  }

  override disconnectedCallback(): void {
    this.#current?.dispose();
    this.#current = undefined;
    super.disconnectedCallback();
  }

  override updated(): void {
    this.sync();
  }

  private sync(): void {
    const stage = this.shadowRoot?.querySelector('.stage');
    if (!(stage instanceof HTMLElement)) return;
    const id = $activeRenderer.get();
    if (this.#current?.id === id) return;

    const snapshot = this.#current?.snapshot();
    this.#current?.dispose();
    const next = workspaceRenderer(id) ?? workspaceRenderers()[0];
    this.#current = next;
    if (!next) return;
    next.mount(stage, WORKSPACE_CONTEXT);
    if (snapshot) next.restore(snapshot);
  }

  override render() {
    return html`<div class="stage"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workspace-host': WorkspaceHost;
  }
}
