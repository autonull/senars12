/**
 * The explanation popover (§3.5 seed, Phase 1.6). Every block, node, link and
 * event explains itself at four disclosure levels — `summary · card · detail ·
 * raw` — read from the one `explainModel` projection and the link catalog. The
 * levels are data, so the same facts serve the popover, an agent narration and a
 * future full-screen inspector instead of being reconstructed per surface.
 */

import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL } from '../../core/block-labels.js';
import { eventBus } from '../../core/events.js';
import { explainModel, type ExplainLink } from '../../core/explain.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $workspaceGraph } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import type { SemanticBlock } from '../../core/workspace-graph.js';

const LEVELS = ['summary', 'card', 'detail', 'raw'] as const;
type Level = (typeof LEVELS)[number];

const json = (value: unknown): string => JSON.stringify(value, null, 2) ?? String(value);

@customElement('s-explain')
export class ExplainView extends SurfaceComponent {
  static override styles = css`
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
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `;

  @property({ type: String }) ref = '';
  @state() private level: Level = 'card';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  protected override renderBody() {
    const model = explainModel($workspaceGraph.get(), this.ref);
    if (!model) return html`<div class="panel"><p class="empty">Block not found</p></div>`;
    const { block, links } = model;
    return html`
      <div class="panel" role="dialog" aria-label="Explanation">
        <header>
          <span class="kind">${BLOCK_KIND_LABEL[block.kind]}</span>
          <span class="title">${block.title ?? block.id}</span>
          <button class="close" title="Close" aria-label="Close explanation" @click=${this.close}>&times;</button>
        </header>
        <div class="levels" role="group" aria-label="Disclosure level">
          ${LEVELS.map(
            (level) => html`<button
              data-level=${level}
              aria-pressed=${this.level === level}
              @click=${() => (this.level = level)}
            >${level}</button>`
          )}
        </div>
        <div class="body">${this.disclosure(block, links)}</div>
      </div>
    `;
  }

  private disclosure(block: SemanticBlock, links: readonly ExplainLink[]) {
    switch (this.level) {
      case 'summary':
        return this.summary(block);
      case 'detail':
        return html`${this.summary(block)}${this.cardBody(block, links)}
          <pre>${json(block.data ?? block.artifact ?? block.spec ?? block)}</pre>`;
      case 'raw':
        return html`<pre>${json(block)}</pre>`;
      default:
        return html`${this.summary(block)}${this.cardBody(block, links)}`;
    }
  }

  private summary(block: SemanticBlock) {
    const uncertainty = block.uncertainty;
    return html`
      <dl>
        <dt>Kind</dt><dd>${block.kind}</dd>
        <dt>Role</dt><dd>${block.role}</dd>
        <dt>Producer</dt><dd>${block.createdBy}</dd>
        <dt>Status</dt><dd>${block.status ?? 'complete'}</dd>
        ${uncertainty ? html`<dt>Uncertainty</dt><dd>f${uncertainty.frequency.toFixed(2)} c${uncertainty.confidence.toFixed(2)}</dd>` : ''}
      </dl>
    `;
  }

  private cardBody(block: SemanticBlock, links: readonly ExplainLink[]) {
    const text = block.text ?? block.title;
    return html`
      ${text ? html`<pre>${text}</pre>` : ''}
      ${
        links.length > 0
          ? html`<div class="links">
              ${links.map(
                (link) => html`<span class="link" data-kind=${link.kind}>
                  <span class="dir">${link.direction === 'out' ? '→' : '←'}</span>
                  <span>${link.label}: ${link.otherLabel}</span>
                </span>`
              )}
            </div>`
          : ''
      }
    `;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'explain' });
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
