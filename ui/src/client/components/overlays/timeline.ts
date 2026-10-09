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
import { overlayManager } from '../../core/overlay-manager.js';
import '../timeline-scrubber.js';
import '../overlays/overlay-header.js';

@customElement('s-timeline')
export class TimelineView extends SurfaceComponent {
  static override styles = css`
    :host { display: block; }
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
        <overlay-header
          overlay-id="timeline"
          kind="Timeline"
          title="Timeline"
          .draggable=${true}
          .resizable=${true}
          .minimizable=${true}
          .maximizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <timeline-scrubber></timeline-scrubber>
      </div>
    `;
  }

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  private readonly close = () => eventBus.emit('overlay:close', { id: 'timeline' });
}

const TIMELINE_SURFACE = { id: 'timeline', title: 'Timeline', group: 'overlay' } as const;

defineSurface(TIMELINE_SURFACE, TimelineView);
registerOverlay({
  id: TIMELINE_SURFACE.id,
  title: TIMELINE_SURFACE.title,
  tag: surfaceTag(TIMELINE_SURFACE),
  window: { draggable: true, resizable: true, minimize: true, persist: true },
});

declare global {
  interface HTMLElementTagNameMap {
    's-timeline': TimelineView;
  }
}
