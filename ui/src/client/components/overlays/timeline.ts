/**
 * The timeline overlay (§4.4). The present-anchored scrubber is session chrome,
 * not a standing panel: it lives in an overlay the HUD, palette or an agent can
 * summon. It reuses the same `timeline-scrubber` element that writes
 * `$view.timeline.t`, so the modulation/gate filters that already read that
 * value are unchanged — only the chrome moved.
 */

import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import '../timeline-scrubber.js';

@customElement('s-timeline')
export class TimelineView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); width: min(680px, 94vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    timeline-scrubber { border-top: none; }
  `;

  protected override renderBody() {
    return html`
      <div class="panel" role="dialog" aria-label="Timeline">
        <header>
          <span class="title">Timeline</span>
          <button class="close" title="Close" aria-label="Close timeline" @click=${this.close}>&times;</button>
        </header>
        <timeline-scrubber></timeline-scrubber>
      </div>
    `;
  }

  private readonly close = () => eventBus.emit('overlay:close', { id: 'timeline' });
}

const TIMELINE_SURFACE = { id: 'timeline', title: 'Timeline', group: 'overlay' } as const;

defineSurface(TIMELINE_SURFACE, TimelineView);
registerOverlay({
  id: TIMELINE_SURFACE.id,
  title: TIMELINE_SURFACE.title,
  tag: surfaceTag(TIMELINE_SURFACE),
});

declare global {
  interface HTMLElementTagNameMap {
    's-timeline': TimelineView;
  }
}
