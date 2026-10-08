import { html, nothing, type TemplateResult } from 'lit';

/**
 * The one renderer for a form control. Panels hand-rolled every `<input>` /
 * `<select>` / `<option>` (config, lens designer, inspector, filters); this maps
 * a `FieldSpec` to its control and normalizes the emitted value, so a field's
 * kind/range/options live in the caller's data and never in bespoke markup.
 */

export type FieldControlType =
  | 'slider'
  | 'dropdown'
  | 'text'
  | 'number'
  | 'search'
  | 'textarea'
  | 'toggle';

export type FieldOption = string | { value: string; label: string };

export interface FieldSpec {
  type: FieldControlType;
  /** Dropdown choices; a string is its own value and label. */
  options?: readonly FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name for the control. */
  ariaLabel?: string;
  /** DOM event to emit on; defaults to `input` for continuous controls, `change` otherwise. */
  on?: 'input' | 'change';
  style?: string;
  className?: string;
}

export type FieldValue = string | number | boolean;

const CONTINUOUS: ReadonlySet<FieldControlType> = new Set(['slider', 'search', 'textarea']);

const optionParts = (option: FieldOption): { value: string; label: string } =>
  typeof option === 'string' ? { value: option, label: option } : option;

const attrs = (spec: FieldSpec) => ({
  class: spec.className ?? nothing,
  style: spec.style ?? nothing,
  disabled: spec.disabled ?? false,
});

/**
 * Render the control for `spec`. `onChange` receives the normalized value:
 * a number for `slider`/`number`, a boolean for `toggle`, a string otherwise.
 */
export function renderField(
  spec: FieldSpec,
  value: FieldValue,
  onChange: (value: FieldValue) => void
): TemplateResult {
  const { class: className, style, disabled } = attrs(spec);
  const stringValue = String(value);

  if (spec.type === 'slider') {
    return html`<input
      type="range"
      class=${className}
      style=${style}
      ?disabled=${disabled}
      aria-label=${spec.ariaLabel ?? nothing}
      min=${spec.min ?? 0}
      max=${spec.max ?? 1}
      step=${spec.step ?? 0.01}
      .value=${stringValue}
      @input=${(e: Event) =>
        onChange(Number.parseFloat((e.target as HTMLInputElement).value))}
    />`;
  }

  if (spec.type === 'dropdown') {
    return html`<select
      class=${className}
      style=${style}
      ?disabled=${disabled}
      aria-label=${spec.ariaLabel ?? nothing}
      .value=${stringValue}
      @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}
    >
      ${(spec.options ?? []).map((option) => {
        const { value: optionValue, label } = optionParts(option);
        return html`<option value=${optionValue} ?selected=${optionValue === stringValue}>
          ${label}
        </option>`;
      })}
    </select>`;
  }

  if (spec.type === 'toggle') {
    return html`<input
      type="checkbox"
      class=${className}
      style=${style}
      ?disabled=${disabled}
      aria-label=${spec.ariaLabel ?? nothing}
      ?checked=${Boolean(value)}
      @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
    />`;
  }

  if (spec.type === 'textarea') {
    return html`<textarea
      class=${className}
      style=${style}
      ?disabled=${disabled}
      aria-label=${spec.ariaLabel ?? nothing}
      placeholder=${spec.placeholder ?? nothing}
      .value=${stringValue}
      @input=${(e: Event) => onChange((e.target as HTMLTextAreaElement).value)}
    ></textarea>`;
  }

  const continuous = (spec.on ?? (CONTINUOUS.has(spec.type) ? 'input' : 'change')) === 'input';
  const readValue = (target: EventTarget | null) => {
    const raw = (target as HTMLInputElement).value;
    return spec.type === 'number' ? Number.parseFloat(raw) : raw;
  };
  const handleInput = (e: Event) => onChange(readValue(e.target));
  const handleChange = (e: Event) => onChange(readValue(e.target));

  return html`<input
    type=${spec.type}
    class=${className}
    style=${style}
    ?disabled=${disabled}
    aria-label=${spec.ariaLabel ?? nothing}
    placeholder=${spec.placeholder ?? nothing}
    .value=${stringValue}
    @input=${continuous ? handleInput : nothing}
    @change=${continuous ? nothing : handleChange}
  />`;
}