import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

@customElement('s-button')
export class SButton extends LitElement {
  static override styles = css`
    :host { display: inline-flex; }
    button { display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-component-toolbar-gap); border: 1px solid transparent; border-radius: var(--borderRadius-component-button); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-medium); line-height: var(--typography-lineHeights-tight); cursor: pointer; transition: var(--transitions-fast); white-space: nowrap; user-select: none; }
    button:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
    button:focus-visible { outline: 2px solid var(--colors-semantic-focus-ring); outline-offset: 2px; }
    .primary { background: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-on-accent); border-color: var(--colors-semantic-accent-primary); }
    .primary:hover:not(:disabled) { background: var(--colors-semantic-accent-primary-dim); }
    .secondary { background: var(--colors-semantic-bg-panel); color: var(--colors-semantic-text-primary); border-color: var(--colors-semantic-border-default); }
    .secondary:hover:not(:disabled) { background: var(--colors-semantic-bg-panel-hover); border-color: var(--colors-semantic-accent-primary); }
    .ghost { background: transparent; color: var(--colors-semantic-text-secondary); }
    .ghost:hover:not(:disabled) { background: var(--colors-semantic-bg-panel); color: var(--colors-semantic-text-primary); }
    .danger { background: transparent; color: var(--colors-primitive-error); border-color: var(--colors-primitive-error); }
    .danger:hover:not(:disabled) { background: rgba(255, 68, 68, 0.1); }
    .icon { background: transparent; color: var(--colors-semantic-text-secondary); min-width: 0; padding: var(--spacing-component-button-padding-y); }
    .icon:hover:not(:disabled) { color: var(--colors-semantic-text-primary); background: var(--colors-semantic-bg-panel); }
    .sm { padding: 1px 6px; font-size: var(--typography-scale-xs); }
    .md { padding: var(--spacing-component-button-padding-y) var(--spacing-component-button-padding-x); }
    .lg { padding: 6px 16px; font-size: var(--typography-scale-base); }
  `;

  @property({ type: String }) variant: ButtonVariant = 'secondary';
  @property({ type: String }) size: ButtonSize = 'md';
  @property({ type: Boolean }) disabled = false;

  override render() {
    return html`
      <button class=${classMap({ [this.variant]: true, [this.size]: true })} ?disabled=${this.disabled}>
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-button': SButton;
  }
}
