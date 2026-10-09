/**
 * The graph node popover (§2.4) — the `explainModel` of the hovered node's
 * block: its identity, its truth, and every link touching it, each labelled
 * through the one link catalog. It takes a **block ref** and a position rather
 * than a graph element, so the semantic half renders and is testable without a
 * canvas and the viewport keeps only the hit-testing and the placement.
 *
 * Rows are Lit nodes, never markup: an engine term is untrusted text, so it is
 * escaped by construction.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL, blockLabel } from '../core/block-labels.js';
import { explainModel } from '../core/explain.js';
import { $activeRenderer, $workspaceGraph, type Ref, setWorkspaceFocus } from '../core/index.js';

@customElement('graph-popover')
export class GraphPopover extends LitElement {
  static override styles = css`
    :host {
      position: absolute; min-width: 15rem; max-width: 24rem; background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-default); border-radius: var(--borderRadius-component-panel);
      padding: var(--spacing-scale-2) var(--spacing-scale-3); font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-primary);
      z-index: var(--zIndex-layers-popover); box-shadow: var(--shadows-panel);
      transform: translate(-50%, -100%); margin-top: -8px;
    }
    .head { display: flex; align-items: baseline; gap: var(--spacing-scale-2); }
    .kind { text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--typography-fontWeights-medium); }
    .chip { color: var(--colors-semantic-text-secondary); font-variant-numeric: tabular-nums; }
    .divider { height: 1px; background: var(--colors-semantic-border-subtle); margin: var(--spacing-scale-2) 0; }
    .row { display: flex; align-items: baseline; gap: var(--spacing-scale-2); width: 100%; border: none; border-radius: var(--borderRadius-component-input); padding: var(--spacing-scale-1); background: transparent; color: inherit; cursor: pointer; text-align: left; font: inherit; }
    .row:hover { background: var(--colors-semantic-bg-panel-hover); }
    .link { flex-shrink: 0; min-width: 5.5rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    .other { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { color: var(--colors-semantic-text-muted); }
  `;

  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  /** The block this popover explains. */
  @property({ type: String }) ref: Ref = '';

  protected override render() {
    const model = explainModel($workspaceGraph.get(), this.ref);
    if (!model) return nothing;
    const { block, links } = model;
    const { uncertainty } = block;
    return html`
      <div class="head">
        <span class="kind">${BLOCK_KIND_LABEL[block.kind]}</span>
        <span class="label">${blockLabel(block)}</span>
        ${
          uncertainty
            ? html`<span class="chip"
              >f${uncertainty.frequency.toFixed(2)} c${uncertainty.confidence.toFixed(2)}</span
            >`
            : ''
        }
      </div>
      ${links.length > 0 ? html`<div class="divider"></div>` : ''}
      ${links.map(
        (link) => html`
          <button class="row" data-other=${link.other} title=${link.otherLabel} @click=${() => this.follow(link.other)}>
            <span class="link">${link.direction === 'out' ? '→' : '←'} ${link.label}</span>
            <span class="other">${link.otherLabel}</span>
          </button>
        `
      )}
      ${links.length === 0 ? html`<div class="empty">No links yet</div>` : ''}
    `;
  }

  /** Follow a link in the notebook — the popover's rows are navigation, not decoration. */
  private follow(ref: Ref) {
    $activeRenderer.set('notebook');
    setWorkspaceFocus(ref);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-popover': GraphPopover;
  }
}
