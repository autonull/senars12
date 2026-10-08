import { describe, expect, it } from 'vitest';
import '../../src/client/components/views/index.js';
import {
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

  it('resolves by shape and budget', () => {
    expect(viewAdapterFor('series', 'embedded')).toEqual(viewAdapterFor('series', 'full'));
    expect(viewAdapterFor('series', 'full')).toBeDefined();
  });

  it('reports capabilities from the adapter', () => {
    const caps = capabilitiesFor('graph');
    expect(caps?.interactions).toContain('zoom');
    expect(caps?.budgets).toEqual(['full', 'embedded']);
  });

  it('lists the shapes a budget supports', () => {
    expect(supportedShapes()).toEqual(
      expect.arrayContaining(['graph', 'series', 'table', 'tree', 'text'])
    );
    expect(viewAdapters()).toHaveLength(5);
  });

  it('returns undefined for an unregistered shape', () => {
    expect(viewAdapterFor('nope' as never)).toBeUndefined();
    expect(capabilitiesFor('nope' as never)).toBeUndefined();
  });
});