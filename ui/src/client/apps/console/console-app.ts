/**
 * Console — the system console app.
 *
 * A raw terminal-style interface for direct engine interaction, debugging,
 * and low-level inspection.
 */
import { css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeLens,
  $cognitiveEvents,
  $connectionState,
  $graphLayer,
  $workspaceGraph,
  BaseComponent,
  narsBackend,
  send,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';
import { projectWorkspaceGraph } from '../../kernel/domain.js';
import { mintCognitiveEvent, type DerivationRecord } from '@senars/core/schemas';

type LogEntry = {
  id: string;
  type: 'input' | 'output' | 'event' | 'error' | 'info';
  text: string;
  timestamp: number;
};

/** The Console app surface — mounted in the viewport. */
@customElement('console-surface')
export class ConsoleSurface extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0b1020;
      color: #e8e8e8;
      font-family: var(--typography-fontFamilies-data, monospace);
    }
    .app {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2, 8px);
      padding: 8px 16px;
      border-bottom: 1px solid #2a2a2a;
      background: #111827;
    }
    .wordmark {
      font-weight: 650;
      letter-spacing: 0.02em;
      color: #6ea8fe;
    }
    .tagline {
      font-size: 12px;
      color: #888;
    }
    .status {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #888;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .dot.connected {
      background: #46c07a;
    }
    .dot.disconnected {
      background: #e5534b;
    }
    .viewport {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .log-entry {
      display: flex;
      gap: 8px;
      padding: 2px 0;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .log-entry .timestamp {
      color: #666;
      font-size: 11px;
      min-width: 80px;
      flex-shrink: 0;
    }
    .log-entry .prefix {
      font-weight: 600;
      min-width: 60px;
      flex-shrink: 0;
    }
    .log-entry .prefix.input { color: #6ea8fe; }
    .log-entry .prefix.output { color: #46c07a; }
    .log-entry .prefix.event { color: #f5a623; }
    .log-entry .prefix.error { color: #e5534b; }
    .log-entry .prefix.info { color: #888; }
    .log-entry .text { flex: 1; }
    form {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #2a2a2a;
      background: #111827;
    }
    input {
      flex: 1;
      background: #0b1020;
      color: #e8e8e8;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    input:focus {
      border-color: #6ea8fe;
    }
    button {
      background: #6ea8fe;
      color: #0b1020;
      border: none;
      border-radius: 4px;
      padding: 0 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .hint {
      padding: 8px 16px;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #2a2a2a;
    }
    .hint code {
      background: #1a1a2e;
      padding: 1px 4px;
      border-radius: 2px;
    }
  `;

  @state() private log: LogEntry[] = [];
  @state() private draft = '';
  @state() private showEvents = true;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($connectionState);
    this.watch($cognitiveEvents);
    this.addLog('info', 'Console ready. Type Narsese or commands.');
    this.addLog('info', 'Commands: :run <n>, :step, :abort, :beliefs, :events on|off, :clear');
  }

  private addLog(type: LogEntry['type'], text: string): void {
    this.log = [...this.log, { id: crypto.randomUUID(), type, text, timestamp: Date.now() }];
    if (this.log.length > 500) this.log = this.log.slice(-500);
    this.requestUpdate();
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  }

  private async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.addLog('input', text);

    // Handle console commands
    if (text.startsWith(':')) {
      await this.handleCommand(text.slice(1));
      return;
    }

    // Send to engine
    const control = narsBackend.control;
    if (!control) {
      this.addLog('error', 'No reasoning engine attached');
      return;
    }
    const mode = text.endsWith('?') ? 'question' : text.endsWith('!') ? 'goal' : 'belief';
    const result = await control.submit({ term: text, mode });
    if (!result.ok) {
      this.addLog('error', result.message ?? 'Engine rejected');
      return;
    }
    if (mode === 'question' && result.answer) {
      this.addLog('output', `${result.answer.answer} [f=${result.answer.frequency?.toFixed(2)} c=${result.answer.confidence?.toFixed(2)}]`);
      if (result.answer.hasDerivation) this.addLog('event', 'Derivation recorded');
    } else {
      this.addLog('output', `${mode === 'goal' ? '✓ goal' : '✓ belief'} accepted`);
    }
  }

  private async handleCommand(cmd: string): Promise<void> {
    const parts = cmd.split(/\s+/);
    const name = parts[0];

    try {
      switch (name) {
        case 'run': {
          const engine = narsBackend.control;
          if (engine?.run) {
            this.addLog('info', 'Running...');
            await engine.run();
            this.addLog('output', 'Run complete');
          }
          break;
        }
        case 'step': {
          const engine = narsBackend.control;
          if (engine?.step) {
            await engine.step();
            this.addLog('output', 'Step complete');
          }
          break;
        }
        case 'abort': {
          const engine = narsBackend.control;
          if (engine?.abort) {
            await engine.abort();
          }
          this.addLog('output', 'Aborted');
          break;
        }
        case 'events': {
          const args = parts.slice(1);
          this.showEvents = args[0] !== 'off';
          this.addLog('info', `Events ${this.showEvents ? 'enabled' : 'disabled'}`);
          break;
        }
        case 'clear': {
          this.log = [];
          this.addLog('info', 'Cleared');
          break;
        }
        default:
          this.addLog('error', `Unknown command: ${name}`);
      }
    } catch (e: unknown) {
      this.addLog('error', (e as Error).message);
    }
  }

  protected override render(): TemplateResult {
    const status = $connectionState.get();

    return html`
      <div class="app">
        <header>
          <span class="wordmark">SeNARS</span>
          <span class="tagline">Console — raw engine interface</span>
          <span class="status">
            <span class="dot ${status}"></span>${status}
          </span>
        </header>
        <div class="viewport">
          ${this.log.map((entry) => html`
            <div class="log-entry">
              <span class="timestamp">${this.formatTime(entry.timestamp)}</span>
              <span class="prefix ${entry.type}">${entry.type.toUpperCase()}</span>
              <span class="text">${entry.text}</span>
            </div>
          `)}
        </div>
        <form @submit=${this.onSubmit}>
          <input
            .value=${this.draft}
            @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)}
            placeholder="Narsese or :command…"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="submit" ?disabled=${!this.draft.trim()}>Send</button>
        </form>
        <div class="hint">
          <code>:run [n]</code> cycles, <code>:step</code> one, <code>:abort</code>, <code>:beliefs</code>, <code>:events on|off</code>, <code>:clear</code>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'console-surface': ConsoleSurface;
  }
}

/** Console app surfaces — viewport surface. */
const consoleSurfaces: SurfaceDescriptor[] = [
  {
    id: 'console-surface',
    label: 'Console',
    title: 'System Console',
    icon: 'terminal',
    placement: 'viewport',
    tag: 'console-surface',
  },
];

/** Console app descriptor — one bundle of contributions plus the shell contract. */
export const CONSOLE_APP: AppDescriptor<'console'> = defineApp({
  bundle: defineBundle({
    id: 'console',
    name: 'Console',
    description: 'Raw engine interface — direct Narsese input, cycle control, belief inspection.',
    surfaces: {
      viewport: consoleSurfaces,
    },
  }),
  icon: 'terminal',
  defaultLens: 'belief',
  defaultGraphLayer: 'both',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The Console app id for registration and routing. */
export const CONSOLE_APP_ID = CONSOLE_APP.id;