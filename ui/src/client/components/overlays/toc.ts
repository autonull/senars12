/**
 * The semantic table-of-contents overlay (§4.3, Phase 1.5). It is the ToC
 * projection (`tocEntries`) with search and kind filters, opened through the one
 * overlay host. Selecting an entry sets the workspace focus (session state) and
 * closes the overlay, so the ToC navigates the substrate instead of owning a
 * second copy of it.
 */

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL } from '../../core/block-labels.js';
import { eventBus } from '../../core/events.js';
import { $workspaceGraph, setWorkspaceFocus } from '../../core/store.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import type { BlockKind } from '../../core/workspace-graph.js';
import { TOC_KINDS_TYPE, tocEntries, type TocEntry } from '../../core/toc.js';

type Filter = 'all' | BlockKind;

@customElement('s-toc')
export class TocView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 0; right: 0; height: 100vh; width: min(380px, 92vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; height: 100%; background: var(--colors-semantic-bg-panel-solid); border-left: 1px solid var(--colors-semantic-border-subtle); box-shadow: var(--shadows-panel); }
    header { display: flex; flex-direction: column; gap: var(--spacing-scale-2); padding: var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .bar { display: flex; align-items: center; gap: var(--spacing-scale-2); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    input { width: 100%; box-sizing: border-box; padding: var(--spacing-scale-1) var(--spacing-scale-2); border: 1px solid var(--colors-semantic-border-subtle); border-radius: 4px; background: var(--colors-semantic-bg-base); color: var(--colors-semantic-text-primary); font-size: var(--typography-scale-sm); }
    .filters { display: flex; flex-wrap: wrap; gap: var(--spacing-scale-1); }
    .filters button { border: 1px solid var(--colors-semantic-border-subtle); border-radius: 999px; padding: 2px var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-size: var(--typography-scale-xs); }
    .filters button[aria-pressed='true'] { background: var(--colors-semantic-accent-cyan); color: var(--colors-semantic-bg-base); border-color: transparent; }
    ul { list-style: none; margin: 0; padding: var(--spacing-scale-2); overflow: auto; display: flex; flex-direction: column; gap: 2px; }
    .entry { display: flex; align-items: baseline; gap: var(--spacing-scale-2); width: 100%; text-align: left; border: none; border-radius: 4px; padding: var(--spacing-scale-1) var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; }
    .entry:hover { background: var(--colors-semantic-bg-subtle); }
    .entry[aria-current='true'] { background: var(--colors-semantic-bg-subtle); outline: 1px solid var(--colors-semantic-accent-cyan); }
    .entry .kind { flex-shrink: 0; width: 6.5rem; text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .entry .label { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `;

  @state() private filter: Filter = 'all';
  @state() private query = '';

  protected override renderBody() {
    const graph = $workspaceGraph.get();
    const entries = tocEntries(graph);
    const present = TOC_KINDS_TYPE.filter((kind) =>
      entries.some((entry) => entry.kind === kind)
    );
    const query = this.query.trim().toLowerCase();
    const shown = entries.filter(
      (entry) =>
        (this.filter === 'all' || entry.kind === this.filter) &&
        (query === '' || entry.label.toLowerCase().includes(query))
    );
    return html`
      <div class="panel" role="dialog" aria-label="Table of contents">
        <header>
          <div class="bar">
            <span class="title">Contents</span>
            <button class="close" title="Close" aria-label="Close contents" @click=${this.close}>&times;</button>
          </div>
          <label class="sr-only" for="toc-search">Search contents</label>
          <input id="toc-search" type="search" placeholder="Search contents…" .value=${this.query} @input=${this.onQuery} />
          <div class="filters" role="group" aria-label="Filter by kind">
            ${this.chip('all', 'All')}
            ${present.map((kind) => this.chip(kind, BLOCK_KIND_LABEL[kind]))}
          </div>
        </header>
        ${
          shown.length > 0
            ? html`<ul>${shown.map((entry) => this.row(entry, graph.focus === entry.ref))}</ul>`
            : html`<p class="empty">No matching blocks</p>`
        }
      </div>
    `;
  }

  private chip(kind: Filter, label: string) {
    return html`<button
      data-filter=${kind}
      aria-pressed=${this.filter === kind}
      @click=${() => (this.filter = kind)}
    >${label}</button>`;
  }

  private row(entry: TocEntry, current: boolean) {
    return html`
      <li>
        <button
          class="entry"
          data-ref=${entry.ref}
          data-kind=${entry.kind}
          aria-current=${current}
          @click=${() => this.navigate(entry.ref)}
        >
          <span class="kind">${BLOCK_KIND_LABEL[entry.kind]}</span>
          <span class="label">${entry.label}</span>
        </button>
      </li>
    `;
  }

  private onQuery(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
  }

  private navigate(ref: string) {
    setWorkspaceFocus(ref);
    eventBus.emit('overlay:close', { id: 'toc' });
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'toc' });
}

const TOC_SURFACE = { id: 'toc', title: 'Table of contents', group: 'overlay' } as const;

defineSurface(TOC_SURFACE, TocView);
registerOverlay({ id: TOC_SURFACE.id, title: TOC_SURFACE.title, tag: surfaceTag(TOC_SURFACE) });

declare global {
  interface HTMLElementTagNameMap {
    's-toc': TocView;
  }
}
