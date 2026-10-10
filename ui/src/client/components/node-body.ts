/**
 * One workspace block's body, rendered as the content of its graph node (the
 * modeless "conversation as graph nodes" paradigm). Reuses `renderBlockBody`, so
 * a node's content and the Notebook's are the same rendering and cannot drift;
 * Lit nodes only, so there is no `innerHTML` sink on this path.
 */

import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $workspaceGraph } from '../core/store.js';
import { blockBodyStyles, renderBlockBody } from '../utils/render-block.js';

@customElement('s-node-body')
export class SNodeBody extends BaseComponent {
  static override styles = [
    blockBodyStyles,
    css`
      :host {
        display: block;
        box-sizing: border-box;
        width: 240px;
        max-height: 200px;
        overflow: auto;
        padding: var(--spacing-scale-2);
        background: var(--colors-semantic-bg-panel-solid);
        border: 1px solid var(--colors-semantic-border-subtle);
        border-radius: var(--borderRadius-component-panel);
        box-shadow: var(--shadows-panel);
        font-size: var(--typography-scale-xs);
      }
    `,
  ];

  @property() ref = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  override render() {
    const block = $workspaceGraph.get().blocks.get(this.ref);
    if (!block) return nothing;
    return html`${renderBlockBody(block, [])}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-node-body': SNodeBody;
  }
}
