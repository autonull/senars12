import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

type PanelDock = 'left' | 'right' | 'bottom' | 'float';

@customElement('s-panel')
export class SPanel extends LitElement {
    static override styles = css`
    :host { display: flex; flex-direction: column; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); overflow: hidden; box-shadow: var(--shadows-panel); }
    .header { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-component-panel-padding); border-bottom: 1px solid var(--colors-semantic-border-subtle); min-height: 36px; }
    .heading { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .actions { display: flex; align-items: center; gap: var(--spacing-scale-1); }
    .content { flex: 1; overflow: auto; padding: var(--spacing-component-panel-padding); }
    .content.no-pad { padding: 0; }
    .docked-left { border-radius: 0; border-left: none; border-top: none; border-bottom: none; }
    .docked-right { border-radius: 0; border-right: none; border-top: none; border-bottom: none; }
    .docked-bottom { border-radius: 0; border-left: none; border-right: none; border-bottom: none; }
    .docked-float { box-shadow: var(--shadows-panel-hover); }
  `;

    @property({type: String}) heading = '';
    @property({type: String}) docked: PanelDock = 'right';
    @property({type: Boolean}) closable = false;
    @property({type: Boolean}) noPad = false;

    override render() {
        return html`
      <div class=${classMap({[`docked-${this.docked}`]: true})}>
        ${
            this.heading
                ? html`
          <div class="header">
            <span class="heading">${this.heading}</span>
            <div class="actions">
              <slot name="actions"></slot>
              ${this.closable ? html`<s-button variant="icon" size="sm" @click=${this.handleClose}>&times;</s-button>` : ''}
            </div>
          </div>
        `
                : ''
        }
        <div class="content ${this.noPad ? 'no-pad' : ''}">
          <slot></slot>
        </div>
      </div>
    `;
    }

    private handleClose() {
        this.dispatchEvent(new CustomEvent('s-close', {bubbles: true, composed: true}));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        's-panel': SPanel;
    }
}
