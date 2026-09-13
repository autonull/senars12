import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

type InputType = 'text' | 'search' | 'textarea' | 'select' | 'slider' | 'toggle';

@customElement('s-input')
export class SInput extends LitElement {
  static override styles = css`
    :host { display: flex; flex-direction: column; gap: var(--spacing-scale-2); }
    label { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
    input, textarea, select { background: var(--colors-semantic-bg-panel); border: 1px solid var(--colors-semantic-border-default); border-radius: var(--borderRadius-component-input); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); padding: var(--spacing-component-input-padding-y) var(--spacing-component-input-padding-x); transition: var(--transitions-fast); width: 100%; }
    input:focus, textarea:focus, select:focus { outline: none; border-color: var(--colors-semantic-border-focus); box-shadow: 0 0 0 1px var(--colors-semantic-border-focus); }
    input::placeholder, textarea::placeholder { color: var(--colors-semantic-text-muted); }
    textarea { resize: vertical; min-height: 60px; }
    select { cursor: pointer; }
    .description { font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .error { font-size: var(--typography-scale-xs); color: var(--colors-primitive-error); }
  `;

  @property({ type: String }) type: InputType = 'text';
  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) description = '';
  @property({ type: String }) error = '';
  @property({ type: Boolean }) disabled = false;

  override render() {
    const inputEl =
      this.type === 'textarea'
        ? html`<textarea .value=${this.value} ?disabled=${this.disabled} placeholder=${this.placeholder} @input=${this.handleInput}></textarea>`
        : this.type === 'select'
          ? html`<select .value=${this.value} ?disabled=${this.disabled} @input=${this.handleInput}><slot></slot></select>`
          : html`<input type=${this.type} .value=${this.value} ?disabled=${this.disabled} placeholder=${this.placeholder} @input=${this.handleInput}>`;

    return html`
      ${this.label ? html`<label>${this.label}</label>` : ''}
      ${inputEl}
      ${this.description ? html`<span class="description">${this.description}</span>` : ''}
      ${this.error ? html`<span class="error">${this.error}</span>` : ''}
    `;
  }

  private handleInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('s-change', { detail: { value: this.value }, bubbles: true, composed: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-input': SInput;
  }
}
