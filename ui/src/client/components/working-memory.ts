import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $workingMemory, $graphMeta } from '../core/store.js';

@customElement('working-memory')
export class WorkingMemory extends LitElement {
  private unsub = $workingMemory.subscribe(() => this.requestUpdate());

  static override styles = css`
    :host { display: block; background: var(--bg-panel); border-top: 1px solid var(--border-dim); padding: 0.5rem; }
    .header { font-family: var(--font-data); font-size: 0.65rem; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem; }
    .items { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.25rem; }
    .chip { font-family: var(--font-data); font-size: 0.65rem; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.2); padding: 2px 6px; border-radius: 3px; white-space: nowrap; color: var(--text-primary); }
    .chip .p { color: var(--accent-amber); margin-left: 4px; }
    .empty { font-family: var(--font-data); font-size: 0.65rem; color: var(--text-dim); }
  `;

  override connectedCallback() {
    super.connectedCallback();
    const w = window as any;
    w.__testApi = w.__testApi || {};
    w.__testApi.workingMemory = {
      getTerms: () => $workingMemory.get().map((item: any) => item.id ?? item.term ?? item.concept ?? ''),
    };
  }

  override disconnectedCallback() {
    this.unsub();
    super.disconnectedCallback();
  }

  override render() {
    const items = $workingMemory.get();
    const meta = $graphMeta.get();
    return html`
      <div class="header">Working Memory ${meta.truncated ? html`<span style="color:var(--accent-amber)">(truncated)</span>` : ''}</div>
      <div class="items">
        ${items.length === 0 ? html`<span class="empty">—</span>` : items.map((i: any) => html`
          <span class="chip">${i.id ?? i.concept ?? i.term}<span class="p">${(i.priority ?? 0).toFixed(2)}</span></span>
        `)}
      </div>
    `;
  }
}
