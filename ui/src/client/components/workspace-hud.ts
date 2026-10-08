/**
 * The floating workspace HUD (§1, Phase 0.4) — the only always-present chrome,
 * and deliberately thin. It switches the active `WorkspaceRenderer` (the same
 * registry the shell mounts) and shows the provider/backend chip. Controls are
 * added only when they do real work: the mode switch changes renderer state and
 * the chip reflects `lm.status`. ⌘K palette and stop/cancel join once those
 * features exist rather than shipping as silent no-ops.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $activeRenderer, $lmStatus } from '../core/store.js';
import { workspaceRenderers } from '../core/workspace-renderer.js';

@customElement('workspace-hud')
export class WorkspaceHud extends BaseComponent {
  static override styles = css`
    :host { position: absolute; bottom: var(--spacing-scale-4); left: 50%; transform: translateX(-50%); z-index: var(--zIndex-layers-panel); }
    .hud {
      display: flex; align-items: center; gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-1) var(--spacing-scale-2);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 999px;
      background: var(--colors-semantic-bg-overlay);
      backdrop-filter: blur(8px);
      box-shadow: var(--shadows-md, 0 2px 12px rgb(0 0 0 / 0.3));
    }
    .modes { display: flex; gap: 2px; }
    button {
      border: none; border-radius: 999px; cursor: pointer;
      padding: var(--spacing-scale-1) var(--spacing-scale-3);
      background: transparent; color: var(--colors-semantic-text-secondary);
      font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs);
    }
    button:hover { background: var(--colors-semantic-bg-subtle); color: var(--colors-semantic-text-primary); }
    button[aria-pressed='true'] { background: var(--colors-semantic-accent-cyan); color: var(--colors-semantic-bg-base); }
    .chip {
      padding: 0 var(--spacing-scale-2);
      color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      border-left: 1px solid var(--colors-semantic-border-subtle);
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeRenderer);
    this.watch($lmStatus);
  }

  override render() {
    const active = $activeRenderer.get();
    const provider = $lmStatus.get().provider;
    return html`
      <div class="hud" role="toolbar" aria-label="Workspace">
        <div class="modes">
          ${workspaceRenderers().map(
            (renderer) => html`
              <button
                data-renderer=${renderer.id}
                aria-pressed=${renderer.id === active}
                @click=${() => $activeRenderer.set(renderer.id)}
              >${renderer.label}</button>
            `
          )}
        </div>
        ${typeof provider === 'string' ? html`<span class="chip" title="Language model provider">${provider}</span>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workspace-hud': WorkspaceHud;
  }
}
