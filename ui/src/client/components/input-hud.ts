import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $streamingDelta } from '../core/store.js';
import { send } from '../core/ws-client.js';
import { addUserMessage } from '../core/store-bindings.js';
import { BaseComponent } from '../core/base-component.js';

@customElement('input-hud')
export class InputHUD extends BaseComponent {
  @state() private composing = false;
  @state() private textareaValue = '';

  static override styles = css`
    :host { display: block; position: fixed; bottom: 0; left: 0; right: 0; z-index: 200; }
    .hud-input { background: var(--bg-panel-solid); border-top: 1px solid var(--border-dim); padding: 8px 12px; display: flex; gap: 8px; max-width: 900px; margin: 0 auto; }
    .input-wrapper { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .model-select { font-family: var(--font-data); font-size: 0.7rem; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 4px 8px; border-radius: 3px; }
    textarea { background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 8px 12px; font-family: var(--font-ui); font-size: 0.85rem; line-height: 1.5; border-radius: 6px; resize: none; outline: none; transition: border-color 0.2s, box-shadow 0.2s; min-height: 44px; }
    textarea:focus { border-color: var(--accent-cyan); box-shadow: var(--glow-cyan); }
    .send-btn { align-self: flex-end; background: var(--accent-cyan); color: var(--bg-void); border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-family: var(--font-ui); font-size: 0.8rem; border-radius: 4px; transition: background 0.2s; }
    .send-btn:hover { background: #00d0d8; }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  private sendMessage() {
    const content = this.textareaValue.trim();
    if (!content) return;
    addUserMessage(content);
    send({ type: 'chat.user', content });
    this.textareaValue = '';
    this.composing = false;
  }

  private onInput(e: Event) {
    this.textareaValue = (e.target as HTMLTextAreaElement).value;
  }

  override render() {
    const streamingDelta = $streamingDelta.get();
    return html`
      <div class="hud-input">
        <div class="input-wrapper">
          <select class="model-select" @change=${(e: Event) => this.model = (e.target as HTMLSelectElement).value}>
            <option value="WebLLM">🧠 WebLLM</option>
            <option value="Ollama">🦙 Ollama</option>
            <option value="OpenAI">🔗 OpenAI</option>
          </select>
          <textarea
            class="chat-input"
            placeholder="Ask SeNARS…"
            .value=${streamingDelta || this.textareaValue}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }}}
            @focus=${() => this.composing = true}
            @blur=${() => this.composing = false}
            @input=${this.onInput}
            style="height: ${this.composing ? '120px' : '44px'}"
          ></textarea>
        </div>
        <button class="send-btn" @click=${() => this.sendMessage()} ?disabled=${!(streamingDelta || this.textareaValue.trim())}>Send</button>
      </div>
    `;
  }

  @state() private model = 'WebLLM';
}