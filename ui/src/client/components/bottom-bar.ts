import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { estimateTokens } from '../../shared/index.js';
import { BaseComponent } from '../core/base-component.js';
import {
  $capabilities,
  $connectionState,
  $controlMode,
  $graphNodes,
  $lmProvider,
  $reasoningRunning,
  $streamingDelta,
  $webllmActive,
  $webllmAvailable,
  $workspaceGraph,
  addUserMessage,
  availableComposerModes,
  capabilityGate,
  COMPOSER_MODE_CATALOG,
  DEFAULT_COMPOSER_MODE,
  eventBus,
  providerLabel,
  type InputSegment,
  type ComposerMode,
  decomposeForMode,
  narsBackend,
  send,
} from '../core/index.js';
import { dispatchCommand } from '../core/commands.js';
import { refreshLmStatus, switchLmProvider } from '../core/lm-transport.js';
import './contradiction-badge.js';
import './primitives/icon.js';

const MAX_HISTORY = 50;
const SLASH_COMMANDS = [
  { id: '/lens', label: '/lens belief|goal|contradiction — Switch cognitive lens' },
  { id: '/focus', label: '/focus <term> — Focus on a concept' },
  { id: '/config', label: '/config <key> <value> — Set a config value' },
  { id: '/clear', label: '/clear — Clear chat history', action: () => location.reload() },
  { id: '/help', label: '/help — Show available commands' },
];

interface Suggestion {
  id: string;
  label: string;
  type: 'slash' | 'mention';
}

const inputHistory: string[] = [];
let historyIndex = -1;

@customElement('bottom-bar')
export class BottomBar extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      background: var(--colors-semantic-bg-panel-solid);
      border-top: 1px solid var(--colors-semantic-border-subtle);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
    }
    .bar {
      display: flex; flex-direction: column; gap: var(--spacing-scale-2);
      max-width: 900px; margin: 0 auto; width: 100%;
    }
    .composer-row {
      display: flex; align-items: flex-end; gap: var(--spacing-scale-2);
      flex-wrap: wrap;
    }
    .input-wrapper {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--spacing-scale-1);
    }
    textarea {
      background: var(--colors-semantic-bg-base);
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-primary);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      line-height: 1.5;
      border-radius: var(--borderRadius-component-input);
      resize: none;
      outline: none;
      transition: var(--transitions-fast);
      min-height: 44px;
      max-height: 120px;
      overflow-y: auto;
      width: 100%;
      box-sizing: border-box;
    }
    textarea:focus {
      border-color: var(--colors-semantic-border-focus);
      box-shadow: 0 0 0 1px var(--colors-semantic-border-focus);
    }
    .composer-footer {
      display: flex; justify-content: space-between; align-items: center;
      gap: var(--spacing-scale-2); flex-wrap: wrap;
    }
    .modes {
      display: flex; gap: var(--spacing-scale-1); flex-wrap: wrap;
    }
    .modes button {
      background: transparent; border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-secondary);
      padding: 1px var(--spacing-scale-2);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xxs);
      border-radius: 999px; cursor: pointer;
      transition: var(--transitions-fast);
    }
    .modes button[aria-pressed='true'] {
      background: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-text-on-accent); border-color: transparent;
    }
    .token-count {
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xxs);
      color: var(--colors-semantic-text-muted);
      white-space: nowrap;
    }
    .suggestions {
      background: var(--colors-semantic-bg-elevated);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-input);
      box-shadow: var(--shadows-panel);
      max-height: 160px; overflow-y: auto;
      margin-top: var(--spacing-scale-1);
    }
    .suggestion {
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-primary);
      cursor: pointer; display: flex; align-items: center; gap: var(--spacing-scale-2);
    }
    .suggestion:hover, .suggestion.selected {
      background: var(--colors-semantic-bg-panel-hover);
    }
    .suggestion-type {
      font-size: var(--typography-scale-xxxs);
      color: var(--colors-semantic-text-muted);
      text-transform: uppercase;
      padding: 1px 4px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 3px;
    }
    .decomposition {
      display: flex; flex-wrap: wrap; gap: var(--spacing-scale-1);
    }
    .segment {
      display: inline-flex; align-items: center; gap: var(--spacing-scale-1);
      max-width: 100%; padding: 1px var(--spacing-scale-2);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 999px;
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xxs);
      color: var(--colors-semantic-text-secondary);
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    }
    .segment-kind {
      text-transform: uppercase; letter-spacing: 0.06em;
      font-size: var(--typography-scale-xxxs); color: var(--colors-semantic-text-muted);
    }
    .contexts {
      display: flex; align-items: center; gap: var(--spacing-scale-2);
      flex-wrap: wrap; padding: 2px 2px 0;
    }
    .context-label {
      color: var(--colors-semantic-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
      font-size: var(--typography-scale-xxxs);
    }
    .context {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 0 var(--spacing-scale-2); border-radius: 999px;
      border: 1px solid var(--colors-semantic-accent-primary);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-secondary);
    }
    .context-title {
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 32ch;
    }
    .context-clear {
      background: transparent; border: none; color: var(--colors-semantic-text-muted);
      cursor: pointer; font-size: 0.85rem; line-height: 1; padding: 0;
    }
    .context-clear:hover { color: var(--colors-semantic-accent-primary); }

    .actions {
      display: flex; align-items: center; gap: var(--spacing-scale-2); flex-shrink: 0;
    }
    .action-btn {
      background: transparent; border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-secondary);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-size: var(--typography-scale-sm);
      border-radius: var(--borderRadius-component-button);
      cursor: pointer; font-family: var(--typography-fontFamilies-ui);
      transition: var(--transitions-fast); white-space: nowrap;
    }
    .action-btn:hover {
      border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary);
    }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn {
      background: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-text-on-accent); border: none;
      padding: var(--spacing-scale-3) var(--spacing-scale-5);
      font-weight: var(--typography-fontWeights-semibold); cursor: pointer;
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      border-radius: var(--borderRadius-component-button); transition: var(--transitions-fast);
    }
    .send-btn:hover { background: var(--colors-semantic-accent-primary-dim); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .status-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--spacing-scale-3); flex-wrap: wrap;
      padding-top: var(--spacing-scale-1); border-top: 1px solid var(--colors-semantic-border-subtle);
    }
    .status-cluster {
      display: flex; align-items: center; gap: var(--spacing-scale-3); flex-wrap: wrap;
    }
    .status-item {
      display: flex; align-items: center; gap: var(--spacing-scale-1);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-secondary);
    }
    .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--colors-semantic-status-disconnected);
    }
    .status-dot.connected { background: var(--colors-semantic-status-connected); }
    .status-dot.connecting { background: var(--colors-semantic-status-connecting); }
    .status-dot.reconnecting { background: var(--colors-semantic-status-reconnecting); }
    .status-dot.standalone { background: var(--colors-semantic-status-connecting); }
    .provider-chip {
      padding: 1px var(--spacing-scale-2); border-radius: 999px;
      font-size: var(--typography-scale-xxxs); color: var(--colors-semantic-text-muted);
      background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle);
    }
    .control-mode-btn {
      padding: var(--spacing-scale-1) var(--spacing-scale-3); border-radius: 999px;
      font-size: var(--typography-scale-xs); font-family: var(--typography-fontFamilies-ui);
      cursor: pointer; border: 1px solid var(--colors-semantic-border-subtle);
      background: transparent; color: var(--colors-semantic-text-secondary);
      transition: var(--transitions-fast);
    }
    .control-mode-btn:hover {
      background: var(--colors-semantic-bg-subtle);
      color: var(--colors-semantic-text-primary);
    }
    .control-mode-btn.active {
      background: var(--colors-semantic-accent-amber);
      color: var(--colors-semantic-bg-base);
      border-color: var(--colors-semantic-accent-amber);
    }
    .abort-btn {
      padding: var(--spacing-scale-1) var(--spacing-scale-3); border-radius: var(--borderRadius-component-button);
      font-size: var(--typography-scale-xs); font-family: var(--typography-fontFamilies-ui);
      background: var(--colors-semantic-accent-red); color: var(--colors-semantic-text-on-accent);
      border: none; cursor: pointer; transition: var(--transitions-fast);
    }
    .abort-btn:hover { filter: brightness(1.2); }
    .palette-btn {
      background: var(--colors-semantic-bg-base);
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-secondary);
      padding: var(--spacing-scale-1) var(--spacing-scale-3);
      font-size: var(--typography-scale-xs);
      font-family: var(--typography-fontFamilies-ui);
      border-radius: var(--borderRadius-component-button);
      cursor: pointer;
      transition: var(--transitions-fast);
    }
    .palette-btn:hover {
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
    .settings-btn {
      background: transparent;
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-secondary);
      padding: var(--spacing-scale-1) var(--spacing-scale-3);
      font-size: var(--typography-scale-xs);
      font-family: var(--typography-fontFamilies-ui);
      border-radius: var(--borderRadius-component-button);
      cursor: pointer;
      transition: var(--transitions-fast);
    }
    .settings-btn:hover {
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
    .contradiction-badge-host { flex-shrink: 0; }
  `;

  @state() private composing = false;
  @state() private textareaValue = '';
  @state() private mode: ComposerMode = DEFAULT_COMPOSER_MODE;
  @state() private contextRefs: string[] = [];
  @state() private decomposition: InputSegment[] = [];
  @state() private showSuggestions = false;
  @state() private suggestionIndex = -1;
  @state() private suggestions: Suggestion[] = [];
  @state() private webllmAvailable = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($streamingDelta);
    this.watch($graphNodes);
    this.watch($workspaceGraph);
    this.watch($connectionState);
    this.watch($controlMode);
    this.watch($reasoningRunning);
    this.watch($lmProvider);
    this.watch($webllmAvailable);
    this.watchWith($capabilities, (capabilities) => {
      if (!availableComposerModes(capabilities).some((m) => m.id === this.mode)) {
        this.mode = DEFAULT_COMPOSER_MODE;
      }
    });
    this.webllmAvailable = 'gpu' in navigator;
    refreshLmStatus();
  }

  override render() {
    const streamingDelta = $streamingDelta.get();
    const tokens = estimateTokens(this.textareaValue);
    const hasContent = !!(streamingDelta || this.textareaValue.trim());
    const canHistoryUp = inputHistory.length > 0;
    const graph = $workspaceGraph.get();
    const contexts = this.contextRefs.map((id) => ({ id, block: graph.blocks.get(id) }));
    const connectionState = $connectionState.get();
    const controlMode = $controlMode.get();
    const reasoningRunning = $reasoningRunning.get();
    const provider = $lmProvider.get();
    const isWebLLM = provider.id === 'webllm';
    const showRunLocally = this.webllmAvailable && !$webllmActive.get() && !isWebLLM;

    const runLocallyBtn = showRunLocally
      ? html`
          <button
            class="action-btn"
            @click=${() => switchLmProvider('webllm')}
            title="Switch to local WebGPU inference"
          >
            <s-icon name="globe" size="10"></s-icon> Run locally
          </button>`
      : '';

    return html`
      <div class="bar">
        <div class="composer-row">
          <div class="input-wrapper">
            ${this.showSuggestions ? html`
              <div class="suggestions">
                ${this.suggestions.map(
                  (s, i) => html`
                  <div class="suggestion ${i === this.suggestionIndex ? 'selected' : ''}"
                    @mousedown=${() => this.applySuggestion(s)}
                    @mouseenter=${() => (this.suggestionIndex = i)}>
                    <span class="suggestion-type">${s.type}</span>
                    <span>${s.label}</span>
                  </div>`
                )}
              </div>
            ` : ''}
            ${contexts.length ? html`<div class="contexts">
                <span class="context-label">↳ Context</span>
                ${contexts.map(
                  ({ id, block }) => html`<span class="context">
                    <span class="context-title">${block?.title ?? block?.text ?? id}</span>
                    <button
                      class="context-clear"
                      title="Remove context"
                      @click=${() => (this.contextRefs = this.contextRefs.filter((ref) => ref !== id))}
                    >×</button>
                  </span>`
                )}
              </div>` : ''}
            <textarea
              class="chat-input"
              placeholder=${COMPOSER_MODE_CATALOG[this.mode].hint}
              .value=${streamingDelta || this.textareaValue}
              @keydown=${this.onKeyDown}
              @focus=${() => (this.composing = true)}
              @blur=${() => {
                this.composing = false;
                setTimeout(() => { this.showSuggestions = false; }, 200);
              }}
              @input=${this.onInput}
            ></textarea>
            ${this.decomposition.length > 1 ||
            (this.decomposition[0] !== undefined && this.decomposition[0].kind !== 'claim')
              ? html`<div class="decomposition" aria-label="Extracted input structure">
                  ${this.decomposition.map(
                    (segment) => html`<span class="segment" data-kind=${segment.kind}>
                      <span class="segment-kind">${segment.kind}</span>${segment.text}
                    </span>`
                  )}
                </div>`
              : ''}
            <div class="composer-footer">
              <div class="modes" role="group" aria-label="Composer mode">
                ${availableComposerModes($capabilities.get()).map(
                  (mode) => html`<button
                    data-mode=${mode.id}
                    aria-pressed=${this.mode === mode.id}
                    @click=${() => this.setMode(mode.id)}
                  >${mode.label}</button>`
                )}
              </div>
              <span class="token-count">~${tokens}/4096 tokens</span>
            </div>
          </div>

          <div class="actions">
            <button class="action-btn" @click=${() => {
              if (canHistoryUp) {
                historyIndex = Math.max(0, historyIndex - 1);
                this.textareaValue = inputHistory[historyIndex] ?? '';
              }
            }} ?disabled=${!canHistoryUp} title="History">
              <s-icon name="history" size="12"></s-icon>
            </button>
            <button class="send-btn" @click=${this.sendMessage} ?disabled=${!hasContent}>
              <s-icon name="send" size="14"></s-icon>
              <span style="margin-left:4px">Send</span>
            </button>
          </div>
        </div>

        <div class="status-row">
          <div class="status-cluster">
            <div class="status-item">
              <span class="status-dot ${connectionState}"></span>
              <span>${connectionState}</span>
            </div>
            <div class="status-item">
              <span class="status-dot ${provider.available ? 'connected' : 'disconnected'}"></span>
              <button class="provider-chip" data-action="provider" @click=${() => dispatchCommand('overlay.provider')}>
                LM: ${providerLabel(provider.id)}
              </button>
              <span>${provider.model ?? ''}</span>
              ${provider.stale ? html`<s-icon name="warning" size="10"></s-icon>` : ''}
              ${isWebLLM ? html`<span class="provider-chip"><s-icon name="globe" size="10"></s-icon> Local</span>` : ''}
              ${runLocallyBtn}
            </div>
            <div class="status-item">
              <button class="control-mode-btn ${controlMode ? 'active' : ''}"
                @click=${() => dispatchCommand('control.mode.toggle')}
                title=${controlMode ? 'Control mode: ON (click to disable)' : 'Control mode: OFF (click to enable)'}>
                <s-icon name="controlMode" size="12"></s-icon>
              </button>
              ${controlMode && reasoningRunning
              ? html`
                  <button
                    class="abort-btn"
                    @click=${() => dispatchCommand('reasoning.abort')}
                    title="Abort reasoning run"
                  >
                    <s-icon name="abort" size="12"></s-icon>
                    <span style="margin-left:4px">Abort</span>
                  </button>`
              : ''}
            </div>
            <contradiction-badge class="contradiction-badge-host"></contradiction-badge>
            <s-icon name="lens" size="14"></s-icon>
          </div>

          <div class="status-cluster">
            <button class="palette-btn" @click=${() => dispatchCommand('overlay.palette')} title="Command palette (⌘K)">
              <s-icon name="palette" size="14"></s-icon>
            </button>
            <button class="settings-btn" @click=${() => dispatchCommand('overlay.settings')} title="Settings">
              <s-icon name="settings" size="14"></s-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private autoResize(ta: HTMLTextAreaElement) {
    ta.style.height = '44px';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  private getSuggestions(text: string): Suggestion[] {
    const cursor = (this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement)?.selectionStart ?? text.length;
    const before = text.slice(0, cursor);

    const slashMatch = before.match(/(^|\s)(\/\w*)$/);
    const slashPrefix = slashMatch?.[2];
    if (slashPrefix) {
      const query = slashPrefix.toLowerCase();
      return SLASH_COMMANDS.filter((c) => c.id.startsWith(query)).map((c) => ({
        id: c.id, label: c.label, type: 'slash' as const,
      }));
    }

    const atMatch = before.match(/(^|\s)(@\w*)$/);
    const atPrefix = atMatch?.[2];
    if (atPrefix) {
      const query = atPrefix.slice(1).toLowerCase();
      const nodes = $graphNodes.get();
      return [...nodes.entries()]
        .filter(([_, n]) => n && (n.label?.toLowerCase().includes(query) || n.term?.toLowerCase().includes(query)))
        .slice(0, 10)
        .map(([id, n]) => ({ id, label: n.term ?? n.label ?? id, type: 'mention' as const }));
    }

    return [];
  }

  private applySuggestion(sug: Suggestion) {
    const ta = this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement;
    const cursor = ta?.selectionStart ?? this.textareaValue.length;
    const before = this.textareaValue.slice(0, cursor);
    const prefix = sug.type === 'slash' ? before.replace(/\/\w*$/, sug.id) : before.replace(/@\w*$/, `@${sug.label} `);
    this.textareaValue = prefix + this.textareaValue.slice(cursor);
    this.showSuggestions = false;
    this.suggestions = [];
    requestAnimationFrame(() => { if (ta) { ta.focus(); this.autoResize(ta); } });
  }

  private setMode(mode: ComposerMode) {
    this.mode = mode;
    this.decomposition = decomposeForMode(this.textareaValue, mode);
  }

  private async sendMessage() {
    const content = this.textareaValue.trim();
    if (!content) return;
    inputHistory.push(content);
    if (inputHistory.length > MAX_HISTORY) inputHistory.shift();
    historyIndex = inputHistory.length;

    const isStructured = this.mode === 'believe' || this.mode === 'goal';
    const control = capabilityGate('reasoning') ? narsBackend.control : undefined;

    if (isStructured && control) {
      const segments = this.decomposition.filter((s) => s.kind === 'claim');
      for (const segment of segments) {
        await control.submit({ term: segment.text, mode: this.mode === 'believe' ? 'belief' : 'goal' });
      }
      addUserMessage(content, this.mode, this.contextRefs);
      send({ type: 'chat.user', content, mode: this.mode, contexts: this.contextRefs });
    } else {
      addUserMessage(content, this.mode, this.contextRefs);
      send({ type: 'chat.user', content, mode: this.mode, contexts: this.contextRefs });
    }

    this.textareaValue = '';
    this.contextRefs = [];
    this.decomposition = [];
    this.composing = false;
    this.showSuggestions = false;
  }

  private onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this.textareaValue = ta.value;
    this.decomposition = decomposeForMode(ta.value, this.mode);
    this.autoResize(ta);

    const suggestions = this.getSuggestions(ta.value);
    this.showSuggestions = suggestions.length > 0;
    this.suggestions = suggestions;
    this.suggestionIndex = -1;
  }

  private onKeyDown(e: KeyboardEvent) {
    const ta = e.target as HTMLTextAreaElement;

    if (e.key === 'Enter' && !e.shiftKey && !this.showSuggestions) {
      e.preventDefault(); this.sendMessage(); return;
    }
    if (e.key === 'Escape') {
      if (this.showSuggestions) { this.showSuggestions = false; this.suggestions = []; return; }
      ta.blur(); return;
    }
    if (this.showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.suggestionIndex = Math.min(this.suggestionIndex + 1, this.suggestions.length - 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.suggestionIndex = Math.max(this.suggestionIndex - 1, -1);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (this.suggestionIndex >= 0 && this.suggestionIndex < this.suggestions.length) {
          this.applySuggestion(this.suggestions[this.suggestionIndex]!);
        }
        return;
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'bottom-bar': BottomBar; }
}