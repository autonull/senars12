/**
 * The semantic-neighborhood popover (§2.4, Phase 2). "Open related" on a block
 * lists the blocks it touches — grouped by relation and direction — and each row
 * navigates (focuses the block, closing the popover). Traversal is the pure
 * `neighborhood` projection; this overlay only presents and dispatches focus, so
 * graph, Notebook and palette share one navigation path. The hop count is session
 * state (`$neighborhoodDepth`, URL-owned) rather than a literal here, so a link can
 * pin how far "related" reaches.
 */

import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL } from '../../core/block-labels.js';
import { eventBus } from '../../core/events.js';
import { type Neighbor, neighborhood } from '../../core/neighborhood.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import {
  $neighborhoodDepth,
  $workspaceGraph,
  setNeighborhoodDepth,
  setWorkspaceFocus,
} from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';

/** The hop counts "Open related" offers. */
const DEPTHS = [1, 2, 3] as const;

const labelOf = (neighbor: Neighbor): string =>
  neighbor.block.title ?? neighbor.block.text?.split('\n')[0]?.trim() ?? BLOCK_KIND_LABEL[neighbor.block.kind];

@customElement('s-related')
export class RelatedView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); width: min(480px, 92vw); max-height: 70vh; z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 70vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .kind { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    .body { padding: var(--spacing-scale-2); overflow: auto; display: flex; flex-direction: column; gap: 2px; }
    .group { margin: var(--spacing-scale-1) var(--spacing-scale-2) 0; font-size: var(--typography-scale-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    button.row { display: flex; align-items: center; gap: var(--spacing-scale-2); width: 100%; text-align: left; border: none; background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; padding: var(--spacing-scale-1) var(--spacing-scale-2); border-radius: 4px; font-size: var(--typography-scale-sm); }
    button.row:hover { background: var(--colors-semantic-bg-subtle); color: var(--colors-semantic-text-primary); }
    .dir { color: var(--colors-semantic-accent-cyan); font-family: var(--typography-fontFamilies-data); }
    .label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
    .depth { display: flex; align-items: center; gap: var(--spacing-scale-1); }
    .depth > span { font-size: var(--typography-scale-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    .depth button { border: 1px solid var(--colors-semantic-border-subtle); border-radius: 999px; padding: 1px var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-xs); }
    .depth button[aria-pressed='true'] { background: var(--colors-semantic-accent-cyan); color: var(--colors-semantic-bg-base); border-color: transparent; }
  `;

  @property({ type: String }) ref = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
    this.watch($neighborhoodDepth);
  }

  protected override renderBody() {
    const depth = $neighborhoodDepth.get();
    const model = neighborhood($workspaceGraph.get(), this.ref, depth);
    if (!model) return html`<div class="panel"><p class="empty">Block not found</p></div>`;
    const grouped = new Map<string, Neighbor[]>();
    for (const neighbor of model.neighbors) {
      const key = `${neighbor.direction === 'out' ? '→' : '←'} ${neighbor.link.label ?? neighbor.link.kind}`;
      const group = grouped.get(key);
      if (group) group.push(neighbor);
      else grouped.set(key, [neighbor]);
    }
    return html`
      <div class="panel" role="dialog" aria-label="Related blocks">
        <header>
          <span class="kind">${BLOCK_KIND_LABEL[model.block.kind]}</span>
          <span class="title">${model.block.title ?? model.block.id}</span>
          <span class="depth" role="group" aria-label="Traversal depth">
            <span>hops</span>
            ${DEPTHS.map(
              (hops) => html`<button
                data-depth=${hops}
                aria-pressed=${depth === hops}
                @click=${() => setNeighborhoodDepth(hops)}
              >
                ${hops}
              </button>`
            )}
          </span>
          <button class="pin-btn" aria-label="Pin related" aria-pressed=${this.hasAttribute('data-pinned')} @click=${this.togglePin}>📌</button>
          <button class="close" title="Close" aria-label="Close related" @click=${this.close}>&times;</button>
        </header>
        <div class="body">
          ${
            model.neighbors.length === 0
              ? html`<p class="empty">No related blocks</p>`
              : [...grouped].map(
                  ([group, neighbors]) => html`
                    <span class="group">${group}</span>
                    ${neighbors.map(
                      (neighbor) => html`<button class="row" data-related=${neighbor.block.id} @click=${() => this.go(neighbor.block.id)}>
                        <span class="dir">${neighbor.direction === 'out' ? '→' : '←'}</span>
                        <span class="label">${labelOf(neighbor)}</span>
                      </button>`
                    )}
                  `
                )
          }
        </div>
      </div>
    `;
  }

  private go(ref: string): void {
    setWorkspaceFocus(ref);
    eventBus.emit('overlay:close', { id: 'related' });
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'related' });

  private readonly togglePin = () => {
    const pinned = this.hasAttribute('data-pinned');
    overlayManager.setPinned('related', !pinned);
  };
}

const RELATED_SURFACE = { id: 'related', title: 'Related', group: 'overlay' } as const;

defineSurface(RELATED_SURFACE, RelatedView);
registerOverlay({
  id: RELATED_SURFACE.id,
  title: RELATED_SURFACE.title,
  tag: surfaceTag(RELATED_SURFACE),
});

declare global {
  interface HTMLElementTagNameMap {
    's-related': RelatedView;
  }
}
