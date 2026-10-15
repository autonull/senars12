/**
 * Cycle controls — run/pause/step/rewind the kernel's micro-tick (§18.2).
 * The cycle is the UI's clock; controlling it controls time for the whole workspace.
 */

import { css, html, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { $cycleState, $cycleCount, $cycleSpeed, setCycleState, stepCycle, rewindCycle, type CycleState } from '../../core/store.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';

@customElement('s-cycle-controls')
export class SCycleControls extends SurfaceComponent {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--colors-surface-elevated);
      border: 1px solid var(--colors-border);
      border-radius: var(--radii-md);
      font-family: var(--fonts-mono);
      font-size: var(--text-xs);
    }
    .cycle-info {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--colors-text-secondary);
    }
    .cycle-count {
      font-variant-numeric: tabular-nums;
      min-width: 4ch;
    }
    .cycle-speed {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--colors-text);
      border-radius: var(--radii-sm);
      cursor: pointer;
      transition: background var(--transitions-fast), color var(--transitions-fast);
    }
    .btn:hover {
      background: var(--colors-surface-hover);
    }
    .btn:active {
      background: var(--colors-surface-active);
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn.primary {
      background: var(--colors-primary);
      color: var(--colors-on-primary);
    }
    .btn.primary:hover {
      background: var(--colors-primary-hover);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 0 var(--space-2);
      height: 24px;
      border-radius: var(--radii-full);
      font-size: var(--text-xs);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status.running {
      background: var(--colors-success-bg);
      color: var(--colors-success);
    }
    .status.paused {
      background: var(--colors-warning-bg);
      color: var(--colors-warning);
    }
    .status.stepping {
      background: var(--colors-primary-bg);
      color: var(--colors-primary);
    }
    .status-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .status.running .status-indicator {
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;

  @property({ type: Boolean }) compact = false;

  @state() private cycleState: CycleState = 'running';
  @state() private cycleCount = 0;
  @state() private cycleSpeed = 1;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchWith($cycleState, (v) => { this.cycleState = v; });
    this.watchWith($cycleCount, (v) => { this.cycleCount = v; });
    this.watchWith($cycleSpeed, (v) => { this.cycleSpeed = v; });
  }

  private handleRun(): void {
    setCycleState('running');
  }

  private handlePause(): void {
    setCycleState('paused');
  }

  private handleStep(): void {
    stepCycle();
  }

  private handleRewind(): void {
    const target = prompt('Rewind to cycle:', String(Math.max(0, this.cycleCount - 10)));
    if (target !== null) {
      const n = Number(target);
      if (!Number.isNaN(n) && n >= 0) {
        rewindCycle(n);
      }
    }
  }

  private handleSpeedChange(e: Event): void {
    const speed = Number((e.target as HTMLSelectElement).value);
    console.log('[CycleControls] Speed change requested:', speed);
  }

  protected override renderBody(): TemplateResult {
    if (this.compact) {
      return html`
        <div class="cycle-info">
          <span class="status ${this.cycleState}">
            <span class="status-indicator"></span>
            ${this.cycleState}
          </span>
          <span class="cycle-count">#${this.cycleCount}</span>
          <button class="btn ${this.cycleState === 'running' ? 'primary' : ''}" @click=${this.cycleState === 'running' ? this.handlePause : this.handleRun} ?disabled=${this.cycleState === 'stepping'} title=${this.cycleState === 'running' ? 'Pause' : 'Run'}>
            <s-icon name=${this.cycleState === 'running' ? 'pause' : 'play'} size="16"></s-icon>
          </button>
          <button class="btn" @click=${this.handleStep} title="Step">⏭</button>
        </div>
      `;
    }

    return html`
      <div class="cycle-info">
        <span class="status ${this.cycleState}">
          <span class="status-indicator"></span>
          ${this.cycleState}
        </span>
        <span class="cycle-count">Cycle #${this.cycleCount}</span>
        
        <div class="cycle-speed">
          <label for="cycle-speed">Speed:</label>
          <select id="cycle-speed" class="btn" .value=${String(this.cycleSpeed)} @change=${this.handleSpeedChange}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
            <option value="5">5×</option>
            <option value="10">10×</option>
          </select>
        </div>
      </div>
      <div style="display: flex; gap: var(--space-1);">
        <button class="btn ${this.cycleState === 'running' ? 'primary' : ''}" @click=${this.cycleState === 'running' ? this.handlePause : this.handleRun} ?disabled=${this.cycleState === 'stepping'} title=${this.cycleState === 'running' ? 'Pause (Space)' : 'Run (Space)'}>
          <s-icon name=${this.cycleState === 'running' ? 'pause' : 'play'} size="16"></s-icon>
        </button>
        <button class="btn" @click=${this.handleStep} ?disabled=${this.cycleState !== 'paused'} title="Step (→)">
          <s-icon name="skipNext" size="16"></s-icon>
        </button>
        <button class="btn" @click=${this.handleRewind} title="Rewind">
          <s-icon name="skipPrevious" size="16"></s-icon>
        </button>
      </div>
    `;
  }
}

const CYCLE_CONTROLS_SURFACE = {
  id: 'cycle-controls',
  title: 'Cycle Controls',
  group: 'instrument',
  a11y: { role: 'region' },
} as const;

defineSurface(
  {
    ...CYCLE_CONTROLS_SURFACE,
    capability: 'reasoning' as const,
    placement: 'panel' as const,
    presentation: {
      hiddenInPalette: false,
    },
  },
  SCycleControls
);

declare global {
  interface HTMLElementTagNameMap {
    's-cycle-controls': SCycleControls;
  }
}