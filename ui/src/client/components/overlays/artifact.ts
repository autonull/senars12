/**
 * The artifact viewer (§4.3, Phase 0.5/4.3). A block's typed artifact — a table
 * or code payload, or an image — opened at full budget through the same
 * `<s-view>` host the notebook embeds, so the artifact has one rendering path in
 * both places and gains the shape switcher for free. Requires a `Ref`, so it is
 * kept out of the command palette.
 */

import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Announcer } from '../../core/announcer.js';
import { artifactViewSpec } from '../../core/artifacts.js';
import { payloadOf } from '../../core/block-payload.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $activeRenderer, $workspaceGraph, setWorkspaceFocus } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { overlayManager } from '../../core/overlay-manager.js';
import { projectDataset } from '../../core/view-projection.js';
import type { SemanticBlock } from '../../core/workspace-graph.js';

const imageOf = (block: SemanticBlock): { alt: string; src: string } | undefined =>
  payloadOf(block.data, 'image');

@customElement('s-artifact')
export class ArtifactView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 8vh; left: 50%; transform: translateX(-50%); width: min(760px, 94vw); max-height: 80vh; z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 80vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .kind { text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-primary); }
    .action { border: 1px solid var(--colors-semantic-border-subtle); border-radius: 4px; padding: 2px var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); }
    .action:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
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
    const { image, spec } = this.resolve(block);
    return html`
      <div class="panel" role="dialog" aria-label="Artifact">
        <header>
          <span class="kind">${block.kind}</span>
          <span class="title">${block.title ?? block.id}</span>
          <button class="action" data-action="copy" title="Copy" aria-label="Copy artifact" @click=${this.copy}>Copy</button>
          <button class="action" data-action="graph" title="Open in graph" aria-label="Open in graph" @click=${this.openInGraph}>Graph</button>
          <button class="pin-btn" aria-label="Pin artifact" aria-pressed=${this.hasAttribute('data-pinned')} @click=${this.togglePin}>📌</button>
          <button class="close" title="Close" aria-label="Close artifact" @click=${this.close}>&times;</button>
        </header>
        <div class="body">
          ${
            image
              ? html`<img class="image" src=${image.src} alt=${image.alt} />`
              : spec
                ? html`<s-view .spec=${spec} .chrome=${true} .budget=${'full'}></s-view>`
                : html`<p class="empty">No artifact for this block</p>`
          }
        </div>
      </div>
    `;
  }

  private resolve(block: SemanticBlock) {
    const image = imageOf(block);
    return { image, spec: image ? undefined : artifactViewSpec(block) };
  }

  /** The clipboard text for the artifact: image source, its text projection, or the block text. */
  private textOf(block: SemanticBlock): string {
    const { image, spec } = this.resolve(block);
    if (image) return image.src;
    const projected = spec ? projectDataset(spec.source.get(), 'text') : undefined;
    return projected?.kind === 'text' ? projected.lines.join('\n') : (block.text ?? '');
  }

  private readonly copy = () => {
    const block = $workspaceGraph.get().blocks.get(this.ref);
    if (!block) return;
    void navigator.clipboard?.writeText(this.textOf(block));
    Announcer.getInstance().announce('Copied artifact');
  };

  private readonly openInGraph = () => {
    $activeRenderer.set('graph');
    setWorkspaceFocus(this.ref);
    eventBus.emit('overlay:close', { id: 'artifact' });
  };

  private readonly close = () => eventBus.emit('overlay:close', { id: 'artifact' });

  private readonly togglePin = () => {
    const pinned = this.hasAttribute('data-pinned');
    overlayManager.setPinned('artifact', !pinned);
  };
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
