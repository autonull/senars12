import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Lens } from '../../shared/protocol.js';
import { $activeLens } from '../core/store.js';
import { send } from '../core/ws-client.js';
import { BaseComponent } from '../core/base-component.js';
import { LENS_COLORS, LENS_LABELS } from '../constants.js';

@customElement('lens-selector')
export class LensSelector extends BaseComponent {
  static override styles = css`
    :host { display: inline-block; position: relative; }
    .badge { display: flex; align-items: center; gap: 6px; background: var(--bg-panel); border: 1px solid var(--border-dim); border-radius: 4px; padding: 3px 8px; cursor: pointer; font-family: var(--font-data); font-size: 0.7rem; color: var(--text-primary); }
    .badge:hover { border-color: var(--accent-cyan); }
    .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .arrow { font-size: 0.55rem; opacity: 0.6; margin-left: 2px; }
    .dropdown { position: absolute; top: 100%; left: 0; margin-top: 4px; background: var(--bg-panel-solid); border: 1px solid var(--border-dim); border-radius: 4px; z-index: 10; min-width: 140px; }
    .option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: none; color: var(--text-primary); font-family: var(--font-data); font-size: 0.75rem; cursor: pointer; text-align: left; }
    .option:hover { background: var(--bg-void); }
    .option.active { background: var(--bg-void); border-left: 2px solid var(--accent-cyan); }
    .desc { font-size: 0.65rem; opacity: 0.5; }
  `;

  @state() private open = false;

  private toggle() { this.open = !this.open; }

  private close() { this.open = false; }

  private selectLens(lens: Lens) {
    $activeLens.set(lens);
    send({ type: 'lens.set', lens });
    this.close();
  }

  override render() {
    const activeLens = $activeLens.get();
    return html`
      <div class="badge" @click=${this.toggle} @blur=${this.close} tabindex="0">
        <span class="dot" style="background: ${LENS_COLORS[activeLens]}"></span>
        ${LENS_LABELS[activeLens]}
        <span class="arrow">▼</span>
      </div>
      ${this.open ? html`
        <div class="dropdown">
          ${(['belief', 'goal', 'contradiction'] as Lens[]).map((l) => html`
            <button class="option ${l === activeLens ? 'active' : ''}" @click=${() => this.selectLens(l)}>
              <span class="dot" style="background: ${LENS_COLORS[l]}"></span>
              <span>${LENS_LABELS[l]}</span>
              <span class="desc">${l === 'belief' ? 'What the system knows' : l === 'goal' ? 'What the system wants' : 'Where beliefs conflict'}</span>
            </button>
          `)}
        </div>
      ` : ''}
    `;
  }
}
