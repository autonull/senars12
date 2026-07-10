import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Lens } from '@senars/core';
import { LENS_COLORS } from '../constants.js';
import { $activeLens, $graphNodes, BaseComponent, eventBus, send } from '../core/index.js';

export interface LensDef {
  id: Lens;
  label: string;
  description: string;
  colorToken: string;
  defaultLayout: string;
}

export const LENS_DEFS: LensDef[] = [
  {
    id: 'belief',
    label: 'Beliefs',
    description: 'What the system knows',
    colorToken: 'lens.belief',
    defaultLayout: 'cose',
  },
  {
    id: 'goal',
    label: 'Goals',
    description: 'What the system wants',
    colorToken: 'lens.goal',
    defaultLayout: 'concentric',
  },
  {
    id: 'contradiction',
    label: 'Conflicts',
    description: 'Where beliefs conflict',
    colorToken: 'lens.contradiction',
    defaultLayout: 'breadthfirst',
  },
];

@customElement('lens-controller')
export class LensController extends BaseComponent {
  static override styles = css`
    :host { display: contents; }
    .lens-group { display: flex; gap: 1px; border-radius: var(--borderRadius-component-button); overflow: visible; border: 1px solid var(--colors-semantic-border-subtle); }
    .lens-btn { padding: 2px 8px; border: none; background: transparent; color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); cursor: pointer; transition: var(--transitions-fast); position: relative; }
    .lens-btn:hover { color: var(--colors-semantic-text-primary); background: var(--colors-semantic-bg-panel); }
    .lens-btn.active { color: var(--colors-semantic-text-primary); background: var(--colors-semantic-bg-panel-hover); }
    .lens-btn.belief.active { color: var(--colors-cognitiveLens-belief-primary); }
    .lens-btn.goal.active { color: var(--colors-cognitiveLens-goal-primary); }
    .lens-btn.contradiction.active { color: var(--colors-cognitiveLens-contradiction-primary); }
    .popover {
      position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
      margin-top: 4px; background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel);
      padding: var(--spacing-scale-3); min-width: 200px;
      z-index: var(--zIndex-layers-popover); box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: auto; white-space: nowrap;
    }
    .popover-header { display: flex; align-items: center; gap: var(--spacing-scale-2); margin-bottom: var(--spacing-scale-2); }
    .popover-swatch { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
    .popover-title { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-primary); font-weight: var(--typography-fontWeights-semibold); }
    .popover-desc { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); margin-bottom: var(--spacing-scale-2); }
    .popover-count { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); display: flex; justify-content: space-between; gap: var(--spacing-scale-4); }
    .popover-count span:first-child { color: var(--colors-semantic-text-muted); }
  `;
  @state() private activePopover: Lens | null = null;
  @state() private nodeCounts: Record<string, number> = { belief: 0, goal: 0, contradiction: 0 };
  private popoverTimer: ReturnType<typeof setTimeout> | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($activeLens);
    this.watchWith($graphNodes, () => this.updateNodeCounts());
    this.updateNodeCounts();
  }

  override render() {
    const activeLens = $activeLens.get();
    return html`
      <div class="lens-group" role="tablist" aria-label="Cognitive lens">
        ${LENS_DEFS.map(
          (def) => html`
          <div style="position:relative;display:inline-block" @mouseenter=${() => this.onEnter(def.id)} @mouseleave=${this.onLeave}>
            <button class="lens-btn ${def.id} ${def.id === activeLens ? 'active' : ''}"
              role="tab" aria-selected=${def.id === activeLens}
              @click=${() => this.selectLens(def.id)}>
              ${def.label}
            </button>
            ${
              this.activePopover === def.id
                ? html`
              <div class="popover" @mouseenter=${this.onPopoverEnter} @mouseleave=${this.onLeave}>
                <div class="popover-header">
                  <span class="popover-swatch" style="background:${LENS_COLORS[def.id]}"></span>
                  <span class="popover-title">${def.label}</span>
                </div>
                <div class="popover-desc">${def.description}</div>
                <div class="popover-count">
                  <span>Nodes</span>
                  <span>${this.nodeCounts[def.id] ?? 0}</span>
                </div>
              </div>
            `
                : ''
            }
          </div>
        `
        )}
      </div>
    `;
  }

  private updateNodeCounts() {
    const nodes = $graphNodes.get();
    const counts: Record<string, number> = { belief: 0, goal: 0, contradiction: 0 };
    for (const n of nodes.values()) {
      if (n.isContradiction) counts.contradiction!++;
      if ((n.goalRelevance ?? 0) > 0.5) counts.goal!++;
      counts.belief!++;
    }
    this.nodeCounts = counts;
  }

  private onEnter(lens: Lens) {
    if (this.popoverTimer) clearTimeout(this.popoverTimer);
    this.activePopover = lens;
  }

  private onLeave() {
    this.popoverTimer = setTimeout(() => {
      this.activePopover = null;
    }, 200);
  }

  private onPopoverEnter() {
    if (this.popoverTimer) clearTimeout(this.popoverTimer);
  }

  private selectLens(lens: Lens) {
    $activeLens.set(lens);
    send({ type: 'lens.set', lens });
    eventBus.emit('lens:changed', lens);
    this.activePopover = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lens-controller': LensController;
  }
}
