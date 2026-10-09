import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $graphNodes, $nodeHistory, $selectedNodeId, $view, mountTestApi, eventBus } from '../core/index.js';

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
    .playhead.prospective {
      background: var(--colors-semantic-accent-amber);
    }
    .prospective-zone {
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: 10%;
      background: linear-gradient(90deg, transparent, var(--colors-semantic-bg-prospective));
      pointer-events: none;
      opacity: 0.5;
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
    .now:disabled {
      cursor: default;
      color: var(--colors-semantic-accent-primary);
      border-color: var(--colors-semantic-accent-primary);
    }
    .status-announce {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  @state() private minTime = 0;
  @state() private maxTime = 100;
  @state() private maxDataTime = 100;
  @state() private playing = false;
  @state() private live = true;
  private animationFrame: number | null = null;
  private lastAnnouncement = '';

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

  override render() {
    const view = $view.get();
    const t = view.timeline.t;
    const live = !Number.isFinite(t);
    this.live = live;

    // Prospective: allow scrubbing up to 10% beyond maxDataTime
    const prospectiveMax = this.maxDataTime + (this.maxDataTime - this.minTime) * 0.1;
    this.maxTime = prospectiveMax;

    const position = live ? this.maxDataTime : t;
    const percentage =
      this.maxTime > this.minTime
        ? ((position - this.minTime) / (this.maxTime - this.minTime)) * 100
        : 50;

    const isProspective = position > this.maxDataTime;

    return html`
      <div class="scrubber-container">
        <span class="time-label">${this.formatTime(this.minTime)}</span>
        <div style="position:relative;flex:1">
          <input
            type="range"
            min="${this.minTime}"
            max="${this.maxTime}"
            step="1"
            .value="${String(position)}"
            @input="${this.onInput}"
          />
          <div class="playhead ${isProspective ? 'prospective' : ''}" style="left:${percentage}%"></div>
          ${isProspective ? html`<div class="prospective-zone"></div>` : ''}
        </div>
        <span class="time-label">${this.formatTime(this.maxTime)}</span>
        <span class="time-value" role="status" aria-live="polite"
          >${live ? 'Live · all events' : this.formatTime(t)}</span
        >
        <button
          class="play now"
          data-action="now"
          title="Return to the present (live)"
          ?disabled="${live}"
          @click="${this.onNow}"
        >
          Now
        </button>
        <button class="play" @click="${() => this.onPlayPause()}">
          ${this.playing ? '❚❚' : '▶'}
        </button>
        <span class="status-announce" aria-live="assertive" aria-atomic="true">
          ${this.lastAnnouncement}
        </span>
      </div>
    `;
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
      this.maxDataTime = max === Number.NEGATIVE_INFINITY ? 100 : max;
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
    this.maxDataTime = max === 0 ? 100 : max;
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
    const wasLive = this.live;
    const nowProspective = t > this.maxDataTime;
    $view.set({ ...$view.get(), timeline: { t } });
    this.announce(
      nowProspective
        ? `Prospective time: ${this.formatTime(t)}`
        : `Time: ${this.formatTime(t)}`
    );
    this.requestUpdate();
  }

  /** Snap back to the present: `Infinity` disables the temporal gate so all events show (§4.4). */
  private onNow() {
    this.stopPlaying();
    $view.set({ ...$view.get(), timeline: { t: Number.POSITIVE_INFINITY } });
    this.announce('Live — all events');
    this.requestUpdate();
  }

  private onPlayPause() {
    if (this.playing) {
      this.stopPlaying();
      this.announce('Playback paused');
    } else {
      this.startPlaying();
      this.announce('Playback started');
    }
  }

  private startPlaying() {
    this.playing = true;
    const step = () => {
      if (!this.playing) return;
      const current = $view.get().timeline.t;
      const isLive = !Number.isFinite(current);
      const start = isLive ? this.maxDataTime : current;
      const next = Math.min(start + 1000, this.maxTime);
      $view.set({ ...$view.get(), timeline: { t: next } });
      const prospective = next > this.maxDataTime;
      this.announce(
        prospective
          ? `Playing prospective: ${this.formatTime(next)}`
          : `Playing: ${this.formatTime(next)}`
      );
      if (next < this.maxTime) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.playing = false;
        this.announce('Playback reached end');
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

  private announce(message: string) {
    if (message !== this.lastAnnouncement) {
      this.lastAnnouncement = message;
      this.requestUpdate();
      // Clear after announcement so repeat changes are announced
      setTimeout(() => {
        this.lastAnnouncement = '';
        this.requestUpdate();
      }, 1000);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-scrubber': TimelineScrubber;
  }
}
