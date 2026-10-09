/**
 * The graph hover popover (§2.4) — the explanation of whatever the pointer is
 * over. A **node** explains its block: identity, truth, and every link touching
 * it. An **edge** explains the link: both endpoints, the confidence and events
 * behind it, and then the explanation of the block it lands on, because that is
 * what an edge is *for*. Both come from `explain.ts`, so the popover never
 * re-derives the semantics.
 *
 * It takes a block/link **ref** and a position rather than a graph element, so
 * the semantic half renders and is testable without a canvas and the viewport
 * keeps only the hit-testing and the placement. Rows are Lit nodes, never markup:
 * an engine term is untrusted text, so it is escaped by construction.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL, blockLabel } from '../core/block-labels.js';
import { type ExplainModel, explainLinkModel, explainModel } from '../core/explain.js';
import { $activeRenderer, $workspaceGraph, type Ref, setWorkspaceFocus } from '../core/index.js';
import { linkMeta } from '../utils/link-catalog.js';

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
    .events { color: var(--colors-semantic-text-muted); }
  `;

  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  /** The block this popover explains. */
  /** The block this popover explains, for a node hover. */
  @property({ type: String }) ref: Ref = '';
  /** The link this popover explains, for an edge hover; wins over `ref`. */
  @property({ type: String }) link: Ref = '';

  protected override render() {
    const graph = $workspaceGraph.get();
    if (this.link) {
      const explained = explainLinkModel(graph, this.link);
      if (!explained) return nothing;
      const { link, source, model } = explained;
      const events = link.eventRefs ?? [];
      return html`
        <div class="head">
          <span class="kind">${linkMeta(link.kind).label}</span>
          <span class="label">${link.source} → ${link.target}</span>
          ${
            link.confidence === undefined
              ? ''
              : html`<span class="chip">c${link.confidence.toFixed(2)}</span>`
          }
          ${
            events.length > 0
              ? html`<span class="events" title=${events.join(', ')}>${events.length} events</span>`
              : ''
          }
        </div>
        ${this.endpoint(link.target, '→')}
        ${source ? this.endpoint(source.id, '←') : ''}
        ${this.blockModel(model, link.id)}
      `;
    }
    const model = explainModel(graph, this.ref);
    return model ? this.blockModel(model) : nothing;
  }

  private endpoint(ref: Ref, arrow: string) {
    const block = $workspaceGraph.get().blocks.get(ref);
    return html`<button class="row" data-other=${ref} @click=${() => this.follow(ref)}>
      <span class="link">${arrow}</span>
      <span class="other">${block ? blockLabel(block) : ref}</span>
    </button>`;
  }

  /** The block's identity, truth and links; `skip` drops the link being explained. */
  private blockModel(model: ExplainModel, skip?: Ref) {
    const { block, links } = model;
    const shown = skip ? links.filter((link) => link.id !== skip) : links;
    const { uncertainty } = block;
    return html`
      ${shown.length > 0 ? html`<div class="divider"></div>` : ''}
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
      ${shown.length > 0 ? html`<div class="divider"></div>` : ''}
      ${shown.map(
        (link) => html`
          <button
            class="row"
            data-other=${link.other}
            title=${`${link.label} ${link.otherLabel}`}
            @click=${() => this.follow(link.other)}
          >
            <span class="link">${link.direction === 'out' ? '→' : '←'} ${link.label}</span>
            <span class="other">${link.otherLabel}</span>
            ${
              link.confidence === undefined
                ? ''
                : html`<span class="chip">c${link.confidence.toFixed(2)}</span>`
            }
          </button>
        `
      )}
      ${shown.length === 0 ? html`<div class="empty">No links yet</div>` : ''}
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
