/**
 * Tool approval overlay (§0.5). Modal dialog for confirming tool calls,
 * including the `prompt_user` tool for system-initiated questions/forms.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ToolCall } from '@senars/util';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';
import { setApprovalHandler, type ToolSpec } from '../../core/tool-registry.js';

interface PendingCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  spec: ToolSpec;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

@customElement('s-tool-approval')
export class ToolApprovalView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(560px, 94vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .panel { display: flex; flex-direction: column; max-height: 80vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .icon { font-size: var(--typography-scale-xl); }
    .title { flex: 1; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .close { border: none; background: transparent; color: var(--colors-semantic-text-muted); cursor: pointer; font-size: var(--typography-scale-base); }
    .body { padding: var(--spacing-scale-3); overflow: auto; display: flex; flex-direction: column; gap: var(--spacing-scale-3); }
    .tool-info { display: flex; flex-direction: column; gap: var(--spacing-scale-1); }
    .tool-name { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-lg); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-semantic-text-primary); }
    .tool-desc { color: var(--colors-semantic-text-secondary); font-size: var(--typography-scale-sm); }
    .args { display: flex; flex-direction: column; gap: var(--spacing-scale-2); }
    .arg { display: flex; flex-direction: column; gap: var(--spacing-scale-1); }
    .arg-label { font-size: var(--typography-scale-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--colors-semantic-text-muted); }
    .arg-value { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-primary); background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-input); padding: var(--spacing-scale-2); overflow: auto; max-height: 200px; }
    .form-field { display: flex; flex-direction: column; gap: var(--spacing-scale-1); }
    .form-field label { font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-secondary); }
    .form-field input, .form-field select, .form-field textarea { padding: var(--spacing-scale-2); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-input); background: var(--colors-semantic-bg-base); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline: none; border-color: var(--colors-semantic-border-focus); }
    .actions { display: flex; gap: var(--spacing-scale-2); justify-content: flex-end; padding-top: var(--spacing-scale-2); border-top: 1px solid var(--colors-semantic-border-subtle); }
    .btn { padding: var(--spacing-scale-2) var(--spacing-scale-3); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    .btn.primary { background: var(--colors-semantic-accent-primary); color: var(--colors-semantic-bg-base); border-color: transparent; }
    .btn.primary:hover { background: var(--colors-semantic-accent-primary-hover); }
    .btn.danger { border-color: var(--colors-primitive-error); color: var(--colors-primitive-error); }
    .btn.danger:hover { background: var(--colors-primitive-error); color: var(--colors-semantic-bg-base); }
    .empty { color: var(--colors-semantic-text-muted); text-align: center; padding: var(--spacing-scale-4); }
  `;

  @state() private queue: PendingCall[] = [];
  @state() private current: PendingCall | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    setApprovalHandler(this.handleApprovalRequired.bind(this));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    setApprovalHandler(undefined);
  }

  private handleApprovalRequired(call: ToolCall, spec: ToolSpec): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const pending: PendingCall = {
        id: call.toolCallId,
        name: call.toolName,
        args: call.args as Record<string, unknown>,
        spec,
        resolve,
        reject,
      };
      this.queue.push(pending);
      if (!this.current) this.next();
      this.requestUpdate();
    });
  }

  private next(): void {
    this.current = this.queue.shift() ?? null;
    this.requestUpdate();
  }

  private renderArgs(args: Record<string, unknown>, spec: ToolSpec): TemplateResult {
    const props = spec.parameters?.properties as Record<string, unknown> | undefined;
    if (!props || Object.keys(args).length === 0) {
      return html`<p class="empty">No arguments</p>`;
    }

    // For prompt_user, render a live form instead of JSON
    if (this.current?.name === 'prompt_user') {
      return this.renderPromptForm(args, props);
    }

    return html`
      <div class="args">
        ${Object.entries(args).map(([key, value]) => html`
          <div class="arg">
            <span class="arg-label">${key}</span>
            <pre class="arg-value">${JSON.stringify(value, null, 2)}</pre>
          </div>
        `)}
      </div>
    `;
  }

  private renderPromptForm(args: Record<string, unknown>, props: Record<string, unknown>): TemplateResult {
    const formArgs = args as {
      promptType?: 'question' | 'confirm' | 'form' | 'select';
      title?: string;
      message?: string;
      schema?: Record<string, unknown>;
      required?: boolean;
      choices?: Array<{ value: string; label: string }>;
    };

    const promptContent = this.renderPromptContent(formArgs, props, args);
    return html`
      <div class="tool-info">
        <span class="tool-name">${formArgs.title ?? 'Prompt'}</span>
        <span class="tool-desc">${formArgs.message}</span>
      </div>
      <div class="args">
        ${promptContent}
      </div>
    `;
  }

  private renderPromptContent(formArgs: { promptType?: string; choices?: Array<{ value: string; label: string }> }, props: Record<string, unknown>, args: Record<string, unknown>): TemplateResult {
    switch (formArgs.promptType) {
      case 'confirm':
        return html`<p class="arg-value">Confirm?</p>`;
      case 'question':
        return html`
          <div class="form-field">
            <label>Answer</label>
            <input type="text" .value=${String(args.answer ?? '')} @input=${(e: Event) => this.updateFormArg('answer', (e.target as HTMLInputElement).value)} />
          </div>
        `;
      case 'select':
        return html`
          <div class="form-field">
            <label>Choose</label>
            <select .value=${String(args.choice ?? '')} @change=${(e: Event) => this.updateFormArg('choice', (e.target as HTMLSelectElement).value)}>
              <option value="">Select…</option>
              ${(formArgs.choices ?? []).map((c) => html`<option value=${c.value}>${c.label}</option>`)}
            </select>
          </div>
        `;
      case 'form':
        if (args.schema) {
          return this.renderFormFields(args.schema as Record<string, unknown>, args);
        }
        return html`<pre class="arg-value">${JSON.stringify(args, null, 2)}</pre>`;
      default:
        return html`<pre class="arg-value">${JSON.stringify(args, null, 2)}</pre>`;
    }
  }

  private renderFormFields(schema: Record<string, unknown>, currentValues: Record<string, unknown>): TemplateResult {
    const props = (schema.properties as Record<string, unknown>) ?? {};
    const required = (schema.required as string[]) ?? [];

    return html`
      ${Object.entries(props).map(([key, prop]) => this.renderFormField(key, prop as { type: string; title?: string; enum?: string[]; format?: string }, required.includes(key), currentValues[key]))}
    `;
  }

  private renderFormField(key: string, propDef: { type: string; title?: string; enum?: string[]; format?: string }, isRequired: boolean, currentValue: unknown): TemplateResult {
    const label = `${propDef.title ?? key}${isRequired ? ' *' : ''}`;
    if (propDef.enum) {
      return html`
        <div class="form-field">
          <label>${label}</label>
          <select .value=${String(currentValue ?? '')} @change=${(e: Event) => this.updateFormArg(key, (e.target as HTMLSelectElement).value)}>
            <option value="">Select…</option>
            ${propDef.enum.map((v) => html`<option value=${v}>${v}</option>`)}
          </select>
        </div>
      `;
    }
    if (propDef.format === 'textarea' || propDef.type === 'string') {
      return html`
        <div class="form-field">
          <label>${label}</label>
          <textarea .value=${String(currentValue ?? '')} @input=${(e: Event) => this.updateFormArg(key, (e.target as HTMLTextAreaElement).value)} rows="3"></textarea>
        </div>
      `;
    }
    if (propDef.type === 'number') {
      return html`
        <div class="form-field">
          <label>${label}</label>
          <input type="number" .value=${String(currentValue ?? '')} @input=${(e: Event) => this.updateFormArg(key, Number((e.target as HTMLInputElement).value))} />
        </div>
      `;
    }
    if (propDef.type === 'boolean') {
      return html`
        <div class="form-field">
          <label>${label}</label>
          <input type="checkbox" .checked=${Boolean(currentValue)} @change=${(e: Event) => this.updateFormArg(key, (e.target as HTMLInputElement).checked)} />
        </div>
      `;
    }
    return html`
      <div class="form-field">
        <label>${label}</label>
        <input type="text" .value=${String(currentValue ?? '')} @input=${(e: Event) => this.updateFormArg(key, (e.target as HTMLInputElement).value)} />
      </div>
    `;
  }

  private updateFormArg(key: string, value: unknown): void {
    if (!this.current) return;
    this.current.args[key] = value;
    this.requestUpdate();
  }

  protected override renderBody() {
    if (!this.current) return html``;

    return html`
      <div class="panel" role="dialog" aria-modal="true" aria-label="Tool approval">
        <overlay-header
          overlay-id="tool-approval"
          .kind=${this.current.name === 'prompt_user' ? '❓' : '🔧'}
          .title=${this.current.spec.title ?? this.current.name}
          .draggable=${true}
          .resizable=${true}
          .pinnable=${false}
          .closeable=${true}
          @header-close=${this.onReject}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div class="body">
          ${this.renderArgs(this.current.args, this.current.spec)}
          <div class="actions">
            <button class="btn danger" @click=${this.onReject}>Cancel</button>
            <button class="btn primary" @click=${this.onApprove}>Approve</button>
          </div>
        </div>
      </div>
    `;
  }

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  private onApprove = (): void => {
    if (!this.current) return;
    const { resolve, args } = this.current;
    this.current = null;
    resolve(args);
    this.next();
    this.requestUpdate();
  };

  private onReject = (): void => {
    if (!this.current) return;
    const { reject } = this.current;
    this.current = null;
    reject(new Error('User cancelled'));
    this.next();
    this.requestUpdate();
  };
}

const TOOL_APPROVAL_SURFACE = { id: 'tool-approval', title: 'Tool approval', group: 'overlay' } as const;

defineSurface(TOOL_APPROVAL_SURFACE, ToolApprovalView);
registerOverlay({
  id: TOOL_APPROVAL_SURFACE.id,
  title: TOOL_APPROVAL_SURFACE.title,
  tag: surfaceTag(TOOL_APPROVAL_SURFACE),
  modal: true,
  hiddenInPalette: true,
});

declare global {
  interface HTMLElementTagNameMap {
    's-tool-approval': ToolApprovalView;
  }
}