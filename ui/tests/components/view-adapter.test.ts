import { describe, expect, it } from 'vitest';
import '../../src/client/components/views/index.js';
import {
  adaptersFor,
  capabilitiesFor,
  supportedShapes,
  viewAdapterFor,
  viewAdapters,
} from '../../src/client/core/view-adapter.js';

describe('view adapter registry', () => {
  it('registers one adapter per shape with its element tag', () => {
    expect(viewAdapterFor('series')?.tag).toBe('s-series');
    expect(viewAdapterFor('table')?.tag).toBe('s-table');
    expect(viewAdapterFor('text')?.tag).toBe('s-text');
    expect(viewAdapterFor('tree')?.tag).toBe('s-tree');
    expect(viewAdapterFor('graph')?.tag).toBe('graph-viewport');
  });

  it('selects the compact variant for the embedded budget by capability', () => {
    expect(viewAdapterFor('series', 'embedded')?.tag).toBe('s-sparkline');
    expect(viewAdapterFor('table', 'embedded')?.tag).toBe('s-table-mini');
    expect(viewAdapterFor('series', 'full')?.tag).toBe('s-series');
    expect(viewAdapterFor('table', 'full')?.tag).toBe('s-table');
    expect(adaptersFor('series').map((a) => a.tag)).toEqual(['s-series', 's-sparkline']);
  });

  it('unions a shape’s capabilities across its variants', () => {
    const caps = capabilitiesFor('graph');
    expect(caps?.interactions).toContain('zoom');
    expect(caps?.budgets).toEqual(['full', 'embedded']);
    expect(capabilitiesFor('series')?.budgets).toEqual(['full', 'embedded']);
  });

  it('lists the shapes a budget supports', () => {
    expect(supportedShapes()).toEqual(
      expect.arrayContaining(['graph', 'series', 'table', 'tree', 'text'])
    );
    expect(supportedShapes('embedded')).toEqual(
      expect.arrayContaining(['graph', 'series', 'table', 'tree', 'text'])
    );
    expect(viewAdapters()).toHaveLength(7);
  });

  it('returns undefined for an unregistered shape', () => {
    expect(viewAdapterFor('nope' as never)).toBeUndefined();
    expect(capabilitiesFor('nope' as never)).toBeUndefined();
  });
});