import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { eventBus } from '../core/events.js';
import { $lmProvider, providerLabel } from '../core/lm-provider.js';
import { refreshLmStatus, switchLmProvider } from '../core/lm-transport.js';
import { $webllmActive, $webllmAvailable } from '../core/store.js';

/**
 * Small status strip answering "which model am I actually using?" — a read-only
 * view of the `LmProvider` façade (§0.6), which is what owns `lm.status` and the
 * switch protocol. Switching lives in the Provider overlay; this strip only
 * reflects it and offers the one switch worth a single click.
 */
@customElement('lm-status-panel')
export class LMStatusPanel extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .panel {
      align-items: center; display: flex; font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs); gap: 8px; padding: 2px 8px; flex-wrap: wrap;
    }
    .dot { border-radius: 50%; height: 6px; width: 6px; }
    .ok { background: var(--colors-primitive-success); } .down { background: var(--colors-primitive-error); }
    .muted { opacity: 0.6; }
    .webllm-badge {
      background: var(--colors-semantic-bg-emphasis);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: var(--typography-scale-xxs);
    }
    .webllm-badge.local { background: color-mix(in srgb, var(--colors-primitive-success) 14%, transparent); border-color: var(--colors-primitive-success); color: var(--colors-primitive-success); }
    .run-locally-btn {
      background: var(--colors-semantic-bg-emphasis);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: var(--typography-scale-xxs);
      cursor: pointer;
      transition: all 0.2s;
    }
    .run-locally-btn:hover { background: var(--colors-semantic-bg-hover); }
    .run-locally-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .provider-link {
      background: none; border: none; padding: 0; cursor: pointer;
      color: var(--colors-semantic-text-muted); font: inherit; text-decoration: underline dotted;
    }
  `;

  private webllmAvailable = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($lmProvider);
    this.watch($webllmAvailable);
    this.watch($webllmActive);
    this.webllmAvailable = 'gpu' in navigator;
    refreshLmStatus();
  }

  private readonly switchToWebLLM = () => switchLmProvider('webllm');

  private readonly openProvider = () => eventBus.emit('overlay:open', { id: 'provider' });

  override render() {
    const { id, model, available, stale } = $lmProvider.get();
    const isWebLLM = id === 'webllm';
    const showRunLocally = this.webllmAvailable && !$webllmActive.get() && !isWebLLM;

    return html`
      <span class="panel">
        <span class="dot ${available ? 'ok' : 'down'}"></span>
        <button class="provider-link" data-action="provider" @click=${this.openProvider}>
          LM: ${providerLabel(id)}
        </button>
        <span class="muted">${model ?? ''}</span>
        ${stale ? html`<span class="muted">switch not applied</span>` : ''}
        ${isWebLLM ? html`<span class="webllm-badge local">🌐 Running locally (WebLLM)</span>` : ''}
        ${
          showRunLocally
            ? html`<button
              class="run-locally-btn"
              data-action="run-locally"
              @click=${this.switchToWebLLM}
              title="Switch to local WebGPU inference"
            >
              🌐 Run locally
            </button>`
            : ''
        }
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lm-status-panel': LMStatusPanel;
  }
}
