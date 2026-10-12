/**
 * The L2 Display popover — the gateway to the four view presets
 * (Ask · Explore · Read · Plan). This is the L2 rung of the disclosure
 * ladder; individual controls (lens, layout, channels) remain in L3
 * (palette) for power users.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { eventBus } from '../../core/events.js';
import { $activeLens, $activeRenderer, $lensLayout } from '../../core/store.js';

class DisplayPopoverBase extends SurfaceComponent {
  static override styles = css`
    :host {
      display: contents;
    }
    .display-popover {
      min-width: 280px;
      max-width: 360px;
    }
    .preset-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-scale-2);
    }
    .preset-btn {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-1);
      padding: var(--spacing-scale-3);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-panel);
      background: var(--colors-semantic-bg-panel-solid);
      cursor: pointer;
      text-align: left;
      transition: var(--transitions-fast);
    }
    .preset-btn:hover {
      border-color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-bg-panel-hover);
    }
    .preset-btn.active {
      border-color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-accent-primary-subtle);
    }
    .preset-label {
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-primary);
    }
    .preset-desc {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-secondary);
      line-height: 1.4;
    }
    .preset-meta {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xxxs);
      color: var(--colors-semantic-text-muted);
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-scale-1);
    }
    .preset-tag {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xxxs);
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--colors-semantic-bg-base);
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-muted);
    }
    .section-title {
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs);
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: var(--spacing-scale-2);
      padding-bottom: var(--spacing-scale-1);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
    }
    .divider {
      height: 1px;
      background: var(--colors-semantic-border-subtle);
      margin: var(--spacing-scale-2) 0;
    }
    .custom-section {
      margin-top: var(--spacing-scale-2);
    }
    .custom-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-button);
      background: transparent;
      color: var(--colors-semantic-text-secondary);
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs);
      cursor: pointer;
      transition: var(--transitions-fast);
    }
    .custom-btn:hover {
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
  `;

  @state() private activePreset: string = 'custom';

  override connectedCallback(): void {
    super.connectedCallback();
    this.activePreset = this.getActivePreset();
    this.unsubscribeLens = $activeLens.subscribe(() => (this.activePreset = this.getActivePreset()));
    this.unsubscribeRenderer = $activeRenderer.subscribe(() => (this.activePreset = this.getActivePreset()));
    this.unsubscribeLayout = $lensLayout.subscribe(() => (this.activePreset = this.getActivePreset()));
  }

  override disconnectedCallback(): void {
    this.unsubscribeLens?.();
    this.unsubscribeRenderer?.();
    this.unsubscribeLayout?.();
    super.disconnectedCallback();
  }

  private unsubscribeLens?: () => void;
  private unsubscribeRenderer?: () => void;
  private unsubscribeLayout?: () => void;

  private getActivePreset(): string {
    const renderer = $activeRenderer.get();
    const lens = $activeLens.get();
    const layout = $lensLayout.get()[lens];

    if (renderer === 'notebook' && lens === 'belief' && layout === 'conversation') return 'ask';
    if (renderer === 'graph' && lens === 'belief' && layout === 'cose') return 'explore';
    if (renderer === 'notebook' && lens === 'belief' && layout === 'conversation') return 'read';
    if (renderer === 'graph' && lens === 'goal' && layout === 'concentric') return 'plan';
    return 'custom';
  }

  private applyPreset = async (presetId: 'ask' | 'explore' | 'read' | 'plan'): Promise<void> => {
    const { getPreset, applyPreset } = await import('../../utils/view-presets.js');
    const preset = getPreset(presetId);
    applyPreset(preset);
  };

  private renderPresets(): TemplateResult {
    const presets = [
      { id: 'ask', label: 'Ask', desc: 'Chat with the LM; submit questions, get answers, steer with prose.', renderer: 'notebook', lens: 'belief', layout: 'conversation' },
      { id: 'explore', label: 'Explore', desc: 'Navigate the concept graph; zoom, filter, trace derivations.', renderer: 'graph', lens: 'belief', layout: 'cose' },
      { id: 'read', label: 'Read', desc: 'Read the notebook; folded sections, citations, embedded views.', renderer: 'notebook', lens: 'belief', layout: 'conversation' },
      { id: 'plan', label: 'Plan', desc: 'Set goals, watch gates/budget/termination, steer autonomy.', renderer: 'graph', lens: 'goal', layout: 'concentric' },
    ] as const;

    return html`
      <div class="section-title">Presets</div>
      <div class="preset-grid">
        ${presets.map(
          (p) => html`
            <button
              class="preset-btn ${this.activePreset === p.id ? 'active' : ''}"
              @click=${() => this.applyPreset(p.id as 'ask' | 'explore' | 'read' | 'plan')}
              title=${`${p.id.charAt(0).toUpperCase() + p.id.slice(1)}: ${p.desc}`}
            >
              <span class="preset-label">${p.id.charAt(0).toUpperCase() + p.id.slice(1)}</span>
              <span class="preset-desc">${p.desc}</span>
              <div class="preset-meta">
                <span class="preset-tag">${p.renderer}</span>
                <span class="preset-tag">${p.lens}</span>
                <span class="preset-tag">${p.layout}</span>
              </div>
            </button>
          `
        )}
      </div>
    `;
  }

  override renderBody(): TemplateResult {
    return html`
      <div class="display-popover">
        <div class="section-title">View Presets</div>
        ${this.renderPresets()}
        <div class="divider"></div>
        <div class="custom-section">
          <button class="custom-btn" @click=${() => eventBus.emit('overlay:open', { id: 'palette' })}>
            <s-icon name="palette" size="12"></s-icon>
            <span>Customize in Palette (⌘K)</span>
          </button>
        </div>
      </div>
    `;
  }
}

// Register the custom element safely - ignore if already defined
const tagName = 's-display-popover';
try {
  customElements.define(tagName, DisplayPopoverBase);
} catch {
  // Ignore: already defined in this jsdom environment
}

const DISPLAY_SURFACE = { id: 'display', title: 'Display', group: 'overlay', a11y: { role: 'dialog' } } as const;
defineSurface({ id: 'display', title: 'Display', group: 'overlay', a11y: { role: 'dialog' } as const }, DisplayPopoverBase);
registerOverlay({
  id: 'display',
  title: 'Display',
  tag: 's-display-popover',
  capability: 'uiControl',
  window: { draggable: true, resizable: true, minimize: true, persist: true },
});