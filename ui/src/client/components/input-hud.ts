import {css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {$graphNodes, $streamingDelta, addUserMessage, BaseComponent, send} from '../core/index.js';

interface SlashCommand {
    id: string;
    label: string;
    action: () => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
    {
        id: '/lens',
        label: '/lens belief|goal|contradiction — Switch cognitive lens',
        action: () => {
        },
    },
    {
        id: '/focus', label: '/focus <term> — Focus on a concept', action: () => {
        }
    },
    {
        id: '/config', label: '/config <key> <value> — Set a config value', action: () => {
        }
    },
    {
        id: '/clear',
        label: '/clear — Clear chat history',
        action: () => {
            location.reload();
        },
    },
    {
        id: '/help', label: '/help — Show available commands', action: () => {
        }
    },
];

const MAX_HISTORY = 50;

interface Suggestion {
    id: string;
    label: string;
    type: 'slash' | 'mention';
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

const inputHistory: string[] = [];
let historyIndex = -1;

@customElement('input-hud')
export class InputHUD extends BaseComponent {
    static override styles = css`
    :host { display: block; position: fixed; bottom: 0; left: 0; right: 0; z-index: var(--zIndex-layers-panel); }
    .hud-input { background: var(--colors-semantic-bg-panel-solid); border-top: 1px solid var(--colors-semantic-border-subtle); padding: var(--spacing-scale-2) var(--spacing-scale-4); display: flex; gap: var(--spacing-scale-3); align-items: flex-end; max-width: 900px; margin: 0 auto; }
    .input-wrapper { flex: 1; display: flex; flex-direction: column; gap: var(--spacing-scale-1); position: relative; }
    textarea { background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-primary); padding: var(--spacing-scale-3) var(--spacing-scale-4); font-family: var(--typography-fontFamilies-ui); font-size: 0.85rem; line-height: 1.5; border-radius: 6px; resize: none; outline: none; transition: var(--transitions-fast); min-height: 44px; max-height: 200px; overflow-y: auto; }
    textarea:focus { border-color: var(--colors-semantic-border-focus); box-shadow: 0 0 0 1px var(--colors-semantic-border-focus); }

    .hud-footer { display: flex; justify-content: space-between; align-items: center; padding: 0 2px; }
    .slash-hints { font-family: var(--typography-fontFamilies-data); font-size: 0.6rem; color: var(--colors-semantic-text-muted); }
    .slash-hints span { cursor: default; }
    .slash-hints .key { color: var(--colors-semantic-text-secondary); }
    .token-count { font-family: var(--typography-fontFamilies-data); font-size: 0.6rem; color: var(--colors-semantic-text-muted); }

    .actions { display: flex; gap: var(--spacing-scale-2); align-items: center; }
    .actions button { background: transparent; border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-secondary); padding: var(--spacing-scale-2) var(--spacing-scale-3); font-size: 0.7rem; border-radius: var(--borderRadius-component-button); cursor: pointer; font-family: var(--typography-fontFamilies-ui); transition: var(--transitions-fast); white-space: nowrap; }
    .actions button:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    .send-btn { background: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-on-accent); border: none; padding: var(--spacing-scale-3) var(--spacing-scale-5); font-weight: var(--typography-fontWeights-semibold); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: 0.8rem; border-radius: var(--borderRadius-component-button); transition: var(--transitions-fast); }
    .send-btn:hover { background: var(--colors-semantic-accent-primary-dim); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .suggestions { position: absolute; bottom: 100%; left: 0; right: 0; background: var(--colors-semantic-bg-elevated); border: 1px solid var(--colors-semantic-border-default); border-radius: 6px 6px 0 0; box-shadow: 0 -4px 12px rgba(0,0,0,0.3); max-height: 160px; overflow-y: auto; z-index: var(--zIndex-layers-tooltip); }
    .suggestion { padding: var(--spacing-scale-2) var(--spacing-scale-3); font-family: var(--typography-fontFamilies-data); font-size: 0.7rem; color: var(--colors-semantic-text-primary); cursor: pointer; display: flex; align-items: center; gap: var(--spacing-scale-2); }
    .suggestion:hover, .suggestion.selected { background: var(--colors-semantic-bg-panel-hover); }
    .suggestion-type { font-size: 0.55rem; color: var(--colors-semantic-text-muted); text-transform: uppercase; padding: 1px 4px; border: 1px solid var(--colors-semantic-border-subtle); border-radius: 3px; }
  `;
    @state() private composing = false;
    @state() private textareaValue = '';
    @state() private showSuggestions = false;
    @state() private suggestionIndex = -1;
    @state() private suggestions: Suggestion[] = [];

    override connectedCallback() {
        super.connectedCallback();
        this.watch($streamingDelta);
        this.watch($graphNodes);
    }

    focusInput() {
        requestAnimationFrame(() => {
            const ta = this.shadowRoot?.querySelector('textarea');
            (ta as HTMLTextAreaElement | undefined)?.focus();
        });
    }

    override render() {
        const streamingDelta = $streamingDelta.get();
        const tokens = estimateTokens(this.textareaValue);
        const hasContent = !!(streamingDelta || this.textareaValue.trim());
        const canHistoryUp = inputHistory.length > 0;

        return html`
      <div class="hud-input">
        <div class="input-wrapper">
          ${
            this.showSuggestions
                ? html`
            <div class="suggestions">
              ${this.suggestions.map(
                    (s, i) => html`
                <div class="suggestion ${classMap({selected: i === this.suggestionIndex})}"
                  @mousedown=${() => this.applySuggestion(s)}
                  @mouseenter=${() => (this.suggestionIndex = i)}>
                  <span class="suggestion-type">${s.type}</span>
                  <span>${s.label}</span>
                </div>
              `
                )}
            </div>
          `
                : ''
        }
          <textarea
            class="chat-input"
            placeholder="Ask SeNARS…"
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
          <div class="hud-footer">
            <span class="slash-hints">Slash: ${SLASH_COMMANDS.map((c) => html`<span class="key">${c.id}</span>`).reduce((a, b) => html`${a} ${b}`)}</span>
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
                .map(([id, n]) => ({id, label: n.term ?? n.label ?? id, type: 'mention' as const}));
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

    private sendMessage() {
        const content = this.textareaValue.trim();
        if (!content) return;
        inputHistory.push(content);
        if (inputHistory.length > MAX_HISTORY) inputHistory.shift();
        historyIndex = inputHistory.length;
        addUserMessage(content);
        send({type: 'chat.user', content});
        this.textareaValue = '';
        this.composing = false;
        this.showSuggestions = false;
    }

    private onInput(e: Event) {
        const ta = e.target as HTMLTextAreaElement;
        this.textareaValue = ta.value;
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
        'input-hud': InputHUD;
    }
}
