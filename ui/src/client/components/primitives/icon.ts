import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { getIcon, type IconName } from '../../utils/icon-registry.js';

@customElement('s-icon')
export class SIcon extends BaseComponent {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1;
      color: inherit;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: String }) name: IconName = 'brain';
  @property({ type: Number }) size = 16;

  override render() {
    const iconSvg = getIcon(this.name);
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width=${this.size}
        height=${this.size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style="width:${this.size}px;height:${this.size}px"
        .innerHTML=${iconSvg}
      ></svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-icon': SIcon;
  }
}