/**
 * One workspace block's body, rendered as the content of its graph node (the
 * modeless "conversation as graph nodes" paradigm). Reuses `renderBlockBody`, so
 * a node's content and the Notebook's are the same rendering and cannot drift;
 * Lit nodes only, so there is no `innerHTML` sink on this path.
 * Supports LoD tiers: 'card' (truncated summary) and 'full' (complete body).
 *
 * Inert until engaged (§Move 2.3): the body does not steal pan/zoom from the
 * graph. An explicit Engage affordance — or the node being focused — enters
 * interaction, so embedded content never fights the canvas by default.
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
        pointer-events: none;
      }
      :host([engaged]) { pointer-events: auto; }
      :host([tier=card]) {
        max-height: 120px;
      }
      :host([tier=full]) {
        max-height: 300px;
      }
      .engage {
        position: sticky;
        top: 0;
        float: right;
        pointer-events: auto;
        padding: 1px 6px;
        border: 1px solid var(--colors-semantic-border-subtle);
        border-radius: var(--borderRadius-scale-sm);
        background: var(--colors-semantic-bg-panel-solid);
        color: var(--colors-semantic-accent-primary);
        cursor: pointer;
        font-family: inherit;
        font-size: var(--typography-scale-xs);
      }
    `,
  ];

  @property() ref = '';
  @property() tier: NodeTier = 'full';
  /** How many projections this body is nested inside (§Move 2.1). */
  @property({ type: Number }) depth = 0;
  /** Inert until engaged: pan/zoom passes through until the body is entered (§Move 2.3). */
  @property({ type: Boolean, reflect: true }) engaged = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  override render() {
    const graph = $workspaceGraph.get();
    const block = graph.blocks.get(this.ref);
    if (!block) return nothing;
    const sources = collectSources(graph);
    return html`
      ${this.engaged ? nothing : html`<button class="engage" @click=${() => (this.engaged = true)}>Engage</button>`}
      ${renderBlockBody(block, sources, this.depth)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-node-body': SNodeBody;
  }
}
