import { afterEach, describe, expect, it } from 'vitest';
import { $activeRenderer, $urlState, $workspaceGraph, hydrateFromUrl } from '../../src/client/core/store.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';

const clearHash = () => window.history.replaceState(null, '', window.location.pathname);

afterEach(() => {
  clearHash();
  $activeRenderer.set('graph');
  $workspaceGraph.set(emptyWorkspaceGraph());
  $urlState.set({ lens: 'belief' });
});

describe('url-addressable state', () => {
  it('hydrates the active renderer and focus from the hash', () => {
    window.location.hash = 'renderer=notebook&focus=blk1';
    hydrateFromUrl();
    expect($activeRenderer.get()).toBe('notebook');
    expect($workspaceGraph.get().focus).toBe('blk1');
  });

  it('mirrors renderer and focus changes into the url state', () => {
    $activeRenderer.set('graph');
    $workspaceGraph.set({ ...$workspaceGraph.get(), focus: 'blk2' });
    expect($urlState.get()).toEqual(expect.objectContaining({ renderer: 'graph', focus: 'blk2' }));
  });
});
