import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { wsClient } from '../core/ws-client.js';

type ConfigField = {
  type: string;
  label: string;
  value: any;
  options?: string[];
  min?: number;
  max?: number;
};

@customElement('config-drawer')
export class ConfigDrawer extends LitElement {
  @state() private schema: Record<string, ConfigField> = {};

  static override styles = css`
    :host { display: block; width: 300px; background: var(--bg-panel-solid); border-left: 1px solid var(--border-dim); padding: 1.5rem; overflow-y: auto; }
    h2 { font-family: var(--font-data); color: var(--accent-amber); text-transform: uppercase; font-size: 0.9rem; letter-spacing: 2px; margin-top: 0; }
    .empty { color: var(--text-dim); font-family: var(--font-data); font-size: 0.8rem; text-align: center; padding-top: 2rem; }
    .field { margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.8rem; color: var(--text-dim); margin-bottom: 0.5rem; font-family: var(--font-data); text-transform: uppercase; }
    input[type=range] { width: 100%; accent-color: var(--accent-cyan); }
    select, input[type=text] { width: 100%; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.5rem; font-family: var(--font-data); outline: none; }
    select:focus, input[type=text]:focus { border-color: var(--accent-cyan); }
    .val { float: right; color: var(--accent-cyan); }
  `;

  private onSchema = (msg: { data: Record<string, ConfigField> }) => { this.schema = msg.data; };

  override connectedCallback() {
    super.connectedCallback();
    wsClient.on('config.schema', this.onSchema);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    wsClient.off('config.schema', this.onSchema);
  }

  private updateConfig(key: string, value: any) {
    this.schema = { ...this.schema, [key]: { ...this.schema[key]!, value } };
    wsClient.send({ type: 'config.set', key, value });
  }

  override render() {
    const entries = Object.entries(this.schema);
    return html`
      <h2>System Config</h2>
      ${entries.length === 0 ? html`<div class="empty">Awaiting config schema...</div>` : ''}
      ${entries.map(([key, field]) => html`
        <div class="field">
          <label>${field.label} <span class="val">${field.value}</span></label>
          ${field.type === 'slider' ? html`
            <input type="range" min=${field.min ?? 0} max=${field.max ?? 1} step="0.1" .value=${field.value}
              @input=${(e: Event) => this.updateConfig(key, parseFloat((e.target as HTMLInputElement).value))}>
          ` : ''}
          ${field.type === 'dropdown' ? html`
            <select @change=${(e: Event) => this.updateConfig(key, (e.target as HTMLSelectElement).value)}>
              ${field.options?.map(opt => html`<option value=${opt} ?selected=${opt === field.value}>${opt}</option>`)}
            </select>
          ` : ''}
          ${field.type === 'text' ? html`
            <input type="text" .value=${field.value}
              @change=${(e: Event) => this.updateConfig(key, (e.target as HTMLInputElement).value)}>
          ` : ''}
          ${field.type === 'toggle' ? html`
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
              <input type="checkbox" ?checked=${field.value}
                @change=${(e: Event) => this.updateConfig(key, (e.target as HTMLInputElement).checked)}>
              <span style="color:var(--text-primary);text-transform:none;">Enabled</span>
            </label>
          ` : ''}
        </div>
      `)}
    `;
  }
}
