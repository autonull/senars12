import { describe, expect, it } from 'vitest';
import {
  generateSurfaces,
  surfaceA11y,
  surfaceDoc,
  surfaceGalleryCell,
  surfaceStory,
} from '../../src/client/core/surface-codegen.js';
import {
  getSurfaces,
  registerSurface,
  surfaceFor,
  surfaceTag,
} from '../../src/client/core/surface-registry.js';

const descriptor = {
  id: 'probe',
  title: 'Probe',
  group: 'Test',
  bindings: { tick: { get: () => 1, subscribe: () => () => {} } },
};

describe('surface registry + generators', () => {
  it('registers a descriptor and looks it up by id', () => {
    registerSurface(descriptor);
    expect(surfaceFor('probe')).toBe(descriptor);
    expect(getSurfaces()).toContain(descriptor);
  });

  it('derives the tag from the id unless one is given', () => {
    expect(surfaceTag(descriptor)).toBe('s-probe');
    expect(surfaceTag({ id: 'x', title: 'X', tag: 'legacy-x' })).toBe('legacy-x');
  });

  it('generates each reflective artifact from one descriptor', () => {
    registerSurface(descriptor);
    expect(surfaceStory(descriptor)).toEqual({
      title: 'Test/Probe',
      name: 'Default',
      tags: ['autodocs'],
      parameters: { a11y: { config: { rules: {} } } },
    });
    expect(surfaceGalleryCell(descriptor)).toEqual({
      id: 'probe',
      group: 'Test',
      title: 'Probe',
      tag: 's-probe',
    });
    expect(surfaceA11y(descriptor)).toEqual({
      surface: 'probe',
      tag: 's-probe',
      role: 'region',
      label: 'Probe',
    });
    expect(surfaceDoc(descriptor)).toEqual({
      id: 'probe',
      title: 'Probe',
      tag: 's-probe',
      group: 'Test',
      bindings: ['tick'],
    });
  });

  it('batch-generates every artifact set from the registry', () => {
    registerSurface(descriptor);
    const { stories, cells, a11y, docs } = generateSurfaces();
    expect(stories.some((story) => story.title === 'Test/Probe')).toBe(true);
    expect(cells.some((cell) => cell.id === 'probe')).toBe(true);
    expect(a11y.some((target) => target.surface === 'probe')).toBe(true);
    expect(docs.some((doc) => doc.id === 'probe')).toBe(true);
  });
});