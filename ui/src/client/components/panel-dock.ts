import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $panels, panelTabs, togglePanel, type PanelTab } from '../core/index.js';
import { panelDef, type PanelKind } from '../core/panel-defs.js';
import { panelSurface, panelSurfaces } from '../core/panel-defs.js';

@customElement('panel-dock')
export class PanelDock extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }
    .dock {
      display: flex; flex-direction: column; height: 100%;
      border-left: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-panel-solid);
    }
    .tabs {
      display: flex; border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-base);
    }
    .tab {
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-secondary);
      background: transparent; border: none; cursor: pointer;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      transition: var(--transitions-fast); white-space: nowrap;
    }
    .tab:hover { color: var(--colors-semantic-text-primary); background: var(--colors-semantic-bg-panel-hover); }
    .tab.active {
      color: var(--colors-semantic-accent-primary);
      border-bottom-color: var(--colors-semantic-accent-primary);
    }
    .tab-close {
      margin-left: var(--spacing-scale-1); padding: 0; line-height: 1;
      background: none; border: none; color: var(--colors-semantic-text-muted); cursor: pointer;
      font-size: var(--typography-scale-sm);
    }
    .tab-close:hover { color: var(--colors-semantic-text-primary); }
    .panel-content {
      flex: 1; overflow: auto; min-height: 0; position: relative;
    }
    .empty-dock {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
    }
  `;

  @state() private activeTab: string | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($panels);
    this.syncActiveTab();
  }

  private syncActiveTab() {
    const panels = $panels.get();
    const tabs = panelTabs();
    const openTabs = tabs.filter((t) => panels.get(t.id)?.open);
    if (openTabs.length > 0 && !openTabs.some((t) => t.id === this.activeTab)) {
      this.activeTab = openTabs[0]!.id;
    } else if (openTabs.length === 0) {
      this.activeTab = null;
    }
  }

  override render() {
    const panels = $panels.get();
    const tabs = panelTabs().filter((t) => panels.get(t.id)?.open);

    if (tabs.length === 0) {
      return html`
        <div class="dock">
          <div class="empty-dock">No panels open</div>
        </div>
      `;
    }

    return html`
      <div class="dock">
        <div class="tabs" role="tablist">
          ${tabs.map(
            (tab) => html`
              <button
                class="tab ${this.activeTab === tab.id ? 'active' : ''}"
                role="tab"
                aria-selected=${this.activeTab === tab.id}
                @click=${() => (this.activeTab = tab.id)}
              >
                ${tab.label}
                <button
                  class="tab-close"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    togglePanel(tab.id);
                  }}
                  aria-label="Close ${tab.label}"
                >
                  ×
                </button>
              </button>
            `
          )}
        </div>
        <div class="panel-content" role="tabpanel">
          ${this.activeTab ? this.renderTabContent(this.activeTab) : ''}
        </div>
      </div>
    `;
  }

  private renderTabContent(tabId: string) {
    const panels = $panels.get();
    const panel = panels.get(tabId);
    if (!panel) return html``;

    // Try unified surface registry first, fall back to legacy panelDef
    const surface = panelSurface(tabId);
    const def = surface ? surface : panelDef(tabId as PanelKind);
    if (def) {
      const component = 'component' in def ? (def as any).component : (def as any).tag;
      return html`<${component}></${component}>`;
    }
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'panel-dock': PanelDock; }
}