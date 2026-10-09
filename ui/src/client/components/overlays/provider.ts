/**
 * The Provider overlay (§0.6) — the switcher half of settings. It reads the
 * `LmProvider` façade: the engine reports which providers it knows and which one
 * is active, this surface only decides what can run *here* and asks for a switch.
 * A request the engine does not honour is reported as such rather than hidden,
 * because the engine fixes its LM client at boot. Configuration is the sibling
 * overlay (`settings`).
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Announcer } from '../../core/announcer.js';
import { eventBus } from '../../core/events.js';
import { $lmProvider, providerLabel, providerUsable } from '../../core/lm-provider.js';
import { refreshLmStatus, switchLmProvider } from '../../core/lm-transport.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
import { $webllmActive, $webllmAvailable } from '../../core/store.js';

@customElement('s-provider')
export class ProviderView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 8vh; left: 50%; transform: translateX(-50%); width: min(460px, 94vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 72vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .action { border: 1px solid var(--colors-semantic-border-subtle); border-radius: 4px; padding: 2px var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); }
    .action:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    .active { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); font-size: var(--typography-scale-xs); }
    .dot { border-radius: 50%; height: 6px; width: 6px; }
    .ok { background: var(--colors-primitive-success); } .down { background: var(--colors-primitive-error); }
    .active .name { color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); }
    .active .model { color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); }
    .notice { padding: var(--spacing-scale-2) var(--spacing-scale-3); color: var(--colors-primitive-error); font-size: var(--typography-scale-xs); }
    ul { list-style: none; margin: 0; padding: var(--spacing-scale-2); overflow: auto; display: flex; flex-direction: column; gap: 2px; }
    .provider { display: flex; align-items: baseline; gap: var(--spacing-scale-2); width: 100%; text-align: left; border: none; border-radius: 4px; padding: var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; }
    .provider:hover:not(:disabled) { background: var(--colors-semantic-bg-subtle); }
    .provider[aria-current='true'] { background: var(--colors-semantic-bg-subtle); outline: 1px solid var(--colors-semantic-accent-cyan); }
    .provider:disabled { opacity: 0.5; cursor: not-allowed; }
    .provider .label { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .provider .kind { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .provider .state { font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($lmProvider);
    // A browser provider's usability is this browser's WebGPU, not the engine's word.
    this.watch($webllmAvailable);
    this.watch($webllmActive);
    refreshLmStatus();
  }

  protected override renderBody() {
    const { id, model, available, providers, pending, stale } = $lmProvider.get();
    return html`
      <div class="panel" role="dialog" aria-label="Provider">
        <overlay-header
          overlay-id="provider"
          title="Provider"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div style="display:flex;align-items:center;gap:var(--spacing-scale-2);padding:var(--spacing-scale-2) var(--spacing-scale-3);border-bottom:1px solid var(--colors-semantic-border-subtle);">
          <button class="action" @click=${() => refreshLmStatus()}>Refresh</button>
        </div>
        <div class="active">
          <span class="dot ${available ? 'ok' : 'down'}"></span>
          <span class="name">${providerLabel(id)}</span>
          <span class="model">${model ?? 'no model'}</span>
        </div>
        ${
          stale
            ? html`<p class="notice">
              The engine kept ${providerLabel(id)} after a request for
              ${providerLabel(pending ?? '')} — restart it to pick the new provider up.
            </p>`
            : ''
        }
        ${
          providers.length === 0
            ? html`<p class="empty">No provider reported yet</p>`
            : html`<ul>
              ${providers.map((provider) => {
                const usable = providerUsable(provider);
                const current = provider.id === id;
                return html`<li>
                  <button
                    class="provider"
                    data-provider=${provider.id}
                    aria-current=${current}
                    ?disabled=${!usable}
                    title=${usable ? provider.id : `${provider.label} needs WebGPU`}
                    @click=${() => this.select(provider.id)}
                  >
                    <span class="label">${provider.label}</span>
                    <span class="kind">${provider.kind}</span>
                    <span class="state">${current ? 'active' : pending === provider.id ? 'pending' : ''}</span>
                  </button>
                </li>`;
              })}
            </ul>`
        }
      </div>
    `;
  }

  private select(id: string): void {
    switchLmProvider(id);
    Announcer.getInstance().announce(`Switching provider to ${providerLabel(id)}`);
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'provider' });

  private readonly togglePin = () => {
    const pinned = this.hasAttribute('data-pinned');
    overlayManager.setPinned('provider', !pinned);
  };
}

const PROVIDER_SURFACE = { id: 'provider', title: 'Provider', group: 'overlay' } as const;

defineSurface(PROVIDER_SURFACE, ProviderView);
registerOverlay({
  id: PROVIDER_SURFACE.id,
  title: PROVIDER_SURFACE.title,
  tag: surfaceTag(PROVIDER_SURFACE),
});

declare global {
  interface HTMLElementTagNameMap {
    's-provider': ProviderView;
  }
}
