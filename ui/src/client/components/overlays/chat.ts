/**
 * Chat overlay — conversation history using the ViewSpec system.
 * Legacy chat surface bridged to overlay + embedded view.
 */

import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { $chatMessages, $streamingDelta, BaseComponent, send } from '../../core/index.js';
import type { ChatMessage } from '@senars/core';
import { viewSource } from '../../core/view-sources.js';
import type { Shape, ViewSpec } from '../../core/view-spec.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

@customElement('s-chat')
export class ChatView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 14vh; left: 50%; transform: translateX(-50%); width: min(700px, 94vw); height: min(600px, 70vh); z-index: 1; }
    :host([hidden]) { display: none; }
    :host([data-pinned]) { position: fixed; top: var(--chat-y, 14vh); left: var(--chat-x, 50%); transform: var(--chat-transform, translateX(-50%)); width: var(--chat-w, min(700px, 94vw)); height: var(--chat-h, min(600px, 70vh)); z-index: 1; }
    .panel { display: flex; flex-direction: column; height: 100%; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    .header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { font-weight: var(--typography-fontWeights-semibold); }
    .count { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .toolbar { display: flex; gap: var(--spacing-scale-1); margin-left: auto; }
    .filter { display: flex; gap: var(--spacing-scale-1); padding: var(--spacing-scale-1) var(--spacing-scale-2); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .filter-btn { padding: 2px 8px; border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); transition: var(--transitions-fast); }
    .filter-btn.active { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); background: var(--colors-semantic-accent-subtle); }
    .filter-btn:hover:not(.active) { border-color: var(--colors-semantic-border-default); color: var(--colors-semantic-text-primary); }
    .content { flex: 1; overflow: auto; }
    .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--colors-semantic-text-muted); }
    .message { display: flex; flex-direction: column; gap: var(--spacing-scale-1); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .msg-header { display: flex; align-items: center; gap: var(--spacing-scale-2); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .msg-role { font-family: var(--typography-fontFamilies-data); text-transform: uppercase; font-weight: var(--typography-fontWeights-semibold); letter-spacing: 0.05em; }
    .msg-role.user { color: var(--colors-semantic-accent-cyan); }
    .msg-role.agent { color: var(--colors-semantic-accent-violet); }
    .msg-time { font-family: var(--typography-fontFamilies-data); font-size: 0.6rem; }
    .msg-body { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); line-height: 1.6; color: var(--colors-semantic-text-primary); white-space: pre-wrap; word-break: break-word; }
    .msg-body.agent { background: var(--colors-semantic-bg-panel); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); padding: var(--spacing-scale-3); }
    .msg-body.agent :first-child { margin-top: 0; }
    .msg-body.agent :last-child { margin-bottom: 0; }
    .msg-body.agent code { background: var(--colors-semantic-bg-base); padding: 1px 4px; border-radius: 3px; font-family: var(--typography-fontFamilies-data); font-size: 0.75rem; }
    .msg-body.agent pre code { display: block; padding: var(--spacing-scale-3); overflow-x: auto; }
    .streaming { position: relative; }
    .streaming::after { content: '▊'; animation: blink 0.8s step-end infinite; color: var(--colors-semantic-accent-primary); }
    @keyframes blink { 50% { opacity: 0; } }
    .actions { display: flex; gap: var(--spacing-scale-1); opacity: 0; transition: var(--transitions-fast); }
    .message:hover .actions { opacity: 1; }
    .action-btn { background: transparent; border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-muted); padding: 1px 6px; font-size: var(--typography-scale-xs); border-radius: var(--borderRadius-component-button); cursor: pointer; font-family: var(--typography-fontFamilies-ui); transition: var(--transitions-fast); }
    .action-btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    s-view { height: 100%; }
  `;

  @state() private filterRole: 'all' | 'user' | 'agent' = 'all';
  @state() private viewShape: Shape = 'tree';
  @state() private autoScroll = true;
  @property({ type: Boolean }) embedded = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($chatMessages);
    this.watch($streamingDelta);
  }

  private getFilteredMessages(): ChatMessage[] {
    const messages = $chatMessages.get();
    if (this.filterRole === 'all') return messages;
    return messages.filter((m) => m.role === this.filterRole);
  }

  private getViewSpec(): ViewSpec {
    const messages = this.getFilteredMessages();
    const treeData = {
      kind: 'tree' as const,
      roots: messages.map((msg) => ({
        id: msg.id,
        label: `${msg.role}: ${msg.content.slice(0, 80)}${msg.content.length > 80 ? '…' : ''}`,
        children: msg.term ? [{ id: `${msg.id}-term`, label: `Term: ${msg.term}`, children: [] }] : undefined,
      })),
    };

    return {
      id: 'overlay:chat',
      title: 'Conversation',
      shapes: ['tree', 'text', 'table'],
      shape: this.viewShape,
      source: viewSource($chatMessages, () => treeData),
    };
  }

  private setFilter(role: 'all' | 'user' | 'agent') {
    this.filterRole = role;
  }

  private setShape(shape: Shape) {
    this.viewShape = shape;
  }

  private formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private renderMarkdown(content: string): string {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }

  private focusTerm(term: string) {
    send({ type: 'focus.set', term });
  }

  private copyMessage(msg: ChatMessage) {
    navigator.clipboard.writeText(msg.content).catch(() => {});
  }

  private regenerate(msg: ChatMessage) {
    send({ type: 'chat.user', content: msg.content });
  }

  private scrollToBottom() {
    requestAnimationFrame(() => {
      const content = this.shadowRoot?.querySelector('.content');
      if (content) content.scrollTop = content.scrollHeight;
    });
  }

  override updated() {
    if (this.autoScroll) this.scrollToBottom();
  }

  private close = () => eventBus.emit('overlay:close', { id: 'chat' });

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  protected override renderBody() {
    if (this.embedded) {
      return html`<s-view .spec=${this.getViewSpec()} .budget=${'embedded'} .chrome=${false}></s-view>`;
    }

    const messages = this.getFilteredMessages();
    const streaming = $streamingDelta.get();
    const hasContent = messages.length > 0 || streaming;

    return html`
      <div class="panel" role="dialog" aria-label="Conversation">
        <overlay-header
          overlay-id="chat"
          title="Conversation"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div class="header">
          <span class="title">Conversation</span>
          <span class="count">${messages.length}</span>
          <div class="toolbar">
            <button class="filter-btn ${this.filterRole === 'all' ? 'active' : ''}" @click=${() => this.setFilter('all')}>All</button>
            <button class="filter-btn ${this.filterRole === 'user' ? 'active' : ''}" @click=${() => this.setFilter('user')}>User</button>
            <button class="filter-btn ${this.filterRole === 'agent' ? 'active' : ''}" @click=${() => this.setFilter('agent')}>Agent</button>
          </div>
        </div>
        <div class="filter">
          <button class="filter-btn ${this.viewShape === 'tree' ? 'active' : ''}" @click=${() => this.setShape('tree')}>Tree</button>
          <button class="filter-btn ${this.viewShape === 'text' ? 'active' : ''}" @click=${() => this.setShape('text')}>Text</button>
          <button class="filter-btn ${this.viewShape === 'table' ? 'active' : ''}" @click=${() => this.setShape('table')}>Table</button>
        </div>
        <div class="content" @scroll=${(e: Event) => {
          const el = e.target as HTMLElement;
          this.autoScroll = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}>
          ${
            !hasContent
              ? html`<div class="empty">No messages</div>`
              : html`
                ${
                  this.viewShape === 'tree' || this.viewShape === 'table'
                    ? html`<s-view .spec=${this.getViewSpec()} .budget=${'full'} .chrome=${true}></s-view>`
                    : html`
                      ${messages.map((msg) => {
                        const isAgent = msg.role === 'agent';
                        const content = isAgent ? this.renderMarkdown(msg.content) : msg.content;
                        return html`
                          <div class="message">
                            <div class="msg-header">
                              <span class="msg-role ${msg.role}">${msg.role}</span>
                              <span class="msg-time">${this.formatTime(msg.timestamp)}</span>
                              ${
                                msg.term
                                  ? html`<span class="focus-btn" @click=${() => this.focusTerm(msg.term!)}>@${msg.term}</span>`
                                  : ''
                              }
                            </div>
                            <div class="msg-body ${msg.role}">${isAgent ? html`${content}` : content}</div>
                            <div class="actions">
                              <button class="action-btn" @click=${() => this.copyMessage(msg)} title="Copy">Copy</button>
                              ${isAgent ? html`<button class="action-btn" @click=${() => this.regenerate(msg)} title="Regenerate">Regenerate</button>` : ''}
                            </div>
                          </div>
                        `;
                      })}
                      ${
                        streaming
                          ? html`
                            <div class="message streaming">
                              <div class="msg-header">
                                <span class="msg-role agent">agent</span>
                                <span class="msg-time">streaming</span>
                              </div>
                              <div class="msg-body agent">${streaming}</div>
                            </div>
                          `
                          : ''
                      }
                    `
                }
              `
          }
        </div>
      </div>
    `;
  }
}

const CHAT_SURFACE = { id: 'chat', title: 'Conversation', group: 'overlay' } as const;

defineSurface(CHAT_SURFACE, ChatView);
registerOverlay({
  id: CHAT_SURFACE.id,
  title: CHAT_SURFACE.title,
  tag: surfaceTag(CHAT_SURFACE),
  window: { draggable: true, resizable: true, minimize: true, persist: true },
});

declare global {
  interface HTMLElementTagNameMap {
    's-chat': ChatView;
  }
}