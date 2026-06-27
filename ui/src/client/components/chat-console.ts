import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { $chat, $streamingDelta } from '../core/store.js';
import { send } from '../core/ws-client.js';

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code: string, lang: string) {
    return hljs.highlightAuto(code, lang ? [lang] : undefined).value;
  },
}));

@customElement('chat-console')
export class ChatConsole extends LitElement {
  private unsubChat = $chat.subscribe(() => this.requestUpdate());
  private unsubStream = $streamingDelta.subscribe(() => this.requestUpdate());

  static override styles = css`
    :host { display: flex; flex-direction: column; background: var(--bg-panel); border: 1px solid var(--border-dim); }
    .messages { flex: 1; overflow-y: auto; padding: 0.75rem; font-family: var(--font-ui); }
    .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); font-family: var(--font-data); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
    .msg { margin-bottom: 0.75rem; line-height: 1.6; font-size: 0.85rem; }
    .msg.user { color: var(--accent-cyan); font-weight: 500; }
    .msg.agent { color: var(--text-primary); }
    .msg pre { background: var(--bg-void); padding: 0.75rem; border-radius: 4px; border-left: 2px solid var(--accent-amber); overflow-x: auto; margin: 0.5rem 0; }
    .msg code { font-family: var(--font-data); font-size: 0.85em; }
    .cursor { animation: blink 1s step-end infinite; color: var(--accent-cyan); }
    @keyframes blink { 50% { opacity: 0; } }
    .input-area { display: flex; padding: 0.5rem; border-top: 1px solid var(--border-dim); background: var(--bg-panel-solid); }
    input { flex: 1; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.5rem 0.75rem; font-family: var(--font-data); font-size: 0.8rem; outline: none; }
    input:focus { border-color: var(--accent-cyan); box-shadow: var(--glow-cyan); }
    button { background: var(--accent-cyan); color: var(--bg-void); border: none; padding: 0 1rem; font-weight: bold; cursor: pointer; font-family: var(--font-ui); font-size: 0.8rem; }
  `;

  override disconnectedCallback() {
    this.unsubChat();
    this.unsubStream();
    super.disconnectedCallback();
  }

  private renderMarkdown(text: string) {
    const raw = marked.parse(text, { async: false }) as string;
    const clean = DOMPurify.sanitize(raw);
    return html`<div .innerHTML=${clean}></div>`;
  }

  private sendMessage() {
    const input = this.shadowRoot!.querySelector('input')!;
    const content = input.value.trim();
    if (!content) return;
    $chat.set([...$chat.get(), { role: 'user', content }]);
    send({ type: 'chat.user', content });
    input.value = '';
  }

  override render() {
    const msgs = $chat.get();
    const delta = $streamingDelta.get();
    const hasMessages = msgs.length > 0 || delta;
    return html`
      <div class="messages">
        ${!hasMessages ? html`<div class="empty">Awaiting signal...</div>` : ''}
        ${msgs.map(m => html`<div class="msg ${m.role}">${this.renderMarkdown(m.content)}</div>`)}
        ${delta ? html`<div class="msg agent">${this.renderMarkdown(delta)}<span class="cursor">▊</span></div>` : ''}
      </div>
      <div class="input-area">
        <input @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.sendMessage()} placeholder="Query the agent..." />
        <button @click=${this.sendMessage}>SEND</button>
      </div>
    `;
  }
}
