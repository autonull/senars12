/**
 * The inspector popover (§1, Phase 0.4). The node/edge detail drawer is session
 * chrome that follows the live selection, not a standing side panel: it floats
 * over the workspace and closes with the selection. It is non-modal and does not
 * steal focus on open, because selecting a node should not interrupt graph
 * navigation; closing it clears the selection so the shell stays consistent.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $selectedEdgeId, $selectedNodeId } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
import '../node-detail-drawer.js';
import '../overlays/overlay-header.js';

@customElement('s-inspector')
export class InspectorView extends SurfaceComponent {
  static override styles = css`
    :host { display: block; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 80vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    node-detail-drawer { flex: 1; min-height: 0; }
  `;

  protected override renderBody() {
    return html`
      <div class="panel" role="dialog" aria-label="Inspector">
        <overlay-header
          overlay-id="inspector"
          kind="Inspector"
          title="Inspector"
          .draggable=${true}
          .resizable=${true}
          .minimizable=${true}
          .maximizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <node-detail-drawer></node-detail-drawer>
      </div>
    `;
  }

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  private readonly close = () => {
    $selectedNodeId.set(null);
    $selectedEdgeId.set(null);
    eventBus.emit('overlay:close', { id: 'inspector' });
  };
}

const INSPECTOR_SURFACE = { id: 'inspector', title: 'Inspector', group: 'overlay' } as const;

defineSurface(INSPECTOR_SURFACE, InspectorView);
registerOverlay({
  id: INSPECTOR_SURFACE.id,
  title: INSPECTOR_SURFACE.title,
  tag: surfaceTag(INSPECTOR_SURFACE),
  autoFocus: false,
  window: { draggable: true, resizable: true, minimize: true, persist: true },
});

declare global {
  interface HTMLElementTagNameMap {
    's-inspector': InspectorView;
  }
}
