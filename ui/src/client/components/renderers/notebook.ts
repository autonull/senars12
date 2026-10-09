/**
 * The Notebook renderer (§4, Phase 1.1) — the first workspace renderer and the
 * standalone semantic-LM wedge. It renders the **section model** (`sections.ts`)
 * as vertically sequenced pages and nested sections, giving each known block kind
 * its own affordance and degrading unknown kinds to text; containment nests to
 * any depth and folding a section hides its subtree. It registers with both
 * contracts: `defineSurface` (so it gets the reflective test API, story, gallery
 * cell and lifecycle slots) and `registerRenderer` (so the mode switcher and the
 * shell can admit it). Nothing here is graph-specific: with only `language`
 * enabled it is a complete conversation surface.
 */

import type { TemplateResult } from 'lit';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BLOCK_KIND_LABEL } from '../../core/block-labels.js';
import { collectSources } from '../../core/citations.js';
import { eventBus } from '../../core/events.js';
import { breadcrumb } from '../../core/navigation.js';
import { admittedRoots, isAdmitted, type SectionNode, sectionTree } from '../../core/sections.js';
import {
  $collapsedBlocks,
  $workspaceGraph,
  setWorkspaceFocus,
  setWorkspaceSelection,
  toggleCollapsed,
} from '../../core/store.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import type { Ref, SemanticBlock, SemanticLink, WorkspaceOp } from '../../core/workspace-graph.js';
import {
  type RendererSnapshot,
  registerRenderer,
  WORKSPACE_INTERACTIONS,
  type WorkspaceContext,
  type WorkspaceRenderer,
  type WorkspaceRendererCaps,
} from '../../core/workspace-renderer.js';
import { blockBodyStyles, renderBlockBody } from '../../utils/render-block.js';
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

interface FoldControl {
  folded: boolean;
  toggle: () => void;
}

interface RenderOptions {
  /** The bibliography inline `[n]` references and citation entries resolve against. */
  sources: Parameters<typeof renderBlockBody>[1];
  focused?: boolean;
  fold?: FoldControl;
  /** Containment depth — 0 at a page root. */
  depth?: number;
  /** False while the present-anchored cursor is before the block (§4.4). */
  admitted?: boolean;
}

function renderBlock(
  block: SemanticBlock,
  { sources, focused, fold, depth, admitted = true }: RenderOptions
): TemplateResult {
  return html`
    <article
      class="block"
      data-id=${block.id}
      data-kind=${block.kind}
      data-depth=${depth ?? 0}
      data-admitted=${admitted}
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
          ${
            fold
              ? html`<button
                  class="fold"
                  title=${fold.folded ? 'Expand' : 'Collapse'}
                  aria-expanded=${!fold.folded}
                  @click=${(event: Event) => {
                    event.stopPropagation();
                    fold.toggle();
                  }}
                >${fold.folded ? '▸' : '▾'}</button>`
              : ''
          }
          <button class="more" title="Block actions" aria-label="Block actions" @click=${(
            event: Event
          ) => {
            event.stopPropagation();
            eventBus.emit('overlay:open', {
              id: 'block-menu',
              ref: block.id,
              anchor: event.currentTarget as HTMLElement,
            });
          }}>⋯</button>
        </span>
      </header>
      ${renderBlockBody(block, sources)}
    </article>
  `;
}

@customElement('s-notebook')
export class NotebookView extends SurfaceComponent {
  static override styles = [
    blockBodyStyles,
    css`
    :host { display: block; overflow: auto; padding: var(--spacing-scale-4); }
    .pages { display: flex; flex-direction: column; gap: var(--spacing-scale-4); max-width: 72ch; margin: 0 auto; }
    .page { display: flex; flex-direction: column; gap: var(--spacing-scale-2); }
    .page:not(:first-child) { border-top: 1px solid var(--colors-semantic-border-subtle); padding-top: var(--spacing-scale-4); }
    .node { display: flex; flex-direction: column; gap: var(--spacing-scale-2); margin-left: var(--spacing-scale-4); padding-left: var(--spacing-scale-3); border-left: 1px solid var(--colors-semantic-border-subtle); }
    .block { display: flex; flex-direction: column; gap: var(--spacing-scale-1); padding: var(--spacing-scale-3); border-radius: 6px; background: var(--colors-semantic-bg-subtle); }
    .block[data-role='user'] { border-left: 3px solid var(--colors-semantic-accent-cyan); }
    .block[data-role='assistant'] { border-left: 3px solid var(--colors-semantic-accent-violet); }
    .block[data-status='streaming'] { opacity: 0.85; }
    .block[data-admitted='false'] { opacity: 0.35; }
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
    .fold { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-xs); line-height: 1; padding: 0 var(--spacing-scale-1); }
    .fold:hover { color: var(--colors-semantic-text-primary); }
    [data-folded='true'] { background: var(--colors-semantic-bg-subtle); border-radius: 6px; }
    .block[data-focused='true'] { outline: 1px solid var(--colors-semantic-accent-cyan); }
    .chip { padding: 0 var(--spacing-scale-1); border-radius: 4px; background: var(--colors-semantic-bg-overlay); color: var(--colors-semantic-text-secondary); font-family: var(--typography-fontFamilies-data); }
    `,
  ];

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

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($collapsedBlocks);
  }

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
    const tree = sectionTree(graph, $collapsedBlocks.get());
    const sources = collectSources(graph);
    const crumbs = breadcrumb(graph, graph.focus);
    const cursor = graph.timeCursor;
    const render = (node: SectionNode): TemplateResult => {
      const fold =
        node.children.length > 0
          ? { folded: node.folded, toggle: () => toggleCollapsed(node.ref) }
          : undefined;
      // A container renders as its own header; its body is the subtree below.
      const header = node.children.length > 0 ? { ...node.block, text: undefined } : node.block;
      return html`
        <section
          class=${node.depth === 0 ? 'page' : 'node'}
          data-id=${node.ref}
          data-depth=${node.depth}
          data-folded=${node.folded}
        >
          ${renderBlock(header, {
            sources,
            focused: graph.focus === node.ref,
            fold,
            depth: node.depth,
            admitted: isAdmitted(node.block, cursor),
          })}
          ${node.folded ? '' : node.children.map(render)}
        </section>
      `;
    };
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
      <div class="pages">${admittedRoots(tree, cursor).map(render)}</div>
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
    setWorkspaceFocus(ref);
  }

  select(refs: readonly Ref[]): void {
    setWorkspaceSelection(refs);
  }

  openComposer(anchor?: Ref): void {
    eventBus.emit('composer:focus', { refs: anchor ? [anchor] : undefined });
  }

  openExplain(ref: Ref): void {
    this.#ctx?.openOverlay('explain', ref);
  }

  snapshot(): RendererSnapshot {
    const { focus, selection } = $workspaceGraph.get();
    return { renderer: this.id, focus, selection: [...selection] };
  }

  restore(snap: RendererSnapshot): void {
    setWorkspaceFocus(snap.focus);
    setWorkspaceSelection(snap.selection);
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
