/**
 * The semantic table-of-contents overlay (§4.3, Phase 1.5). It is the ToC
 * projection (`tocEntries`) with search and kind filters, opened through the one
 * overlay host. Selecting an entry sets the workspace focus (session state) and
 * closes the overlay, so the ToC navigates the substrate instead of owning a
 * second copy of it. Rows carry the section model's `depth`, and the folded-count
 * badge dispatches the same `view.fold-all` the palette offers. Each row also
 * reaches sideways: **Open related** opens the neighborhood traversal, and ⌥-click
 * explains the block instead of navigating to it.
 */

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { artifactViewSpec } from '../../core/artifacts.js';
import { BLOCK_KIND_LABEL } from '../../core/block-labels.js';
import { dispatchCommand } from '../../core/commands.js';
import { eventBus } from '../../core/events.js';
import { $collapsedBlocks, $workspaceGraph, setWorkspaceFocus } from '../../core/store.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
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
    .row { display: flex; align-items: stretch; gap: 2px; }
    .entry { display: flex; flex: 1; min-width: 0; align-items: baseline; gap: var(--spacing-scale-2); text-align: left; border: none; border-radius: 4px; padding: var(--spacing-scale-1) var(--spacing-scale-2) var(--spacing-scale-1) calc(var(--spacing-scale-2) + var(--depth, 0) * var(--spacing-scale-3)); background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; }
    .folds { border: 1px solid var(--colors-semantic-border-subtle); border-radius: 999px; padding: 2px var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-xs); }
    .folds:hover { color: var(--colors-semantic-text-primary); }
    .entry:hover { background: var(--colors-semantic-bg-subtle); }
    .entry[aria-current='true'] { background: var(--colors-semantic-bg-subtle); outline: 1px solid var(--colors-semantic-accent-cyan); }
    .entry .kind { flex-shrink: 0; width: 6.5rem; text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .entry .label { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .artifact { flex-shrink: 0; border: none; border-radius: 4px; padding: 0 var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-sm); }
    .artifact:hover, .related:hover { background: var(--colors-semantic-bg-subtle); color: var(--colors-semantic-accent-primary); }
    .related { flex-shrink: 0; border: none; border-radius: 4px; padding: 0 var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-sm); }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `;

  @state() private filter: Filter = 'all';
  @state() private query = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($collapsedBlocks);
  }

  protected override renderBody() {
    const graph = $workspaceGraph.get();
    const folded = $collapsedBlocks.get();
    const entries = tocEntries(graph, folded);
    const present = TOC_KINDS_TYPE.filter((kind) => entries.some((entry) => entry.kind === kind));
    const query = this.query.trim().toLowerCase();
    const shown = entries.filter(
      (entry) =>
        (this.filter === 'all' || entry.kind === this.filter) &&
        (query === '' || entry.label.toLowerCase().includes(query))
    );
    const hasArtifact = (ref: string): boolean => {
      const block = graph.blocks.get(ref);
      return block ? block.kind === 'image' || artifactViewSpec(block) !== undefined : false;
    };
    return html`
      <div class="panel" role="dialog" aria-label="Table of contents">
        <overlay-header
          overlay-id="toc"
          title="Contents"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div class="bar" style="display:flex;align-items:center;gap:var(--spacing-scale-2);padding:var(--spacing-scale-2) var(--spacing-scale-3);border-bottom:1px solid var(--colors-semantic-border-subtle);">
          ${
            folded.size > 0
              ? html`<button
                  class="folds"
                  title="Fold/unfold all sections"
                  @click=${() => dispatchCommand('view.fold-all')}
                >${folded.size} folded</button>`
              : ''
          }
        </div>
        <label class="sr-only" for="toc-search">Search contents</label>
        <input id="toc-search" type="search" placeholder="Search contents…" .value=${this.query} @input=${this.onQuery} />
        <div class="filters" role="group" aria-label="Filter by kind">
          ${this.chip('all', 'All')}
          ${present.map((kind) => this.chip(kind, BLOCK_KIND_LABEL[kind]))}
        </div>
        ${
          shown.length > 0
            ? html`<ul>${shown.map((entry) => this.row(entry, graph.focus === entry.ref, hasArtifact(entry.ref)))}</ul>`
            : html`<p class="empty">No matching blocks</p>`
        }
      </div>
    `;
  }

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  private chip(kind: Filter, label: string) {
    return html`<button
      data-filter=${kind}
      aria-pressed=${this.filter === kind}
      @click=${() => (this.filter = kind)}
    >${label}</button>`;
  }

  private row(entry: TocEntry, current: boolean, hasArtifact: boolean) {
    return html`
      <li class="row">
        <button
          class="entry"
          data-ref=${entry.ref}
          data-kind=${entry.kind}
          data-depth=${entry.depth}
          style=${`--depth: ${entry.depth}`}
          aria-current=${current}
          title="Click to focus · ⌥-click to explain"
          @click=${(event: MouseEvent) =>
            event.altKey ? this.explain(entry.ref) : this.navigate(entry.ref)}
        >
          <span class="kind">${BLOCK_KIND_LABEL[entry.kind]}</span>
          <span class="label">${entry.label}</span>
        </button>
        <button
          class="related"
          data-related=${entry.ref}
          title="Open related"
          aria-label="Open related"
          @click=${() => this.openRelated(entry.ref)}
        >
          ⋯
        </button>
        ${
          hasArtifact
            ? html`<button
                class="artifact"
                data-artifact=${entry.ref}
                title="Open artifact"
                aria-label="Open artifact"
                @click=${() => this.openArtifact(entry.ref)}
              >▦</button>`
            : ''
        }
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

  private openArtifact(ref: string) {
    eventBus.emit('overlay:open', { id: 'artifact', ref });
  }

  private openRelated(ref: string) {
    eventBus.emit('overlay:open', { id: 'related', ref });
  }

  private explain(ref: string) {
    eventBus.emit('overlay:open', { id: 'explain', ref });
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
