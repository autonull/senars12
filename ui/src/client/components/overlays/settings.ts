/**
 * The settings dialog (§1, Phase 0.5; panel migration: config-hud/config-profiles
 * → settings dialog). A palette-launched overlay that hosts the existing config
 * form (fields from `$config`/`fieldCatalog` via `renderField`), so provider and
 * region settings live in one focus-trapped dialog instead of a standing panel.
 * Modal: it captures the background, and the form's own close affordance routes
 * through the overlay host.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import '../config-hud.js';

@customElement('s-settings')
export class SettingsView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 8vh; left: 50%; transform: translateX(-50%); width: min(520px, 94vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; height: 84vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    config-hud { flex: 1; min-height: 0; }
  `;

  protected override renderBody() {
    return html`<div class="panel" role="dialog" aria-label="Settings">
      <config-hud @s-close=${this.close}></config-hud>
    </div>`;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'settings' });
}

const SETTINGS_SURFACE = { id: 'settings', title: 'Settings', group: 'overlay' } as const;

defineSurface(SETTINGS_SURFACE, SettingsView);
registerOverlay({
  id: SETTINGS_SURFACE.id,
  title: SETTINGS_SURFACE.title,
  tag: surfaceTag(SETTINGS_SURFACE),
  modal: true,
});

declare global {
  interface HTMLElementTagNameMap {
    's-settings': SettingsView;
  }
}
