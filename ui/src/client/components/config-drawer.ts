import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $config, mountTestApi } from '../core/store.js';
import { send } from '../core/ws-client.js';
import { BaseComponent } from '../core/base-component.js';
import type { ConfigFieldType } from '../../shared/protocol.js';

const updateConfig = (key: string, value: unknown) => {
  const cfg = $config.get();
  $config.set({ ...cfg, [key]: { ...cfg[key], value } });
  send({ type: 'config.set', key, value });
};

type FieldRenderer = (f: ConfigFieldType, k: string) => unknown;
const FIELD_RENDERERS: Record<string, FieldRenderer> = {
  slider: (f, k) => html`<input type="range" min=${f.min ?? 0} max=${f.max ?? 1} step=${f.step ?? 0.1}
    .value=${f.value} @input=${(e: Event) => updateConfig(k, parseFloat((e.target as HTMLInputElement).value))} />`,
  dropdown: (f, k) => html`<select @change=${(e: Event) => updateConfig(k, (e.target as HTMLSelectElement).value)}>
    ${f.options?.map((o: string) => html`<option value=${o} ?selected=${o === String(f.value)}>${o}</option>`)}
  </select>`,
  text: (f, k) => html`<input type="text" .value=${f.value} @change=${(e: Event) => updateConfig(k, (e.target as HTMLInputElement).value)} />`,
  toggle: (f, k) => html`<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
    <input type="checkbox" ?checked=${f.value} @change=${(e: Event) => updateConfig(k, (e.target as HTMLInputElement).checked)} />
    <span style="color:var(--text-primary);text-transform:none;">Enabled</span>
  </label>`,
};

@customElement('config-drawer')
export class ConfigDrawer extends BaseComponent {
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
    this.watch($config);
    mountTestApi('config', { getConfig: () => $config.get() });
  }

  override render() {
    const cfg = $config.get();
    const entries = Object.entries(cfg);
    return html`
      <h2>System Config</h2>
      ${!entries.length ? html`<div class="empty">Awaiting config schema...</div>` : entries.map(([k, f]) => html`
        <div class="field" data-testid="field-${k}">
          <label>${f.label} <span class="val">${f.value}</span></label>
          ${FIELD_RENDERERS[f.type]?.(f, k)}
        </div>`)}
    `;
  }
}