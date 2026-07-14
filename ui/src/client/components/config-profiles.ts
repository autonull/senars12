import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $config, BaseComponent } from '../core/index.js';

export interface ConfigProfile {
  name: string;
  description: string;
  values: Record<string, unknown>;
  builtin?: boolean;
}

const STORAGE_KEY = 'senars:profiles';
const ACTIVE_KEY = 'senars:activeProfile';

const BUILTIN_PROFILES: ConfigProfile[] = [
  { name: 'Default', description: 'Balanced configuration', values: {}, builtin: true },
  {
    name: 'Research',
    description: 'High derivation throughput, low decay',
    values: { 'nars.derivationBudget': 200, 'nars.decayRate': 0.5, 'nars.forgetThreshold': 0.05 },
    builtin: true,
  },
  {
    name: 'Creative',
    description: 'High novelty, low confidence threshold',
    values: {
      'llm.temperature': 0.9,
      'nars.confidenceThreshold': 0.3,
      'nars.derivationBudget': 150,
    },
    builtin: true,
  },
];

function loadProfiles(): ConfigProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom: ConfigProfile[] = raw ? JSON.parse(raw) : [];
    return [...BUILTIN_PROFILES, ...custom.filter((p) => !p.builtin)];
  } catch {
    return [...BUILTIN_PROFILES];
  }
}

function saveProfiles(profiles: ConfigProfile[]): void {
  const custom = profiles.filter((p) => !p.builtin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

function loadActiveProfile(): string {
  return localStorage.getItem(ACTIVE_KEY) ?? 'Default';
}

function saveActiveProfile(name: string): void {
  localStorage.setItem(ACTIVE_KEY, name);
}

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
    .export-area textarea { width: 100%; min-height: 80px; background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: var(--spacing-scale-2); border-radius: var(--borderRadius-component-input); resize: vertical; }
    .import-row { display: flex; gap: var(--spacing-scale-2); align-items: center; }
    .import-error { color: var(--colors-primitive-error); font-size: var(--typography-scale-xs); }
  `;
  @state() private profiles: ConfigProfile[] = [];
  @state() private activeProfile = 'Default';
  @state() private showExport = false;
  @state() private importError = '';

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
            this.importError = '';
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
          <export-import .profiles=${this.profiles} .onImport=${(t: string) => this.handleImport(t)} .onExport=${() => this.handleExport()}></export-import>
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
    const cfg = $config.get();
    const updated = { ...cfg };
    for (const [key, value] of Object.entries(profile.values)) {
      if (updated[key]) updated[key] = { ...updated[key], value };
    }
    $config.set(updated);
    this.dispatchEvent(
      new CustomEvent('profile-change', { detail: { profile }, bubbles: true, composed: true })
    );
  }

  private saveAsProfile() {
    const name = prompt('Profile name:');
    if (!name || this.profiles.some((p) => p.name === name && p.builtin)) return;
    const cfg = $config.get();
    const values: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(cfg)) {
      values[key] = field.value;
    }
    this.profiles = [
      ...this.profiles.filter((p) => p.name !== name),
      { name, description: 'Custom profile', values },
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
    const data = JSON.stringify(
      { profiles: this.profiles.filter((p) => !p.builtin), config: cfg },
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senars-profiles-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private handleImport(text: string) {
    try {
      const data = JSON.parse(text);
      if (data.profiles) {
        this.profiles = [
          ...BUILTIN_PROFILES,
          ...data.profiles.filter((p: ConfigProfile) => !p.builtin),
        ];
        saveProfiles(this.profiles);
      }
      if (data.config) $config.set(data.config);
      this.importError = '';
      this.showExport = false;
    } catch {
      this.importError = 'Invalid JSON';
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'config-profiles': ConfigProfiles;
  }
}
