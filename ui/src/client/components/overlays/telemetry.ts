/**
 * The telemetry overlay (§1, Phase 0.4). The full telemetry panel is session
 * chrome, not a standing bottom panel: it lives in an overlay the HUD, palette
 * or an agent can summon. It reuses the same `telemetry-panel` element — export,
 * ranges, metric toggles and the cognitive readout are unchanged — only the
 * chrome moved. The HUD keeps a one-glance sparkline expansion for the common case.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
import '../telemetry-panel.js';

@customElement('s-telemetry')
export class TelemetryView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 14vh; left: 50%; transform: translateX(-50%); width: min(720px, 94vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
  `;

  protected override renderBody() {
    return html`
      <div class="panel" role="dialog" aria-label="Telemetry">
        <overlay-header
          overlay-id="telemetry"
          title="Telemetry"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <telemetry-panel></telemetry-panel>
      </div>
    `;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'telemetry' });

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };
}

const TELEMETRY_SURFACE = { id: 'telemetry', title: 'Telemetry', group: 'overlay' } as const;

defineSurface(TELEMETRY_SURFACE, TelemetryView);
registerOverlay({
  id: TELEMETRY_SURFACE.id,
  title: TELEMETRY_SURFACE.title,
  tag: surfaceTag(TELEMETRY_SURFACE),
});

declare global {
  interface HTMLElementTagNameMap {
    's-telemetry': TelemetryView;
  }
}
