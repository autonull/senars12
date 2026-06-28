import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $config, mountTestApi } from '../core/store.js';
import { send } from '../core/ws-client.js';

const updateConfig = (key: string, value: unknown) => {
  const cfg = $config.get();
  $config.set({ ...cfg, [key]: { ...cfg[key], value } });
  send({ type: 'config.set', key, value });
};

const renderField = (field: any, key: string) => html`
  <div class="field" data-testid="field-${key}">
    <label>${field.label} <span class="val">${field.value}</span></label>
    ${field.type === 'slider' ? html`
      <input type="range" min=${field.min ?? 0} max=${field.max ?? 1} step=${field.step ?? 0.1}
        .value=${field.value} @input=${(e: Event) => updateConfig(key, parseFloat((e.target as HTMLInputElement).value))} />
    ` : ''}
    ${field.type === 'dropdown' ? html`
      <select @change=${(e: Event) => updateConfig(key, (e.target as HTMLSelectElement).value)}>
        ${field.options?.map?.((o: string) => html`<option value=${o} ?selected=${o === String(field.value)}>${o}</option>`)}
      </select>
    ` : ''}
    ${field.type === 'text' ? html`
      <input type="text" .value=${field.value} @change=${(e: Event) => updateConfig(key, (e.target as HTMLInputElement).value)} />
    ` : ''}
    ${field.type === 'toggle' ? html`
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
        <input type="checkbox" ?checked=${field.value} @change=${(e: Event) => updateConfig(key, (e.target as HTMLInputElement).checked)} />
        <span style="color:var(--text-primary);text-transform:none;">Enabled</span>
      </label>
    ` : ''}
  </div>
`;

@customElement('config-drawer')
export class ConfigDrawer extends LitElement {
  private unsub = $config.subscribe(() => this.requestUpdate());

  static override styles = css`
    :host { display: block; background: var(--bg-panel-solid); border-left: 1px solid var(--border-dim); padding: 1rem; overflow-y: auto; }
    h2 { font-family: var(--font-data); color: var(--accent-amber); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; margin: 0 0 1rem 0; }
    .empty { color: var(--text-dim); font-family: var(--font-data); font-size: 0.8rem; text-align: center; padding-top: 2rem; }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.25rem; font-family: var(--font-data); text-transform: uppercase; }
    input[type=range] { width: 100%; accent-color: var(--accent-cyan); }
    select, input[type=text] { width: 100%; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.4rem; font-family: var(--font-data); font-size: 0.75rem; outline: none; }
    select:focus, input[type=text]:focus { border-color: var(--accent-cyan); }
    .val { float: right; color: var(--accent-cyan); }
  `;

  override connectedCallback() {
    super.connectedCallback();
    mountTestApi('config', { getConfig: () => $config.get() });
  }

  override disconnectedCallback() {
    this.unsub();
    super.disconnectedCallback();
  }

  override render() {
    const cfg = $config.get();
    return html`
      <h2>System Config</h2>
      ${Object.keys(cfg).length === 0 ? html`<div class="empty">Awaiting config schema...</div>` : ''}
      ${Object.entries(cfg).map(([k, v]) => renderField(v, k))}
    `;
  }
}