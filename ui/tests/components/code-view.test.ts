import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/client/components/views/index.js';
import { CodeView } from '../../src/client/components/views/code-view.js';
import { tokenizeCode } from '../../src/client/components/views/code-highlight.js';
import type { CodeDataset } from '../../src/client/core/view-spec.js';

const code: CodeDataset = {
  kind: 'code',
  language: 'ts',
  lines: ['const x = "hi" + 42; // tail', 'return x;'],
};

const kindOf = (line: string, text: string, language?: string) =>
  tokenizeCode(line, language).find((token) => token.text === text)?.kind;

describe('tokenizeCode', () => {
  it('preserves every character and classifies tokens', () => {
    const line = code.lines[0]!;
    expect(
      tokenizeCode(line, 'ts')
        .map((token) => token.text)
        .join('')
    ).toBe(line);
    expect(kindOf(line, 'const', 'ts')).toBe('keyword');
    expect(kindOf(line, '"hi"', 'ts')).toBe('string');
    expect(kindOf(line, '42', 'ts')).toBe('number');
    expect(kindOf(line, '// tail', 'ts')).toBe('comment');
  });

  it('treats # as a comment only in hash-comment languages', () => {
    expect(kindOf('# note', '# note', 'py')).toBe('comment');
    expect(kindOf('# note', '# note', 'ts')).toBe('plain');
  });
});

describe('s-code', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  const mount = async (data: CodeDataset, budget: 'full' | 'embedded' = 'full') => {
    const el = document.createElement('s-code') as CodeView;
    el.budget = budget;
    el.data = data;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  };

  it('renders a line-number gutter and highlights tokens', async () => {
    const el = await mount(code);
    expect(el.shadowRoot?.querySelectorAll('.gutter span').length).toBe(2);
    expect(el.shadowRoot?.querySelectorAll('.line').length).toBe(2);
    expect(el.shadowRoot?.querySelector('.keyword')?.textContent).toBe('const');
    expect(el.shadowRoot?.querySelector('.code')?.getAttribute('data-language')).toBe('ts');
  });

  it('truncates long code with a count when embedded', async () => {
    const el = await mount(
      { kind: 'code', lines: Array.from({ length: 20 }, (_, i) => `line${i}`) },
      'embedded'
    );
    expect(el.shadowRoot?.querySelectorAll('.line').length).toBe(8);
    expect(el.shadowRoot?.querySelector('.more')?.textContent).toContain('12 more lines');
  });

  it('renders an empty slot for empty code', async () => {
    const el = await mount({ kind: 'code', lines: [] });
    expect(el.shadowRoot?.querySelector('.empty')).toBeTruthy();
  });
});
