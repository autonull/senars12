import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseComponent } from '../core/base-component.js';
import { $graphNodes, $nodeHistory, $selectedNodeId, $view, mountTestApi } from '../core/index.js';

@customElement('timeline-scrubber')
export class TimelineScrubber extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      background: var(--colors-semantic-bg-panel);
      border-top: 1px solid var(--colors-semantic-border-subtle);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
    }
    .scrubber-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
    }
    .time-label {
      color: var(--colors-semantic-text-muted);
      min-width: 80px;
    }
    input[type="range"] {
      flex: 1;
      height: 6px;
      -webkit-appearance: none;
      background: transparent;
      margin: 0;
      padding: 0;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      height: 6px;
      background: var(--colors-semantic-border-subtle);
      border-radius: 3px;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--colors-semantic-accent-primary);
      cursor: pointer;
      margin-top: -4px;
    }
    .time-value {
      min-width: 60px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--colors-semantic-text-primary);
    }
    .playhead {
      position: absolute;
      top: -20px;
      width: 2px;
      height: 20px;
      background: var(--colors-semantic-accent-primary);
      pointer-events: none;
      transition: left 0.1s linear;
    }
    .play {
      flex-shrink: 0;
      padding: 2px 8px;
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm);
      background: transparent;
      color: var(--colors-semantic-text-secondary);
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
    }
    .play:hover {
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
  `;

  @state() private minTime = 0;
  @state() private maxTime = 100;
  @state() private playing = false;
  private animationFrame: number | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => this.computeTimeRange());
    this.watchWith($view, () => this.requestUpdate());
    this.computeTimeRange();
    mountTestApi('timeline', {
      getTime: () => $view.get().timeline.t,
      setTime: (t: number) => $view.set({ ...$view.get(), timeline: { t } }),
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPlaying();
  }

  private computeTimeRange() {
    const selectedId = $selectedNodeId.get();
    const history = selectedId ? $nodeHistory.get() : [];
    if (history.length > 0) {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const h of history) {
        min = Math.min(min, h.timestamp);
        max = Math.max(max, h.timestamp);
      }
      this.minTime = min === Number.POSITIVE_INFINITY ? 0 : min;
      this.maxTime = max === Number.NEGATIVE_INFINITY ? 100 : max;
      return;
    }

    const nodes = $graphNodes.get();
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const nd of nodes.values()) {
      if (nd.occurrenceTime !== undefined) {
        min = Math.min(min, nd.occurrenceTime);
        max = Math.max(max, nd.occurrenceTime);
      }
    }
    this.minTime = min === Number.POSITIVE_INFINITY ? 0 : min;
    this.maxTime = max === 0 ? 100 : max;
  }

  private formatTime(t: number): string {
    return new Date(t).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private onInput(e: Event) {
    const t = Number.parseFloat((e.target as HTMLInputElement).value);
    $view.set({ ...$view.get(), timeline: { t } });
    this.requestUpdate();
  }

  private onPlayPause() {
    if (this.playing) {
      this.stopPlaying();
    } else {
      this.startPlaying();
    }
  }

  private startPlaying() {
    this.playing = true;
    const step = () => {
      if (!this.playing) return;
      const current = $view.get().timeline.t;
      const next = Math.min(current + 1000, this.maxTime);
      $view.set({ ...$view.get(), timeline: { t: next } });
      if (next < this.maxTime) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.playing = false;
      }
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private stopPlaying() {
    this.playing = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  override render() {
    const t = $view.get().timeline.t;
    const percentage =
      this.maxTime > this.minTime ? ((t - this.minTime) / (this.maxTime - this.minTime)) * 100 : 50;
    return html`
      <div class="scrubber-container">
        <span class="time-label">${this.formatTime(this.minTime)}</span>
        <div style="position:relative;flex:1">
          <input
            type="range"
            min="${this.minTime}"
            max="${this.maxTime}"
            step="1"
            .value="${String(t)}"
            @input="${this.onInput}"
          />
          <div class="playhead" style="left:${percentage}%"></div>
        </div>
        <span class="time-label">${this.formatTime(this.maxTime)}</span>
        <span class="time-value">${this.formatTime(t)}</span>
        <button class="play" @click="${() => this.onPlayPause()}">
          ${this.playing ? '❚❚' : '▶'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-scrubber': TimelineScrubber;
  }
}
