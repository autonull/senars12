import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEC,
  LAYERS,
  LAYOUTS,
  LENSES,
  MODES,
  SHAPES,
  layoutTemplate,
  parseSpec,
  randomSpec,
  specToSearch,
  specToVariant,
  WIDGETS,
  widgetById,
  type LayoutId,
  type Spec,
} from '../../src/client/apps/lab/compose.js';

const AREA_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const areaNames = (areas: string): Set<string> =>
  new Set(areas.match(/[a-z]+/g)?.flatMap((token) => token.split('')) ?? []);
/** Grid tracks are `minmax(0, 1fr)` (spaces inside), so count tracks, not tokens. */
const trackCount = (tracks: string): number => (tracks.match(/minmax\(/g) ?? []).length;

const spec = (over: Partial<Spec> = {}): Spec => ({ ...DEFAULT_SPEC, ...over });

describe('lab layout templates', () => {
  it('collapses a single-pane layout to one area', () => {
    for (const layout of LAYOUTS.map((l) => l.id)) {
      expect(layoutTemplate(layout, 1)).toEqual({ columns: '1fr', rows: '1fr', areas: '"a"' });
    }
  });

  it('lays columns and rows out along one axis', () => {
    const cols = layoutTemplate('h', 3);
    expect(trackCount(cols.columns)).toBe(3);
    expect(cols.rows).toBe('1fr');
    const rows = layoutTemplate('v', 3);
    expect(trackCount(rows.rows)).toBe(3);
    expect(rows.columns).toBe('1fr');
  });

  it('pins exactly one main column for hero and rail', () => {
    for (const layout of ['hero', 'rail'] as const) {
      const t = layoutTemplate(layout, 3);
      expect(trackCount(t.columns)).toBe(2);
      // The hero (area `a`) repeats down its column; the rail stacks the rest.
      const main = t.areas.match(/"?a"?/g) ?? [];
      expect(main.length).toBeGreaterThan(1);
    }
  });

  it('makes a dense grid whose areas cover every widget slot', () => {
    for (const n of [2, 4, 5, 9]) {
      const t = layoutTemplate('grid', n);
      expect(trackCount(t.columns)).toBe(Math.ceil(Math.sqrt(n)));
      expect(areaNames(t.areas).size).toBe(n);
    }
  });

  it('always names one area per widget, never fewer', () => {
    for (const layout of LAYOUTS.map((l) => l.id)) {
      for (const n of [1, 2, 3, 5, 9]) {
        const t = layoutTemplate(layout, n);
        expect(t.areas.length).toBeGreaterThan(0);
        expect(t.columns.length).toBeGreaterThan(0);
        expect(t.rows.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('spec → variant', () => {
  it('places each widget tag in its own area, in order', () => {
    const s = spec({ widgets: ['chat', 'graph', 'notebook'] });
    const variant = specToVariant(s);
    expect(Object.keys(variant.regions)).toEqual(AREA_LETTERS.slice(0, 3));
    s.widgets.forEach((id, i) => {
      const w = widgetById(id)!;
      expect(variant.regions[AREA_LETTERS[i]!]).toEqual([w.tag]);
    });
    // The grid template names exactly the areas the regions fill.
    expect(areaNames(variant.areas)).toEqual(new Set(Object.keys(variant.regions)));
  });

  it('carries the global controls and names the composition', () => {
    const variant = specToVariant(spec({ mode: '3d', shape: 'table' }));
    expect(variant.mode).toBe('3d');
    expect(variant.shape).toBe('table');
    expect(variant.name).toBe('Chat · Graph');
    expect(variant.id).toBe('compose');
  });

  it('drops unknown widget ids and yields an empty composition', () => {
    const variant = specToVariant(spec({ widgets: ['nope', 'graph'] }));
    expect(Object.keys(variant.regions)).toEqual(['a']);
    expect(specToVariant(spec({ widgets: [] })).name).toBe('Empty');
  });
});

describe('spec ⇄ URL', () => {
  it('round-trips a full spec through the search string', () => {
    const original = spec({ layout: 'grid', widgets: ['graph', 'goals', 'toc'], mode: '3d', shape: 'table', lens: 'temporal', layer: 'concepts' });
    const params = new URLSearchParams(specToSearch(original).slice(1));
    expect(params.get('compose')).toBe('1');
    expect(parseSpec(params)).toEqual(original);
  });

  it('falls back to defaults for unknown or missing dimensions', () => {
    const parsed = parseSpec(new URLSearchParams('layout=bogus&mode=4d&lens=nope'));
    expect(parsed.layout).toBe(DEFAULT_SPEC.layout);
    expect(parsed.mode).toBe(DEFAULT_SPEC.mode);
    expect(parsed.lens).toBe(DEFAULT_SPEC.lens);
    expect(parsed.widgets).toEqual(DEFAULT_SPEC.widgets);
  });
});

describe('random sampling', () => {
  it('always samples a point inside the space', () => {
    const layoutIds = LAYOUTS.map((l) => l.id);
    const widgetIds = new Set(WIDGETS.map((w) => w.id));
    for (let i = 0; i < 200; i++) {
      const s = randomSpec();
      expect(layoutIds).toContain(s.layout);
      expect(MODES).toContain(s.mode);
      expect(SHAPES).toContain(s.shape);
      expect(LENSES).toContain(s.lens);
      expect(LAYERS).toContain(s.layer);
      expect(s.widgets.length).toBeGreaterThanOrEqual(1);
      expect(s.widgets.length).toBeLessThanOrEqual(4);
      expect(new Set(s.widgets).size).toBe(s.widgets.length);
      for (const id of s.widgets) expect(widgetIds.has(id)).toBe(true);
      // Every sample is addressable and reloads to itself.
      const round = parseSpec(new URLSearchParams(specToSearch(s).slice(1)));
      expect(round).toEqual(s);
    }
  });

  it('names every layout and lens exactly once', () => {
    expect(new Set(LAYOUTS.map((l: { id: LayoutId }) => l.id)).size).toBe(LAYOUTS.length);
    expect(new Set(LENSES).size).toBe(LENSES.length);
  });
});
