/**
 * The parameter space of the UI.
 *
 * A "view" is a widget (a surface tag). An "app" is a *composition*: an ordered
 * selection of widgets placed by a layout template, under global controls
 * (graph mode/shape, lens, layer). Every point in this space is addressable by
 * URL, so a composition is a shareable page — and the catalogue presets are just
 * named points in it. New widgets/layouts are data, not code.
 */
import type { Variant } from './variants.js';

export interface Widget {
  readonly id: string;
  readonly label: string;
  readonly tag: string;
  readonly group: 'projection' | 'chrome' | 'view';
}

export const WIDGETS: readonly Widget[] = [
  { id: 'chat', label: 'Chat', tag: 'ask-surface', group: 'projection' },
  { id: 'graph', label: 'Graph', tag: 'graph-surface', group: 'projection' },
  { id: 'notebook', label: 'Notebook', tag: 'notebook-surface', group: 'projection' },
  { id: 'console', label: 'Console', tag: 'console-surface', group: 'projection' },
  { id: 'goals', label: 'Goals', tag: 'goals-surface', group: 'projection' },
  { id: 'explore', label: 'Explore', tag: 'explore-surface', group: 'projection' },
  { id: 'hud', label: 'HUD', tag: 'hud-surface', group: 'projection' },
  { id: 'inspector', label: 'Inspector', tag: 'node-detail-drawer', group: 'chrome' },
  { id: 'metrics', label: 'Metrics', tag: 'cognitive-metrics', group: 'chrome' },
  { id: 'telemetry', label: 'Telemetry', tag: 'telemetry-panel', group: 'chrome' },
  { id: 'history', label: 'History', tag: 'chat-history-panel', group: 'chrome' },
  { id: 'timeline', label: 'Timeline', tag: 'timeline-scrubber', group: 'chrome' },
  { id: 'toolbar', label: 'Graph toolbar', tag: 'graph-toolbar', group: 'chrome' },
  { id: 'minimap', label: 'Minimap', tag: 'graph-minimap', group: 'chrome' },
  { id: 'legend', label: 'Legend', tag: 'graph-legend', group: 'chrome' },
  { id: 'lenses', label: 'Lenses', tag: 'lens-controller', group: 'chrome' },
  { id: 'designer', label: 'Lens designer', tag: 'lens-designer', group: 'chrome' },
  { id: 'config', label: 'Config', tag: 'config-hud', group: 'chrome' },
  { id: 'toc', label: 'Outline', tag: 's-toc', group: 'view' },
  { id: 'events', label: 'Events', tag: 's-events', group: 'view' },
  { id: 'nodes', label: 'Nodes', tag: 's-nodes', group: 'view' },
  { id: 'related', label: 'Related', tag: 's-related', group: 'view' },
  { id: 'explain', label: 'Explain', tag: 's-explain', group: 'view' },
];

export const widgetById = (id: string): Widget | undefined => WIDGETS.find((w) => w.id === id);

export type LayoutId = 'auto' | 'h' | 'v' | 'grid' | 'hero' | 'rail';
export const LAYOUTS: readonly { id: LayoutId; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'h', label: 'Columns' },
  { id: 'v', label: 'Rows' },
  { id: 'grid', label: 'Grid' },
  { id: 'hero', label: 'Hero + rail' },
  { id: 'rail', label: 'Rail + hero' },
];

export const LENSES = ['belief', 'goal', 'contradiction', 'temporal'] as const;
export const LAYERS = ['both', 'conversation', 'concepts'] as const;
export const MODES = ['2d', '3d'] as const;
export const SHAPES = ['graph', 'table'] as const;
export const FIT_OPTIONS = ['legible', 'fit'] as const;

export interface Spec {
  layout: LayoutId;
  widgets: string[];
  mode: '2d' | '3d';
  shape: 'graph' | 'table';
  lens: string;
  layer: string;
  fit: 'legible' | 'fit';
}

export const DEFAULT_SPEC: Spec = {
  layout: 'auto',
  widgets: ['chat', 'graph'],
  mode: '2d',
  shape: 'graph',
  lens: 'belief',
  layer: 'both',
  fit: 'legible',
};

const AREA = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const rep = (unit: string, n: number): string => Array.from({ length: n }, () => unit).join(' ');
const quote = (cells: readonly string[]): string => `"${cells.join(' ')}"`;

interface Template {
  columns: string;
  rows: string;
  areas: string;
}

export function layoutTemplate(layout: LayoutId, n: number): Template {
  if (n <= 1) return { columns: '1fr', rows: '1fr', areas: '"a"' };
  const ids = AREA.slice(0, n);
  if (layout === 'h') return { columns: rep('minmax(0, 1fr)', n), rows: '1fr', areas: quote(ids) };
  if (layout === 'v')
    return { columns: '1fr', rows: rep('minmax(0, 1fr)', n), areas: ids.map((x) => `"${x}"`).join(' ') };
  if (layout === 'hero' || layout === 'rail') {
    const mainCol = layout === 'hero' ? 0 : 1;
    const matrix = ids.slice(1).map((id) => {
      const row = ['', ''];
      row[mainCol] = 'a';
      row[1 - mainCol] = id;
      return row.join(' ');
    });
    return { columns: rep('minmax(0, 1fr)', 2), rows: rep('minmax(0, 1fr)', matrix.length), areas: matrix.map((r) => `"${r}"`).join(' ') };
  }
  const cols = layout === 'grid' ? Math.ceil(Math.sqrt(n)) : n <= 3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const matrix: string[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) cells.push(ids[r * cols + c] ?? ids[n - 1]!);
    matrix.push(quote(cells));
  }
  return { columns: rep('minmax(0, 1fr)', cols), rows: rep('minmax(0, 1fr)', rows), areas: matrix.join(' ') };
}

export function specToVariant(spec: Spec): Variant {
  const widgets = spec.widgets.map(widgetById).filter((w): w is Widget => !!w);
  const t = layoutTemplate(spec.layout, Math.max(widgets.length, 1));
  const regions: Record<string, readonly string[]> = {};
  widgets.forEach((w, i) => {
    const area = AREA[i] ?? 'a';
    regions[area] = [w.tag];
  });
  const name = widgets.length ? widgets.map((w) => w.label).join(' · ') : 'Empty';
  return {
    id: 'compose',
    name,
    blurb: `${spec.layout} · ${spec.mode} · ${spec.shape} · ${spec.lens} · ${spec.layer}`,
    columns: t.columns,
    rows: t.rows,
    areas: t.areas,
    regions,
    mode: spec.mode,
    shape: spec.shape,
  };
}

export function parseSpec(params: URLSearchParams): Spec {
  const csv = (key: string): string[] | undefined => {
    const value = params.get(key);
    return value ? value.split(',').filter(Boolean) : undefined;
  };
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  return {
    layout: pick(params.get('layout'), LAYOUTS.map((l) => l.id), DEFAULT_SPEC.layout),
    widgets: csv('w') ?? DEFAULT_SPEC.widgets,
    mode: pick(params.get('mode'), MODES, DEFAULT_SPEC.mode),
    shape: pick(params.get('shape'), SHAPES, DEFAULT_SPEC.shape),
    lens: pick(params.get('lens'), LENSES, DEFAULT_SPEC.lens),
    layer: pick(params.get('layer'), LAYERS, DEFAULT_SPEC.layer),
    fit: pick(params.get('fit'), FIT_OPTIONS, DEFAULT_SPEC.fit),
  };
}

export function specToSearch(spec: Spec): string {
  const params = new URLSearchParams();
  params.set('compose', '1');
  params.set('layout', spec.layout);
  params.set('w', spec.widgets.join(','));
  params.set('mode', spec.mode);
  params.set('shape', spec.shape);
  params.set('lens', spec.lens);
  params.set('layer', spec.layer);
  params.set('fit', spec.fit);
  return `?${params.toString()}`;
}

export function randomSpec(): Spec {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
  const n = 1 + Math.floor(Math.random() * 4);
  const pool = [...WIDGETS];
  const widgets: string[] = [];
  while (widgets.length < n && pool.length) {
    const [w] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    if (w) widgets.push(w.id);
  }
  return {
    layout: pick(LAYOUTS).id,
    widgets,
    mode: pick(MODES),
    shape: pick(SHAPES),
    lens: pick(LENSES),
    layer: pick(LAYERS),
    fit: pick(FIT_OPTIONS),
  };
}
