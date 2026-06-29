import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

type EmptySize = 'sm' | 'md' | 'lg';

@customElement('s-empty-state')
export class SEmptyState extends LitElement {
  static override styles = css`
    :host { display: flex; align-items: center; justify-content: center; }
    .container { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-scale-4); text-align: center; max-width: 280px; }
    .icon { color: var(--colors-semantic-text-muted); opacity: 0.5; }
    .icon.sm { font-size: 1.5rem; }
    .icon.md { font-size: 2.5rem; }
    .icon.lg { font-size: 3.5rem; }
    .title { color: var(--colors-semantic-text-secondary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-base); font-weight: var(--typography-fontWeights-medium); }
    .description { color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); line-height: var(--typography-lineHeights-relaxed); }
    .action { margin-top: var(--spacing-scale-2); }
  `;

  @property({ type: String }) icon = '';
  @property({ type: String }) heading = '';
  @property({ type: String }) description = '';
  @property({ type: String }) size: EmptySize = 'md';

  override render() {
    return html`
      <div class="container">
        ${this.icon ? html`<div class="icon ${classMap({ [this.size]: true })}">${this.icon}</div>` : ''}
        ${this.heading ? html`<div class="title">${this.heading}</div>` : ''}
        ${this.description ? html`<div class="description">${this.description}</div>` : ''}
        <div class="action"><slot name="action"></slot></div>
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-empty-state': SEmptyState;
  }
}
