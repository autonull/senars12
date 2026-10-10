/**
 * Config Profiles — Named profiles over UiConfig (§C.4).
 */

import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { $config, BaseComponent, send, type UiConfig, loadConfig, saveConfig, UiConfigSchema } from '../core/index.js';
import { ConfigProfile, BUILTIN_PROFILES, loadProfiles, saveProfiles, loadActiveProfile, saveActiveProfile, applyProfile, exportConfig, importConfig } from '../core/config-schema.js';

const STORAGE_KEY = 'senars:profiles';
const ACTIVE_KEY = 'senars:activeProfile';

@customElement('config-profiles')
export class ConfigProfiles extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .profile-bar { display: flex; align-items: center; gap: var(--spacing-scale-2); margin-bottom: var(--spacing-scale-3); flex-wrap: wrap; }
    .profile-bar label { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); text-transform: uppercase; }
    select { background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-default); color: var(--colors-semantic-text-primary); padding: var(--spacing-scale-1) var(--spacing-scale-3); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); border-radius: var(--borderRadius-component-input); outline: none; cursor: pointer; }
    select:focus { border-color: var(--colors-semantic-border-focus); }
    .profile-actions { display: flex; gap: var(--spacing-scale-1); }
    .profile-actions button { background: transparent; border: 1px solid var(--colors-semantic-border-default); color: var(--colors-semantic-text-secondary); padding: 2px 8px; font-size: var(--typography-scale-xs); border-radius: var(--borderRadius-component-button); cursor: pointer; font-family: var(--typography-fontFamilies-ui); transition: var(--transitions-fast); }
    .profile-actions button:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    .export-area { margin-top: var(--spacing-scale-2); }
  `;

  @state() private profiles: ConfigProfile[] = [];
  @state() private activeProfile = 'Default';
  @state() private showExport = false;

  override connectedCallback() {
    super.connectedCallback();
    this.profiles = loadProfiles();
    this.activeProfile = loadActiveProfile();
  }

  override render() {
    return html`
      <div class="profile-bar">
        <label>Profile</label>
        <select @change=${(e: Event) => this.selectProfile((e.target as HTMLSelectElement).value)}>
          ${this.profiles.map(
            (p) => html`
            <option value=${p.name} ?selected=${p.name === this.activeProfile}>${p.name}</option>
          `
          )}
        </select>
        <div class="profile-actions">
          <button @click=${this.saveAsProfile} title="Save current config as profile">+ Save</button>
          <button @click=${() => {
            this.showExport = !this.showExport;
          }} title="Export/Import profiles">
            ${this.showExport ? '✕' : '⇅'}
          </button>
          ${
            this.profiles.find((p) => p.name === this.activeProfile && !p.builtin)
              ? html`
            <button @click=${() => this.deleteProfile(this.activeProfile)} title="Delete profile">🗑</button>
          `
              : ''
          }
        </div>
      </div>
      ${
        this.showExport
          ? html`
        <div class="export-area">
          <s-divider></s-divider>
          <export-import .onImport=${(t: string) => this.handleImport(t)} .onExport=${() => this.handleExport()}></export-import>
        </div>
      `
          : ''
      }
    `;
  }

  private selectProfile(name: string) {
    const profile = this.profiles.find((p) => p.name === name);
    if (!profile) return;
    this.activeProfile = name;
    saveActiveProfile(name);
    const currentConfig = $config.get();
    const updatedConfig = applyProfile(currentConfig, profile);
    $config.set(updatedConfig);
    // Send config.set for each changed field
    for (const [key, value] of Object.entries(profile.values)) {
      send({ type: 'config.set', key, value });
    }
    this.dispatchEvent(
      new CustomEvent('profile-change', { detail: { profile }, bubbles: true, composed: true })
    );
  }

  private saveAsProfile() {
    const name = prompt('Profile name:');
    if (!name || this.profiles.some((p) => p.name === name && p.builtin)) return;
    const cfg = $config.get();
    const values: Record<string, unknown> = {};
    // Serialize full config
    function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, flatten(value as Record<string, unknown>, path));
        } else {
          result[path] = value;
        }
      }
      return result;
    }
    Object.assign(values, flatten(cfg as Record<string, unknown>));
    this.profiles = [
      ...this.profiles.filter((p) => p.name !== name),
      { name, description: 'Custom profile', values, builtin: false },
    ];
    saveProfiles(this.profiles);
    this.activeProfile = name;
    saveActiveProfile(name);
  }

  private deleteProfile(name: string) {
    if (this.profiles.find((p) => p.name === name)?.builtin) return;
    this.profiles = this.profiles.filter((p) => p.name !== name);
    saveProfiles(this.profiles);
    if (this.activeProfile === name) {
      this.selectProfile('Default');
    }
  }

  private handleExport() {
    const cfg = $config.get();
    const data = exportConfig(cfg, this.profiles);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senars-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private handleImport(text: string): string | null {
    try {
      const result = importConfig(text);
      if (!result) return 'Invalid JSON';
      if (result.profiles.length > 0) {
        this.profiles = [...BUILTIN_PROFILES, ...result.profiles];
        saveProfiles(this.profiles);
      }
      $config.set(result.config);
      this.showExport = false;
      return null;
    } catch {
      return 'Invalid JSON';
    }
  }
}

@customElement('export-import')
export class ExportImport extends LitElement {
  static override styles = css`
    :host { display: block; }
    button { background: transparent; border: 1px solid var(--colors-semantic-border-default); color: var(--colors-semantic-text-secondary); padding: 2px 8px; font-size: var(--typography-scale-xs); border-radius: var(--borderRadius-component-button); cursor: pointer; font-family: var(--typography-fontFamilies-ui); transition: var(--transitions-fast); }
    button:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    textarea { width: 100%; min-height: 80px; box-sizing: border-box; background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: var(--spacing-scale-2); border-radius: var(--borderRadius-component-input); resize: vertical; }
    .import-row { display: flex; gap: var(--spacing-scale-2); align-items: center; margin-top: var(--spacing-scale-2); }
    .error { color: var(--colors-primitive-error); font-size: var(--typography-scale-xs); }
  `;

  @property({ attribute: false }) onImport?: (text: string) => string | null;
  @property({ attribute: false }) onExport?: () => void;
  @state() private text = '';
  @state() private error = '';

  override render() {
    return html`
      <button @click=${() => this.onExport?.()}>Export</button>
      <textarea
        placeholder="Paste exported config JSON…"
        .value=${this.text}
        @input=${(e: Event) => {
          this.text = (e.target as HTMLTextAreaElement).value;
        }}
      ></textarea>
      <div class="import-row">
        <button @click=${this.importNow}>Import</button>
        ${this.error ? html`<span class="error">${this.error}</span>` : ''}
      </div>
    `;
  }

  private importNow() {
    const text = this.text.trim();
    if (!text) return;
    const error = this.onImport?.(text) ?? null;
    if (error) {
      this.error = error;
      return;
    }
    this.error = '';
    this.text = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'config-profiles': ConfigProfiles;
    'export-import': ExportImport;
  }
}