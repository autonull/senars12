import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { $graphNodes } from '../core/store.js';
import { BaseComponent } from '../core/base-component.js';

@customElement('s-search-panel')
export class SSearchPanel extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .search-input {
      margin-bottom: var(--spacing-scale-3);
    }
  `;

  @state() private hasNodes = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => {
      this.hasNodes = $graphNodes.get().size > 0;
    });
  }

  override render() {
    return html`
      <s-panel heading="Search" docked="right" closable @s-close=${this.handleClose}>
        <s-input class="search-input" type="search" placeholder="Search concepts…"></s-input>
        ${!this.hasNodes
          ? html`
              <s-empty-state
                icon="search"
                heading="No concepts"
                description="Send a message to populate the graph"
                size="sm"
              ></s-empty-state>
            `
          : ''}
      </s-panel>
    `;
  }

  private handleClose() {
    import('../core/store.js').then(({ togglePanel }) => togglePanel('search'));
  }
}

declare global {
  interface HTMLElementTagNameMap { 's-search-panel': SSearchPanel; }
}