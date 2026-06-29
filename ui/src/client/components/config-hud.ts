import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { ConfigFieldType } from '../../shared/protocol.js';
import { $config, BaseComponent, send } from '../core/index.js';
import './config-profiles.js';

type ConfigCategory = 'llm' | 'nars' | 'system' | 'advanced';

interface ValidationResult {
  valid: boolean;
  message?: string;
}

const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  llm: 'Language Model',
  nars: 'NARS Reasoning',
  system: 'System',
  advanced: 'Advanced',
};

const CATEGORY_ORDER: ConfigCategory[] = ['llm', 'nars', 'system', 'advanced'];

function validateField(field: ConfigFieldType, value: unknown): ValidationResult {
  const v = field.validation;
  if (!v) return { valid: true };
  if (typeof value === 'number') {
    if (v.min != null && value < v.min) return { valid: false, message: `Minimum ${v.min}` };
    if (v.max != null && value > v.max) return { valid: false, message: `Maximum ${v.max}` };
  }
  if (typeof value === 'string' && v.pattern) {
    if (!new RegExp(v.pattern).test(value))
      return { valid: false, message: `Must match ${v.pattern}` };
  }
  return { valid: true };
}

function categoryForKey(key: string): ConfigCategory {
  if (key.startsWith('llm.') || key.startsWith('llm_')) return 'llm';
  if (key.startsWith('nars.') || key.startsWith('nars_')) return 'nars';
  if (key.startsWith('sys.') || key.startsWith('sys_')) return 'system';
  return 'advanced';
}

function updateConfig(key: string, value: unknown) {
  const cfg = $config.get();
  $config.set({ ...cfg, [key]: { ...cfg[key], value } });
  send({ type: 'config.set', key, value });
}

@customElement('config-hud')
export class ConfigHUD extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .hud-config { display: flex; flex-direction: column; height: 100%; }
    .config-scroll { flex: 1; overflow-y: auto; padding: var(--spacing-scale-3); }
    .config-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-scale-2); }
    .config-header h3 { font-family: var(--typography-fontFamilies-data); color: var(--colors-cognitiveLens-contradiction-primary); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; margin: 0; }
    .config-header-actions { display: flex; gap: var(--spacing-scale-1); }
    .icon-btn { background: transparent; border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); padding: 2px 8px; cursor: pointer; color: var(--colors-semantic-text-muted); font-size: 0.75rem; font-family: var(--typography-fontFamilies-ui); transition: var(--transitions-fast); }
    .icon-btn:hover { color: var(--colors-semantic-accent-primary); border-color: var(--colors-semantic-accent-primary); }
    .dirty-indicator { color: var(--colors-cognitiveLens-contradiction-primary); font-size: var(--typography-scale-xs); padding: 2px 0; }

    .category { margin-bottom: var(--spacing-scale-3); }
    .category-header { display: flex; align-items: center; gap: var(--spacing-scale-2); cursor: pointer; padding: var(--spacing-scale-2) 0; user-select: none; border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .category-header:hover { opacity: 0.8; }
    .category-header h4 { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); text-transform: uppercase; letter-spacing: 1px; color: var(--colors-semantic-text-secondary); margin: 0; flex: 1; }
    .category-fields { display: flex; flex-direction: column; gap: var(--spacing-scale-2); padding-top: var(--spacing-scale-2); }
    .category-fields.collapsed { display: none; }

    .field { display: flex; flex-direction: column; gap: 2px; }
    .field-header { display: flex; align-items: center; justify-content: space-between; }
    .field label { font-size: 0.7rem; color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); text-transform: uppercase; letter-spacing: 0.05em; }
    .field-description { font-size: 0.65rem; color: var(--colors-semantic-text-muted); line-height: 1.4; }
    .field.dirty label { color: var(--colors-cognitiveLens-contradiction-primary); }
    .field.dirty .field-value { outline: 1px solid var(--colors-cognitiveLens-contradiction-primary); outline-offset: 1px; border-radius: 2px; }
    .field.error label { color: var(--colors-primitive-error); }
    .field-error { font-size: 0.65rem; color: var(--colors-primitive-error); }

    input[type=range] { width: 100%; accent-color: var(--colors-semantic-accent-primary); }
    select, input[type=text], input[type=number] { width: 100%; background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-primary); padding: var(--spacing-scale-2) var(--spacing-scale-3); font-family: var(--typography-fontFamilies-data); font-size: 0.7rem; outline: none; border-radius: var(--borderRadius-component-input); box-sizing: border-box; }
    select:focus, input:focus { border-color: var(--colors-semantic-border-focus); }

    .field-value { display: flex; align-items: center; gap: var(--spacing-scale-2); }
    .field-value .val { font-size: 0.7rem; color: var(--colors-semantic-text-secondary); font-family: var(--typography-fontFamilies-data); min-width: 24px; text-align: right; }

    .reset-all { text-align: right; padding: var(--spacing-scale-2) 0; border-top: 1px solid var(--colors-semantic-border-subtle); margin-top: var(--spacing-scale-2); }
    .reset-all button { background: transparent; border: none; color: var(--colors-semantic-text-muted); font-size: 0.7rem; cursor: pointer; font-family: var(--typography-fontFamilies-ui); }
    .reset-all button:hover { color: var(--colors-primitive-error); }

    .dirty-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--colors-cognitiveLens-contradiction-primary); display: inline-block; }
  `;
  @state() private dirtyFields = new Set<string>();
  @state() private collapsedCategories = new Set<string>();
  @state() private validationErrors = new Map<string, string>();
  @state() private profileSelector = false;
  private validateDebounce: Record<string, number> = {};

  override connectedCallback() {
    super.connectedCallback();
    this.watch($config);
  }

  override render() {
    return html`
      <div class="hud-config">
        <div class="config-header">
          <h3>Configuration</h3>
          <div class="config-header-actions">
            ${this.dirtyFields.size > 0 ? html`<span class="dirty-indicator">${this.dirtyFields.size} unsaved</span>` : ''}
            <button class="icon-btn" @click=${() => (this.profileSelector = !this.profileSelector)} title="Profiles">Profiles</button>
            <button class="icon-btn" @click=${this.closePanel} title="Close">✕</button>
          </div>
        </div>

        ${this.profileSelector ? html`<config-profiles></config-profiles>` : ''}

        <div class="config-scroll">
          ${[...this.groupByCategory().entries()].map(([cat, fields]) => {
            if (fields.length === 0) return '';
            const collapsed = this.collapsedCategories.has(cat);
            const dirtyCount = this.countDirtyInCategory(cat);
            return html`
              <div class="category">
                <div class="category-header" @click=${() => this.toggleCategory(cat)}>
                  <span>${collapsed ? '▸' : '▾'}</span>
                  <h4>${CATEGORY_LABELS[cat]}</h4>
                  ${dirtyCount > 0 ? html`<span class="dirty-dot"></span>` : ''}
                  <button class="icon-btn" @click=${(e: Event) => {
                    e.stopPropagation();
                    this.resetCategory(cat);
                  }} size="sm">Reset</button>
                </div>
                <div class="category-fields ${collapsed ? 'collapsed' : ''}">
                  ${fields.map(([key, f]) => this.renderField(f, key))}
                </div>
              </div>`;
          })}
          ${
            this.dirtyFields.size > 0
              ? html`
            <div class="reset-all">
              <button @click=${this.resetAll}>Reset all fields</button>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  private closePanel() {
    this.dispatchEvent(new CustomEvent('s-close', { bubbles: true, composed: true }));
  }

  private getCategory(field: ConfigFieldType, key: string): ConfigCategory {
    return field.category ?? categoryForKey(key);
  }

  private handleChange(key: string, value: unknown) {
    const cfg = $config.get();
    const field = cfg[key] as ConfigFieldType;
    if (!field) return;

    const result = validateField(field, value);
    if (!result.valid) {
      this.validationErrors.set(key, result.message!);
    } else {
      this.validationErrors.delete(key);
    }
    this.dirtyFields.add(key);
    this.requestUpdate();

    if (this.validateDebounce[key]) clearTimeout(this.validateDebounce[key]);
    this.validateDebounce[key] = window.setTimeout(() => {
      updateConfig(key, value);
    }, 300);
  }

  private resetCategory(cat: ConfigCategory) {
    const cfg = $config.get();
    for (const [key, field] of Object.entries(cfg)) {
      if (this.getCategory(field, key) === cat) {
        this.dirtyFields.delete(key);
        this.validationErrors.delete(key);
      }
    }
    this.requestUpdate();
  }

  private resetAll() {
    this.dirtyFields.clear();
    this.validationErrors.clear();
    this.requestUpdate();
  }

  private toggleCategory(cat: string) {
    if (this.collapsedCategories.has(cat)) this.collapsedCategories.delete(cat);
    else this.collapsedCategories.add(cat);
    this.requestUpdate();
  }

  private renderField(field: ConfigFieldType, key: string): unknown {
    const isDirty = this.dirtyFields.has(key);
    const error = this.validationErrors.get(key);
    const val = field.value;
    const desc = field.description;

    const input =
      field.type === 'slider'
        ? html`
      <div class="field-value">
        <input type="range" min=${field.min ?? 0} max=${field.max ?? 1} step=${field.step ?? 0.1}
          .value=${val} @input=${(e: Event) => this.handleChange(key, Number.parseFloat((e.target as HTMLInputElement).value))} />
        <span class="val">${typeof val === 'number' ? val.toFixed(2) : val}</span>
      </div>`
        : field.type === 'dropdown'
          ? html`
      <div class="field-value">
        <select @change=${(e: Event) => this.handleChange(key, (e.target as HTMLSelectElement).value)}>
          ${field.options?.map((o) => html`<option value=${o} ?selected=${o === String(val)}>${o}</option>`)}
        </select>
      </div>`
          : field.type === 'toggle'
            ? html`
      <div class="field-value">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" ?checked=${val} @change=${(e: Event) => this.handleChange(key, (e.target as HTMLInputElement).checked)} />
          <span style="color:var(--colors-semantic-text-primary);font-size:0.75rem;">${val ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>`
            : html`
      <div class="field-value">
        <input type=${field.type === 'text' ? 'text' : 'number'} .value=${val}
          @change=${(e: Event) => this.handleChange(key, (e.target as HTMLInputElement).value)} />
      </div>`;

    return html`
      <div class="field ${classMap({ dirty: isDirty, error: !!error })}">
        <div class="field-header">
          <label>${field.label} ${isDirty ? html`<span class="dirty-dot"></span>` : ''}</label>
        </div>
        ${desc ? html`<span class="field-description">${desc}</span>` : ''}
        ${input}
        ${error ? html`<span class="field-error">${error}</span>` : ''}
      </div>`;
  }

  private groupByCategory(): Map<ConfigCategory, [string, ConfigFieldType][]> {
    const cfg = $config.get();
    const groups = new Map<ConfigCategory, [string, ConfigFieldType][]>();
    for (const cat of CATEGORY_ORDER) groups.set(cat, []);
    for (const [key, field] of Object.entries(cfg)) {
      const cat = this.getCategory(field, key);
      groups.get(cat)?.push([key, field]);
    }
    return groups;
  }

  private countDirtyInCategory(cat: ConfigCategory): number {
    const cfg = $config.get();
    let count = 0;
    for (const key of this.dirtyFields) {
      const field = cfg[key];
      if (field && this.getCategory(field, key) === cat) count++;
    }
    return count;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'config-hud': ConfigHUD;
  }
}
