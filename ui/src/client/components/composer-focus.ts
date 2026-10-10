/**
 * Floating composer focus component (§P2.3).
 * Extracted from input-hud to enable agent-driven positioning.
 * The composer is one universal input; a mode picks the schema.
 */

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { estimateTokens } from '../../shared/index.js';
import { BaseComponent } from '../core/base-component.js';
import {
  $capabilities,
  $graphNodes,
  $streamingDelta,
  $workspaceGraph,
  addUserMessage,
  availableComposerModes,
  capabilityGate,
  COMPOSER_MODE_CATALOG,
  type ComposerMode,
  decomposeForMode,
  DEFAULT_COMPOSER_MODE,
  eventBus,
  type InputSegment,
  narsBackend,
  registerCommand,
  send,
} from '../core/index.js';

interface SlashCommand {
  id: string;
  label: string;
  action: () => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: '/lens',
    label: '/lens belief|goal|contradiction — Switch cognitive lens',
    action: () => {},
  },
  {
    id: '/focus',
    label: '/focus <term> — Focus on a concept',
    action: () => {},
  },
  {
    id: '/config',
    label: '/config <key> <value> — Set a config value',
    action: () => {},
  },
  {
    id: '/clear',
    label: '/clear — Clear chat history',
    action: () => {
      location.reload();
    },
  },
  {
    id: '/help',
    label: '/help — Show available commands',
    action: () => {},
  },
];

const MAX_HISTORY = 50;

interface Suggestion {
  id: string;
  label: string;
  type: 'slash' | 'mention';
}

const inputHistory: string[] = [];
let historyIndex = -1;

@customElement('composer-focus')
export class ComposerFocus extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      position: fixed;
      z-index: var(--zIndex-layers-tooltip);
      pointer-events: none;
      transition: opacity 0.15s ease-out, transform 0.15s ease-out;
    }
    :host([hidden]) {
      display: none;
    }
    .composer {
      pointer-events: auto;
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-panel);
      box-shadow: var(--shadows-panel);
      padding: var(--spacing-scale-2);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-2);
      min-width: 320px;
      max-width: 600px;
      width: 100%;
    }
    .composer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-scale-2);
    }
    .composer-title {
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-primary);
    }
    .composer-close {
      background: transparent;
      border: none;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      padding: var(--spacing-scale-1);
      border-radius: var(--borderRadius-component-button);
      font-size: 1.2rem;
      line-height: 1;
      transition: var(--transitions-fast);
    }
    .composer-close:hover {
      color: var(--colors-semantic-accent-primary);
      background: var(--colors-semantic-bg-subtle);
    }
    .input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-1);
      position: relative;
    }
    textarea {
      background: var(--colors-semantic-bg-base);
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-primary);
      padding: var(--spacing-scale-3) var(--spacing-scale-4);
      font-family: var(--typography-fontFamilies-ui);
      font-size: 0.85rem;
      line-height: 1.5;
      border-radius: 6px;
      resize: none;
      outline: none;
      transition: var(--transitions-fast);
      min-height: 44px;
      max-height: 200px;
      overflow-y: auto;
      width: 100%;
      box-sizing: border-box;
    }
    textarea:focus {
      border-color: var(--colors-semantic-border-focus);
      box-shadow: 0 0 0 1px var(--colors-semantic-border-focus);
    }
    .composer-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 var(--spacing-scale-1);
    }
    .modes {
      display: flex;
      gap: var(--spacing-scale-1);
      flex-wrap: wrap;
    }
    .modes button {
      background: transparent;
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-secondary);
      padding: 1px var(--spacing-scale-2);
      font-family: var(--typography-fontFamilies-data);
      font-size: 0.6rem;
      border-radius: 999px;
      cursor: pointer;
      transition: var(--transitions-fast);
    }
    .modes button[aria-pressed='true'] {
      background: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-text-on-accent);
      border-color: transparent;
    }
    .token-count {
      font-family: var(--typography-fontFamilies-data);
      font-size: 0.6rem;
      color: var(--colors-semantic-text-muted);
    }
    .actions {
      display: flex;
      gap: var(--spacing-scale-2);
      align-items: center;
    }
    .actions button {
      background: transparent;
      border: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-secondary);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-size: 0.7rem;
      border-radius: var(--borderRadius-component-button);
      cursor: pointer;
      font-family: var(--typography-fontFamilies-ui);
      transition: var(--transitions-fast);
      white-space: nowrap;
    }
    .actions button:hover {
      border-color: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary);
    }
    .send-btn {
      background: var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-text-on-accent);
      border: none;
      padding: var(--spacing-scale-3) var(--spacing-scale-5);
      font-weight: var(--typography-fontWeights-semibold);
      cursor: pointer;
      font-family: var(--typography-fontFamilies-ui);
      font-size: 0.8rem;
      border-radius: var(--borderRadius-component-button);
      transition: var(--transitions-fast);
    }
    .send-btn:hover {
      background: var(--colors-semantic-accent-primary-dim);
    }
    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .suggestions {
      background: var(--colors-semantic-bg-elevated);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-height: 160px;
      overflow-y: auto;
      margin-top: var(--spacing-scale-1);
    }
    .suggestion {
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data);
      font-size: 0.7rem;
      color: var(--colors-semantic-text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
    }
    .suggestion:hover,
    .suggestion.selected {
      background: var(--colors-semantic-bg-panel-hover);
    }
    .suggestion-type {
      font-size: 0.55rem;
      color: var(--colors-semantic-text-muted);
      text-transform: uppercase;
      padding: 1px 4px;
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 3px;
    }
    .decomposition {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-scale-1);
    }
    .segment {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-scale-1);
      max-width: 100%;
      padding: 1px var(--spacing-scale-2);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 999px;
      font-family: var(--typography-fontFamilies-data);
      font-size: 0.6rem;
      color: var(--colors-semantic-text-secondary);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis.
    }
    .segment-kind {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.55rem;
      color: var(--colors-semantic-text-muted);
    }
    .contexts {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      flex-wrap: wrap;
      padding: 2px 2px 0;
    }
    .context-label {
      color: var(--colors-semantic-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.55rem;
    }
    .context {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 var(--spacing-scale-2);
      border-radius: 999px;
      border: 1px solid var(--colors-semantic-accent-primary);
      font-family: var(--typography-fontFamilies-data);
      font-size: 0.65rem;
      color: var(--colors-semantic-text-secondary);
    }
    .context-title {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 32ch;
    }
    .context-clear {
      background: transparent;
      border: none;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      font-size: 0.85rem;
      line-height: 1;
      padding: 0;
    }
    .context-clear:hover {
      color: var(--colors-semantic-accent-primary);
    }
    .drag-handle {
      cursor: grab;
      padding: var(--spacing-scale-1);
      color: var(--colors-semantic-text-muted);
      font-size: 1rem;
      user-select: none;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
  `;

  @state() private composing = false;
  @state() private textareaValue = '';
  @state() private mode: ComposerMode = DEFAULT_COMPOSER_MODE;
  @state() private contextRefs: string[] = [];
  @state() private decomposition: InputSegment[] = [];
  @state() private showSuggestions = false;
  @state() private suggestionIndex = -1;
  @state() private suggestions: Suggestion[] = [];
  @state() private isDragging = false;
  @state() private position = { x: 0, y: 0 };
  @state() private isOpen = false;

  #unsubscribeFocus?: () => void;
  #dragStart = { x: 0, y: 0 };
  #positionStart = { x: 0, y: 0 };

  override connectedCallback() {
    super.connectedCallback();
    this.watch($streamingDelta);
    this.watch($graphNodes);
    this.watch($workspaceGraph);
    this.watchWith($capabilities, (capabilities) => {
      if (!availableComposerModes(capabilities).some((m) => m.id === this.mode)) {
        this.mode = DEFAULT_COMPOSER_MODE;
      }
    });
    this.#unsubscribeFocus = eventBus.on('composer:focus', this.onComposerFocus);
    eventBus.on('composer:open', this.onComposerOpen);
    eventBus.on('overlay:close', ({ id }) => {
      if (id === 'composer') this.close();
    });
  }

  override disconnectedCallback() {
    this.#unsubscribeFocus?.();
    window.removeEventListener('mousemove', this.#onDragMove);
    window.removeEventListener('mouseup', this.#onDragEnd);
    super.disconnectedCallback();
  }

  private onComposerFocus = ({ refs, mode }: { refs?: string[]; mode?: string }) => {
    if (refs?.length) this.contextRefs = [...new Set(refs)];
    if (mode && availableComposerModes($capabilities.get()).some((m) => m.id === mode)) {
      this.mode = mode as ComposerMode;
    }
    this.open();
    this.focusInput();
  };

  private onComposerOpen = ({ position, anchor }: { position?: { x: number; y: number }; anchor?: string }) => {
    if (position) this.position = position;
    this.open();
  };

  open(position?: { x: number; y: number }) {
    if (position) this.position = position;
    this.isOpen = true;
    this.style.left = `${this.position.x}px`;
    this.style.top = `${this.position.y}px`;
    this.requestUpdate();
    requestAnimationFrame(() => this.focusInput());
  }

  close() {
    this.isOpen = false;
    this.textareaValue = '';
    this.contextRefs = [];
    this.decomposition = [];
    this.composing = false;
    this.showSuggestions = false;
    this.requestUpdate();
  }

  toggle(position?: { x: number; y: number }) {
    if (this.isOpen) this.close();
    else this.open(position);
  }

  focusInput = () => {
    requestAnimationFrame(() => {
      const ta = this.shadowRoot?.querySelector('textarea');
      (ta as HTMLTextAreaElement | undefined)?.focus();
    });
  };

  override render() {
    if (!this.isOpen) return html``;

    const streamingDelta = $streamingDelta.get();
    const tokens = estimateTokens(this.textareaValue);
    const hasContent = !!(streamingDelta || this.textareaValue.trim());
    const canHistoryUp = inputHistory.length > 0;
    const graph = $workspaceGraph.get();
    const contexts = this.contextRefs.map((id) => ({ id, block: graph.blocks.get(id) }));

    return html`
      <div class="composer ${this.isDragging ? 'dragging' : ''}">
        <div class="composer-header">
          <div class="drag-handle" title="Drag to move" @mousedown=${this.#onDragStart}>⋮⋮</div>
          <span class="composer-title">Composer</span>
          <button class="composer-close" @click=${this.close} aria-label="Close composer">✕</button>
        </div>
        <div class="input-wrapper">
          ${this.showSuggestions ? html`
            <div class="suggestions">
              ${this.suggestions.map(
                (s, i) => html`
                <div class="suggestion ${classMap({ selected: i === this.suggestionIndex })}"
                  @mousedown=${() => this.applySuggestion(s)}
                  @mouseenter=${() => (this.suggestionIndex = i)}>
                  <span class="suggestion-type">${s.type}</span>
                  <span>${s.label}</span>
                </div>
              `
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
              setTimeout(() => {
                this.showSuggestions = false;
              }, 200);
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
          <button @click=${() => {
            if (canHistoryUp) {
              historyIndex = Math.max(0, historyIndex - 1);
              this.textareaValue = inputHistory[historyIndex] ?? '';
            }
          }} ?disabled=${!canHistoryUp} title="History">▲</button>
          <button class="send-btn" @click=${this.sendMessage} ?disabled=${!hasContent}>Send</button>
        </div>
      </div>
    `;
  }

  #onDragStart = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.drag-handle') && !target.closest('.composer-header')) return;

    e.preventDefault();
    this.isDragging = true;
    this.#dragStart = { x: e.clientX, y: e.clientY };
    this.#positionStart = { ...this.position };
    this.style.cursor = 'grabbing';
    window.addEventListener('mousemove', this.#onDragMove);
    window.addEventListener('mouseup', this.#onDragEnd);
  };

  #onDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.#dragStart.x;
    const dy = e.clientY - this.#dragStart.y;
    this.position = {
      x: this.#positionStart.x + dx,
      y: this.#positionStart.y + dy,
    };
    this.style.left = `${this.position.x}px`;
    this.style.top = `${this.position.y}px`;
  };

  #onDragEnd = () => {
    this.isDragging = false;
    this.style.cursor = '';
    window.removeEventListener('mousemove', this.#onDragMove);
    window.removeEventListener('mouseup', this.#onDragEnd);
  };

  private autoResize(ta: HTMLTextAreaElement) {
    ta.style.height = '44px';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  private getSuggestions(text: string): Suggestion[] {
    const cursor =
      (this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement)?.selectionStart ??
      text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);

    const slashMatch = before.match(/(^|\s)(\/\w*)$/);
    const slashPrefix = slashMatch?.[2];
    if (slashPrefix) {
      const query = slashPrefix.toLowerCase();
      return SLASH_COMMANDS.filter((c) => c.id.startsWith(query)).map((c) => ({
        id: c.id,
        label: c.label,
        type: 'slash' as const,
      }));
    }

    const atMatch = before.match(/(^|\s)(@\w*)$/);
    const atPrefix = atMatch?.[2];
    if (atPrefix) {
      const query = atPrefix.slice(1).toLowerCase();
      const nodes = $graphNodes.get();
      return [...nodes.entries()]
        .filter(
          ([_, n]) =>
            n && (n.label?.toLowerCase().includes(query) || n.term?.toLowerCase().includes(query))
        )
        .slice(0, 10)
        .map(([id, n]) => ({ id, label: n.term ?? n.label ?? id, type: 'mention' as const }));
    }

    return [];
  }

  private applySuggestion(sug: Suggestion) {
    const ta = this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement;
    const cursor = ta?.selectionStart ?? this.textareaValue.length;
    const before = this.textareaValue.slice(0, cursor);
    const prefix =
      sug.type === 'slash'
        ? before.replace(/\/\w*$/, sug.id)
        : before.replace(/@\w*$/, `@${sug.label} `);
    this.textareaValue = prefix + this.textareaValue.slice(cursor);
    this.showSuggestions = false;
    this.suggestions = [];
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        this.autoResize(ta);
      }
    });
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

    // Structured modes (believe, goal) route through the reasoning backend
    const isStructured = this.mode === 'believe' || this.mode === 'goal';
    const control = capabilityGate('reasoning') ? narsBackend.control : undefined;

    if (isStructured && control) {
      const segments = this.decomposition.filter((s) => s.kind === 'claim');
      for (const segment of segments) {
        await control.submit({
          term: segment.text,
          mode: this.mode === 'believe' ? 'belief' : 'goal',
        });
      }
      // Also add to chat for history
      addUserMessage(content, this.mode, this.contextRefs);
      send({ type: 'chat.user', content, mode: this.mode, contexts: this.contextRefs });
    } else {
      // Language modes: regular chat path
      addUserMessage(content, this.mode, this.contextRefs);
      send({ type: 'chat.user', content, mode: this.mode, contexts: this.contextRefs });
    }

    this.textareaValue = '';
    this.contextRefs = [];
    this.decomposition = [];
    this.composing = false;
    this.showSuggestions = false;
    this.close();
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
      e.preventDefault();
      this.sendMessage();
      return;
    }

    if (e.key === 'Escape') {
      if (this.showSuggestions) {
        this.showSuggestions = false;
        this.suggestions = [];
        return;
      }
      ta.blur();
      this.close();
      return;
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
          const sug = this.suggestions[this.suggestionIndex];
          if (sug) this.applySuggestion(sug);
        }
        return;
      }
    }

    if (e.key === 'ArrowUp' && !ta.value) {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        this.textareaValue = inputHistory[historyIndex] ?? '';
        requestAnimationFrame(() => this.autoResize(ta));
      }
      return;
    }

    if (e.key === 'ArrowDown' && !ta.value && historyIndex < inputHistory.length - 1) {
      e.preventDefault();
      historyIndex++;
      this.textareaValue = inputHistory[historyIndex] ?? '';
      requestAnimationFrame(() => this.autoResize(ta));
      return;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'composer-focus': ComposerFocus;
  }
}

registerCommand({
  id: 'composer.focus',
  title: 'Focus composer',
  group: 'Compose',
  keywords: 'input ask type message mode',
  run: (args) =>
    eventBus.emit('composer:focus', {
      refs: args?.refs as string[] | undefined,
      mode: args?.mode as string | undefined,
    }),
});

registerCommand({
  id: 'composer.open',
  title: 'Open composer at position',
  group: 'Compose',
  keywords: 'composer open position',
  run: (args) =>
    eventBus.emit('composer:open', {
      position: args?.position as { x: number; y: number } | undefined,
      anchor: args?.anchor as string | undefined,
    }),
  parse: (args) => ({
    position: args?.position as { x: number; y: number } | undefined,
    anchor: args?.anchor as string | undefined,
  }),
});

registerCommand({
  id: 'composer.close',
  title: 'Close composer',
  group: 'Compose',
  keywords: 'composer close dismiss',
  run: () => {
    const composer = document.querySelector('composer-focus');
    (composer as ComposerFocus | null)?.close();
  },
});