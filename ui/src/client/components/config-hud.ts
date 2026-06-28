import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $config, $configOpen, send } from '../core/index.js';
import { BaseComponent } from '../core/index.js';
import type { ConfigFieldType } from '../../shared/protocol.js';

const updateConfig = (key: string, value: unknown) => {
  const cfg = $config.get();
  $config.set({ ...cfg, [key]: { ...cfg[key], value } });
  send({ type: 'config.set', key, value });
};

const FIELD_RENDERERS: Record<string, (f: ConfigFieldType, k: string) => unknown> = {
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

@customElement('config-hud')
export class ConfigHUD extends BaseComponent {
  static override styles = css`
    :host { display: block; position: fixed; top: 48px; right: 0; bottom: 60px; z-index: 200; pointer-events: none; }
    .hud-config { pointer-events: auto; }
    .hud-config-trigger { position: absolute; top: 8px; right: 8px; }
    .icon-btn { background: var(--bg-panel); border: 1px solid var(--border-dim); border-radius: 4px; padding: 6px 10px; cursor: pointer; color: var(--text-dim); font-size: 1rem; transition: all 0.2s; }
    .icon-btn:hover { color: var(--accent-cyan); border-color: var(--accent-cyan); background: rgba(0,243,255,0.1); }
    .hud-config-panel { position: absolute; top: 0; right: 0; width: 320px; max-height: 100%; background: var(--bg-panel-solid); border-left: 1px solid var(--border-dim); padding: 1rem; overflow-y: auto; animation: slideIn 0.2s ease; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .config-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-dim); }
    .config-header h3 { font-family: var(--font-data); color: var(--accent-amber); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; margin: 0; }
    .config-grid { display: flex; flex-direction: column; gap: 1rem; }
    .field label { display: block; font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.25rem; font-family: var(--font-data); text-transform: uppercase; }
    input[type=range] { width: 100%; accent-color: var(--accent-cyan); }
    select, input[type=text] { width: 100%; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.4rem; font-family: var(--font-data); font-size: 0.75rem; outline: none; border-radius: 3px; }
    select:focus, input[type=text]:focus { border-color: var(--accent-cyan); }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($config);
    this.watch($configOpen);
  }

  override render() {
    const open = $configOpen.get();
    return html`
      <div class="hud-config">
        ${!open ? html`
          <div class="hud-config-trigger">
            <button class="icon-btn" title="Configuration" @click=${() => $configOpen.set(true)}>⚙</button>
          </div>
        ` : ''}
        ${open ? html`
          <div class="hud-config-panel">
            <div class="config-header">
              <h3>SeNARS Configuration</h3>
              <button class="icon-btn" @click=${() => $configOpen.set(false)} title="Close">✕</button>
            </div>
            <div class="config-grid">
              ${Object.entries($config.get()).map(([k, f]) => html`
                <div class="field" data-testid="field-${k}">
                  <label>${f.label} <span style="float:right;color:var(--accent-cyan)">${f.value}</span></label>
                  ${FIELD_RENDERERS[f.type]?.(f, k)}
                </div>`)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}