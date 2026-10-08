import { afterEach, describe, expect, it } from 'vitest';
import { GRAPH_LAYERS, layerVisible } from '../../src/client/core/graph-layer.js';
import { $graphLayer, setGraphLayer } from '../../src/client/core/store.js';

afterEach(() => $graphLayer.set('both'));

describe('graph layer', () => {
  it('shows both layers under "both"', () => {
    expect(GRAPH_LAYERS).toEqual(['both', 'conversation', 'concepts']);
    expect(layerVisible(true, 'both')).toBe(true);
    expect(layerVisible(false, 'both')).toBe(true);
  });

  it('isolates the conversation', () => {
    expect(layerVisible(true, 'conversation')).toBe(true);
    expect(layerVisible(false, 'conversation')).toBe(false);
  });

  it('isolates the concepts', () => {
    expect(layerVisible(true, 'concepts')).toBe(false);
    expect(layerVisible(false, 'concepts')).toBe(true);
  });

  it('defaults to both and is settable', () => {
    expect($graphLayer.get()).toBe('both');
    setGraphLayer('conversation');
    expect($graphLayer.get()).toBe('conversation');
  });
});
