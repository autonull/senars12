import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LensSpecSchema } from '../../shared/lens-schema.js';
import type { LensSpec, ModulationSpec } from '../../shared/lens-schema.js';
import {
  $activeLens,
  $graphNodes,
  $lensFields,
  $lensRegistry,
  $panels,
  BaseComponent,
  evaluateLens,
  getItems,
  registerLens,
  send,
} from '../core/index.js';
import { evaluate } from '../modulation/evaluate.js';
import { compile } from '../modulation/compile.js';
import { getMemoCache } from '../modulation/memo.js';
import { beliefLens } from '../modulation/compile.js';
import type { Delta } from '../modulation/types.js';

/** Fields available for lens mapping, with type info for the UI. */
export interface FieldOption {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'object';
}

const FALLBACK_FIELDS: FieldOption[] = [
  { key: 'priority', label: 'Priority', type: 'number' },
  { key: 'confidence', label: 'Confidence', type: 'number' },
  { key: 'isContradiction', label: 'Is Contradiction', type: 'boolean' },
  { key: 'truth', label: 'Truth (frequency)', type: 'object' },
  { key: 'occurrenceTime', label: 'Occurrence Time', type: 'number' },
  { key: 'goalRelevance', label: 'Goal Relevance', type: 'number' },
  { key: 'nodeType', label: 'Node Type', type: 'string' },
];

const CHANNEL_OPTIONS = [
  { key: 'color', label: 'Color' },
  { key: 'opacity', label: 'Opacity' },
  { key: 'size', label: 'Size' },
  { key: 'label', label: 'Label' },
  { key: 'stroke.dash', label: 'Stroke Dash' },
  { key: 'stroke.width', label: 'Stroke Width' },
  { key: 'z', label: 'Z Index' },
  { key: 'flow.enable', label: 'Flow Animation' },
  { key: 'line-style', label: 'Line Style' },
  { key: 'width', label: 'Width' },
  { key: 'edge-color', label: 'Edge Color' },
];

const SCALE_MAP_OPTIONS = [
  { key: '', label: 'None (direct value)' },
  { key: 'truth-to-color', label: 'Truth → Color (red→green)' },
  { key: 'priority-to-size', label: 'Priority → Size' },
  { key: 'confidence-to-opacity', label: 'Confidence → Opacity' },
];

interface Mapping {
  id: string;
  op: 'field' | 'const';
  field: string;
  channel: string;
  map: string;
  constValue: string;
}

let mappingCounter = 0;
function newMappingId(): string {
  return `mapping-${++mappingCounter}`;
}

function createEmptyMapping(): Mapping {
  return {
    id: newMappingId(),
    op: 'field',
    field: 'priority',
    channel: 'size',
    map: 'priority-to-size',
    constValue: '',
  };
}

function mappingsToModulationSpec(mappings: Mapping[]): ModulationSpec {
  const children: ModulationSpec[] = [];
  for (const m of mappings) {
    let child: ModulationSpec;
    if (m.op === 'const') {
      const num = Number.parseFloat(m.constValue);
      child = { op: 'const', value: Number.isNaN(num) ? m.constValue : num };
    } else {
      child = m.map
        ? { op: 'field', field: m.field, map: m.map }
        : { op: 'field', field: m.field };
    }
    children.push({ op: 'channel', channel: m.channel, child });
  }
  return children.length === 1 ? children[0] as ModulationSpec : { op: 'union', children };
}

function buildLensSpec(name: string, description: string, mappings: Mapping[]): LensSpec {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    label: name,
    description,
    modulation: mappingsToModulationSpec(mappings),
  };
}

@customElement('lens-designer')
export class LensDesigner extends BaseComponent {
  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); }
    .scroll { flex: 1; overflow-y: auto; padding: var(--spacing-scale-3); }
    .section-title { font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); text-transform: uppercase; letter-spacing: 1px; margin: var(--spacing-scale-3) 0 var(--spacing-scale-2); }
    .field-row { display: flex; align-items: center; gap: var(--spacing-scale-2); margin-bottom: var(--spacing-scale-2); padding: var(--spacing-scale-2); background: var(--colors-semantic-bg-panel); border-radius: var(--borderRadius-component-panel); border: 1px solid var(--colors-semantic-border-subtle); }
    .field-row select, .field-row input { background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-input); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: var(--spacing-scale-1) var(--spacing-scale-2); outline: none; }
    .field-row select:focus, .field-row input:focus { border-color: var(--colors-semantic-border-focus); }
    .field-row .remove-btn { background: none; border: none; color: var(--colors-primitive-error); cursor: pointer; font-size: 1rem; padding: 2px 4px; line-height: 1; }
    .field-row .remove-btn:hover { opacity: 0.7; }
    .add-btn { display: flex; align-items: center; gap: var(--spacing-scale-1); width: 100%; padding: var(--spacing-scale-2); border: 1px dashed var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); background: transparent; color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); cursor: pointer; transition: var(--transitions-fast); justify-content: center; }
    .add-btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }

    .meta-row { display: flex; gap: var(--spacing-scale-2); margin-bottom: var(--spacing-scale-3); }
    .meta-row input { flex: 1; background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-input); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: var(--spacing-scale-1) var(--spacing-scale-2); outline: none; }
    .meta-row input:focus { border-color: var(--colors-semantic-border-focus); }

    .preview-box { background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); padding: var(--spacing-scale-2); margin-bottom: var(--spacing-scale-3); font-family: monospace; font-size: 0.65rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto; color: var(--colors-semantic-text-secondary); }
    .preview-box.error { border-color: var(--colors-primitive-error); color: var(--colors-primitive-error); }

    .validation-error { color: var(--colors-primitive-error); font-size: 0.65rem; padding: var(--spacing-scale-2); border: 1px solid var(--colors-primitive-error); border-radius: var(--borderRadius-component-panel); margin-bottom: var(--spacing-scale-2); }

    .actions { display: flex; gap: var(--spacing-scale-2); padding: var(--spacing-scale-3); border-top: 1px solid var(--colors-semantic-border-subtle); }
    .commit-btn { flex: 1; padding: var(--spacing-scale-2); border: none; border-radius: var(--borderRadius-component-button); background: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-on-accent); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); cursor: pointer; font-weight: var(--typography-fontWeights-semibold); transition: var(--transitions-fast); }
    .commit-btn:hover { opacity: 0.9; }
    .commit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .op-toggle { display: flex; align-items: center; gap: var(--spacing-scale-1); }
    .op-toggle label { font-size: 0.6rem; color: var(--colors-semantic-text-muted); cursor: pointer; }
    .op-toggle input[type=checkbox] { accent-color: var(--colors-semantic-accent-primary); }

    .preview-stats { display: flex; gap: var(--spacing-scale-3); padding: var(--spacing-scale-2); background: var(--colors-semantic-bg-panel); border-radius: var(--borderRadius-component-panel); margin-bottom: var(--spacing-scale-2); }
    .preview-stat { display: flex; flex-direction: column; }
    .preview-stat-label { font-size: 0.6rem; color: var(--colors-semantic-text-muted); text-transform: uppercase; }
    .preview-stat-value { font-size: 0.75rem; color: var(--colors-semantic-text-primary); font-weight: var(--typography-fontWeights-semibold); }
  `;

  @state() private name = '';
  @state() private description = '';
  @state() private mappings: Mapping[] = [createEmptyMapping()];
  @state() private validationError = '';
  @state() private previewJson = '';
  @state() private previewDelta: Delta | null = null;
  @state() private nodeCount = 0;

  private get fieldOptions(): FieldOption[] {
    const serverFields = $lensFields.get();
    return serverFields.length > 0 ? serverFields : FALLBACK_FIELDS;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.watch($graphNodes);
    this.watch($lensFields);
    this.nodeCount = $graphNodes.get().size;
  }

  override render() {
    const canCommit = this.name.trim().length > 0 && !this.validationError;

    return html`
      <div class="scroll">
        <div class="section-title">Lens Definition</div>
        <div class="meta-row">
          <input type="text" placeholder="Lens name…" .value=${this.name} @input=${this.onNameInput} />
          <input type="text" placeholder="Description (optional)" .value=${this.description} @input=${this.onDescInput} />
        </div>

        <div class="section-title">Mappings</div>
        ${this.mappings.map((m, i) => this.renderMapping(m, i))}

        <button class="add-btn" @click=${this.addMapping}>+ Add mapping</button>

        ${this.validationError ? html`<div class="validation-error">${this.validationError}</div>` : ''}

        <div class="section-title">Live Preview</div>
        ${this.renderPreview()}
        <div class="preview-box ${this.validationError ? 'error' : ''}">${this.previewJson || 'Adjust mappings to see preview'}</div>
      </div>

      <div class="actions">
        <button class="commit-btn" ?disabled=${!canCommit} @click=${this.commitLens}>
          ${canCommit ? `Create "${this.name}" & Apply` : 'Enter a lens name'}
        </button>
      </div>
    `;
  }

  private renderMapping(m: Mapping, i: number) {
    return html`
      <div class="field-row">
        <select @change=${(e: Event) => this.updateMapping(i, 'op', (e.target as HTMLSelectElement).value)}
          style="width:60px" .value=${m.op}>
          <option value="field">Field</option>
          <option value="const">Const</option>
        </select>

        ${m.op === 'field' ? html`
          <select @change=${(e: Event) => this.updateMapping(i, 'field', (e.target as HTMLSelectElement).value)}
            style="flex:1" .value=${m.field}>
            ${this.fieldOptions.map(f => html`<option value=${f.key}>${f.label}</option>`)}
          </select>
        ` : html`
          <input type="text" placeholder="Value…" style="flex:1" .value=${m.constValue}
            @input=${(e: Event) => this.updateMapping(i, 'constValue', (e.target as HTMLInputElement).value)} />
        `}

        <span style="color:var(--colors-semantic-text-muted)">→</span>

        <select @change=${(e: Event) => this.updateMapping(i, 'channel', (e.target as HTMLSelectElement).value)}
          style="flex:1" .value=${m.channel}>
          ${CHANNEL_OPTIONS.map(c => html`<option value=${c.key}>${c.label}</option>`)}
        </select>

        ${m.op === 'field' ? html`
          <select @change=${(e: Event) => this.updateMapping(i, 'map', (e.target as HTMLSelectElement).value)}
            style="flex:1.5" .value=${m.map}>
            ${SCALE_MAP_OPTIONS.map(s => html`<option value=${s.key}>${s.label}</option>`)}
          </select>
        ` : ''}

        ${this.mappings.length > 1 ? html`
          <button class="remove-btn" @click=${() => this.removeMapping(i)} title="Remove">✕</button>
        ` : ''}
      </div>
    `;
  }

  private renderPreview() {
    const stats = this.computePreviewStats();
    if (!stats) return html`<div style="color:var(--colors-semantic-text-muted);padding:var(--spacing-scale-2)">No nodes to preview (send a message first)</div>`;

    return html`
      <div class="preview-stats">
        <div class="preview-stat">
          <span class="preview-stat-label">Nodes</span>
          <span class="preview-stat-value">${stats.nodeCount}</span>
        </div>
        <div class="preview-stat">
          <span class="preview-stat-label">Channels</span>
          <span class="preview-stat-value">${stats.channelCount}</span>
        </div>
        ${stats.colorSample ? html`
        <div class="preview-stat">
          <span class="preview-stat-label">Sample Color</span>
          <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${stats.colorSample};border:1px solid var(--colors-semantic-border-subtle)"></span>
        </div>` : ''}
        ${stats.sizeSample !== undefined ? html`
        <div class="preview-stat">
          <span class="preview-stat-label">Sample Size</span>
          <span class="preview-stat-value">${stats.sizeSample.toFixed(0)}</span>
        </div>` : ''}
      </div>
    `;
  }

  private computePreviewStats(): { nodeCount: number; channelCount: number; colorSample?: string; sizeSample?: number } | null {
    if (!this.previewDelta || this.previewDelta.size === 0) return null;
    const entries = Array.from(this.previewDelta.entries());
    const firstEntry = entries[0]?.[1];
    const channels = firstEntry ? Object.keys(firstEntry) : [];
    const colorSample = firstEntry?.color as string | undefined;
    const sizeSample = firstEntry?.size as number | undefined;
    return {
      nodeCount: this.previewDelta.size,
      channelCount: channels.length,
      colorSample,
      sizeSample,
    };
  }

  private onNameInput(e: Event) {
    this.name = (e.target as HTMLInputElement).value;
    this.rebuildPreview();
  }

  private onDescInput(e: Event) {
    this.description = (e.target as HTMLInputElement).value;
  }

  private updateMapping(index: number, key: keyof Mapping, value: string) {
    const mappings = this.mappings.map(m => ({ ...m }));
    const target = mappings[index];
    if (target) {
      (target as Record<string, string>)[key] = value;
    }
    this.mappings = mappings;
    this.rebuildPreview();
  }

  private addMapping() {
    this.mappings = [...this.mappings, createEmptyMapping()];
  }

  private removeMapping(index: number) {
    this.mappings = this.mappings.filter((_, i) => i !== index);
    this.rebuildPreview();
  }

  private rebuildPreview() {
    const spec = buildLensSpec(this.name || 'preview', this.description, this.mappings);
    const parsed = LensSpecSchema.safeParse(spec);
    if (!parsed.success) {
      this.validationError = parsed.error.issues.map((e: { path: (string | symbol | number)[]; message: string }) => `${String(e.path.join('.'))}: ${e.message}`).join('; ');
      this.previewJson = JSON.stringify(spec.modulation, null, 2);
      this.previewDelta = null;
      return;
    }
    this.validationError = '';
    this.previewJson = JSON.stringify(spec.modulation, null, 2);

    try {
      const items = getItems();
      if (items.length === 0) {
        this.previewDelta = null;
        return;
      }
      const modulated = compile(spec as Parameters<typeof compile>[0]);
      const view = { flags: { reducedMotion: false, highContrast: false, prefersColorScheme: 'dark' as const }, timeline: { t: Number.POSITIVE_INFINITY } };
      const delta = evaluate(items, { id: spec.id, label: spec.label, description: spec.description, modulation: modulated }, view);
      this.previewDelta = delta;
      this.nodeCount = items.length;
    } catch {
      this.previewDelta = null;
    }
  }

  private commitLens() {
    if (!this.name.trim()) return;

    const spec = buildLensSpec(this.name, this.description, this.mappings);
    const parsed = LensSpecSchema.safeParse(spec);
    if (!parsed.success) {
      this.validationError = parsed.error.issues.map((e: { path: (string | symbol | number)[]; message: string }) => `${String(e.path.join('.'))}: ${e.message}`).join('; ');
      return;
    }

    const lensSpec = parsed.data as unknown as LensSpec;

    // Register locally
    registerLens(lensSpec);

    // Send to server
    send({ type: 'lens.define', lens: lensSpec });

    // Switch to the new lens
    $activeLens.set(lensSpec.id);
    send({ type: 'lens.set', lens: lensSpec.id });

    // Close the panel
    const panels = new Map($panels.get());
    const panel = panels.get('lens-designer');
    if (panel) {
      panels.set('lens-designer', { ...panel, open: false });
      $panels.set(panels);
    }

    // Reset form
    this.name = '';
    this.description = '';
    this.mappings = [createEmptyMapping()];
    this.previewJson = '';
    this.previewDelta = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lens-designer': LensDesigner;
  }
}
