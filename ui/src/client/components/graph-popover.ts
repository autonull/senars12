/**
 * The graph hover popover (§2.4) — the explanation of whatever the pointer is
 * over. A **node** explains its block: identity, truth, the body the notebook
 * would render, and every link touching it. An **edge** explains the link: both
 * endpoints, the confidence and events behind it, and then the block it lands on
 * — body included, so an edge into an artifact previews that artifact — because
 * that is what an edge is *for*. Both come from `explain.ts`, and the body from
 * the notebook's own renderer, so the popover never re-derives the semantics.
 *
 * It takes a block/link **ref** and a position rather than a graph element, so
 * the semantic half renders and is testable without a canvas and the viewport
 * keeps only the hit-testing and the placement. Rows are Lit nodes, never markup:
 * an engine term is untrusted text, so it is escaped by construction.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL, blockLabel } from '../core/block-labels.js';
import { collectSources } from '../core/citations.js';
import { embeddedViewSpec, hasEmbeddedView } from '../core/embedded-views.js';
import { type ExplainLink, type ExplainModel, explainLinkModel, explainModel } from '../core/explain.js';
import { eventBus } from '../core/events.js';
import { $workspaceGraph, type Ref, revealBlock } from '../core/index.js';
import type { SemanticBlock, WorkspaceGraph } from '../core/workspace-graph.js';
import { linkMeta } from '../utils/link-catalog.js';
import { blockBodyStyles, renderBlockBody } from '../utils/render-block.js';

/** The body says something the head did not: a payload, or text beyond the label. */
const showsBody = (block: SemanticBlock): boolean =>
  block.data !== undefined || (block.text?.trim() ?? '') !== blockLabel(block);

@customElement('graph-popover')
export class GraphPopover extends LitElement {
  static override styles = [
    blockBodyStyles,
    css`
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
    .card { max-height: 14rem; overflow: auto; margin: var(--spacing-scale-2) 0; font-size: var(--typography-scale-sm); }
    .embed { margin: var(--spacing-scale-2) 0; padding: var(--spacing-scale-2) 0; border-top: 1px solid var(--colors-semantic-border-subtle); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .embed s-view { max-height: 12rem; }
    .divider { height: 1px; background: var(--colors-semantic-border-subtle); margin: var(--spacing-scale-2) 0; }
    .row { display: flex; align-items: baseline; gap: var(--spacing-scale-2); width: 100%; border: none; border-radius: var(--borderRadius-component-input); padding: var(--spacing-scale-1); background: transparent; color: inherit; cursor: pointer; text-align: left; font: inherit; }
    .row:hover { background: var(--colors-semantic-bg-panel-hover); }
    .link { flex-shrink: 0; min-width: 5.5rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    .other { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { color: var(--colors-semantic-text-muted); }
    .events { color: var(--colors-semantic-text-muted); }
    `,
  ];

  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
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
        ${this.derivation(graph, model.block)}
        ${this.blockCard(model, link.id)}
      `;
    }
    const model = explainModel(graph, this.ref);
    return model ? this.blockCard(model) : nothing;
  }

  /**
   * How the block came to be, read through the one embedded-view projection and
   * rendered by the one view host — the same tree the notebook embeds, so the edge
   * that claims a derivation shows it rather than asserting it.
   */
  private derivation(graph: WorkspaceGraph, block: SemanticBlock) {
    return hasEmbeddedView(graph, block.id, 'derivation')
      ? html`<div class="embed" data-embed="derivation">
          <s-view
            .spec=${embeddedViewSpec(block, 'derivation')}
            .chrome=${false}
            .budget=${'embedded'}
          ></s-view>
        </div>`
      : nothing;
  }

  /** An endpoint row: click to go there, ⌥ to explain the block. */
  private endpoint(ref: Ref, arrow: string) {
    const block = $workspaceGraph.get().blocks.get(ref);
    return html`<button
      class="row"
      data-other=${ref}
      @click=${(event: MouseEvent) => this.to(ref, event)}
    >
      <span class="link">${arrow}</span>
      <span class="other">${block ? blockLabel(block) : ref}</span>
    </button>`;
  }

  /** The block as its **notebook card**: identity, truth, body and links; `skip` drops the link being explained. */
  private blockCard(model: ExplainModel, skip?: Ref) {
    const { block, links } = model;
    const shown = skip ? links.filter((link) => link.id !== skip) : links;
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
      ${
        showsBody(block)
          ? html`<div class="card">${renderBlockBody(block, collectSources($workspaceGraph.get()))}</div>`
          : ''
      }
      ${shown.length > 0 ? html`<div class="divider"></div>` : ''}
      ${shown.map(
        (link) => html`
          <button
            class="row"
            data-other=${link.other}
            title=${`${link.label} ${link.otherLabel} — ⌥ to explain this link`}
            @click=${(event: MouseEvent) => this.activate(link, event)}
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

  /**
   * A row navigates to the other block; ⌥ explains the subject itself, which for a
   * link row is the link and for an endpoint row the block — the same gesture the
   * notebook and the ToC use (§3.5).
   */
  private to(ref: Ref, event: MouseEvent) {
    if (event.altKey) eventBus.emit('overlay:open', { id: 'explain', ref });
    else revealBlock(ref);
  }

  /** A link row navigates to the other block; ⌥ explains the link itself. */
  private activate(link: ExplainLink, event: MouseEvent) {
    this.to(event.altKey ? link.id : link.other, event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-popover': GraphPopover;
  }
}
