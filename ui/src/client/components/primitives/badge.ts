import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

type BadgeVariant = 'count' | 'status' | 'lens';

@customElement('s-badge')
export class SBadge extends LitElement {
  static override styles = css`
    :host { display: inline-flex; }
    .badge { display: inline-flex; align-items: center; gap: var(--spacing-component-badge-gap); padding: 1px 6px; border-radius: var(--borderRadius-component-badge); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); font-weight: var(--typography-fontWeights-medium); line-height: var(--typography-lineHeights-tight); white-space: nowrap; user-select: none; }
    .count { background: var(--colors-semantic-bg-panel); color: var(--colors-semantic-text-secondary); border: 1px solid var(--colors-semantic-border-default); }
    .status { background: transparent; border: 1px solid currentColor; }
    .lens { padding: 2px 8px; font-size: var(--typography-scale-xs); font-family: var(--typography-fontFamilies-ui); font-weight: var(--typography-fontWeights-semibold); }
    .connected { color: var(--colors-semantic-status-connected); }
    .connecting { color: var(--colors-semantic-status-connecting); }
    .disconnected { color: var(--colors-semantic-status-disconnected); }
    .dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
  `;

  @property({ type: String }) variant: BadgeVariant = 'count';
  @property({ type: String }) status: string | undefined;

  override render() {
    return html`
      <span class="badge ${classMap({
        [this.variant]: true,
        ...(this.status ? { [this.status]: true } : {}),
      })}">
        ${this.status ? html`<span class="dot" style="background: currentColor"></span>` : ''}
        <slot></slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-badge': SBadge;
  }
}
