import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/client/components/views/index.js';
import { diffLines } from '../../src/client/core/diff.js';
import { DiffView } from '../../src/client/components/views/diff-view.js';
import type { DiffDataset } from '../../src/client/core/view-spec.js';

describe('diffLines', () => {
  it('keeps shared lines and marks the rest as del/add', () => {
    expect(diffLines('a\nb\nd', 'a\nc\nd')).toEqual([
      { kind: 'context', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'c' },
      { kind: 'context', text: 'd' },
    ]);
  });

  it('is all context for identical texts and all add/del for disjoint ones', () => {
    expect(diffLines('x', 'x')).toEqual([{ kind: 'context', text: 'x' }]);
    expect(diffLines('x', 'y')).toEqual([
      { kind: 'del', text: 'x' },
      { kind: 'add', text: 'y' },
    ]);
  });
});

describe('s-diff', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  const mount = async (data: DiffDataset, budget: 'full' | 'embedded' = 'full') => {
    const el = document.createElement('s-diff') as DiffView;
    el.budget = budget;
    el.data = data;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  };

  it('renders a row per line with add/del/context signs', async () => {
    const el = await mount({ kind: 'diff', lines: diffLines('a\nb', 'a\nc') });
    const rows = [...(el.shadowRoot?.querySelectorAll('.row') ?? [])];
    expect(rows.map((row) => row.className)).toEqual(['row context', 'row del', 'row add']);
    expect(rows.map((row) => row.querySelector('.sign')?.textContent)).toEqual([' ', '-', '+']);
  });

  it('truncates long diffs with a count when embedded', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({
      kind: 'context' as const,
      text: `l${i}`,
    }));
    const el = await mount({ kind: 'diff', lines }, 'embedded');
    expect(el.shadowRoot?.querySelectorAll('.row').length).toBe(12);
    expect(el.shadowRoot?.querySelector('.more')?.textContent).toContain('8 more lines');
  });
});
