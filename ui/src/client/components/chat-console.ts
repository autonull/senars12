import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { wsClient } from '../core/ws-client.js';

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code: string, lang: string) {
    return hljs.highlightAuto(code, lang ? [lang] : undefined).value;
  },
}));

@customElement('chat-console')
export class ChatConsole extends LitElement {
  @state() private messages: { role: 'user' | 'agent'; content: string }[] = [];
  @state() private streamingContent = '';

  private onStream = (msg: { delta: string }) => { this.streamingContent += msg.delta; };
  private onComplete = (msg: { content: string }) => {
    this.messages = [...this.messages, { role: 'agent', content: this.streamingContent || msg.content }];
    this.streamingContent = '';
  };

  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; background: var(--bg-panel); border: 1px solid var(--border-dim); }
    .messages { flex: 1; overflow-y: auto; padding: 1rem; font-family: var(--font-ui); }
    .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); font-family: var(--font-data); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
    .msg { margin-bottom: 1rem; line-height: 1.6; }
    .msg.user { color: var(--accent-cyan); font-weight: 500; }
    .msg.agent { color: var(--text-primary); }
    .msg pre { background: var(--bg-void); padding: 1rem; border-radius: 4px; border-left: 2px solid var(--accent-amber); overflow-x: auto; }
    .msg code { font-family: var(--font-data); font-size: 0.9em; }
    .cursor { animation: blink 1s step-end infinite; color: var(--accent-cyan); }
    @keyframes blink { 50% { opacity: 0; } }
    .input-area { display: flex; padding: 1rem; border-top: 1px solid var(--border-dim); background: var(--bg-panel-solid); }
    input { flex: 1; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.75rem; font-family: var(--font-data); outline: none; }
    input:focus { border-color: var(--accent-cyan); box-shadow: var(--glow-cyan); }
    input:disabled { opacity: 0.4; }
    button { background: var(--accent-cyan); color: var(--bg-void); border: none; padding: 0 1.5rem; font-weight: bold; cursor: pointer; font-family: var(--font-ui); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    wsClient.on('chat.agent.stream', this.onStream);
    wsClient.on('chat.agent.complete', this.onComplete);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    wsClient.off('chat.agent.stream', this.onStream);
    wsClient.off('chat.agent.complete', this.onComplete);
  }

  private renderMarkdown(text: string) {
    const raw = marked.parse(text, { async: false }) as string;
    const clean = DOMPurify.sanitize(raw);
    return html`<div class="markdown-body" .innerHTML=${clean}></div>`;
  }

  override render() {
    const hasMessages = this.messages.length > 0 || this.streamingContent;
    return html`
      <div class="messages">
        ${!hasMessages ? html`<div class="empty">Awaiting signal...</div>` : ''}
        ${this.messages.map(m => html`<div class="msg ${m.role}">${this.renderMarkdown(m.content)}</div>`)}
        ${this.streamingContent ? html`<div class="msg agent">${this.renderMarkdown(this.streamingContent)}<span class="cursor">▊</span></div>` : ''}
      </div>
      <div class="input-area">
        <input @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.sendMsg()} placeholder="Query the agent..." />
        <button @click=${this.sendMsg}>SEND</button>
      </div>
    `;
  }

  private sendMsg() {
    const input = this.shadowRoot?.querySelector('input');
    if (!input?.value) return;
    this.messages = [...this.messages, { role: 'user', content: input.value }];
    wsClient.send({ type: 'chat.user', content: input.value });
    input.value = '';
  }
}
