/**
 * Config HUD — Settings panel generated from Zod schema (§C.3).
 * Form fields are generated from UiConfigSchema, not hand-written.
 */

import { z } from 'zod';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { type Debounced, debounce, getOrInsert } from '@senars/util';
import { $config, BaseComponent, send, type UiConfig, UiConfigSchema, type Theme, type Density, type Motion } from '../core/index.js';
import { renderField, type FieldValue } from '../utils/render-field.js';
import './config-profiles.js';

type ConfigSection = 'appearance' | 'defaults' | 'panels' | 'provider' | 'budgets' | 'nars' | 'advanced';

const SECTION_LABELS: Record<ConfigSection, string> = {
  appearance: 'Appearance',
  defaults: 'Defaults',
  panels: 'Panels',
  provider: 'Provider',
  budgets: 'Budgets',
  nars: 'Reasoning',
  advanced: 'Advanced',
};

const SECTION_ORDER: ConfigSection[] = ['appearance', 'defaults', 'panels', 'provider', 'budgets', 'nars', 'advanced'];

const FIELD_METADATA: Record<string, { label: string; description?: string; section: ConfigSection; options?: string[] }> = {
  // Appearance
  theme: { label: 'Theme', description: 'UI color theme', section: 'appearance', options: ['auto', 'dark', 'light'] },
  density: { label: 'Density', description: 'Spacing density', section: 'appearance', options: ['comfortable', 'compact'] },
  motion: { label: 'Motion', description: 'Animation preference', section: 'appearance', options: ['normal', 'reduced'] },

  // Defaults
  defaultRenderer: { label: 'Default Renderer', description: 'Renderer on boot', section: 'defaults' },
  defaultLens: { label: 'Default Lens', description: 'Cognitive lens on boot', section: 'defaults', options: ['belief', 'goal', 'contradiction'] },
  'defaultLayout.concept': { label: 'Concept Layout', description: 'Layout for concept scope', section: 'defaults' },
  'defaultLayout.conversation': { label: 'Conversation Layout', description: 'Layout for conversation scope', section: 'defaults' },

  // Provider
  'provider.name': { label: 'Provider', description: 'LLM provider', section: 'provider', options: ['webllm', 'ollama', 'openai', 'anthropic'] },
  'provider.model': { label: 'Model', description: 'Model identifier', section: 'provider' },
  'provider.temperature': { label: 'Temperature', description: 'Sampling temperature', section: 'provider', options: undefined },
  'provider.maxTokens': { label: 'Max Tokens', description: 'Maximum response tokens', section: 'provider' },
  'provider.baseUrl': { label: 'Base URL', description: 'Custom API base URL', section: 'provider' },
  'provider.apiKey': { label: 'API Key', description: 'API key (stored locally)', section: 'provider' },

  // Budgets
  'budgets.inference': { label: 'Inference Budget', description: 'Inference operations budget', section: 'budgets' },
  'budgets.memory': { label: 'Memory Budget', description: 'Memory operations budget', section: 'budgets' },
  'budgets.tools': { label: 'Tools Budget', description: 'Tool invocations budget', section: 'budgets' },

  // NARS
  'nars.maxConcepts': { label: 'Max Concepts', description: 'Maximum concepts in working memory', section: 'nars' },
  'nars.activationDecayRate': { label: 'Decay Rate', description: 'Priority decay per cycle', section: 'nars' },
  'nars.consolidationInterval': { label: 'Consolidation Interval', description: 'Cycles between consolidation', section: 'nars' },
  'nars.cpuThrottleMs': { label: 'CPU Throttle (ms)', description: 'Minimum pause between cycle bursts', section: 'nars' },
  'nars.maxDerivationDepth': { label: 'Max Derivation Depth', description: 'Maximum inference chain depth', section: 'nars' },
  'nars.maxDerivationsPerStep': { label: 'Max Derivations/Step', description: 'Max derivations per inference step', section: 'nars' },

  // Advanced
  showTelemetry: { label: 'Show Telemetry', description: 'Display telemetry overlay', section: 'advanced' },
  showMinimap: { label: 'Show Minimap', description: 'Display graph minimap', section: 'advanced' },
  autoConnect: { label: 'Auto Connect', description: 'Auto-connect to server on load', section: 'advanced' },
  debugMode: { label: 'Debug Mode', description: 'Enable debug logging', section: 'advanced' },
};

function getNestedValue(obj: UiConfig, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => (acc as Record<string, unknown>)[key], obj);
}

function setNestedValue(obj: UiConfig, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === undefined) continue;
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
}

function updateConfig(path: string, value: unknown) {
  const cfg = $config.get();
  const updated = { ...cfg };
  setNestedValue(updated, path, value);
  $config.set(updated);
  send({ type: 'config.set', key: path, value });
}

function validateValue(path: string, value: unknown): { valid: boolean; message?: string } {
  try {
    // Extract the field schema from UiConfigSchema
    const keys = path.split('.');
    let schema: z.ZodTypeAny = UiConfigSchema;
    for (const key of keys) {
      const shape = (schema as z.ZodObject<any> | undefined)?.shape;
      if (shape && key in shape) {
        schema = shape[key] as z.ZodTypeAny;
      } else if ((schema as z.ZodArray<any> | undefined)?.element) {
        return { valid: true };
      } else if ('unwrap' in schema && typeof (schema as { unwrap?: () => z.ZodTypeAny }).unwrap === 'function') {
        schema = (schema as { unwrap: () => z.ZodTypeAny }).unwrap();
        if (!schema) return { valid: true };
        const unwrappedShape = (schema as z.ZodObject<any> | undefined)?.shape;
        if (unwrappedShape && key in unwrappedShape) {
          schema = unwrappedShape[key] as z.ZodTypeAny;
        }
      } else {
        return { valid: true };
      }
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      return { valid: false, message: result.error.issues[0]?.message ?? 'Invalid value' };
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
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

    .section { margin-bottom: var(--spacing-scale-3); }
    .section-header { display: flex; align-items: center; gap: var(--spacing-scale-2); cursor: pointer; padding: var(--spacing-scale-2) 0; user-select: none; border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .section-header:hover { opacity: 0.8; }
    .section-header h4 { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); text-transform: uppercase; letter-spacing: 1px; color: var(--colors-semantic-text-secondary); margin: 0; flex: 1; }
    .section-fields { display: flex; flex-direction: column; gap: var(--spacing-scale-2); padding-top: var(--spacing-scale-2); }
    .section-fields.collapsed { display: none; }

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
  @state() private collapsedSections = new Set<string>();
  @state() private validationErrors = new Map<string, string>();
  @state() private profileSelector = false;
  private readonly commits = new Map<string, Debounced<[unknown]>>();

  private commitFor(key: string): Debounced<[unknown]> {
    return getOrInsert(this.commits, key, () =>
      debounce((value: unknown) => updateConfig(key, value), 300)
    );
  }

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
          ${SECTION_ORDER.map((section) => {
            const fields = this.getFieldsForSection(section);
            if (fields.length === 0) return '';
            const collapsed = this.collapsedSections.has(section);
            const dirtyCount = this.countDirtyInSection(section);
            return html`
              <div class="section">
                <div class="section-header" @click=${() => this.toggleSection(section)}>
                  <span>${collapsed ? '▸' : '▾'}</span>
                  <h4>${SECTION_LABELS[section]}</h4>
                  ${dirtyCount > 0 ? html`<span class="dirty-dot"></span>` : ''}
                  <button class="icon-btn" @click=${(e: Event) => {
                    e.stopPropagation();
                    this.resetSection(section);
                  }} size="sm">Reset</button>
                </div>
                <div class="section-fields ${collapsed ? 'collapsed' : ''}">
                  ${fields.map((path) => this.renderField(path))}
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

  private getFieldsForSection(section: ConfigSection): string[] {
    return Object.entries(FIELD_METADATA)
      .filter(([, meta]) => meta.section === section)
      .map(([path]) => path);
  }

  private handleChange(path: string, value: unknown) {
    const result = validateValue(path, value);
    if (!result.valid) {
      this.validationErrors.set(path, result.message!);
    } else {
      this.validationErrors.delete(path);
    }
    this.dirtyFields.add(path);
    this.requestUpdate();
    this.commitFor(path)(value);
  }

  override disconnectedCallback(): void {
    for (const commit of this.commits.values()) commit.cancel();
    this.commits.clear();
    super.disconnectedCallback();
  }

  private resetSection(section: ConfigSection) {
    const cfg = $config.get();
    const defaults = UiConfigSchema.parse({});
    for (const path of this.getFieldsForSection(section)) {
      this.dirtyFields.delete(path);
      this.validationErrors.delete(path);
      const defaultValue = getNestedValue(defaults, path);
      setNestedValue(cfg, path, defaultValue);
    }
    $config.set({ ...cfg });
    // Send reset for each field
    for (const path of this.getFieldsForSection(section)) {
      const defaultValue = getNestedValue(defaults, path);
      send({ type: 'config.set', key: path, value: defaultValue });
    }
    this.requestUpdate();
  }

  private resetAll() {
    this.dirtyFields.clear();
    this.validationErrors.clear();
    const defaults = UiConfigSchema.parse({});
    $config.set(defaults);
    // Send reset for all fields
    for (const [path] of Object.entries(FIELD_METADATA)) {
      const defaultValue = getNestedValue(defaults, path);
      send({ type: 'config.set', key: path, value: defaultValue });
    }
    this.requestUpdate();
  }

  private toggleSection(section: string) {
    if (this.collapsedSections.has(section)) this.collapsedSections.delete(section);
    else this.collapsedSections.add(section);
    this.requestUpdate();
  }

  private countDirtyInSection(section: ConfigSection): number {
    const fields = this.getFieldsForSection(section);
    return fields.filter((path) => this.dirtyFields.has(path)).length;
  }

  private renderField(path: string): unknown {
    const meta = FIELD_METADATA[path];
    if (!meta) return '';
    const isDirty = this.dirtyFields.has(path);
    const error = this.validationErrors.get(path);
    const value = getNestedValue($config.get(), path);

    const fieldSchema = this.getFieldSchema(path);
    const fieldType = fieldSchema?.constructor.name.replace('Zod', '').toLowerCase() ?? 'text';

    return html`
      <div class="field ${classMap({ dirty: isDirty, error: !!error })}">
        <div class="field-header">
          <label>${meta.label} ${isDirty ? html`<span class="dirty-dot"></span>` : ''}</label>
        </div>
        ${meta.description ? html`<span class="field-description">${meta.description}</span>` : ''}
        <div class="field-value">${this.renderControl(path, value, fieldType, meta.options)}</div>
        ${error ? html`<span class="field-error">${error}</span>` : ''}
      </div>`;
  }

  private getFieldSchema(path: string): z.ZodTypeAny | undefined {
    let schema: z.ZodTypeAny = UiConfigSchema;
    for (const key of path.split('.')) {
      // Use type guards for Zod types
      const shape = (schema as z.ZodObject<any> | undefined)?.shape;
      if (shape && key in shape) {
        schema = shape[key] as z.ZodTypeAny;
      } else if ((schema as z.ZodArray<any> | undefined)?.element) {
        return undefined;
      } else if ('unwrap' in schema && typeof (schema as { unwrap?: () => z.ZodTypeAny }).unwrap === 'function') {
        schema = (schema as { unwrap: () => z.ZodTypeAny }).unwrap();
        if (!schema) return undefined;
        const unwrappedShape = (schema as z.ZodObject<any> | undefined)?.shape;
        if (unwrappedShape && key in unwrappedShape) {
          schema = unwrappedShape[key] as z.ZodTypeAny;
        }
      } else {
        return undefined;
      }
    }
    return schema;
  }

  private renderControl(path: string, value: unknown, type: string, options?: string[]): unknown {
    const change = (v: FieldValue) => this.handleChange(path, v);

    switch (type) {
      case 'zodenum':
      case 'enum': {
        const opts = options ?? ['auto', 'dark', 'light'];
        return renderField({ type: 'dropdown', options: opts }, String(value ?? ''), change);
      }
      case 'zodnumber':
      case 'number': {
        // Check if it's a slider field based on metadata
        const meta = FIELD_METADATA[path];
        if (meta?.options) {
          return renderField({ type: 'dropdown', options: meta.options }, String(value ?? ''), change);
        }
        // Default to slider for known numeric fields
        const min = (path.includes('maxConcepts') ? 100 : 0) as number;
        const max = (path.includes('maxConcepts') ? 10000 : 100) as number;
        const step = (path.includes('DecayRate') ? 0.001 : 1) as number;
        return html`
          ${renderField({ type: 'slider', min, max, step }, Number(value) || 0, change)}
          <span class="val">${Number(value).toFixed(step < 1 ? 3 : 0)}</span>
        `;
      }
      case 'zodboolean':
      case 'boolean':
        return html`<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          ${renderField({ type: 'toggle' }, Boolean(value), change)}
          <span style="color:var(--colors-semantic-text-primary);font-size:0.75rem;">${value ? 'Enabled' : 'Disabled'}</span>
        </label>`;
      default:
        return renderField({ type: 'text' }, String(value ?? ''), change);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'config-hud': ConfigHUD;
  }
}