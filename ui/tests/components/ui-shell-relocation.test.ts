import { defineCatalog, registerSurface, resetSurfaces, surfaceTag } from '@senars/ui-shell/framework';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ui-shell public import path', () => {
  beforeEach(() => resetSurfaces());

  it('resolves relocated framework module', () => {
    const cat = defineCatalog({ a: { label: 'A' } } as const);
    expect(cat.ids).toEqual(['a']);
  });

  it('resolves the relocated surface registry', () => {
    registerSurface({ id: 'panel-x', title: 'Panel X' });
    expect(surfaceTag({ id: 'panel-x', title: 'Panel X' })).toBe('s-panel-x');
  });
});
