import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

type SpinnerVariant = 'inline' | 'overlay';

@customElement('s-spinner')
export class SSpinner extends LitElement {
    static override styles = css`
    :host { display: inline-flex; }
    .spinner { display: inline-flex; align-items: center; justify-content: center; }
    .overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: var(--zIndex-layers-modal); }
    .ring { width: 16px; height: 16px; border: 2px solid var(--colors-semantic-border-default); border-top-color: var(--colors-semantic-accent-primary); border-radius: 50%; animation: spin 0.6s linear infinite; }
    .overlay .ring { width: 24px; height: 24px; border-width: 3px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

    @property({type: String}) variant: SpinnerVariant = 'inline';

    override render() {
        const content = html`<div class="ring"></div>`;
        if (this.variant === 'overlay') {
            return html`<div class="spinner overlay">${content}</div>`;
        }
        return html`<div class="spinner">${content}</div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        's-spinner': SSpinner;
    }
}
