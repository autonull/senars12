import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

type TooltipTrigger = 'hover' | 'focus' | 'delayed';

@customElement('s-tooltip')
export class STooltip extends LitElement {
    static override styles = css`
    :host { display: inline-flex; position: relative; }
    .trigger { display: inline-flex; cursor: pointer; }
    .tooltip { position: absolute; bottom: calc(100% + var(--spacing-component-tooltip-gap)); left: 50%; transform: translateX(-50%); padding: var(--spacing-scale-2) var(--spacing-scale-3); background: var(--colors-semantic-bg-elevated); border: 1px solid var(--colors-semantic-border-default); border-radius: var(--borderRadius-component-tooltip); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); white-space: nowrap; pointer-events: none; z-index: var(--zIndex-layers-tooltip); box-shadow: var(--shadows-tooltip); }
    .tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 4px solid transparent; border-top-color: var(--colors-semantic-border-default); }
    .hidden { display: none; }
    .visible { display: block; }
  `;

    @property({type: String}) text = '';
    @property({type: String}) trigger: TooltipTrigger = 'hover';
    @property({type: Boolean}) visible = false;

    private showTimer: number | undefined;

    override render() {
        return html`
      <div class="trigger" @mouseenter=${this.handleMouseEnter} @mouseleave=${this.handleMouseLeave} @focus=${() => {
            this.visible = true;
            this.requestUpdate();
        }} @blur=${() => {
            this.visible = false;
            this.requestUpdate();
        }}>
        <slot></slot>
        <div class="tooltip ${classMap({hidden: !this.visible})}">${this.text}</div>
      </div>
    `;
    }

    private handleMouseEnter() {
        if (this.trigger === 'delayed') {
            this.showTimer = window.setTimeout(() => {
                this.visible = true;
                this.requestUpdate();
            }, 500);
        } else {
            this.visible = true;
            this.requestUpdate();
        }
    }

    private handleMouseLeave() {
        if (this.showTimer) {
            clearTimeout(this.showTimer);
            this.showTimer = undefined;
        }
        this.visible = false;
        this.requestUpdate();
    }
}

declare global {
    interface HTMLElementTagNameMap {
        's-tooltip': STooltip;
    }
}
