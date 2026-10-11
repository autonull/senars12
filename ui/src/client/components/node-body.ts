/**
 * One workspace block's body, rendered as the content of its graph node (the
 * modeless "conversation as graph nodes" paradigm). Reuses `renderBlockBody`, so
 * a node's content and the Notebook's are the same rendering and cannot drift;
 * Lit nodes only, so there is no `innerHTML` sink on this path.
 * Supports LoD tiers: 'card' (truncated summary) and 'full' (complete body).
 */

import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $workspaceGraph } from '../core/store.js';
import { blockBodyStyles, renderBlockBody } from '../utils/render-block.js';
import { collectSources } from '../core/citations.js';

type NodeTier = 'card' | 'full';

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
      :host([tier=card]) {
        max-height: 120px;
      }
      :host([tier=full]) {
        max-height: 300px;
      }
    `,
  ];

  @property() ref = '';
  @property() tier: NodeTier = 'full';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  override render() {
    const graph = $workspaceGraph.get();
    const block = graph.blocks.get(this.ref);
    if (!block) return nothing;
    // For card tier, we could truncate the body - for now render full body
    // The max-height CSS handles visual truncation
    const sources = collectSources(graph);
    return html`${renderBlockBody(block, sources)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-node-body': SNodeBody;
  }
}
