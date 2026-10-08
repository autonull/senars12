/**
 * The artifact viewer (§4.3, Phase 0.5/4.3). A block's typed artifact — a table
 * or code payload, or an image — opened at full budget through the same
 * `<s-view>` host the notebook embeds, so the artifact has one rendering path in
 * both places and gains the shape switcher for free. Requires a `Ref`, so it is
 * kept out of the command palette.
 */

import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { artifactViewSpec } from '../../core/artifacts.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $workspaceGraph } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import type { SemanticBlock } from '../../core/workspace-graph.js';

const imageOf = (block: SemanticBlock): { alt: string; src: string } | undefined => {
  if (block.kind !== 'image') return undefined;
  const data = block.data as { alt?: string; src?: string } | undefined;
  return data?.src ? { alt: data.alt ?? '', src: data.src } : undefined;
};

@customElement('s-artifact')
export class ArtifactView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 8vh; left: 50%; transform: translateX(-50%); width: min(760px, 94vw); max-height: 80vh; z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 80vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .kind { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    .body { overflow: auto; padding: var(--spacing-scale-2); }
    .image { max-width: 100%; }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
  `;

  @property({ type: String }) ref = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
  }

  protected override renderBody() {
    const block = $workspaceGraph.get().blocks.get(this.ref);
    if (!block) return html`<div class="panel"><p class="empty">Block not found</p></div>`;
    const image = imageOf(block);
    const spec = image ? undefined : artifactViewSpec(block);
    return html`
      <div class="panel" role="dialog" aria-label="Artifact">
        <header>
          <span class="kind">${block.kind}</span>
          <span class="title">${block.title ?? block.id}</span>
          <button class="close" title="Close" aria-label="Close artifact" @click=${this.close}>&times;</button>
        </header>
        <div class="body">
          ${image
            ? html`<img class="image" src=${image.src} alt=${image.alt} />`
            : spec
              ? html`<s-view .spec=${spec} .chrome=${true} .budget=${'full'}></s-view>`
              : html`<p class="empty">No artifact for this block</p>`}
        </div>
      </div>
    `;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'artifact' });
}

const ARTIFACT_SURFACE = { id: 'artifact', title: 'Artifact', group: 'overlay' } as const;

defineSurface(ARTIFACT_SURFACE, ArtifactView);
registerOverlay({
  id: ARTIFACT_SURFACE.id,
  title: ARTIFACT_SURFACE.title,
  tag: surfaceTag(ARTIFACT_SURFACE),
  hiddenInPalette: true,
});

declare global {
  interface HTMLElementTagNameMap {
    's-artifact': ArtifactView;
  }
}
