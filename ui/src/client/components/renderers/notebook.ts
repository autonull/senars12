/**
 * The Notebook renderer (§4, Phase 1.1) — the first workspace renderer and the
 * standalone semantic-LM wedge. It renders the top-level blocks of the
 * WorkspaceGraph as vertically sequenced pages/sections, giving each known block
 * kind its own affordance and degrading unknown kinds to text. It registers with
 * both contracts: `defineSurface` (so it gets the reflective test API, story,
 * gallery cell and lifecycle slots) and `registerRenderer` (so the mode switcher
 * and the shell can admit it). Nothing here is graph-specific: with only
 * `language` enabled it is a complete conversation surface.
 */

import type { TemplateResult } from 'lit';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL } from '../../core/block-labels.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { breadcrumb } from '../../core/navigation.js';
import type { TableData } from '../../core/segmentation.js';
import { eventBus } from '../../core/events.js';
import { $workspaceGraph, setWorkspaceFocus } from '../../core/store.js';
import type { Ref, SemanticBlock, SemanticLink, WorkspaceOp } from '../../core/workspace-graph.js';
import { rootBlocks } from '../../core/workspace-graph.js';
import {
  registerRenderer,
  WORKSPACE_INTERACTIONS,
  type RendererSnapshot,
  type WorkspaceContext,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../core/workspace-renderer.js';
import '../primitives/empty-state.js';

const isSection = (block: SemanticBlock): boolean =>
  block.kind === 'turn' || block.kind === 'section';

function uncertaintyChip(block: SemanticBlock): TemplateResult {
  const { uncertainty } = block;
  if (!uncertainty) return html``;
  return html`<span class="chip" title=${uncertainty.vocabulary ?? 'uncertainty'}>
    f${uncertainty.frequency.toFixed(2)} c${uncertainty.confidence.toFixed(2)}
  </span>`;
}

function renderTable(data: TableData): TemplateResult {
  return html`
    <table class="data">
      <thead><tr>${data.headers.map((cell) => html`<th>${cell}</th>`)}</tr></thead>
      <tbody>
        ${data.rows.map(
          (row) => html`<tr>${row.map((cell) => html`<td>${cell}</td>`)}</tr>`
        )}
      </tbody>
    </table>
  `;
}

function renderHeading(block: SemanticBlock): TemplateResult {
  const content = block.text ?? block.title;
  switch (Math.min(Math.max(block.level ?? 2, 1), 6)) {
    case 1:
      return html`<h1 class="heading">${content}</h1>`;
    case 2:
      return html`<h2 class="heading">${content}</h2>`;
    case 3:
      return html`<h3 class="heading">${content}</h3>`;
    case 4:
      return html`<h4 class="heading">${content}</h4>`;
    case 5:
      return html`<h5 class="heading">${content}</h5>`;
    default:
      return html`<h6 class="heading">${content}</h6>`;
  }
}

function renderBlock(block: SemanticBlock, focused = false): TemplateResult {
  const body = (() => {
    if (block.kind === 'heading') return renderHeading(block);
    if (block.kind === 'image' && block.data) {
      const { alt, src } = block.data as { alt: string; src: string };
      return html`<img class="image" src=${src} alt=${alt} loading="lazy" />`;
    }
    if (block.kind === 'citation' && block.data) {
      const { label, key, href } = block.data as { label?: string; key?: string; href: string };
      return html`<a class="citation" href=${href} target="_blank" rel="noreferrer"
        >${label ?? key ?? href}</a
      >`;
    }
    if (block.kind === 'code')
      return html`<pre class="code"><code>${block.text}</code></pre>`;
    if (block.kind === 'table' && block.data)
      return renderTable(block.data as TableData);
    if (block.kind === 'list' && block.data) {
      const items = (block.data as { items: string[] }).items;
      return html`<ul class="list">${items.map((item) => html`<li>${item}</li>`)}</ul>`;
    }
    return block.text ? html`<div class="text">${block.text}</div>` : html``;
  })();

  return html`
    <article
      class="block"
      data-id=${block.id}
      data-kind=${block.kind}
      data-role=${block.role}
      data-status=${block.status ?? 'complete'}
      data-focused=${focused}
      aria-current=${focused}
      @click=${() => setWorkspaceFocus(block.id)}
    >
      <header class="block-head">
        <span class="kind">${BLOCK_KIND_LABEL[block.kind]}</span>
        ${block.title && !isSection(block) && block.title !== BLOCK_KIND_LABEL[block.kind] ? html`<span class="title">${block.title}</span>` : ''}
        <span class="meta">
          ${uncertaintyChip(block)}
          <button class="more" title="Block actions" aria-label="Block actions" @click=${(event: Event) => {
            event.stopPropagation();
            eventBus.emit('overlay:open', { id: 'block-menu', ref: block.id, anchor: event.currentTarget as HTMLElement });
          }}>⋯</button>
        </span>
      </header>
      ${body}
    </article>
  `;
}

@customElement('s-notebook')
export class NotebookView extends SurfaceComponent {
  static override styles = css`
    :host { display: block; overflow: auto; padding: var(--spacing-scale-4); }
    .pages { display: flex; flex-direction: column; gap: var(--spacing-scale-4); max-width: 72ch; margin: 0 auto; }
    .page { display: flex; flex-direction: column; gap: var(--spacing-scale-2); }
    .page:not(:first-child) { border-top: 1px solid var(--colors-semantic-border-subtle); padding-top: var(--spacing-scale-4); }
    .block { display: flex; flex-direction: column; gap: var(--spacing-scale-1); padding: var(--spacing-scale-3); border-radius: 6px; background: var(--colors-semantic-bg-subtle); }
    .block[data-role='user'] { border-left: 3px solid var(--colors-semantic-accent-cyan); }
    .block[data-role='assistant'] { border-left: 3px solid var(--colors-semantic-accent-violet); }
    .block[data-status='streaming'] { opacity: 0.85; }
    .block-head { display: flex; align-items: center; gap: var(--spacing-scale-2); font-size: var(--typography-scale-xs); }
    .kind { text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    .title { color: var(--colors-semantic-text-secondary); font-weight: var(--typography-fontWeights-medium); }
    .meta { display: flex; align-items: center; gap: var(--spacing-scale-2); margin-left: auto; }
    .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-scale-1); max-width: 72ch; margin: 0 auto var(--spacing-scale-3); font-size: var(--typography-scale-xs); }
    .breadcrumb .crumb { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; padding: 0; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); }
    .breadcrumb .crumb:hover { color: var(--colors-semantic-text-primary); }
    .breadcrumb .crumb[aria-current='true'] { color: var(--colors-semantic-text-secondary); }
    .breadcrumb .sep { color: var(--colors-semantic-text-muted); }
    .more { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); line-height: 1; padding: 0 var(--spacing-scale-1); }
    .more:hover { color: var(--colors-semantic-text-primary); }
    .block[data-focused='true'] { outline: 1px solid var(--colors-semantic-accent-cyan); }
    .chip { padding: 0 var(--spacing-scale-1); border-radius: 4px; background: var(--colors-semantic-bg-overlay); color: var(--colors-semantic-text-secondary); font-family: var(--typography-fontFamilies-data); }
    .text { color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-base); line-height: var(--typography-lineHeights-relaxed); white-space: pre-wrap; word-break: break-word; }
    .heading { margin: 0; color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); }
    .code { margin: 0; padding: var(--spacing-scale-3); border-radius: 6px; background: var(--colors-semantic-bg-base); overflow: auto; }
    .code code { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); }
    .image { max-width: 100%; border-radius: 6px; }
    .citation { color: var(--colors-semantic-accent-cyan); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-sm); text-decoration: none; }
    .citation:hover { text-decoration: underline; }
    .list { margin: 0; padding-left: var(--spacing-scale-4); color: var(--colors-semantic-text-primary); font-size: var(--typography-scale-base); line-height: var(--typography-lineHeights-relaxed); }
    table.data { border-collapse: collapse; width: 100%; font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-primary); }
    table.data th, table.data td { border: 1px solid var(--colors-semantic-border-subtle); padding: var(--spacing-scale-1) var(--spacing-scale-2); text-align: left; }
    table.data th { color: var(--colors-semantic-text-secondary); font-weight: var(--typography-fontWeights-medium); }
  `;

  protected override surfaceState() {
    return $workspaceGraph.get().roots.length > 0 ? 'ready' : 'empty';
  }

  protected override renderEmpty() {
    return html`<s-empty-state
      icon="📓"
      heading="Empty notebook"
      description="Send a message to start the semantic notebook"
      size="lg"
    ></s-empty-state>`;
  }

  #scrolledFocus?: string;

  override updated(): void {
    const focus = $workspaceGraph.get().focus;
    if (focus === undefined || focus === this.#scrolledFocus) return;
    this.#scrolledFocus = focus;
    const escaped = globalThis.CSS?.escape?.(focus) ?? focus;
    this.renderRoot
      .querySelector<HTMLElement>(`[data-id="${escaped}"]`)
      ?.scrollIntoView?.({ block: 'center' });
  }

  protected override renderBody() {
    const graph = $workspaceGraph.get();
    const pages = rootBlocks(graph);
    const crumbs = breadcrumb(graph, graph.focus);
    return html`
      ${
        crumbs.length > 0
          ? html`<nav class="breadcrumb" aria-label="Breadcrumb">
              ${crumbs.map(
                (crumb, index) => html`
                  ${index > 0 ? html`<span class="sep">›</span>` : ''}
                  <button
                    class="crumb"
                    data-ref=${crumb.ref}
                    aria-current=${index === crumbs.length - 1}
                    @click=${() => setWorkspaceFocus(crumb.ref)}
                  >${BLOCK_KIND_LABEL[crumb.kind]} · ${crumb.label}</button>
                `
              )}
            </nav>`
          : ''
      }
      <div class="pages">
        ${pages.map((block) => {
          const children = (block.children ?? [])
            .map((id) => graph.blocks.get(id))
            .filter((child): child is SemanticBlock => !!child);
          return html`
            <section class="page" data-id=${block.id}>
              ${renderBlock(children.length > 0 ? { ...block, text: undefined } : block, graph.focus === block.id)}
              ${children.map((child) => renderBlock(child, graph.focus === child.id))}
            </section>
          `;
        })}
      </div>
    `;
  }
}

defineSurface(
  { id: 'notebook', title: 'Notebook', group: 'workspace', bindings: { graph: $workspaceGraph } },
  NotebookView
);

class NotebookRenderer implements WorkspaceRenderer {
  readonly id = 'notebook';
  readonly label = 'Notebook';

  #element?: NotebookView;
  #ctx?: WorkspaceContext;
  #focus?: Ref;
  #selection = new Set<Ref>();

  capabilities(): WorkspaceRendererCaps {
    return { interactions: WORKSPACE_INTERACTIONS, blockKinds: 'all', parity: 'full' };
  }

  mount(host: HTMLElement, ctx: WorkspaceContext): void {
    this.#ctx = ctx;
    this.#element = document.createElement('s-notebook');
    host.appendChild(this.#element);
  }

  present(_blocks: readonly SemanticBlock[], _links: readonly SemanticLink[]): void {}

  apply(_ops: readonly WorkspaceOp[]): void {}

  focus(ref: Ref): void {
    this.#focus = ref;
  }

  select(refs: readonly Ref[]): void {
    this.#selection = new Set(refs);
  }

  openComposer(anchor?: Ref): void {
    this.#ctx?.openOverlay('composer', anchor ?? this.#focus);
  }

  openExplain(ref: Ref): void {
    this.#ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    return { renderer: this.id, focus: this.#focus, selection: [...this.#selection] };
  }

  restore(snap: RendererSnapshot): void {
    this.#focus = snap.focus;
    this.#selection = new Set(snap.selection);
  }

  dispose(): void {
    this.#element?.remove();
    this.#element = undefined;
    this.#ctx = undefined;
  }
}

export const notebookRenderer = new NotebookRenderer();

registerRenderer(notebookRenderer);

declare global {
  interface HTMLElementTagNameMap {
    's-notebook': NotebookView;
  }
}
