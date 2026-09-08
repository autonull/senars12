import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

type ToolbarPlacement = 'floating' | 'pinned' | 'overflow';

@customElement('s-toolbar')
export class SToolbar extends LitElement {
    static override styles = css`
    :host { display: flex; }
    .toolbar { display: flex; align-items: center; gap: var(--spacing-component-toolbar-gap); padding: var(--spacing-component-toolbar-padding); background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); }
    .floating { box-shadow: var(--shadows-panel); }
    .pinned { border-radius: 0; border-left: none; border-right: none; }
    .overflow { flex-wrap: wrap; }
    .divider { width: 1px; height: 20px; background: var(--colors-semantic-border-subtle); margin: 0 var(--spacing-scale-1); }
    ::slotted(*) { flex-shrink: 0; }
  `;

    @property({type: String}) placement: ToolbarPlacement = 'pinned';

    override render() {
        return html`
      <div class="toolbar ${classMap({[this.placement]: true})}">
        <slot></slot>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        's-toolbar': SToolbar;
    }
}
