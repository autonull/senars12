import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { $chat, $streamingDelta, $selectedMessageId, $focusTerm, mountTestApi } from '../core/store.js';
import { send } from '../core/ws-client.js';
import { addUserMessage } from '../core/store-bindings.js';
import { BaseComponent } from '../core/base-component.js';

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    return hljs.highlightAuto(code, lang ? [lang] : undefined).value;
  },
}));

@customElement('chat-console')
export class ChatConsole extends BaseComponent {
  static override styles = css`
    :host { display: flex; flex-direction: column; background: var(--bg-panel); border: 1px solid var(--border-dim); }
    .messages { flex: 1; overflow-y: auto; padding: 0.75rem; font-family: var(--font-ui); }
    .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); font-family: var(--font-data); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
    .msg { margin-bottom: 0.75rem; line-height: 1.6; font-size: 0.85rem; cursor: pointer; transition: opacity 0.2s; }
    .msg:hover { opacity: 0.8; }
    .msg.user { color: var(--accent-cyan); font-weight: 500; }
    .msg.agent { color: var(--text-primary); }
    .msg.selected { border-left: 2px solid var(--accent-cyan); padding-left: 0.5rem; }
    .msg pre { background: var(--bg-void); padding: 0.75rem; border-radius: 4px; border-left: 2px solid var(--accent-amber); overflow-x: auto; margin: 0.5rem 0; }
    .msg code { font-family: var(--font-data); font-size: 0.85em; }
    .cursor { animation: blink 1s step-end infinite; color: var(--accent-cyan); }
    @keyframes blink { 50% { opacity: 0; } }
    .input-area { display: flex; padding: 0.5rem; border-top: 1px solid var(--border-dim); background: var(--bg-panel-solid); }
    input { flex: 1; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.5rem 0.75rem; font-family: var(--font-data); font-size: 0.8rem; outline: none; }
    input:focus { border-color: var(--accent-cyan); box-shadow: var(--glow-cyan); }
    button { background: var(--accent-cyan); color: var(--bg-void); border: none; padding: 0 1rem; font-weight: bold; cursor: pointer; font-family: var(--font-ui); font-size: 0.8rem; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($chat);
    this.watch($streamingDelta);
    mountTestApi('chat', {
      getMessages: () => $chat.get(),
      getStreamingDelta: () => $streamingDelta.get(),
    });
  }

  private renderMarkdown = (text: string) => {
    const clean = DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
    return html`<div .innerHTML=${clean}></div>`;
  };

  private sendMessage() {
    const input = this.shadowRoot!.querySelector('input') as HTMLInputElement;
    const content = input.value.trim();
    if (!content) return;
    addUserMessage(content);
    send({ type: 'chat.user', content });
    input.value = '';
  }

  private onMessageClick(index: number) {
    const msgs = $chat.get();
    const msg = msgs[index];
    if (!msg) return;
    $selectedMessageId.set(msg.id);
    $focusTerm.set(msg.term ?? msg.content.slice(0, 40));
  }

  override render() {
    const msgs = $chat.get();
    const delta = $streamingDelta.get();
    const hasMessages = msgs.length > 0 || delta;
    return html`
      <div class="messages">
        ${!hasMessages ? html`<div class="empty">Awaiting signal...</div>` : ''}
        ${msgs.map((m, i) => html`
          <div class="msg ${m.role}" data-testid="message" data-role="${m.role}" @click=${() => this.onMessageClick(i)}>
            ${this.renderMarkdown(m.content)}
          </div>`)}
        ${delta ? html`<div class="msg agent" data-testid="message" data-role="agent">${this.renderMarkdown(delta)}<span class="cursor">▊</span></div>` : ''}
      </div>
      <div class="input-area">
        <input @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.sendMessage()} placeholder="Query the agent..." />
        <button @click=${() => this.sendMessage()}>SEND</button>
      </div>
    `;
  }
}
