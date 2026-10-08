import { render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderField, type FieldSpec, type FieldValue } from '../../src/client/utils/render-field.js';

describe('renderField', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  const mount = (
    spec: FieldSpec,
    value: FieldValue,
    onChange: (value: FieldValue) => void
  ): void => {
    render(renderField(spec, value, onChange), container);
  };

  it('slider emits a number on input', () => {
    const onChange = vi.fn();
    mount({ type: 'slider', min: 0, max: 1, step: 0.01 }, 0.5, onChange);
    const input = container.querySelector('input[type=range]') as HTMLInputElement;
    expect(input.value).toBe('0.5');
    input.value = '0.25';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith(0.25);
  });

  it('dropdown marks the current option and emits on change', () => {
    const onChange = vi.fn();
    mount({ type: 'dropdown', options: ['a', { value: 'b', label: 'Bee' }] }, 'b', onChange);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('b');
    expect(select.options[1]?.textContent?.trim()).toBe('Bee');
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('toggle emits a boolean', () => {
    const onChange = vi.fn();
    mount({ type: 'toggle' }, true, onChange);
    const input = container.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(input.checked).toBe(true);
    input.checked = false;
    input.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('text emits only on change', () => {
    const onChange = vi.fn();
    mount({ type: 'text', placeholder: 'hi' }, 'x', onChange);
    const input = container.querySelector('input[type=text]') as HTMLInputElement;
    input.value = 'y';
    input.dispatchEvent(new Event('input'));
    expect(onChange).not.toHaveBeenCalled();
    input.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith('y');
  });

  it('search emits on input and carries its accessible name', () => {
    const onChange = vi.fn();
    mount({ type: 'search', ariaLabel: 'Search nodes' }, '', onChange);
    const input = container.querySelector('input[type=search]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search nodes');
    input.value = 'cat';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('cat');
  });
});