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
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { $workspaceGraph } from '../../core/store.js';
import type { BlockKind, Ref, SemanticBlock, SemanticLink, WorkspaceOp } from '../../core/workspace-graph.js';
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

/** Presentation label per block kind — exhaustive, so a new kind must name itself here. */
export const BLOCK_KIND_LABEL = {
  turn: 'Turn',
  section: 'Section',
  heading: 'Heading',
  paragraph: 'Paragraph',
  claim: 'Claim',
  question: 'Question',
  answer: 'Answer',
  list: 'List',
  table: 'Table',
  code: 'Code',
  math: 'Math',
  image: 'Image',
  diagram: 'Diagram',
  chart: 'Chart',
  citation: 'Citation',
  'tool-call': 'Tool call',
  'tool-result': 'Tool result',
  derivation: 'Derivation',
  'gate-decision': 'Gate decision',
  budget: 'Budget',
  'config-change': 'Config change',
  error: 'Error',
  'embedded-view': 'Embedded view',
  raw: 'Raw',
} satisfies Record<BlockKind, string>;

const isSection = (block: SemanticBlock): boolean =>
  block.kind === 'turn' || block.kind === 'section';

function uncertaintyChip(block: SemanticBlock): TemplateResult {
  const { uncertainty } = block;
  if (!uncertainty) return html``;
  return html`<span class="chip" title=${uncertainty.vocabulary ?? 'uncertainty'}>
    f${uncertainty.frequency.toFixed(2)} c${uncertainty.confidence.toFixed(2)}
  </span>`;
}

function renderBlock(block: SemanticBlock): TemplateResult {
  if (block.kind === 'heading') {
    const level = Math.min(Math.max(block.level ?? 2, 1), 6);
    return html`<h${level} class="heading">${block.text ?? block.title}</h${level}>`;
  }
  return html`
    <article class="block" data-kind=${block.kind} data-role=${block.role} data-status=${block.status ?? 'complete'}>
      <header class="block-head">
        <span class="kind">${BLOCK_KIND_LABEL[block.kind]}</span>
        ${block.title && !isSection(block) ? html`<span class="title">${block.title}</span>` : ''}
        ${uncertaintyChip(block)}
      </header>
      ${block.text ? html`<div class="text">${block.text}</div>` : ''}
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
    .chip { margin-left: auto; padding: 0 var(--spacing-scale-1); border-radius: 4px; background: var(--colors-semantic-bg-overlay); color: var(--colors-semantic-text-secondary); font-family: var(--typography-fontFamilies-data); }
    .text { color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-base); line-height: var(--typography-lineHeights-relaxed); white-space: pre-wrap; word-break: break-word; }
    .heading { margin: 0; color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); }
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

  protected override renderBody() {
    const pages = rootBlocks($workspaceGraph.get());
    return html`
      <div class="pages">
        ${pages.map(
          (block) => html`
            <section class="page" data-id=${block.id}>${renderBlock(block)}</section>
          `
        )}
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
