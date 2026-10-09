/**
 * The configuration dialog (§1, Phase 0.5; panel migration: config-hud/config-profiles
 * → settings dialog). A palette-launched overlay that hosts the existing config
 * form (fields from `$config`/`fieldCatalog` via `renderField`), so the reasoning
 * and system settings live in one focus-trapped dialog instead of a standing
 * panel. Which model runs is the sibling overlay (`provider`).
 * Modal: it captures the background, and the form's own close affordance routes
 * through the overlay host.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
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
    return html`
      <div class="panel" role="dialog" aria-label="Settings">
        <header style="display:flex;align-items:center;gap:var(--spacing-scale-2);padding:var(--spacing-scale-2) var(--spacing-scale-3);border-bottom:1px solid var(--colors-semantic-border-subtle);">
          <span class="title" style="flex:1;font-family:var(--typography-fontFamilies-ui);font-size:var(--typography-scale-sm);font-weight:var(--typography-fontWeights-semibold);color:var(--colors-semantic-text-primary);">Configuration</span>
          <button class="pin-btn" aria-label="Pin settings" aria-pressed=${this.hasAttribute('data-pinned')} @click=${this.togglePin}>📌</button>
          <button class="close" style="border:none;background:transparent;color:var(--colors-semantic-text-muted);cursor:pointer;font-size:var(--typography-scale-base);" title="Close" aria-label="Close settings" @click=${this.close}>&times;</button>
        </header>
        <config-hud @s-close=${this.close}></config-hud>
      </div>`;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'settings' });

  private readonly togglePin = () => {
    const pinned = this.hasAttribute('data-pinned');
    overlayManager.setPinned('settings', !pinned);
  };
}

const SETTINGS_SURFACE = { id: 'settings', title: 'Configuration', group: 'overlay' } as const;

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
