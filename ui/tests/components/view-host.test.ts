import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/client/components/views/index.js';
import { $viewSelection } from '../../src/client/core/store.js';
import { ViewHost } from '../../src/client/core/view-host.js';
import { surfaceFor } from '../../src/client/core/surface-registry.js';
import type {
  SeriesDataset,
  TableDataset,
  ViewDataset,
  ViewSpec,
} from '../../src/client/core/view-spec.js';

const series: SeriesDataset = {
  kind: 'series',
  series: [{ id: 'hz', label: 'Hz', values: [1, 2, 3] }],
};

const table: TableDataset = {
  kind: 'table',
  columns: [{ id: 'term', label: 'Term' }],
  rows: [
    { id: 'r0', term: 'cat' },
    { id: 'r1', term: 'dog' },
  ],
};

function source(data: ViewDataset) {
  let value = data;
  const subscribers = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (fn: () => void) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    set: (next: ViewDataset) => {
      value = next;
      for (const fn of subscribers) fn();
    },
  };
}

describe('view host', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    $viewSelection.set({ nodes: new Set(), edges: new Set() });
  });

  afterEach(() => container.remove());

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  it('registers as a surface with the view tag', () => {
    expect(surfaceFor('view')?.id).toBe('view');
    expect(customElements.get('s-view')).toBe(ViewHost);
  });

  const mount = async (spec: ViewSpec): Promise<ViewHost> => {
    const el = document.createElement('s-view') as ViewHost;
    container.appendChild(el);
    await el.updateComplete;
    el.spec = spec;
    await el.updateComplete;
    await tick();
    await el.updateComplete;
    return el;
  };

  it('mounts the adapter for the default shape', async () => {
    const el = await mount({ id: 't', title: 'Test', shapes: ['series', 'table'], source: source(series) });
    expect(el.shadowRoot?.querySelector('s-series')).toBeTruthy();
  });

  it('switches shape through the chrome switcher', async () => {
    const el = await mount({ id: 't', title: 'Test', shapes: ['series', 'table'], source: source(series) });
    const button = [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>('.shape-btn') ?? [])].find(
      (btn) => btn.textContent?.trim() === 'table'
    );
    button?.click();
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('s-table')).toBeTruthy();
  });

  it('renders the empty slot when the dataset is empty', async () => {
    const el = await mount({
      id: 't',
      title: 'Test',
      shapes: ['series'],
      source: source({ kind: 'series', series: [] }),
    });
    expect(el.shadowRoot?.querySelector('.slot')?.getAttribute('role')).toBe('status');
  });

  it('stores an adapter row selection in the shared selection atom', async () => {
    const el = await mount({ id: 't', title: 'Test', shapes: ['table'], source: source(table) });
    const adapter = el.shadowRoot?.querySelector('s-table');
    const row = adapter?.shadowRoot?.querySelector('tbody tr') as HTMLElement | undefined;
    row?.click();
    expect($viewSelection.get().focus).toBe('r0');
  });

  it('re-renders when the source notifies', async () => {
    const src = source({ kind: 'series', series: [] });
    const el = await mount({ id: 't', title: 'Test', shapes: ['series'], source: src });
    expect(el.shadowRoot?.querySelector('.slot')).toBeTruthy();
    src.set(series);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('s-series')).toBeTruthy();
  });
});