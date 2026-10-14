/**
 * Composition framework: the data model, the pure layout engine, and the
 * URL ⇄ composition ⇄ atoms sync. These are the keystone the shell, the Studio
 * and the Lab all build on, so they are tested as pure data transformations.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cellSurface,
  compositionFor,
  getCompositions,
  registerComposition,
  resetCompositions,
  type Composition,
} from '../../src/client/framework/composition.js';
import { areaName, layoutOf, layoutTemplate } from '../../src/client/framework/layout.js';
import {
  applyGlobals,
  compositionFromUrl,
  compositionToSearch,
  resolveGlobals,
} from '../../src/client/apps/shared/config-sync.js';
import {
  $activeLens,
  $graphFilter,
  $graphFit,
  $graphLayer,
  $graphShape,
  $viewportMode,
} from '../../src/client/kernel/index.js';

const composition = (over: Partial<Composition> = {}): Composition => ({
  id: 'test',
  name: 'Test',
  layout: 'h',
  cells: [{ surface: 'a-surface' }, { surface: 'b-surface' }],
  ...over,
});

const trackCount = (tracks: string): number => (tracks.match(/minmax\(/g) ?? []).length;
const areaNames = (areas: string): Set<string> =>
  new Set(areas.match(/[a-z]+/g)?.flatMap((t) => t.split('')) ?? []);

describe('composition registry', () => {
  beforeEach(resetCompositions);

  it('registers, resolves and lists compositions by id', () => {
    const c = composition({ id: 'chat-graph' });
    registerComposition(c);
    expect(compositionFor('chat-graph')).toBe(c);
    expect(getCompositions()).toEqual([c]);
    expect(compositionFor('missing')).toBeUndefined();
  });

  it('reads a cell surface without unwrapping nested compositions', () => {
    expect(cellSurface({ surface: 'graph-surface' })).toBe('graph-surface');
    expect(cellSurface({ composition: composition() })).toBeUndefined();
  });
});

describe('layoutOf', () => {
  it('collapses a single cell to one area regardless of layout', () => {
    for (const layout of ['auto', 'h', 'grid', 'hero'] as const) {
      expect(layoutOf(composition({ layout, cells: [{ surface: 'x' }] }))).toEqual({
        columns: '1fr',
        rows: '1fr',
        areas: '"a"',
      });
    }
  });

  it('lays columns and rows along one axis', () => {
    const cols = layoutOf(composition({ layout: 'h', cells: Array(3).fill({ surface: 'x' }) }));
    expect(trackCount(cols.columns)).toBe(3);
    expect(cols.rows).toBe('1fr');
    const rows = layoutOf(composition({ layout: 'v', cells: Array(3).fill({ surface: 'x' }) }));
    expect(trackCount(rows.rows)).toBe(3);
  });

  it('names exactly one area per cell, in order', () => {
    const c = composition({ layout: 'grid', cells: Array(5).fill({ surface: 'x' }) });
    expect(areaNames(layoutOf(c).areas).size).toBe(5);
    expect(areaName(0)).toBe('a');
    expect(areaName(4)).toBe('e');
  });

  it('generalises the Lab template (single source of grid math)', () => {
    expect(layoutTemplate('h', 2)).toEqual(layoutOf(composition({ layout: 'h' })));
  });
});

describe('config sync', () => {
  beforeEach(resetCompositions);

  it('validates globals, falling back for unknown or missing values', () => {
    const resolved = resolveGlobals(new URLSearchParams('mode=4d&shape=bogus&lens=temporal'));
    expect(resolved.mode).toBe('2d');
    expect(resolved.shape).toBe('graph');
    expect(resolved.lens).toBe('temporal');
  });

  it('resolves a preset and applies explicit URL overrides', () => {
    registerComposition(composition({ id: 'chat-graph' }));
    const resolved = compositionFromUrl(new URLSearchParams('preset=chat-graph&layout=v&mode=3d'));
    expect(resolved?.id).toBe('chat-graph');
    expect(resolved?.layout).toBe('v');
    expect(resolved?.globals?.mode).toBe('3d');
  });

  it('falls back to the supplied composition when the preset is unknown', () => {
    const fallback = composition({ id: 'fallback' });
    expect(compositionFromUrl(new URLSearchParams('preset=nope'), fallback)?.id).toBe('fallback');
  });

  it('round-trips a composition through the search string', () => {
    const c = composition({
      id: 'chat-graph',
      layout: 'grid',
      globals: { lens: 'temporal', layer: 'concepts', shape: 'table', mode: '3d', fit: 'fit', filter: 'all' },
    });
    registerComposition(c);
    const round = compositionFromUrl(new URLSearchParams(compositionToSearch(c).slice(1)), c);
    expect(round).toEqual(c);
  });

  it('applies globals to the atoms surfaces watch', () => {
    applyGlobals({ lens: 'goal', layer: 'concepts', shape: 'table', mode: '3d', fit: 'fit', filter: 'all' });
    expect($activeLens.get()).toBe('goal');
    expect($graphLayer.get()).toBe('concepts');
    expect($graphShape.get()).toBe('table');
    expect($viewportMode.get()).toBe('3d');
    expect($graphFit.get()).toBe('fit');
    expect($graphFilter.get()).toBeNull();
  });
});
