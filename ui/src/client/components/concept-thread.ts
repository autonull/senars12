import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $focusTerm, $chat, $selectedMessageId } from '../core/store.js';

@customElement('concept-thread')
export class ConceptThread extends LitElement {
  private unsubs = [$focusTerm.subscribe(() => this.requestUpdate()), $chat.subscribe(() => this.requestUpdate())];

  static override styles = css`
    :host { display: block; background: var(--bg-panel); border-left: 1px solid var(--border-dim); overflow-y: auto; }
    .panel { padding: 0.75rem; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-dim); }
    .term { font-family: var(--font-data); font-size: 0.75rem; color: var(--accent-cyan); }
    .close { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.85rem; }
    .close:hover { color: var(--text-primary); }
    .empty { color: var(--text-dim); font-family: var(--font-data); font-size: 0.7rem; padding: 1rem 0; text-align: center; }
    .msg { padding: 0.5rem; margin-bottom: 0.5rem; background: var(--bg-void); border-radius: 4px; font-family: var(--font-ui); font-size: 0.75rem; line-height: 1.5; color: var(--text-primary); border-left: 2px solid var(--border-dim); cursor: pointer; }
    .msg:hover { border-left-color: var(--accent-cyan); }
  `;

  override disconnectedCallback() {
    this.unsubs.forEach(u => u());
    super.disconnectedCallback();
  }

  private onMessageClick(msgId: string) {
    $selectedMessageId.set(msgId);
  }

  override render() {
    const term = $focusTerm.get();
    if (!term) return html``;

    const related = $chat.get().filter((m) => (m.term && m.term.toLowerCase().includes(term.toLowerCase())) || m.content.toLowerCase().includes(term.toLowerCase()));
    return html`
      <div class="panel">
        <div class="header">
          <span class="term">${term}</span>
          <button class="close" @click=${() => $focusTerm.set(null)}>✕</button>
        </div>
        ${related.length === 0 ? html`<div class="empty">No related messages</div>` : ''}
        ${related.map((m) => html`
          <div class="msg" @click=${() => this.onMessageClick(m.id)}>
            <div style="font-size:0.65rem;opacity:0.5;margin-bottom:2px;color:${m.role === 'user' ? 'var(--accent-cyan)' : 'var(--accent-magenta)'}">${m.role}</div>
            ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}
          </div>
        `)}
      </div>
    `;
  }
}
