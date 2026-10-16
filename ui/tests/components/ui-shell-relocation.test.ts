import { defineCatalog } from '@senars/ui-shell/framework';
import { describe, expect, it } from 'vitest';

describe('ui-shell public import path', () => {
  it('resolves relocated framework module', () => {
    const cat = defineCatalog({ a: { label: 'A' } } as const);
    expect(cat.ids).toEqual(['a']);
  });
});
