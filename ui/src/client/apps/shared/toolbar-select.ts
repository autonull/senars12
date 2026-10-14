/**
 * ToolbarSelect — reusable select component for app toolbars.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LitElement } from 'lit';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@customElement('toolbar-select')
export class ToolbarSelect extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    select {
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      min-width: 120px;
    }
    select:focus {
      border-color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    label {
      font-size: 12px;
      color: var(--colors-semantic-text-muted);
      white-space: nowrap;
    }
  `;

  @property({ type: String }) selectLabel = '';
  @property({ type: String }) selectedValue = '';
  @property({ type: Array }) options: SelectOption[] = [];
  @property({ type: String }) selectAriaLabel = '';
  @property({ type: Boolean }) disabled = false;

  private handleChange = (e: Event): void => {
    const select = e.target as HTMLSelectElement;
    this.selectedValue = select.value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.selectedValue }, bubbles: true }));
  };

protected override render(): unknown {
    return html`
      ${this.selectLabel ? html`<label>${this.selectLabel}</label>` : nothing}
      <select
        .value=${this.selectedValue}
        @change=${this.handleChange}
        ?disabled=${this.disabled}
        aria-label=${this.selectAriaLabel || this.selectLabel}
      >
        ${this.options.map((opt) => html`
          <option value=${opt.value} ?disabled=${opt.disabled} ?selected=${opt.value === this.selectedValue}>
            ${opt.label}
          </option>
        `)}
      </select>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toolbar-select': ToolbarSelect;
  }
}