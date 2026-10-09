/**
 * The explanation overlay (§3.5, Phase 1.6). Every block, link and event
 * explains itself at four disclosure levels — `summary · card · detail · raw` —
 * read from the one `explain()` projection and the link catalog. The levels are
 * data, so the same facts serve this overlay, the hover popover and a future
 * agent narration instead of being reconstructed per surface.
 *
 * The body is rendered by `renderBlockBody`, the notebook's own renderer, so an
 * explanation of an artifact *is* the artifact rather than a JSON dump of its
 * payload — and `raw` keeps the whole subject for when the machine shape is what
 * is being asked for.
 */

import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL, blockLabel } from '../../core/block-labels.js';
import { collectSources } from '../../core/citations.js';
import { eventBus } from '../../core/events.js';
import {
  explain,
  type ExplainedCitation,
  type ExplainedEvent,
  type ExplainedLink,
  type ExplainLink,
  type ExplainModel,
  type ExplainSubject,
} from '../../core/explain.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $nodeHistory, $workspaceGraph } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
import type { Disclosure } from '../../core/view-spec.js';
import { linkMeta } from '../../utils/link-catalog.js';
import { blockBodyStyles, renderBlockBody } from '../../utils/render-block.js';

const LEVELS: readonly Disclosure[] = ['summary', 'card', 'detail', 'raw'];

const json = (value: unknown): string => JSON.stringify(value, null, 2) ?? String(value);

const truth = (t: { frequency: number; confidence: number }): string =>
  `f${t.frequency.toFixed(2)} c${t.confidence.toFixed(2)}`;

/** The links touching an explained block, as the catalog names them. */
const linkRows = (links: readonly ExplainLink[]) => html`
  <div class="links">
    ${links.map(
      (link) => html`<span class="link" data-kind=${link.kind}>
        <span class="dir">${link.direction === 'out' ? '→' : '←'}</span>
        <span>${link.label}: ${link.otherLabel}</span>
      </span>`
    )}
  </div>
`;

/** The links whose provenance cites an explained event. */
const citationRows = (citing: readonly ExplainedCitation[]) => html`
  <div class="links">
    ${citing.map(
      (citation) => html`<span class="link">
        <span class="dir">${citation.label}</span>
        <span>${citation.sourceLabel} → ${citation.targetLabel}</span>
      </span>`
    )}
  </div>
`;

@customElement('s-explain')
export class ExplainView extends SurfaceComponent {
  static override styles = [
    blockBodyStyles,
    css`
    :host { position: fixed; top: 10vh; left: 50%; transform: translateX(-50%); width: min(560px, 92vw); max-height: 76vh; z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 76vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .kind { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    .levels { display: flex; gap: var(--spacing-scale-1); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .levels button { border: 1px solid var(--colors-semantic-border-subtle); border-radius: 999px; padding: 2px var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-size: var(--typography-scale-xs); text-transform: capitalize; }
    .levels button[aria-pressed='true'] { background: var(--colors-semantic-accent-violet); color: var(--colors-semantic-bg-base); border-color: transparent; }
    .body { padding: var(--spacing-scale-3); overflow: auto; display: flex; flex-direction: column; gap: var(--spacing-scale-2); }
    dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px var(--spacing-scale-3); font-size: var(--typography-scale-sm); }
    dt { color: var(--colors-semantic-text-muted); }
    dd { margin: 0; color: var(--colors-semantic-text-primary); }
    pre { margin: 0; padding: var(--spacing-scale-2); border-radius: 4px; background: var(--colors-semantic-bg-base); overflow: auto; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); }
    .links { display: flex; flex-direction: column; gap: 2px; }
    .link { display: flex; gap: var(--spacing-scale-2); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); }
    .link .dir { color: var(--colors-semantic-text-muted); }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
  `,
  ];

  @property({ type: String }) ref = '';
  @state() private level: Disclosure = 'card';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
    this.watch($nodeHistory);
  }

  protected override renderBody() {
    const subject = explain($workspaceGraph.get(), this.ref, $nodeHistory.get());
    if (!subject) return html`<div class="panel"><p class="empty">Nothing to explain</p></div>`;
    const { kind, title } = this.heading(subject);
    return html`
      <div class="panel" role="dialog" aria-modal="true" aria-label="Explanation">
        <overlay-header
          overlay-id="explain"
          .kind=${kind}
          .title=${title}
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <span class="kind" style="display:none">${kind}</span>
        <div class="levels" role="group" aria-label="Disclosure level">
          ${LEVELS.map(
            (level) => html`<button
              data-level=${level}
              aria-pressed=${this.level === level}
              @click=${() => (this.level = level)}
            >${level}</button>`
          )}
        </div>
        <div class="body">${this.disclosure(subject)}</div>
      </div>
    `;
  }

  /** What is being explained, in the overlay's own header. */
  private heading(subject: ExplainSubject): { kind: string; title: string } {
    switch (subject.kind) {
      case 'block':
        return {
          kind: BLOCK_KIND_LABEL[subject.model.block.kind],
          title: subject.model.block.title ?? subject.model.block.id,
        };
      case 'link': {
        const { link, target } = subject.model;
        return {
          kind: linkMeta(link.kind).label,
          title: target ? blockLabel(target) : link.target,
        };
      }
      case 'event':
        return { kind: subject.model.entry.source, title: subject.model.entry.stampId };
    }
  }

  private disclosure(subject: ExplainSubject) {
    switch (subject.kind) {
      case 'block':
        return this.block(subject.model);
      case 'link':
        return this.link(subject.model);
      case 'event':
        return this.event(subject.model);
    }
  }

  private block(model: ExplainModel) {
    const { block } = model;
    switch (this.level) {
      case 'raw':
        return html`<pre>${json(block)}</pre>`;
      case 'detail':
        return html`${this.blockFacts(block)}
          ${this.blockBody(model)}
          <pre>${json(block.data ?? block.artifact ?? block.spec ?? {})}</pre>`;
      case 'summary':
        return this.blockFacts(block);
      default:
        return html`${this.blockFacts(block)}${this.blockBody(model)}`;
    }
  }

  private link(model: ExplainedLink) {
    const { link, source, target } = model;
    const facts = html`
      <dl>
        <dt>Relationship</dt><dd>${linkMeta(link.kind).label}</dd>
        <dt>Source</dt><dd>${source ? blockLabel(source) : link.source}</dd>
        <dt>Target</dt><dd>${target ? blockLabel(target) : link.target}</dd>
        ${link.confidence === undefined ? '' : html`<dt>Confidence</dt><dd>${link.confidence.toFixed(2)}</dd>`}
        ${link.eventRefs?.length ? html`<dt>Events</dt><dd>${link.eventRefs.join(', ')}</dd>` : ''}
      </dl>
    `;
    switch (this.level) {
      case 'raw':
        return html`<pre>${json(link)}</pre>`;
      case 'summary':
        return facts;
      default:
        return html`${facts}${target ? this.blockBody(model.model) : ''}`;
    }
  }

  private event(model: ExplainedEvent) {
    const { entry, citing } = model;
    const facts = html`
      <dl>
        <dt>Stamp</dt><dd>${entry.stampId}</dd>
        <dt>Source</dt><dd>${entry.source}</dd>
        <dt>Truth</dt><dd>${truth(entry.truth)}</dd>
        <dt>At</dt><dd>${new Date(entry.timestamp).toLocaleString()}</dd>
      </dl>
    `;
    switch (this.level) {
      case 'raw':
        return html`<pre>${json(model)}</pre>`;
      case 'summary':
        return facts;
      default:
        return html`${facts}${citing.length > 0 ? citationRows(citing) : ''}`;
    }
  }

  private blockFacts(block: ExplainModel['block']) {
    const { uncertainty } = block;
    return html`
      <dl>
        <dt>Kind</dt><dd>${block.kind}</dd>
        <dt>Role</dt><dd>${block.role}</dd>
        <dt>Producer</dt><dd>${block.createdBy}</dd>
        <dt>Status</dt><dd>${block.status ?? 'complete'}</dd>
        ${uncertainty ? html`<dt>Uncertainty</dt><dd>${truth(uncertainty)}</dd>` : ''}
      </dl>
    `;
  }

  /** The block as the notebook would render it, links and all. */
  private blockBody(model: ExplainModel) {
    return html`
      ${renderBlockBody(model.block, collectSources($workspaceGraph.get()))}
      ${model.links.length > 0 ? linkRows(model.links) : ''}
    `;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'explain' });

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };
}

const EXPLAIN_SURFACE = { id: 'explain', title: 'Explanation', group: 'overlay' } as const;

defineSurface(EXPLAIN_SURFACE, ExplainView);
registerOverlay({
  id: EXPLAIN_SURFACE.id,
  title: EXPLAIN_SURFACE.title,
  tag: surfaceTag(EXPLAIN_SURFACE),
});

declare global {
  interface HTMLElementTagNameMap {
    's-explain': ExplainView;
  }
}