import DOMPurify from 'dompurify';
import {css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {marked} from 'marked';
import type {ChatMessage} from '../../shared/protocol.js';
import {$chatMessages, $focusTerm, $streamingDelta, BaseComponent, send} from '../core/index.js';

@customElement('chat-history-panel')
export class ChatHistoryPanel extends BaseComponent {
    static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; }
    .chat-scroll { flex: 1; overflow-y: auto; padding: var(--spacing-scale-2); display: flex; flex-direction: column; gap: var(--spacing-scale-3); }
    .chat-scroll::-webkit-scrollbar { width: 4px; }
    .chat-scroll::-webkit-scrollbar-thumb { background: var(--colors-semantic-border-default); border-radius: 2px; }

    .message { display: flex; flex-direction: column; gap: var(--spacing-scale-1); animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .msg-header { display: flex; align-items: center; gap: var(--spacing-scale-2); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .msg-role { font-family: var(--typography-fontFamilies-data); text-transform: uppercase; font-weight: var(--typography-fontWeights-semibold); letter-spacing: 0.05em; }
    .msg-time { font-family: var(--typography-fontFamilies-data); font-size: 0.6rem; }
    .msg-body { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); line-height: 1.6; color: var(--colors-semantic-text-primary); white-space: pre-wrap; word-break: break-word; }
    .msg-body.user { color: var(--colors-semantic-accent-primary); }
    .msg-body.system { color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); font-size: 0.65rem; }
    .msg-body.agent { background: var(--colors-semantic-bg-panel); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); padding: var(--spacing-scale-3); }
    .msg-body.agent :first-child { margin-top: 0; }
    .msg-body.agent :last-child { margin-bottom: 0; }
    .msg-body.agent p { margin: 0.5em 0; }
    .msg-body.agent code { background: var(--colors-semantic-bg-base); padding: 1px 4px; border-radius: 3px; font-family: var(--typography-fontFamilies-data); font-size: 0.75rem; }
    .msg-body.agent pre code { display: block; padding: var(--spacing-scale-3); overflow-x: auto; }
    .msg-body.agent ul, .msg-body.agent ol { padding-left: var(--spacing-scale-4); }

    .msg-actions { display: flex; gap: var(--spacing-scale-1); opacity: 0; transition: var(--transitions-fast); }
    .message:hover .msg-actions { opacity: 1; }
    .msg-actions button { background: transparent; border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-muted); padding: 1px 6px; font-size: 0.6rem; border-radius: var(--borderRadius-component-button); cursor: pointer; font-family: var(--typography-fontFamilies-ui); transition: var(--transitions-fast); }
    .msg-actions button:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }

    .streaming { position: relative; }
    .streaming::after { content: '▊'; animation: blink 0.8s step-end infinite; color: var(--colors-semantic-accent-primary); }
    @keyframes blink { 50% { opacity: 0; } }

    .empty { display: flex; align-items: center; justify-content: center; height: 100%; }
    .divider { display: flex; align-items: center; gap: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: 0.6rem; padding: var(--spacing-scale-1) 0; }
    .divider-line { flex: 1; height: 1px; background: var(--colors-semantic-border-subtle); }

    .focus-btn { cursor: pointer; color: var(--colors-semantic-accent-primary); text-decoration: underline; text-decoration-style: dotted; transition: var(--transitions-fast); }
    .focus-btn:hover { color: var(--colors-semantic-accent-primary-dim); }
  `;
    @state() private autoScroll = true;

    override connectedCallback() {
        super.connectedCallback();
        this.watch($chatMessages);
        this.watch($streamingDelta);
    }

    override updated() {
        if (this.autoScroll) this.scrollToBottom();
    }

    override render() {
        const messages = $chatMessages.get();
        const streaming = $streamingDelta.get();
        const hasContent = messages.length > 0 || streaming;

        if (!hasContent) {
            return html`
        <div class="empty">
          <s-empty-state icon="💬" heading="No messages" description="Ask a question to start a conversation" size="sm"></s-empty-state>
        </div>`;
        }

        return html`
      <div class="chat-scroll" @scroll=${this.handleScroll}>
        ${messages.map((msg, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const prevDay = prev ? new Date(prev.timestamp).toDateString() : null;
            const curDay = new Date(msg.timestamp).toDateString();
            const showDivider = prevDay && prevDay !== curDay;
            return html`
            ${showDivider ? html`<div class="divider"><span class="divider-line"></span>${curDay}</div>` : ''}
            ${this.renderMessage(msg)}`;
        })}
        ${
            streaming
                ? html`
          <div class="message streaming">
            <div class="msg-header">
              <span class="msg-role">agent</span>
              <span class="msg-time">streaming</span>
            </div>
            <div class="msg-body agent">${streaming}</div>
          </div>
        `
                : ''
        }
      </div>`;
    }

    private scrollToBottom() {
        requestAnimationFrame(() => {
            const scroll = this.shadowRoot?.querySelector('.chat-scroll');
            if (scroll) scroll.scrollTop = scroll.scrollHeight;
        });
    }

    private handleScroll(e: Event) {
        const el = e.target as HTMLElement;
        this.autoScroll = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }

    private formatTime(ts: number): string {
        const d = new Date(ts);
        return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }

    private renderMarkdown(content: string): string {
        const raw = marked.parse(content, {async: false}) as string;
        return DOMPurify.sanitize(raw);
    }

    private focusTerm(term: string) {
        $focusTerm.set(term);
        send({type: 'focus.set', term});
    }

    private async copyMessage(msg: ChatMessage) {
        try {
            await navigator.clipboard.writeText(msg.content);
        } catch {
            /* clipboard unavailable */
        }
    }

    private regenerate(msg: ChatMessage) {
        send({type: 'chat.user', content: msg.content});
    }

    private renderMessage(msg: ChatMessage): unknown {
        const isAgent = msg.role === 'agent';
        const content = isAgent ? this.renderMarkdown(msg.content) : msg.content;
        const focusTerm = msg.term;
        const hasFocusTerm = !!focusTerm;

        return html`
      <div class="message">
        <div class="msg-header">
          <span class="msg-role">${msg.role}</span>
          <span class="msg-time">${this.formatTime(msg.timestamp)}</span>
          ${
            hasFocusTerm
                ? html`
            <span class="focus-btn" @click=${() => this.focusTerm(msg.term!)}>@${msg.term}</span>
          `
                : ''
        }
        </div>
        <div class="msg-body ${classMap({[msg.role]: true})}">
          ${isAgent ? unsafeHTML(content) : content}
        </div>
        <div class="msg-actions">
          <button @click=${() => this.copyMessage(msg)} title="Copy">Copy</button>
          ${isAgent ? html`<button @click=${() => this.regenerate(msg)} title="Regenerate">Regenerate</button>` : ''}
        </div>
      </div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'chat-history-panel': ChatHistoryPanel;
    }
}
